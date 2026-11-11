'use client';

import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocalList, type LocalListField } from '@/components/ui/local-list';
import { branchDues, type BranchDue } from '../domain/branches';
import { minorToInput, type Minor } from '../domain/money';
import type { BranchTransfer } from '../domain/types';
import { AmountInput, BranchSelect, Field, FormDialog, Money, ReasonDialog, useRunCommand } from './common';
import { todayIso, useBranches, useCurrency, useDirectory, useExpensesData, useExpensesPermissions } from './expenses-provider';

/** A due row: who owes whom, with a stable key. */
export type BranchDueRow = BranchDue & { key: string };

/**
 * What one branch (or the company) owes another after paying from its custody
 * (decisions.md §29), filtered by one branch when chosen.
 */
export function useBranchDues(branchFilter: string) {
  const data = useExpensesData();
  const currency = useCurrency();
  const branches = useBranches();
  const perms = useExpensesPermissions();
  const [transfer, setTransfer] = React.useState<BranchDueRow | 'new' | null>(null);
  const rows = React.useMemo<BranchDueRow[]>(() => {
    if (!data) return [];
    const match = (id: string | null) => branchFilter === 'all' || (id ?? '') === branchFilter;
    return branchDues(data, currency.code)
      .filter((d) => match(d.fromBranchId) || match(d.toBranchId))
      .map((d) => ({ ...d, key: `${d.fromBranchId ?? ''}|${d.toBranchId ?? ''}` }));
  }, [data, currency.code, branchFilter]);
  const fields = React.useMemo<LocalListField<BranchDueRow>[]>(
    () => [
      {
        key: 'from',
        label: 'الجهة المدينة',
        kind: 'name',
        text: (d) => branches.nameOf(d.fromBranchId),
        groupKey: (d) => d.fromBranchId ?? '',
        groupLabel: (k) => branches.nameOf(k || null),
      },
      {
        key: 'to',
        label: 'الجهة الدائنة',
        text: (d) => branches.nameOf(d.toBranchId),
        groupKey: (d) => d.toBranchId ?? '',
        groupLabel: (k) => branches.nameOf(k || null),
      },
      {
        key: 'amount',
        label: 'المستحق',
        kind: 'number',
        text: (d) => currency.format(d.amount),
        sortValue: (d) => d.amount,
        sum: (d) => d.amount,
        formatSum: currency.format,
        cell: (d) => <Money value={d.amount} className="font-bold" />,
      },
      {
        key: 'actions',
        label: '',
        sortable: false,
        screenOnly: true,
        text: () => '',
        cell: (d) => (perms.settle ? <Button size="sm" onClick={() => setTransfer(d)}>تسوية</Button> : null),
      },
    ],
    [branches, currency, perms.settle],
  );
  const list = useLocalList({ section: 'expenses', page: 'branch-dues', fields, rows });
  return { list, rows, transfer, setTransfer };
}

