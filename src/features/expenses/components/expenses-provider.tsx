'use client';

import * as React from 'react';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { useCan } from '@/features/auth/hooks/use-can';
import { useExpensesStore } from '../data/store';
import { computeLedger, type Ledger } from '../domain/ledger';
import { currencySpec, formatMoney, type CurrencySpec, type Minor } from '../domain/money';
import { ORG } from '../domain/types';
import type { ExpensesData, Participant, PartyId } from '../domain/types';
import { EXP } from '../constants/permissions';
import type { LocalListField } from '@/components/ui/local-list';

export const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Loads the active company's expenses data and participants from the server
 * (again when the company changes). Participants are refreshed whenever the
 * app opens or the tab regains focus. The signed-in user is the actor.
 */
export function ExpensesProvider({ children }: { children: React.ReactNode }) {
  const companyId = useAuthStore((s) => s.activeCompanyId);
  const init = useExpensesStore((s) => s.init);

  React.useEffect(() => {
    if (!companyId) return;
    void init(companyId);
    // Back to the tab (a user or contact added elsewhere): refresh the people.
    const onFocus = () => void init(companyId);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [companyId, init]);

  return <>{children}</>;
}

/** The data, or null while loading. */
export function useExpensesData(): ExpensesData | null {
  return useExpensesStore((s) => s.data);
}

export function useCurrency(): CurrencySpec & { format: (minor: Minor) => string } {
  const code = useExpensesStore((s) => s.currency);
  return React.useMemo(() => {
    const spec = currencySpec(code);
    return { ...spec, format: (minor: Minor) => formatMoney(minor, spec) };
  }, [code]);
}

export function useLedger(): Ledger | null {
  const data = useExpensesData();
  const currency = useExpensesStore((s) => s.currency);
  return React.useMemo(() => (data ? computeLedger(data, currency) : null), [data, currency]);
}

export type Directory = {
  all: Participant[];
  /** Active participants to choose from (live first, then samples). */
  choices: Participant[];
  nameOf: (id: PartyId | null | undefined) => string;
  get: (id: PartyId) => Participant | undefined;
};

export function useDirectory(): Directory {
  const live = useExpensesStore((s) => s.liveParticipants);
  const data = useExpensesData();
  return React.useMemo(() => {
    const all = [...live, ...(data?.demoParticipants ?? [])];
    const byId = new Map(all.map((p) => [p.id, p]));
    return {
      all,
      choices: all.filter((p) => p.active),
      get: (id) => byId.get(id),
      nameOf: (id) => (id === ORG ? 'المنشأة' : id ? (byId.get(id)?.name ?? (id === 'auto' ? 'اعتماد تلقائي' : 'غير معروف')) : '—'),
    };
  }, [live, data?.demoParticipants]);
}

/** Real ERP permissions (exp.*) of the signed-in user — not the simulated actor. */
export function useExpensesPermissions() {
  const can = useCan();
  return React.useMemo(
    () => ({
      create: can(EXP.expensesCreate),
      approve: can(EXP.expensesApprove),
      void: can(EXP.expensesVoid),
      custody: can(EXP.custodyManage),
      settle: can(EXP.settlementsCreate),
      reports: can(EXP.reportsRead),
      setup: can(EXP.setupManage),
      periods: can(EXP.periodsManage),
      settings: can(EXP.settingsUpdate),
    }),
    [can],
  );
}

/** The company's own records (no branch), as the screens name them. */
export const COMPANY_BRANCH_LABEL = 'الشركة (المركز)';
/** A group or cost center without a branch. */
export const SHARED_BRANCH_LABEL = 'كل الفروع';

export type BranchChoices = {
  /** Where this person may file a record: '' is the company itself (head office). */
  options: Array<{ value: string; label: string }>;
  /** Where a group or cost center may belong: '' is every branch. */
  referenceOptions: Array<{ value: string; label: string }>;
  /** More than one choice: the form shows the field (else it is filled alone). */
  show: boolean;
  /** This person sees branches: lists get the branch filter, column and grouping. */
  hasBranches: boolean;
  /** The active branch when allowed, else the first choice. */
  defaultValue: string;
  /** A record's branch, by name. */
  nameOf: (id: string | null | undefined) => string;
  /** A group's or cost center's branch, by name. */
  referenceName: (id: string | null | undefined) => string;
};

/**
 * The branches of the signed-in user in expenses, as the server sent them
 * (decisions.md §29). The server decides; this only fills the forms.
 */
export function useBranches(): BranchChoices {
  const branches = useExpensesStore((s) => s.branches);
  const access = useExpensesStore((s) => s.branchAccess);
  const active = useAuthStore((s) => s.activeBranchId);
  return React.useMemo(() => {
    const byId = new Map(branches.map((b) => [b.id, b.name]));
    const named = branches.map((b) => ({ value: b.id, label: b.name }));
    const options = [...(access.companyLevel ? [{ value: '', label: COMPANY_BRANCH_LABEL }] : []), ...named];
    const referenceOptions = [...(access.companyLevel ? [{ value: '', label: SHARED_BRANCH_LABEL }] : []), ...named];
    const defaultValue = active && byId.has(active) ? active : (options[0]?.value ?? '');
    return {
      options,
      referenceOptions,
      show: options.length > 1,
      hasBranches: branches.length > 0,
      defaultValue,
      nameOf: (id) => (id ? (byId.get(id) ?? 'فرع آخر') : COMPANY_BRANCH_LABEL),
      referenceName: (id) => (id ? (byId.get(id) ?? 'فرع آخر') : SHARED_BRANCH_LABEL),
    };
  }, [branches, access, active]);
}

/**
 * The «الفرع» column of a records list: a column, a sort and a grouping, in
 * the export too (decisions.md §29). None when this person sees no branches.
 */
export function branchListFields<T>(
  branches: BranchChoices,
  branchOf: (row: T) => string | null | undefined,
): LocalListField<T>[] {
  if (!branches.hasBranches) return [];
  return [
    {
      key: 'branch',
      label: 'الفرع',
      optional: true,
      text: (row) => branches.nameOf(branchOf(row)),
      groupKey: (row) => branchOf(row) ?? '',
      groupLabel: (key) => branches.nameOf(key || null),
    },
  ];
}
