'use client';

import * as React from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { allTxns } from '../domain/ledger';
import { addDays, lockedThrough, nextPeriodStart, pendingInPeriod, periodLabel, periodSummary } from '../domain/periods';
import type { ExpensesData, PeriodClosing } from '../domain/types';
import { EmptyState, Field, FormDialog, LoadingBlock, Money, PartyName, ReasonDialog, ResponsiveTable, Section, useRunCommand } from './common';
import { todayIso, useCurrency, useExpensesData, useExpensesPermissions } from './expenses-provider';

type Preset = 'month' | 'half' | 'months' | 'custom';

const PRESET_LABELS: Record<Preset, string> = {
  month: 'شهر كامل',
  half: 'نصف شهر',
  months: 'عدة أشهر',
  custom: 'حتى تاريخ أختاره',
};

/** Last day of the month `months - 1` months after `date`'s month. */
function monthEnd(date: string, months = 1): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 + months;
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function periodEnd(start: string, preset: Preset, months: number, custom: string): string {
  if (preset === 'month') return monthEnd(start);
  if (preset === 'months') return monthEnd(start, Math.max(1, months));
  if (preset === 'half') return Number(start.slice(8)) <= 15 ? `${start.slice(0, 8)}15` : monthEnd(start);
  return custom;
}

/** Where the first period starts by default: the month of the oldest record. */
function firstStart(data: ExpensesData): string {
  const oldest = allTxns(data).reduce<string | null>((min, t) => (min === null || t.date < min ? t.date : min), null);
  return `${(oldest ?? todayIso()).slice(0, 7)}-01`;
}

function CloseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const data = useExpensesData();
  const currency = useCurrency();
  const run = useRunCommand();
  const [from, setFrom] = React.useState('');
  const [preset, setPreset] = React.useState<Preset>('month');
  const [months, setMonths] = React.useState(3);
  const [custom, setCustom] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [note, setNote] = React.useState('');
  const defaultStart = data ? (nextPeriodStart(data) ?? firstStart(data)) : '';
  React.useEffect(() => {
    if (!open) return;
    setFrom(defaultStart);
    setPreset('month');
    setMonths(3);
    setCustom(addDays(todayIso(), -1));
    setLabel('');
    setNote('');
  }, [open, defaultStart]);
  if (!data) return null;
  const fixedStart = nextPeriodStart(data);
  const start = fixedStart ?? from;
  const end = start ? periodEnd(start, preset, months, custom) : '';
  const today = todayIso();
  const valid = Boolean(start && end && end >= start);
  const notEnded = valid && end >= today;
  const pending = valid ? pendingInPeriod(data, start, end) : 0;
  const summary = valid ? periodSummary(data, start, end, currency.code) : null;
  const drafts = valid ? allTxns(data).filter((t) => (t.status === 'draft' || t.status === 'rejected') && t.date >= start && t.date <= end).length : 0;
  const canClose = valid && !notEnded && pending === 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="إقفال فترة"
      description="بعد الإقفال لا يُسجَّل في الفترة شيء ولا يُعدَّل ولا يُعتمد ولا يُلغى. إعادة الفتح لآخر فترة فقط وبسبب مكتوب."
      footer={<>
        <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        <Button disabled={!canClose} onClick={() => void run({ type: 'closePeriod', from: start, to: end, label: label.trim() || null, note: note.trim() || null }, 'أُقفلت الفترة').then((ok) => ok && onOpenChange(false))}>
          <Lock className="me-1.5 h-4 w-4" />
          إقفال
        </Button>
      </>}
    >
      <Field label="بداية الفترة" hint={fixedStart ? 'تبدأ كل فترة في اليوم التالي لنهاية آخر فترة مقفلة.' : 'أول فترة: اختر يوم بدايتها.'}>
        <Input type="date" className="h-10" value={start} disabled={Boolean(fixedStart)} onChange={(e) => setFrom(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="طول الفترة">
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(PRESET_LABELS) as Preset[]).map((p) => <SelectItem key={p} value={p}>{PRESET_LABELS[p]}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        {preset === 'months' ? (
          <Field label="عدد الأشهر"><Input type="number" min={1} max={24} className="h-10" value={months} onChange={(e) => setMonths(Math.min(24, Math.max(1, Number(e.target.value) || 1)))} /></Field>
        ) : preset === 'custom' ? (
          <Field label="نهاية الفترة"><Input type="date" className="h-10" value={custom} min={start} onChange={(e) => setCustom(e.target.value)} /></Field>
        ) : (
          <Field label="نهاية الفترة"><Input className="h-10" value={end} disabled readOnly /></Field>
        )}
      </div>
      <Field label="اسم الفترة (اختياري)"><Input className="h-10" value={label} placeholder={valid ? periodLabel(start, end) : ''} onChange={(e) => setLabel(e.target.value)} /></Field>
      <Field label="ملاحظة"><Input className="h-10" value={note} onChange={(e) => setNote(e.target.value)} /></Field>

      {!valid ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">نهاية الفترة قبل بدايتها.</p> : null}
      {notEnded ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">لا تُقفل فترة لم تنتهِ: يجب أن تكون نهايتها قبل اليوم.</p> : null}
      {pending > 0 ? <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">في الفترة {pending} عملية بانتظار الاعتماد: اعتمدها أو ارفضها أولاً.</p> : null}
      {drafts > 0 ? <p className="rounded-lg bg-muted px-3 py-2 text-xs">{drafts} مسودة أو مرفوضة في الفترة ستبقى كما هي ولا تُرسل بعد الإقفال.</p> : null}
      {summary ? (
        <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
          <div className="rounded-xl bg-muted p-2">المصروفات<br /><span className="font-semibold">{summary.expensesCount}</span></div>
          <div className="rounded-xl bg-muted p-2">إجماليها<br /><Money value={summary.expensesTotal} className="font-semibold" /></div>
          <div className="rounded-xl bg-muted p-2">خروج النقد<br /><Money value={summary.cashOut} className="font-semibold" /></div>
          <div className="rounded-xl bg-muted p-2">دخول النقد<br /><Money value={summary.cashIn} className="font-semibold" /></div>
        </div>
      ) : null}
    </FormDialog>
  );
}

export function PeriodsPage() {
  const data = useExpensesData();
  const perms = useExpensesPermissions();
  const run = useRunCommand();
  const [closing, setClosing] = React.useState(false);
  const [reopen, setReopen] = React.useState<PeriodClosing | null>(null);

  usePageHeaderActions(
    () => (
      <PageHeaderPrimaryButton icon={Lock} label="إقفال فترة" disabled={!perms.periods} onClick={() => setClosing(true)}>
        إقفال فترة
      </PageHeaderPrimaryButton>
    ),
    [perms.periods],
  );

  if (!data) return <LoadingBlock />;
  const last = lockedThrough(data);
  const next = nextPeriodStart(data);
  const rows = [...(data.closings ?? [])].sort((a, b) => b.to.localeCompare(a.to) || b.closedAt.localeCompare(a.closedAt));
  const latestClosed = rows.find((c) => c.status === 'closed');

  return (
    <div className="space-y-4">
      <SetPageTitle titleAr="إقفال الفترات" descriptionAr="شهرياً أو نصف شهر أو عدة أشهر أو حتى تاريخ تختاره" iconName="Lock" />
      <Section title="الحالة">
        {last ? (
          <p className="text-sm">مقفل حتى <span className="font-semibold">{last}</span>. الفترة التالية تبدأ <span className="font-semibold">{next}</span>.</p>
        ) : (
          <p className="text-sm text-muted-foreground">لا فترات مقفلة بعد. كل العمليات قابلة للتعديل والإلغاء حسب صلاحياتها.</p>
        )}
      </Section>
      <Section title="الفترات">
        {rows.length === 0 ? <EmptyState text="لا فترات" action={perms.periods ? <Button size="sm" onClick={() => setClosing(true)}>إقفال أول فترة</Button> : undefined} /> : (
          <ResponsiveTable
            rows={rows}
            rowKey={(c) => c.id}
            card={(c) => (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="text-sm font-semibold">{c.label}</p><p className="text-xs text-muted-foreground">{c.from} إلى {c.to}</p></div>
                  <Badge variant={c.status === 'closed' ? 'success' : 'subtle'}>{c.status === 'closed' ? 'مقفلة' : 'أُعيد فتحها'}</Badge>
                </div>
                {c.summary ? <p className="text-xs">مصروفات <Money value={c.summary.expensesTotal} className="font-semibold" /> · خروج <Money value={c.summary.cashOut} /> · دخول <Money value={c.summary.cashIn} /></p> : null}
                <p className="text-[11px] text-muted-foreground">أقفلها <PartyName id={c.closedBy} link={false} /> {c.closedAt.slice(0, 10)}{c.reopenReason ? <> · أعاد فتحها <PartyName id={c.reopenedBy} link={false} />: {c.reopenReason}</> : null}</p>
                {c.id === latestClosed?.id && perms.periods ? <Button size="sm" variant="outline" onClick={() => setReopen(c)}><LockOpen className="me-1 h-3.5 w-3.5" />إعادة فتح</Button> : null}
              </div>
            )}
            columns={[
              { header: 'الفترة', cell: (c) => <span className="font-medium">{c.label}</span> },
              { header: 'من', cell: (c) => c.from },
              { header: 'إلى', cell: (c) => c.to },
              { header: 'المصروفات', cell: (c) => (c.summary ? <Money value={c.summary.expensesTotal} className="font-semibold" /> : '—') },
              { header: 'خروج النقد', cell: (c) => (c.summary ? <Money value={c.summary.cashOut} /> : '—') },
              { header: 'دخول النقد', cell: (c) => (c.summary ? <Money value={c.summary.cashIn} /> : '—') },
              { header: 'الحالة', cell: (c) => <Badge variant={c.status === 'closed' ? 'success' : 'subtle'}>{c.status === 'closed' ? 'مقفلة' : 'أُعيد فتحها'}</Badge> },
              { header: 'أقفلها', cell: (c) => <span className="text-xs"><PartyName id={c.closedBy} link={false} /> {c.closedAt.slice(0, 10)}</span> },
              { header: 'سبب إعادة الفتح', cell: (c) => <span className="text-xs">{c.reopenReason ?? '—'}</span> },
              { header: '', cell: (c) => (c.id === latestClosed?.id && perms.periods ? <Button size="sm" variant="outline" onClick={() => setReopen(c)}><LockOpen className="me-1 h-3.5 w-3.5" />إعادة فتح</Button> : null) },
            ]}
          />
        )}
      </Section>
      <CloseDialog open={closing} onOpenChange={setClosing} />
      <ReasonDialog
        open={reopen !== null}
        onOpenChange={(o) => !o && setReopen(null)}
        title={reopen ? `إعادة فتح «${reopen.label}»` : 'إعادة فتح'}
        confirmLabel="إعادة الفتح"
        destructive
        onConfirm={(reason) => {
          if (reopen) void run({ type: 'reopenPeriod', closingId: reopen.id, reason }, 'أُعيد فتح الفترة');
          setReopen(null);
        }}
      />
    </div>
  );
}
