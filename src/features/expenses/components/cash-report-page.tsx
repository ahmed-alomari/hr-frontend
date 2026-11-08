'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { ListFilterBar, type PeriodRange } from '@/components/ui/list-filter-bar';
import { ListColumnsPicker, useColumnVisibility, type ListColumnOption } from '@/components/ui/list-columns-picker';
import { hrFiltersKey } from '@/features/hr/lib/use-persisted-filter-state';
import { downloadXlsxFromAoA, type XlsxCell } from '@/shared/export/download-xlsx';
import { useExpensesStore } from '../data/store';
import { CASH_MOVEMENT_LABELS_AR, cashMovements, cashReport, type CashMovement, type CashReport } from '../domain/reports';
import type { Minor } from '../domain/money';
import { Money, PartyName } from './common';
import { last30Days, ReportExportMenu, ReportSummaryCard } from './report-common';
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

/** Chosen columns. The fixed ones (date, type, direction, amount) are not here, so they cannot be hidden. */
const MOVEMENT_COLUMN_OPTIONS: readonly ListColumnOption[] = [
  { key: 'party', label: 'الشخص' },
  { key: 'description', label: 'البيان' },
  { key: 'group', label: 'المجموعة' },
  { key: 'category', label: 'الفئة' },
  { key: 'costCenter', label: 'مركز التكلفة' },
  { key: 'createdBy', label: 'سجّله' },
  { key: 'method', label: 'طريقة السداد' },
  { key: 'note', label: 'الملاحظة' },
];

/** Optional columns start hidden; the user picks the ones to add. The choice is kept per company. */
const MOVEMENT_COLUMNS_HIDDEN_BY_DEFAULT = MOVEMENT_COLUMN_OPTIONS.map((o) => o.key);

function directionBadge(direction: 'out' | 'in') {
  return direction === 'out' ? <Badge variant="destructive">خروج</Badge> : <Badge variant="success">دخول</Badge>;
}