/** Transfers between branches, newest first, with the void action. */
export function useBranchTransfers(branchFilter: string, period: { from: string; to: string }) {
  const data = useExpensesData();
  const currency = useCurrency();
  const branches = useBranches();
  const directory = useDirectory();
  const perms = useExpensesPermissions();
  const [voiding, setVoiding] = React.useState<BranchTransfer | null>(null);
  const rows = React.useMemo(() => {
    const match = (id: string | null) => branchFilter === 'all' || (id ?? '') === branchFilter;
    return (data?.branchTransfers ?? [])
      .filter(
        (t) =>
          t.currency === currency.code &&
          (match(t.fromBranchId) || match(t.toBranchId)) &&
          (!period.from || t.date >= period.from) &&
          (!period.to || t.date <= period.to),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [data, currency.code, branchFilter, period.from, period.to]);
  const fields = React.useMemo<LocalListField<BranchTransfer>[]>(
    () => [
      { key: 'date', label: 'التاريخ', kind: 'date', text: (t) => t.date, groupKey: (t) => t.date.slice(0, 7) },
      {
        key: 'from',
        label: 'من',
        kind: 'name',
        text: (t) => branches.nameOf(t.fromBranchId),
        groupKey: (t) => t.fromBranchId ?? '',
        groupLabel: (k) => branches.nameOf(k || null),
      },
      {
        key: 'to',
        label: 'إلى',
        text: (t) => branches.nameOf(t.toBranchId),
        groupKey: (t) => t.toBranchId ?? '',
        groupLabel: (k) => branches.nameOf(k || null),
      },
      { key: 'note', label: 'ملاحظة', optional: true, sortable: false, text: (t) => t.note ?? '' },
      {
        key: 'createdBy',
        label: 'سجّله',
        optional: true,
        hiddenByDefault: true,
        text: (t) => directory.nameOf(t.createdBy),
        groupKey: (t) => t.createdBy,
        groupLabel: (id) => directory.nameOf(id),
      },
      {
        key: 'amount',
        label: 'المبلغ',
        kind: 'number',
        text: (t) => currency.format(t.amount),
        sortValue: (t) => t.amount,
        sum: (t) => (t.voidedAt ? 0 : t.amount),
        formatSum: currency.format,
        cell: (t) => <Money value={t.amount} className={t.voidedAt ? 'line-through text-muted-foreground' : 'font-semibold'} />,
      },
      {
        key: 'status',
        label: 'الحالة',
        kind: 'status',
        text: (t) => (t.voidedAt ? 'ملغى' : 'معتمد'),
        cell: (t) => (t.voidedAt ? <Badge variant="outline">ملغى</Badge> : <Badge variant="success">معتمد</Badge>),
        groupKey: (t) => (t.voidedAt ? 'void' : 'ok'),
        groupLabel: (k) => (k === 'void' ? 'ملغى' : 'معتمد'),
      },
      {
        key: 'actions',
        label: '',
        sortable: false,
        screenOnly: true,
        text: () => '',
        cell: (t) =>
          perms.settle && !t.voidedAt ? (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setVoiding(t)}>
              إلغاء
            </Button>
          ) : null,
      },
    ],
    [branches, currency, directory, perms.settle],
  );
  const list = useLocalList({ section: 'expenses', page: 'branch-transfers', fields, rows });
  return { list, rows, voiding, setVoiding };
}

/** Records money one branch hands another to clear (part of) what it owes it. */
export function BranchTransferDialog({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset?: BranchDue | null;
}) {
  const data = useExpensesData();
  const currency = useCurrency();
  const branches = useBranches();
  const run = useRunCommand();
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [amount, setAmount] = React.useState<{ t: string; m: Minor }>({ t: '', m: 0 });
  const [date, setDate] = React.useState(todayIso());
  const [note, setNote] = React.useState('');
  React.useEffect(() => {
    if (!open) return;
    setFrom(preset?.fromBranchId ?? branches.options[0]?.value ?? '');
    setTo(preset?.toBranchId ?? branches.options[1]?.value ?? '');
    setAmount(preset ? { t: minorToInput(preset.amount, currency.decimals), m: preset.amount } : { t: '', m: 0 });
    setDate(todayIso());
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when the dialog opens
  }, [open, preset]);
  if (!data) return null;
  const owed =
    branchDues(data, currency.code).find((d) => (d.fromBranchId ?? '') === from && (d.toBranchId ?? '') === to)?.amount ?? 0;
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="تسوية بين فرعين"
      description="مبلغ تدفعه جهة لجهة أخرى عمّا صرفته الثانية عنها من عهدتها."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button
            disabled={from === to || amount.m <= 0 || amount.m > owed}
            onClick={() =>
              void run(
                { type: 'addBranchTransfer', fromBranchId: from || null, toBranchId: to || null, amount: amount.m, date, note: note.trim() || null },
                'سُجّلت التسوية',
              ).then((ok) => ok && onOpenChange(false))
            }
          >
            تسجيل
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <BranchSelect id="bt-from" label="الجهة الدافعة" value={from} onChange={setFrom} options={branches.options} />
        <ArrowLeft className="mx-auto hidden h-5 w-5 text-muted-foreground sm:block" />
        <BranchSelect id="bt-to" label="الجهة المستلمة" value={to} onChange={setTo} options={branches.options} />
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-xs">
        على {branches.nameOf(from || null)} لـ{branches.nameOf(to || null)} حالياً: <Money value={owed} className="font-semibold" />
        {owed > 0 ? (
          <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={() => setAmount({ t: minorToInput(owed, currency.decimals), m: owed })}>
            تسوية الكل
          </Button>
        ) : null}
      </p>
      <Field label="المبلغ"><AmountInput value={amount.t} onChange={(t, m) => setAmount({ t, m })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="التاريخ"><Input type="date" className="h-10" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="ملاحظة"><Input className="h-10" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </FormDialog>
  );
}

/** Voids a transfer: what it cleared becomes due again. */
export function VoidBranchTransferDialog({ transfer, onClose }: { transfer: BranchTransfer | null; onClose: () => void }) {
  const run = useRunCommand();
  return (
    <ReasonDialog
      open={transfer !== null}
      onOpenChange={(o) => !o && onClose()}
      title="إلغاء التسوية بين الفرعين"
      confirmLabel="إلغاء التسوية"
      destructive
      onConfirm={(reason) => {
        if (transfer) void run({ type: 'voidBranchTransfer', id: transfer.id, reason }, 'أُلغيت التسوية').then((ok) => ok && onClose());
      }}
    />
  );
}
