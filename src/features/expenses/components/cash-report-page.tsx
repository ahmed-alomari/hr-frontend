'use client';

import * as React from 'react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { ListFilterBar, type PeriodRange } from '@/components/ui/list-filter-bar';
import { LocalListTable, LocalListToolbar, useLocalList, type LocalListField } from '@/components/ui/local-list';
import { CASH_MOVEMENT_LABELS_AR, cashMovements, cashReport, type CashMovement, type CashReport } from '../domain/reports';
import type { Minor } from '../domain/money';
import { Money, PartyName } from './common';
import { last30Days, ReportSummaryCard } from './report-common';
import { todayIso, useCurrency, useDirectory, useExpensesData } from './expenses-provider';

type CashRow = { key: keyof CashReport; label: string; direction: 'out' | 'in'; amount: Minor };
type Direction = 'all' | 'out' | 'in';

const CASH_LINES: Array<Omit<CashRow, 'amount'>> = [
  { key: 'expensesPaidDirect', label: 'مصروفات مدفوعة مباشرة', direction: 'out' },
  { key: 'custodyFunding', label: 'تسليم وتغذية العهد', direction: 'out' },
  { key: 'advancesPaid', label: 'سلف مدفوعة', direction: 'out' },
  { key: 'settlementsPaid', label: 'تعويضات وسداد للأشخاص', direction: 'out' },
  { key: 'custodyReturns', label: 'مرتجعات العهد', direction: 'in' },
  { key: 'settlementsReceived', label: 'سداد مستلم من الأشخاص', direction: 'in' },
];

const METHOD_LABELS: Record<NonNullable<CashMovement['method']>, string> = {
  cash: 'نقداً',
  transfer: 'تحويل',
  payroll: 'خصم من الراتب',
  other: 'أخرى',
};

function directionBadge(direction: 'out' | 'in') {
  return direction === 'out' ? <Badge variant="destructive">خروج</Badge> : <Badge variant="success">دخول</Badge>;
}

