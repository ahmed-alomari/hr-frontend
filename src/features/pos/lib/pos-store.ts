'use client';

import * as React from 'react';
import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/shared/api/client';
import {
  DEFAULT_POS_SETTINGS,
  type PosAuditEvent,
  type PosCashMovement,
  type PosCollection,
  type PosCustomer,
  type PosDevice,
  type PosDiscount,
  type PosHeldCart,
  type PosMenuCategory,
  type PosMoneyMethod,
  type PosPayment,
  type PosRegister,
  type PosReturn,
  type PosSale,
  type PosSaleLine,
  type PosSaleTotals,
  type PosSession,
  type PosSettings,
  type PosStockMode,
} from '@/features/pos/domain/types';

/**
 * Point of sale data, on the server (since 2026-10-10): every device of the
 * company sees the same settings, registers, shifts and sales.
 *
 * - Reading: GET /pos/data for what the screen needs (`days` of history; the
 *   register needs none), then only what changed, every 30 s.
 * - Actions: POST /pos/commands — the server runs the POS rules under a lock
 *   and answers with what changed. Actions of a company are sent one after
 *   the other (a payment never reaches the server before its sale), and the
 *   ids of new records are made here, so a retried action has one effect.
 * - A refused action (rule or permission) rejects with the server's Arabic
 *   reason (PosRuleError); usePosContext shows it.
 */

export type PosCompanyData = {
  settings: PosSettings;
  registers: PosRegister[];
  devices: PosDevice[];
  sessions: PosSession[];
  sales: PosSale[];
  returns: PosReturn[];
  cashMovements: PosCashMovement[];
  /** Collections of credit invoices (recent ones, and the open shifts'). */
  collections: PosCollection[];
  heldCarts: PosHeldCart[];
  menuCategories: PosMenuCategory[];
  audit: PosAuditEvent[];
  returnSequence: number;
  /** From the server: pass as `since` to read only what changed after it. */
  syncedAt?: string;
  /** The lists hold only what changed. */
  changedOnly?: boolean;
};

export const EMPTY_POS_DATA: PosCompanyData = {
  settings: DEFAULT_POS_SETTINGS,
  registers: [],
  devices: [],
  sessions: [],
  sales: [],
  returns: [],
  cashMovements: [],
  collections: [],
  heldCarts: [],
  menuCategories: [],
  audit: [],
  returnSequence: 1,
};

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.floor(Math.random() * 256) & (15 >> (Number(c) / 4)))).toString(16),
      );

export const posDataQueryKey = (companyId: string | null | undefined) => ['pos', 'data', companyId ?? ''];

/** How much history each screen reads: the default for those listing documents. */
export const POS_HISTORY_DAYS = 90;

/** Days of history, or a period the screen chose (any age). */
export type PosDataScopeValue = number | { from: string; to: string };

const scopeKey = (scope: PosDataScopeValue) => (typeof scope === 'number' ? [scope] : ['range', scope.from, scope.to]);

const scopeQuery = (scope: PosDataScopeValue) =>
  typeof scope === 'number' ? { days: scope } : scope.from && scope.to ? { from: scope.from, to: scope.to } : { days: POS_HISTORY_DAYS };

const mergeById = <T extends { id: string }>(current: T[], changed: T[], place: 'first' | 'last'): T[] => {
  if (changed.length === 0) return current;
  const incoming = new Map(changed.map((row) => [row.id, row]));
  const kept = current.map((row) => incoming.get(row.id) ?? row);
  const known = new Set(current.map((row) => row.id));
  const added = changed.filter((row) => !known.has(row.id));
  return place === 'first' ? [...added, ...kept] : [...kept, ...added];
};

/** What the server says changed, over what this screen holds. Records are never removed. */
export function mergePosChanges(current: PosCompanyData | undefined, changes: PosCompanyData): PosCompanyData {
  if (!current) return { ...changes, changedOnly: undefined };
  return {
    ...changes,
    changedOnly: undefined,
    sessions: mergeById(current.sessions, changes.sessions, 'last'),
    sales: mergeById(current.sales, changes.sales, 'first'),
    returns: mergeById(current.returns, changes.returns, 'first'),
    cashMovements: mergeById(current.cashMovements, changes.cashMovements, 'last'),
    collections: mergeById(current.collections ?? [], changes.collections ?? [], 'last'),
  };
}

