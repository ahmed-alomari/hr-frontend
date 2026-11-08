'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { ListFilterBar, type PeriodRange } from '@/components/ui/list-filter-bar';
import { ListColumnsPicker, useColumnVisibility, type ListColumnOption } from '@/components/ui/list-columns-picker';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';
import { downloadXlsxFromAoA, type XlsxCell } from '@/shared/export/download-xlsx';
import { useExpensesStore } from '../data/store';
import { peopleReport, type PersonReportRow } from '../domain/reports';
import { expensesRoutes } from '../constants/routes';
import { Money } from './common';
import { last30Days, ReportExportMenu, ReportSummaryCard } from './report-common';
import { todayIso, useCurrency, useDirectory, useExpensesData } from './expenses-provider';

type Slice = 'all' | 'spent' | 'custody' | 'owed' | 'owes';

const SLICE_LABELS: Record<Slice, string> = {
  all: 'كل الأشخاص',
  spent: 'صرفوا في الفترة',
  custody: 'معهم عهدة',
  owed: 'لهم رصيد',
  owes: 'عليهم رصيد',
};

/** Chosen columns. Name, spend, custody, days, and the two balances stay visible. */
const COLUMN_OPTIONS: readonly ListColumnOption[] = [
  { key: 'spentPersonal', label: 'من ماله' },
  { key: 'spentCustody', label: 'من عهدته' },
  { key: 'borne', label: 'تحمّل تكلفة' },
  { key: 'custodyIn', label: 'عهدة استلمها' },
  { key: 'custodyOut', label: 'عهدة أرجعها' },
  { key: 'advances', label: 'سلف استلمها' },
  { key: 'paidOut', label: 'سداد دفعه' },
  { key: 'paidIn', label: 'سداد استلمه' },
];

const HIDDEN_BY_DEFAULT = COLUMN_OPTIONS.map((o) => o.key);

function matchesSlice(row: PersonReportRow, slice: Slice): boolean {
  if (slice === 'spent') return row.spent > 0;
  if (slice === 'custody') return row.hasCustody;
  if (slice === 'owed') return row.owedToThem > 0;
  if (slice === 'owes') return row.theyOwe > 0;
  return true;
}

function custodyLabel(row: PersonReportRow) {
  return row.hasCustody ? <Badge variant="success">معه عهدة</Badge> : <Badge variant="subtle">بلا عهدة</Badge>;
}

function Breakdown({ row }: { row: PersonReportRow }) {
  const line = (label: string, value: number) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <Money value={value} />
    </div>
  );
  return (
    <div className="grid gap-2 text-xs sm:grid-cols-2">
      <div className="space-y-1 rounded-lg bg-muted/40 p-2">
        <p className="font-medium">المصروف خلال الفترة</p>
        {line('دفعه من ماله', row.spentPersonal)}
        {line('صُرف من عهدته', row.spentCustody)}
        {line('تكلفة تحمّلها', row.borne)}
      </div>
      <div className="space-y-1 rounded-lg bg-muted/40 p-2">
        <p className="font-medium">العهدة</p>
        {line('استلم خلال الفترة', row.custodyIn)}
        {line('أرجع خلال الفترة', row.custodyOut)}
        {line('الباقي معه الآن', row.custodyNow)}
      </div>
      <div className="space-y-1 rounded-lg bg-muted/40 p-2">
        <p className="font-medium">السلف والسداد خلال الفترة</p>
        {line('سلفة استلمها', row.advances)}
        {line('سداد دفعه', row.paidOut)}
        {line('سداد استلمه', row.paidIn)}
      </div>
      <div className="space-y-1 rounded-lg bg-muted/40 p-2">
        <p className="font-medium">الرصيد الآن</p>
        {line('له', row.owedToThem)}
        {line('عليه', row.theyOwe)}
        <p className="text-[11px] text-muted-foreground">له وعليه من كل المصروف والعهد والسلف، بعد المقاصة، وليس من الفترة وحدها.</p>
      </div>
    </div>
  );
}