export function CashReportPage() {
  const data = useExpensesData();
  const currency = useCurrency();
  const directory = useDirectory();
  const advanced = data?.settings.mode === 'advanced';
  const defaultPeriod = React.useMemo(() => last30Days(todayIso()), []);
  const [period, setPeriod] = React.useState<PeriodRange>(defaultPeriod);
  const [direction, setDirection] = React.useState<Direction>('all');

  const range = React.useMemo(() => ({ currency: currency.code, from: period.from || null, to: period.to || null }), [currency.code, period]);
  const cash = React.useMemo(() => (data ? cashReport(data, range) : null), [data, range]);
  const movements = React.useMemo<CashMovement[]>(() => (data ? cashMovements(data, range) : []), [data, range]);

  const allRows = React.useMemo<CashRow[]>(() => (cash ? CASH_LINES.map((l) => ({ ...l, amount: cash[l.key] })) : []), [cash]);
  const rows = React.useMemo(() => allRows.filter((r) => direction === 'all' || r.direction === direction), [allRows, direction]);
  const shownMovements = React.useMemo(() => movements.filter((m) => direction === 'all' || m.direction === direction), [movements, direction]);
  const cashOut = movements.filter((m) => m.direction === 'out').reduce((t, m) => t + m.amount, 0);
  const cashIn = movements.filter((m) => m.direction === 'in').reduce((t, m) => t + m.amount, 0);

  const isDefaultPeriod = period.from === defaultPeriod.from && period.to === defaultPeriod.to;
  const activeFilterCount = (direction !== 'all' ? 1 : 0) + (isDefaultPeriod ? 0 : 1);

  const fields = React.useMemo<LocalListField<CashMovement>[]>(() => {
    const groupName = (id: string | null) => data?.groups.find((g) => g.id === id)?.name ?? '—';
    const categoryName = (id: string | null) => data?.categories.find((c) => c.id === id)?.name ?? '—';
    const centers = (m: CashMovement) => m.costCenterIds.map((id) => data?.costCenters.find((c) => c.id === id)?.name ?? '').filter(Boolean).join('، ');
    const method = (m: CashMovement) => (m.method ? METHOD_LABELS[m.method] : 'صندوق المنشأة');
    const part = (dir: 'out' | 'in') => (m: CashMovement) => (m.direction === dir ? m.amount : 0);
    const list: LocalListField<CashMovement>[] = [
      { key: 'date', label: 'التاريخ', kind: 'date', text: (m) => m.date, cell: (m) => <span dir="ltr" className="tabular-nums">{m.date}</span>, groupKey: (m) => m.date.slice(0, 7) },
      { key: 'type', label: 'النوع', text: (m) => CASH_MOVEMENT_LABELS_AR[m.type], cell: (m) => <span className="font-medium">{CASH_MOVEMENT_LABELS_AR[m.type]}</span>, groupKey: (m) => m.type, groupLabel: (k) => CASH_MOVEMENT_LABELS_AR[k as CashMovement['type']] ?? k },
      { key: 'direction', label: 'الاتجاه', kind: 'status', text: (m) => (m.direction === 'out' ? 'خروج' : 'دخول'), cell: (m) => directionBadge(m.direction), groupKey: (m) => m.direction, groupLabel: (k) => (k === 'out' ? 'خروج' : 'دخول') },
      { key: 'party', label: 'الشخص', optional: true, hiddenByDefault: true, text: (m) => (m.partyId ? directory.nameOf(m.partyId) : ''), cell: (m) => (m.partyId ? <PartyName id={m.partyId} link={false} /> : <span className="text-muted-foreground">—</span>), groupKey: (m) => m.partyId ?? null, groupLabel: (id) => directory.nameOf(id) },
      { key: 'description', label: 'البيان', optional: true, hiddenByDefault: true, text: (m) => m.description },
      { key: 'group', label: 'المجموعة', optional: true, hiddenByDefault: true, text: (m) => groupName(m.groupId), groupKey: (m) => m.groupId ?? null, groupLabel: groupName },
      { key: 'category', label: 'الفئة', optional: true, hiddenByDefault: true, text: (m) => (m.categoryId ? categoryName(m.categoryId) : ''), groupKey: (m) => m.categoryId ?? null, groupLabel: categoryName },
      ...(advanced ? [{ key: 'costCenter', label: 'مركز التكلفة', optional: true, hiddenByDefault: true, text: centers }] : []),
      { key: 'createdBy', label: 'سجّله', optional: true, hiddenByDefault: true, text: (m) => directory.nameOf(m.createdBy), groupKey: (m) => m.createdBy, groupLabel: (id) => directory.nameOf(id) },
      { key: 'method', label: 'طريقة السداد', optional: true, hiddenByDefault: true, text: method, groupKey: method },
      { key: 'note', label: 'الملاحظة', optional: true, hiddenByDefault: true, sortable: false, text: (m) => m.note },
      { key: 'out', label: 'خروج', kind: 'number', text: (m) => (m.direction === 'out' ? currency.format(m.amount) : ''), sortValue: part('out'), sum: part('out'), formatSum: currency.format, cell: (m) => (m.direction === 'out' ? <Money value={m.amount} className="font-semibold text-destructive" /> : null) },
      { key: 'in', label: 'دخول', kind: 'number', text: (m) => (m.direction === 'in' ? currency.format(m.amount) : ''), sortValue: part('in'), sum: part('in'), formatSum: currency.format, cell: (m) => (m.direction === 'in' ? <Money value={m.amount} className="font-semibold text-success" /> : null) },
    ];
    return list;
  }, [data, directory, currency, advanced]);
  const list = useLocalList({ section: 'expenses', page: 'cash', fields, rows: shownMovements });
  const periodLine = `الفترة: ${period.from || '…'} إلى ${period.to || '…'}`;

  usePageHeaderActions(
    () => (
      <LocalListToolbar
        list={list}
        title="حركة النقد"
        fileName={`cash-${period.from || 'all'}-${period.to || 'all'}`}
        subtitleLines={[periodLine, `الصافي (خروج − دخول): ${currency.format(list.total.sums.out - list.total.sums.in)}`]}
        before={<FilterToggleButton activeFilterCount={activeFilterCount} />}
      />
    ),
    [activeFilterCount, list.rows, list.visibleFields, list.groups, list.sort.sortKey, periodLine],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showStatusSection={false}
        showEmployeePicker={false}
        periodValue={period}
        onPeriodChange={setPeriod}
        defaultPeriod={defaultPeriod}
        inlineSelects={[
          {
            id: 'direction',
            value: direction,
            onChange: (v) => setDirection(v === 'out' || v === 'in' ? v : 'all'),
            placeholder: 'كل الحركات',
            options: [
              { value: 'all', label: 'كل الحركات' },
              { value: 'out', label: 'خروج' },
              { value: 'in', label: 'دخول' },
            ],
          },
        ]}
      />
    ),
    [period, defaultPeriod, direction],
  );

  const summaryColumns: ColumnDef<CashRow>[] = [
    { key: 'label', title: 'البند', render: (r) => <span className="font-medium">{r.label}</span> },
    { key: 'direction', title: 'الاتجاه', render: (r) => directionBadge(r.direction) },
    { key: 'amount', title: 'المبلغ', render: (r) => <Money value={r.amount} className="font-semibold" /> },
  ];

  const loading = !data;

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle titleAr="حركة النقد" descriptionAr="كل حركات النقد المعتمدة. خروج: مصروفات مباشرة وتمويل عهد وسلف وتعويضات؛ دخول: مرتجعات وسداد." iconName="Banknote" />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <ReportSummaryCard label="خروج النقد" value={<Money value={cashOut} />} />
        <ReportSummaryCard label="دخول النقد" value={<Money value={cashIn} />} />
        <ReportSummaryCard label="الصافي" value={<Money value={cashOut - cashIn} />} hint="خروج − دخول" />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">ملخص حسب النوع</h2>
        <DataTable
          variant="directory"
          columns={summaryColumns}
          data={rows}
          keyExtractor={(r) => r.key}
          mobileCard={(r) => (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{r.label}</p>
                {directionBadge(r.direction)}
              </div>
              <Money value={r.amount} className="shrink-0 font-semibold" />
            </div>
          )}
          loading={loading}
          emptyText="لا حركات ضمن الفلاتر الحالية."
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">تفصيل الحركات <span className="font-normal text-muted-foreground">({shownMovements.length})</span></h2>
        <p className="text-xs text-muted-foreground">التاريخ والنوع والاتجاه والخروج والدخول أعمدة ثابتة. بقية الحقول تُضاف من زر الأعمدة، وتظهر في الجدول وفي التصدير والطباعة.</p>
        <LocalListTable
          list={list}
          rowKey={(m) => `${m.kind}:${m.id}`}
          empty={<p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">لا حركات ضمن الفلاتر الحالية.</p>}
          card={(m) => (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{CASH_MOVEMENT_LABELS_AR[m.type]}</p>
                <p className="truncate text-xs text-muted-foreground">
                  <span dir="ltr">{m.date}</span>
                  {list.columns.isVisible('party') && m.partyId ? <> · <PartyName id={m.partyId} link={false} /></> : null}
                  {list.columns.isVisible('description') && m.description ? <> · {m.description}</> : null}
                </p>
                {directionBadge(m.direction)}
              </div>
              <Money value={m.amount} className="shrink-0 font-semibold" />
            </div>
          )}
        />
      </section>
    </div>
  );
}