function withDefaults(data: Partial<PosCompanyData> | undefined | null): PosCompanyData {
  if (!data) return EMPTY_POS_DATA;
  const settings = (data.settings ?? {}) as Partial<PosSettings>;
  return {
    ...EMPTY_POS_DATA,
    ...data,
    settings: {
      ...DEFAULT_POS_SETTINGS,
      ...settings,
      tax: { ...DEFAULT_POS_SETTINGS.tax, ...settings.tax },
      discounts: { ...DEFAULT_POS_SETTINGS.discounts, ...settings.discounts },
      returns: { ...DEFAULT_POS_SETTINGS.returns, ...settings.returns },
      shifts: { ...DEFAULT_POS_SETTINGS.shifts, ...settings.shifts },
      paymentMethods: { ...DEFAULT_POS_SETTINGS.paymentMethods, ...settings.paymentMethods },
    },
    menuCategories: data.menuCategories ?? [],
    collections: data.collections ?? [],
  } as PosCompanyData;
}

export function usePosData(companyId: string | null | undefined, scope: PosDataScopeValue = POS_HISTORY_DAYS): PosCompanyData {
  const queryClient = useQueryClient();
  const queryKey = [...posDataQueryKey(companyId), ...scopeKey(scope)];
  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const held = queryClient.getQueryData<PosCompanyData>(queryKey);
      const answer = await apiRequest<PosCompanyData>('/pos/data', {
        query: {
          companyId: companyId!,
          ...(held?.syncedAt ? { since: held.syncedAt } : scopeQuery(scope)),
        },
        throwOnError: true,
        silent: true,
      });
      return answer.changedOnly ? mergePosChanges(held, answer) : answer;
    },
    enabled: Boolean(companyId),
    // Changing the period keeps the list on screen until the new one arrives.
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  // Stable while the data does not change (screens copy settings into drafts
  // in effects; a new object each render would loop).
  return React.useMemo(() => withDefaults(data), [data]);
}

/** A rule (or permission) the server refused: the action did nothing; the message says why. */
export class PosRuleError extends Error {}

/** One queue per company: actions reach the server in the order they were made. */
const queues = new Map<string, Promise<unknown>>();

type CommandResponse = { changes?: PosCompanyData; data?: PosCompanyData; result: unknown };

