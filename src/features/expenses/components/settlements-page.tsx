'use client';

import * as React from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { owedBetween } from '../domain/commands';
import { settlementSuggestions } from '../domain/ledger';
import { minorToInput, type Minor } from '../domain/money';
import type { PartyId, Settlement } from '../domain/types';
import { AmountInput, EmptyState, Field, FormDialog, LoadingBlock, Money, PartyName, PartySelect, ResponsiveTable, Section, StatusBadge, useRunCommand } from './common';
import { todayIso, useCurrency, useExpensesData, useExpensesPermissions, useLedger } from './expenses-provider';
import { GroupField } from './group-policy';
import { TxnActions } from './txn-actions';

const METHOD_LABELS: Record<Settlement['method'], string> = { cash: 'نقداً', transfer: 'تحويل', payroll: 'خصم من الراتب', other: 'أخرى' };

export function SettlementDialog({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preset?: { fromId: PartyId; toId: PartyId; amount: Minor } | null;
}) {
  const data = useExpensesData();
  const currency = useCurrency();
  const run = useRunCommand();
  const [fromId, setFromId] = React.useState<PartyId | null>(null);
  const [toId, setToId] = React.useState<PartyId | null>(null);
  const [amount, setAmount] = React.useState<{ t: string; m: Minor }>({ t: '', m: 0 });
  const [method, setMethod] = React.useState<Settlement['method']>('cash');
  const [date, setDate] = React.useState(todayIso());
  const [note, setNote] = React.useState('');
  const [groupId, setGroupId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open) return;
    setGroupId(null);
    setFromId(preset?.fromId ?? null);
    setToId(preset?.toId ?? null);
    setAmount(preset ? { t: minorToInput(preset.amount, currency.decimals), m: preset.amount } : { t: '', m: 0 });
    setMethod('cash');
    setDate(todayIso());
    setNote('');
  }, [open, preset, currency.decimals]);
  if (!data) return null;
  const owed = fromId && toId ? owedBetween(data, fromId, toId, currency.code) : 0;
  const save = () => {
    if (!fromId || !toId) return;
    if (amount.m > owed && !window.confirm('المبلغ أكبر مما على الدافع لهذا الطرف؛ الزيادة تصبح مستحقة للدافع. متابعة؟')) return;
    void run({ type: 'addSettlement', fromId, toId, amount: amount.m, method, date, note: note.trim() || null, groupId }, 'سُجّل السداد').then((ok) => ok && onOpenChange(false));
  };
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="تسجيل سداد"
      description="دفعة من طرف لآخر (أو مع المنشأة) تقلل ما بينهما."
      footer={<>
        <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        <Button disabled={!fromId || !toId || fromId === toId || amount.m <= 0} onClick={save}>تسجيل</Button>
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <Field label="الدافع"><PartySelect value={fromId} onChange={setFromId} includeOrg /></Field>
        <ArrowLeft className="mx-auto hidden h-5 w-5 text-muted-foreground sm:block" />
        <Field label="المستلم"><PartySelect value={toId} onChange={setToId} includeOrg exclude={fromId ? [fromId] : []} /></Field>
      </div>
      {fromId && toId ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs">
          على <PartyName id={fromId} link={false} /> لـ <PartyName id={toId} link={false} /> حالياً: <Money value={owed} className="font-semibold" />
          {owed > 0 ? <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={() => setAmount({ t: minorToInput(owed, currency.decimals), m: owed })}>سداد الكل</Button> : null}
        </p>
      ) : null}
      <Field label="المبلغ"><AmountInput value={amount.t} onChange={(t, m) => setAmount({ t, m })} /></Field>
      <GroupField value={groupId} onChange={setGroupId} amount={amount.m} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الطريقة">
          <Select value={method} onValueChange={(v) => setMethod(v as Settlement['method'])}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(METHOD_LABELS) as Settlement['method'][]).map((m) => <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="التاريخ"><Input type="date" className="h-10" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="ملاحظة"><Input className="h-10" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </FormDialog>
  );
}

export function SettlementsPage() {
  const data = useExpensesData();
  const ledger = useLedger();
  const currency = useCurrency();
  const perms = useExpensesPermissions();
  const [dialog, setDialog] = React.useState<{ fromId: PartyId; toId: PartyId; amount: Minor } | null | 'new'>(null);

  usePageHeaderActions(
    () => (
      <PageHeaderPrimaryButton icon={Plus} label="تسجيل سداد" disabled={!perms.settle} onClick={() => setDialog('new')}>
        تسجيل سداد
      </PageHeaderPrimaryButton>
    ),
    [perms.settle],
  );

  if (!data || !ledger) return <LoadingBlock />;
  const suggestions = settlementSuggestions(ledger);
  const history = data.settlements.filter((s) => s.currency === currency.code).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <SetPageTitle titleAr="التسويات والسداد" descriptionAr="ما يلزم سداده بين الأطراف ومع المنشأة" iconName="Banknote" />
      <Section title="مطلوب سداده" description="دفعة مباشرة لكل طرفين بينهما مستحق (تبسيط الديون عبر أطراف ثالثة مؤجل)">
        {suggestions.length === 0 ? <EmptyState text="لا مستحقات قائمة — كل الحسابات مسوّاة" /> : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {suggestions.map((s) => (
              <li key={s.fromId + s.toId} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
                <div className="min-w-0 text-sm">
                  <p className="truncate"><PartyName id={s.fromId} /> <span className="text-muted-foreground">يدفع لـ</span> <PartyName id={s.toId} /></p>
                  <Money value={s.amount} className="font-bold" />
                </div>
                {perms.settle ? <Button size="sm" onClick={() => setDialog(s)}>سداد</Button> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="سجل السداد">
        {history.length === 0 ? <EmptyState text="لا عمليات سداد" /> : (
          <ResponsiveTable
            rows={history}
            rowKey={(s) => s.id}
            card={(s) => (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2"><p className="min-w-0 text-sm"><PartyName id={s.fromId} /> ← <PartyName id={s.toId} /></p><Money value={s.amount} className="font-semibold" /></div>
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{s.date} · {METHOD_LABELS[s.method]}{s.note ? ` · ${s.note}` : ''}</span><StatusBadge status={s.status} /></div>
                <TxnActions txn={s} compact />
              </div>
            )}
            columns={[
              { header: 'التاريخ', cell: (s) => s.date },
              { header: 'الدافع', cell: (s) => <PartyName id={s.fromId} /> },
              { header: 'المستلم', cell: (s) => <PartyName id={s.toId} /> },
              { header: 'الطريقة', cell: (s) => METHOD_LABELS[s.method] },
              { header: 'المبلغ', cell: (s) => <Money value={s.amount} className="font-semibold" /> },
              { header: 'الحالة', cell: (s) => <StatusBadge status={s.status} /> },
              { header: '', cell: (s) => <TxnActions txn={s} compact /> },
            ]}
          />
        )}
      </Section>
      <SettlementDialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)} preset={dialog === 'new' ? null : dialog} />
    </div>
  );
}