export function PeopleReportPage() {
  const data = useExpensesData();
  const currency = useCurrency();
  const directory = useDirectory();
  const companyId = useExpensesStore((s) => s.companyId);
  const defaultPeriod = React.useMemo(() => last30Days(todayIso()), []);
  const filterKey = (field: string) => hrFiltersKey('expenses', 'people-report', companyId, field);
  const [period, setPeriod] = usePersistedFilterState<PeriodRange>(filterKey('period'), defaultPeriod);
  const [slice, setSlice] = usePersistedFilterState<Slice>(filterKey('slice'), 'all');
  const [query, setQuery] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const columnsModel = useColumnVisibility(filterKey('hiddenColumns'), COLUMN_OPTIONS, HIDDEN_BY_DEFAULT);

  const rows = React.useMemo(() => {
    if (!data) return [];
    const report = peopleReport(data, { currency: currency.code, from: period.from || null, to: period.to || null });
    const q = query.trim();
    return report.filter((row) => matchesSlice(row, slice) && (!q || directory.nameOf(row.partyId).includes(q)));
  }, [data, currency.code, period, slice, query, directory]);

  const selected = rows.find((row) => row.partyId === selectedId) ?? null;
  const spentTotal = rows.reduce((t, row) => t + row.spent, 0);
  const withCustody = rows.filter((row) => row.hasCustody).length;
  const owedTotal = rows.reduce((t, row) => t + row.owedToThem, 0);
  const oweTotal = rows.reduce((t, row) => t + row.theyOwe, 0);

  const isDefaultPeriod = period.from === defaultPeriod.from && period.to === defaultPeriod.to;
  const activeFilterCount = (slice !== 'all' ? 1 : 0) + (isDefaultPeriod ? 0 : 1) + (query.trim() ? 1 : 0);

  const cellText = React.useCallback((row: PersonReportRow, key: string): string => {
    switch (key) {
      case 'name': return directory.nameOf(row.partyId);
      case 'spent': return currency.format(row.spent);
      case 'custody': return row.hasCustody ? `معه عهدة ${currency.format(row.custodyNow)}` : 'بلا عهدة';
      case 'days': return String(row.days);
      case 'owed': return currency.format(row.owedToThem);
      case 'owes': return currency.format(row.theyOwe);
      case 'spentPersonal': return currency.format(row.spentPersonal);
      case 'spentCustody': return currency.format(row.spentCustody);
      case 'borne': return currency.format(row.borne);
      case 'custodyIn': return currency.format(row.custodyIn);
      case 'custodyOut': return currency.format(row.custodyOut);
      case 'advances': return currency.format(row.advances);
      case 'paidOut': return currency.format(row.paidOut);
      case 'paidIn': return currency.format(row.paidIn);
      default: return '';
    }
  }, [currency, directory]);

  const columns = React.useMemo<ColumnDef<PersonReportRow>[]>(() => {
    const all: ColumnDef<PersonReportRow>[] = [
      { key: 'name', title: 'الشخص', sticky: 'start', render: (row) => <span className="font-medium">{directory.nameOf(row.partyId)}</span> },
      { key: 'spent', title: 'صرف في الفترة', render: (row) => <Money value={row.spent} className="font-semibold" /> },
      { key: 'custody', title: 'العهدة الآن', render: (row) => <span className="inline-flex items-center gap-1.5">{custodyLabel(row)}{row.hasCustody ? <Money value={row.custodyNow} /> : null}</span> },
      { key: 'days', title: 'أيام الفترة', render: (row) => <span className="tabular-nums">{row.days}</span> },
      { key: 'owed', title: 'له الآن', render: (row) => <Money value={row.owedToThem} className="text-success" /> },
      { key: 'owes', title: 'عليه الآن', render: (row) => <Money value={row.theyOwe} className="text-destructive" /> },
      { key: 'spentPersonal', title: 'من ماله', render: (row) => <Money value={row.spentPersonal} /> },
      { key: 'spentCustody', title: 'من عهدته', render: (row) => <Money value={row.spentCustody} /> },
      { key: 'borne', title: 'تحمّل تكلفة', render: (row) => <Money value={row.borne} /> },
      { key: 'custodyIn', title: 'عهدة استلمها', render: (row) => <Money value={row.custodyIn} /> },
      { key: 'custodyOut', title: 'عهدة أرجعها', render: (row) => <Money value={row.custodyOut} /> },
      { key: 'advances', title: 'سلف استلمها', render: (row) => <Money value={row.advances} /> },
      { key: 'paidOut', title: 'سداد دفعه', render: (row) => <Money value={row.paidOut} /> },
      { key: 'paidIn', title: 'سداد استلمه', render: (row) => <Money value={row.paidIn} /> },
    ];
    return all.filter((column) => columnsModel.isVisible(column.key));
  }, [columnsModel, directory]);

  const exportExcel = React.useCallback(async () => {
    if (rows.length === 0) {
      toast.error('لا توجد بيانات للتصدير ضمن الفلاتر الحالية.');
      return;
    }
    const sheet: XlsxCell[][] = [columns.map((column) => column.title)];
    for (const row of rows) sheet.push(columns.map((column) => cellText(row, column.key)));
    try {
      await downloadXlsxFromAoA(`تقرير-الأشخاص-${period.from || 'الكل'}-${period.to || 'الكل'}.xlsx`, 'تقرير الأشخاص', sheet);
      toast.success('تم تنزيل ملف Excel.');
    } catch {
      toast.error('تعذر تصدير التقرير.');
    }
  }, [rows, columns, cellText, period]);

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
            id: 'slice',
            value: slice,
            onChange: (value) => setSlice(value === 'spent' || value === 'custody' || value === 'owed' || value === 'owes' ? value : 'all'),
            placeholder: SLICE_LABELS.all,
            options: (Object.keys(SLICE_LABELS) as Slice[]).map((key) => ({ value: key, label: SLICE_LABELS[key] })),
          },
        ]}
      />
    ),
    [period, defaultPeriod, slice],
  );

  const loading = !data;

  return (
    <div className="flex flex-col gap-4">
      <SetPageTitle titleAr="تقرير الأشخاص" descriptionAr="لكل شخص: كم صرف وفي كم يوم خلال الفترة، وهل معه عهدة، وكم له وكم عليه الآن." iconName="Users" />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <ReportSummaryCard label="صرفوا في الفترة" value={<Money value={spentTotal} />} hint={`${rows.length} شخص`} />
        <ReportSummaryCard label="معهم عهدة الآن" value={String(withCustody)} hint="من الظاهرة أسماؤهم" />
        <ReportSummaryCard label="لهم الآن" value={<Money value={owedTotal} />} valueClassName="text-success" />
        <ReportSummaryCard label="عليهم الآن" value={<Money value={oweTotal} />} valueClassName="text-destructive" />
      </div>

      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم الشخص" className="h-10" />

      <DataTable
        variant="directory"
        columns={columns}
        data={rows}
        keyExtractor={(row) => row.partyId}
        onRowClick={(row) => setSelectedId((current) => (current === row.partyId ? null : row.partyId))}
        mobileCard={(row) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate font-medium">{directory.nameOf(row.partyId)}</p>
              {custodyLabel(row)}
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-center text-[11px]">
              <div className="rounded-lg bg-muted/50 p-1.5"><p className="text-muted-foreground">صرف في الفترة</p><Money value={row.spent} className="font-semibold" /></div>
              <div className="rounded-lg bg-muted/50 p-1.5"><p className="text-muted-foreground">الأيام</p><p className="font-semibold tabular-nums">{row.days} يوم</p></div>
              <div className="rounded-lg bg-success/10 p-1.5"><p className="text-muted-foreground">له الآن</p><Money value={row.owedToThem} className="font-semibold text-success" /></div>
              <div className="rounded-lg bg-destructive/10 p-1.5"><p className="text-muted-foreground">عليه الآن</p><Money value={row.theyOwe} className="font-semibold text-destructive" /></div>
            </div>
            {row.hasCustody ? <p className="text-xs">العهدة الآن <Money value={row.custodyNow} className="font-semibold" /></p> : null}
            {selectedId === row.partyId ? (
              <div className="space-y-2 border-t border-border pt-2" onClick={(e) => e.stopPropagation()}>
                <Breakdown row={row} />
                <Link href={expensesRoutes.personDetail(row.partyId)} className="text-xs text-primary hover:underline">كشف الحساب</Link>
              </div>
            ) : <p className="text-[11px] text-muted-foreground">اضغط لعرض المصروف والعهدة والسلف</p>}
          </div>
        )}
        loading={loading}
        emptyText="لا أشخاص ضمن الفلاتر الحالية."
      />

      {selected ? (
        <section className="hidden space-y-2 rounded-xl border border-border bg-card p-3 md:block">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{directory.nameOf(selected.partyId)}</h2>
            <Link href={expensesRoutes.personDetail(selected.partyId)} className="text-xs text-primary hover:underline">كشف الحساب</Link>
          </div>
          <Breakdown row={selected} />
        </section>
      ) : null}
    </div>
  );
}