/** Actions bound to one company; each is one server command. */
export function posActions(companyId: string, queryClient: QueryClient) {
  const run = <T = true>(command: Record<string, unknown>): Promise<T> => {
    const previous = queues.get(companyId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        try {
          const res = await apiRequest<CommandResponse>('/pos/commands', {
            method: 'POST',
            body: { companyId, command, respond: 'changes', deviceId: readPairedDevice(companyId) ?? undefined },
            throwOnError: true,
            silent: true,
          });
          // Every screen's copy of the company's data takes what changed.
          const changes = res.changes;
          if (changes) {
            queryClient.setQueriesData<PosCompanyData>({ queryKey: posDataQueryKey(companyId) }, (current) =>
              mergePosChanges(current, changes),
            );
          } else if (res.data) {
            queryClient.setQueriesData<PosCompanyData>({ queryKey: posDataQueryKey(companyId) }, res.data);
          }
          // Actions without a result resolve to true (a refused one rejects).
          return (res.result ?? true) as T;
        } catch (error) {
          // ApiError is not an Error: read its message (the server's Arabic reason).
          const raw = (error as { message?: unknown } | null)?.message;
          const message =
            typeof raw === 'string' && raw && !raw.startsWith('HTTP ') ? raw : 'تعذّر تنفيذ الإجراء الآن، حاول مرة أخرى.';
          // The server's data may have moved on: read it again.
          void queryClient.invalidateQueries({ queryKey: posDataQueryKey(companyId) });
          throw new PosRuleError(message);
        }
      });
    queues.set(companyId, next);
    return next;
  };

  const read = () =>
    withDefaults(queryClient.getQueriesData<PosCompanyData>({ queryKey: posDataQueryKey(companyId) })[0]?.[1]);

  return {
    /** Settings other than the stock mode (that one goes through the drain). */
    saveSettings(settings: PosSettings) {
      return run({ type: 'saveSettings', settings });
    },

    /** Starts the drain: no new shifts from now; open ones finish in their mode. */
    requestStockModeChange(to: PosStockMode, _by?: string) {
      return run({ type: 'requestStockModeChange', to });
    },

    cancelStockModeChange(_by?: string) {
      return run({ type: 'cancelStockModeChange' });
    },

    /** Explicit choice once drained: no open shift, nothing awaiting payment or in exception. */
    confirmStockModeChange(_by?: string) {
      return run({ type: 'confirmStockModeChange' });
    },

    saveRegister(input: Omit<PosRegister, 'id' | 'createdAt' | 'nextSequence'> & { id?: string }) {
      const id = input.id ?? newId();
      return run({ type: 'saveRegister', register: { ...input, id } }).then(() => id);
    },

    pairDevice(registerId: string, label: string, _by?: string) {
      const id = newId();
      return run({ type: 'pairDevice', id, registerId, label }).then(() => id);
    },

    revokeDevice(deviceId: string, _by?: string) {
      return run({ type: 'revokeDevice', deviceId });
    },

    openSession(registerId: string, _cashierId: string, _cashierName: string, openingFloat: number, _stockMode?: PosStockMode) {
      const id = newId();
      return run({ type: 'openSession', id, registerId, openingFloat }).then(() => id);
    },

    closeSession(
      sessionId: string,
      result: {
        countedCash: number;
        expectedCash: number;
        difference: number;
        differenceReason: string | null;
        denominationCounts: Record<string, number> | null;
      },
      _by?: string,
    ) {
      return run({ type: 'closeSession', sessionId, result });
    },

    addCashMovement(sessionId: string, type: 'in' | 'out', amount: number, reason: string, _by?: string) {
      return run({ type: 'addCashMovement', id: newId(), sessionId, movementType: type, amount, reason });
    },

    holdCart(cart: Omit<PosHeldCart, 'id' | 'createdAt'>) {
      const id = newId();
      return run({ type: 'holdCart', cart: { ...cart, id } }).then(() => id);
    },

    dropHeldCart(id: string) {
      return run({ type: 'dropHeldCart', id });
    },

    voidCart(_by: string, itemCount: number, value: number) {
      return run({ type: 'voidCart', itemCount, value });
    },

    logAudit(_by: string, type: PosAuditEvent['type'], detail: string) {
      return run({ type: 'logAudit', auditType: type, detail });
    },

    /** Commit the cart: prices and snapshot fixed on the server. */
    commitSale(input: {
      registerId: string;
      sessionId: string;
      cashierName?: string;
      stockSource: PosStockMode;
      customer: PosCustomer;
      lines: PosSaleLine[];
      orderDiscount: PosDiscount | null;
      totals: PosSaleTotals;
      /** A supervisor's approval of a discount above the cashier limit. */
      discountApproval?: string | null;
    }) {
      const id = newId();
      const { cashierName: _cashier, discountApproval, ...sale } = input;
      return run({ type: 'commitSale', id, sale, discountApproval: discountApproval ?? null }).then(() => id);
    },

    addPayment(saleId: string, payment: Omit<PosPayment, 'id' | 'createdAt'>) {
      const id = newId();
      return run({ type: 'addPayment', saleId, payment: { ...payment, id } }).then(() => id);
    },

    updatePayment(saleId: string, paymentId: string, patch: Partial<PosPayment>) {
      return run({ type: 'updatePayment', saleId, paymentId, patch });
    },

    /** The customer of an open sale (a contact for a credit sale; the server reads its name). */
    setSaleCustomer(saleId: string, customer: PosCustomer) {
      return run({ type: 'setSaleCustomer', saleId, customer });
    },

    /** A payment on a credit invoice: in the open shift (into its drawer), or outside one (null). */
    collectCredit(input: {
      /** One per payment, kept across retries: a resend counts once. */
      id?: string;
      saleId: string;
      method: PosMoneyMethod;
      amount: number;
      reference: string | null;
      sessionId: string | null;
    }) {
      const id = input.id ?? newId();
      return run({ type: 'collectCredit', ...input, id }).then(() => id);
    },

    /** Paid in full: the receipt number is given by the server, from the register's sequence. */
    completeSale(saleId: string) {
      return run<string>({ type: 'completeSale', saleId });
    },

    cancelSale(saleId: string, reason: string, _by?: string) {
      return run({ type: 'cancelSale', saleId, reason });
    },

    markException(saleId: string, reason: string) {
      return run({ type: 'markException', saleId, reason });
    },

    /** Item swap after payment: the previous version is kept, never edited silently. */
    reviseSale(saleId: string, lines: PosSaleLine[], totals: PosSaleTotals, reason: string, _by?: string) {
      return run({ type: 'reviseSale', saleId, lines, totals, reason });
    },

    createReturn(input: Omit<PosReturn, 'id' | 'number' | 'createdAt'>) {
      const id = newId();
      const { createdBy: _createdBy, stockPosting: _stockPosting, ...ret } = input;
      return run<{ id: string; number: string }>({ type: 'createReturn', id, ret });
    },

    recordRefund(returnId: string, reference: string | null, _by?: string) {
      return run({ type: 'recordRefund', returnId, reference });
    },

    /** Goods received while not linked: reviewed (counted) before they are posted to inventory. */
    reviewStockPosting(returnId: string, _by?: string) {
      return run({ type: 'reviewStockPosting', returnId });
    },

    /** Linked again: what came back while unlinked goes to inventory, once. */
    postReturnStock(returnId: string) {
      return run({ type: 'postReturnStock', returnId });
    },

    setDamagedDecision(returnId: string, decision: NonNullable<PosReturn['damagedDecision']>) {
      return run({ type: 'setDamagedDecision', returnId, decision });
    },

    read,
  };
}