export function CashReportPage() {
  const data = useExpensesData();
  const currency = useCurrency();
  const directory = useDirectory();
  const companyId = useExpensesStore((s) => s.companyId);
  const advanced = data?.settings.mode === 'advanced';
  const columnOptions = React.useMemo(
    () => MOVEMENT_COLUMN_OPTIONS.filter((o) => advanced || o.key !== 'costCenter'),
    [advanced],
  );
  const columnsModel = useColumnVisibility(
    hrFiltersKey('expenses', 'cash', companyId, 'hiddenColumns'),
    columnOptions,
    MOVEMENT_COLUMNS_HIDDEN_BY_DEFAULT,
  );
  const shown = (key: string) => columnsModel.isVisible(key);
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

  const cellText = React.useCallback((m: CashMovement, key: string): string => {
    switch (key) {
      case 'date': return m.date;
      case 'type': return CASH_MOVEMENT_LABELS_AR[m.type];
      case 'direction': return m.direction === 'out' ? 'خروج' : 'دخول';
      case 'party': return m.partyId ? directory.nameOf(m.partyId) : '';
      case 'description': return m.description;
      case 'group': return data?.groups.find((g) => g.id === m.groupId)?.name ?? '';
      case 'category': return data?.categories.find((c) => c.id === m.categoryId)?.name ?? '';
      case 'costCenter': return m.costCenterIds.map((id) => data?.costCenters.find((c) => c.id === id)?.name ?? '').filter(Boolean).join('، ');
      case 'createdBy': return directory.nameOf(m.createdBy);
      case 'method': return m.method ? METHOD_LABELS[m.method] : 'صندوق المنشأة';
      case 'note': return m.note;
      case 'amount': return currency.format(m.amount);
      default: return '';
    }
  }, [data, directory, currency]);

  const movementColumns = React.useMemo<ColumnDef<CashMovement>[]>(() => {
    const all: ColumnDef<CashMovement>[] = [
      { key: 'date', title: 'التاريخ', render: (m) => <span dir="ltr" className="tabular-nums">{m.date}</span> },
      { key: 'type', title: 'النوع', render: (m) => <span className="font-medium">{CASH_MOVEMENT_LABELS_AR[m.type]}</span> },
      { key: 'direction', title: 'الاتجاه', render: (m) => directionBadge(m.direction) },
      { key: 'party', title: 'الشخص', render: (m) => (m.partyId ? <PartyName id={m.partyId} link={false} /> : <span className="text-muted-foreground">—</span>) },
      { key: 'description', title: 'البيان', render: (m) => <span className="text-muted-foreground">{m.description || '—'}</span> },
      { key: 'group', title: 'المجموعة', render: (m) => cellText(m, 'group') || '—' },
      { key: 'category', title: 'الفئة', render: (m) => cellText(m, 'category') || '—' },
      { key: 'costCenter', title: 'مركز التكلفة', render: (m) => cellText(m, 'costCenter') || '—' },
      { key: 'createdBy', title: 'سجّله', render: (m) => <PartyName id={m.createdBy} link={false} /> },
      { key: 'method', title: 'طريقة السداد', render: (m) => cellText(m, 'method') },
      { key: 'note', title: 'الملاحظة', render: (m) => <span className="text-muted-foreground">{m.note || '—'}</span> },
      { key: 'amount', title: 'المبلغ', render: (m) => <Money value={m.amount} className="font-semibold" /> },
    ];
    return all.filter((c) => (c.key !== 'costCenter' || advanced) && columnsModel.isVisible(c.key));
  }, [advanced, cellText, columnsModel]);

  const exportExcel = React.useCallback(async () => {
    if (!cash) return;
    const sheet: XlsxCell[][] = [movementColumns.map((c) => c.title)];
    for (const m of shownMovements) sheet.push(movementColumns.map((c) => cellText(m, c.key)));
    const out = shownMovements.filter((m) => m.direction === 'out').reduce((t, m) => t + m.amount, 0);
    const inn = shownMovements.filter((m) => m.direction === 'in').reduce((t, m) => t + m.amount, 0);
    const pad = (label: string, value: string): XlsxCell[] => [...Array(Math.max(movementColumns.length - 2, 0)).fill(''), label, value];
    sheet.push([]);
    sheet.push(pad('إجمالي الخروج', currency.format(out)));
    sheet.push(pad('إجمالي الدخول', currency.format(inn)));
    sheet.push(pad('الصافي (خروج − دخول)', currency.format(out - inn)));
    try {
      await downloadXlsxFromAoA(`حركة-النقد-${period.from || 'الكل'}-${period.to || 'الكل'}.xlsx`, 'حركة النقد', sheet);
      toast.success('تم تنزيل ملف Excel.');
    } catch {
      toast.error('تعذر تصدير التقرير.');
    }
  }, [cash, shownMovements, movementColumns, cellText, currency, period]);

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <ListColumnsPicker model={columnsModel} />
        <ReportExportMenu onExcel={() => void exportExcel()} />
      </div>
    ),
    [activeFilterCount, columnsModel, exportExcel],
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
        <p className="text-xs text-muted-foreground">التاريخ والنوع والاتجاه والمبلغ أعمدة ثابتة. بقية الحقول تُضاف من زر الأعمدة، وتظهر في الجدول وفي ملف Excel.</p>
        <DataTable
          variant="directory"
          columns={movementColumns}
          data={shownMovements}
          keyExtractor={(m) => `${m.kind}:${m.id}`}
          mobileCard={(m) => (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{CASH_MOVEMENT_LABELS_AR[m.type]}</p>
                <p className="truncate text-xs text-muted-foreground">
                  <span dir="ltr">{m.date}</span>
                  {shown('party') && m.partyId ? <> · <PartyName id={m.partyId} link={false} /></> : null}
                  {shown('description') && m.description ? <> · {m.description}</> : null}
                </p>
                {directionBadge(m.direction)}
              </div>
              <Money value={m.amount} className="shrink-0 font-semibold" />
            </div>
          )}
          loading={loading}
          emptyText="لا حركات ضمن الفلاتر الحالية."
        />
      </section>
    </div>
  );
}