/** This browser's paired device, per company. */
const DEVICE_KEY = 'erp.pos.device';

/** A sale by its receipt number, whatever its age: every screen's copy takes it. */
export async function lookupSaleByNumber(companyId: string, saleNumber: string, queryClient: QueryClient): Promise<void> {
  const changes = await apiRequest<PosCompanyData>('/pos/data', {
    query: { companyId, saleNumber },
    throwOnError: true,
    silent: true,
  });
  queryClient.setQueriesData<PosCompanyData>({ queryKey: posDataQueryKey(companyId) }, (current) =>
    current ? { ...mergePosChanges(current, changes), syncedAt: current.syncedAt } : current,
  );
}

/** Company users, for the settings' supervisors and a register's assigned users. */
export function fetchPosUserChoices(companyId: string): Promise<Array<{ id: string; name: string }>> {
  return apiRequest<Array<{ id: string; name: string }>>('/pos/supervisor-candidates', {
    query: { companyId },
    throwOnError: true,
    silent: true,
  });
}

export type PosDiscountApproval = { token: string; supervisorName: string; maxPercent: number };

/** A supervisor signs for a discount above the limit, with his password. */
export async function requestDiscountApproval(
  companyId: string,
  input: { supervisorId: string; password: string; percent: number },
): Promise<PosDiscountApproval> {
  try {
    return await apiRequest<PosDiscountApproval>('/pos/discount-approvals', {
      method: 'POST',
      body: { companyId, ...input },
      throwOnError: true,
      silent: true,
    });
  } catch (error) {
    const raw = (error as { message?: unknown } | null)?.message;
    throw new PosRuleError(typeof raw === 'string' && raw && !raw.startsWith('HTTP ') ? raw : 'تعذّر طلب الموافقة، حاول مرة أخرى.');
  }
}

export function readPairedDevice(companyId: string): string | null {
  try {
    const all = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}') as Record<string, string>;
    return all[companyId] ?? null;
  } catch {
    return null;
  }
}

export function writePairedDevice(companyId: string, deviceId: string | null): void {
  try {
    const all = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}') as Record<string, string>;
    if (deviceId) all[companyId] = deviceId;
    else delete all[companyId];
    localStorage.setItem(DEVICE_KEY, JSON.stringify(all));
  } catch {
    // Storage blocked: the register still works, pairing is just not remembered.
  }
}

/**
 * Menu categories kept in this browser before they moved to the server
 * (zustand persist `erp.pos.v1`), read once to copy them up.
 */
export function readLegacyMenuCategories(companyId: string): PosMenuCategory[] {
  try {
    const stored = JSON.parse(localStorage.getItem('erp.pos.v1') ?? '{}') as {
      state?: { companies?: Record<string, { menuCategories?: PosMenuCategory[] }> };
    };
    return stored.state?.companies?.[companyId]?.menuCategories ?? [];
  } catch {
    return [];
  }
}
