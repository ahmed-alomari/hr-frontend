'use client';

import * as React from 'react';
import Link from 'next/link';
import { PhoneStatsFold } from '@/components/layouts/phone-fold';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { Badge } from '@/components/ui/badge';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { ListFilterBar, type PeriodRange } from '@/components/ui/list-filter-bar';
import { LocalListTable, LocalListToolbar, useLocalList, type LocalListField } from '@/components/ui/local-list';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';
import { useExpensesStore } from '../data/store';
import { peopleReport, type PersonReportRow } from '../domain/reports';
import { expensesRoutes } from '../constants/routes';
import { EmptyState, LoadingBlock, Money } from './common';
import { last30Days, ReportSummaryCard } from './report-common';
import { todayIso, useCurrency, useDirectory, useExpensesData } from './expenses-provider';

type Slice = 'all' | 'spent' | 'custody' | 'owed' | 'owes';

const SLICE_LABELS: Record<Slice, string> = {
  all: 'كل الأشخاص',
  spent: 'صرفوا في الفترة',
  custody: 'معهم عهدة',
  owed: 'لهم رصيد',
  owes: 'عليهم رصيد',
};

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
  const [query, setQuery] = usePersistedFilterState(filterKey('query'), '');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const rows = React.useMemo(() => {
    if (!data) return [];
    const report = peopleReport(data, { currency: currency.code, from: period.from || null, to: period.to || null });
    const q = query.trim();
    return report.filter((row) => matchesSlice(row, slice) && (!q || directory.nameOf(row.partyId).includes(q)));
  }, [data, currency.code, period, slice, query, directory]);

  const fields = React.useMemo<LocalListField<PersonReportRow>[]>(() => {
    const money = (key: keyof PersonReportRow & string, label: string, opts: Partial<LocalListField<PersonReportRow>> = {}): LocalListField<PersonReportRow> => ({
      key,
      label,
      kind: 'number',
      text: (r) => currency.format(r[key] as number),
      sortValue: (r) => r[key] as number,
      sum: (r) => r[key] as number,
      formatSum: currency.format,
      cell: (r) => <Money value={r[key] as number} />,
      ...opts,
    });
    return [
      { key: 'name', label: 'الشخص', kind: 'name', text: (r) => directory.nameOf(r.partyId), cell: (r) => <span className="font-medium">{directory.nameOf(r.partyId)}</span> },
      money('spent', 'صرف في الفترة', { cell: (r) => <Money value={r.spent} className="font-semibold" /> }),
      { key: 'custody', label: 'العهدة الآن', text: (r) => (r.hasCustody ? `معه عهدة ${currency.format(r.custodyNow)}` : 'بلا عهدة'), sortValue: (r) => r.custodyNow, cell: (r) => <span className="inline-flex items-center gap-1.5">{custodyLabel(r)}{r.hasCustody ? <Money value={r.custodyNow} /> : null}</span>, groupKey: (r) => (r.hasCustody ? 'yes' : 'no'), groupLabel: (k) => (k === 'yes' ? 'معه عهدة' : 'بلا عهدة') },
      { key: 'days', label: 'أيام الفترة', kind: 'number', text: (r) => String(r.days), sortValue: (r) => r.days, groupKey: (r) => (r.days === 0 ? '0' : r.days <= 5 ? '1-5' : r.days <= 15 ? '6-15' : '16+'), groupLabel: (k) => (k === '0' ? 'لم يصرف' : `${k} يوم`) },
      money('owedToThem', 'له الآن', { cell: (r) => <Money value={r.owedToThem} className="text-success" /> }),
      money('theyOwe', 'عليه الآن', { cell: (r) => <Money value={r.theyOwe} className="text-destructive" /> }),
      money('spentPersonal', 'من ماله', { optional: true, hiddenByDefault: true }),
      money('spentCustody', 'من عهدته', { optional: true, hiddenByDefault: true }),
      money('borne', 'تحمّل تكلفة', { optional: true, hiddenByDefault: true }),
      money('custodyIn', 'عهدة استلمها', { optional: true, hiddenByDefault: true }),
      money('custodyOut', 'عهدة أرجعها', { optional: true, hiddenByDefault: true }),
      money('advances', 'سلف استلمها', { optional: true, hiddenByDefault: true }),
      money('paidOut', 'سداد دفعه', { optional: true, hiddenByDefault: true }),
      money('paidIn', 'سداد استلمه', { optional: true, hiddenByDefault: true }),
    ];
  }, [currency, directory]);
  const list = useLocalList({ section: 'expenses', page: 'people-report', fields, rows });

  const selected = rows.find((row) => row.partyId === selectedId) ?? null;
  const spentTotal = rows.reduce((t, row) => t + row.spent, 0);
  const withCustody = rows.filter((row) => row.hasCustody).length;
  const owedTotal = rows.reduce((t, row) => t + row.owedToThem, 0);
  const oweTotal = rows.reduce((t, row) => t + row.theyOwe, 0);

  const isDefaultPeriod = period.from === defaultPeriod.from && period.to === defaultPeriod.to;
  const activeFilterCount = (slice !== 'all' ? 1 : 0) + (isDefaultPeriod ? 0 : 1) + (query.trim() ? 1 : 0);
  const periodLine = `الفترة: ${period.from || '…'} إلى ${period.to || '…'}`;

  usePageHeaderActions(
    () => (
      <LocalListToolbar
        list={list}
        title="تقرير الأشخاص"
        fileName={`people-report-${period.from || 'all'}-${period.to || 'all'}`}
        subtitleLines={[periodLine, slice !== 'all' ? SLICE_LABELS[slice] : ''].filter(Boolean)}
        before={<FilterToggleButton activeFilterCount={activeFilterCount} />}
      />
    ),
    [activeFilterCount, list.rows, list.visibleFields, list.groups, list.sort.sortKey, periodLine, slice],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showStatusSection={false}
        showEmployeePicker={false}
        leadingFilters={<EntityFilterSearchField value={query} onChange={setQuery} placeholder="ابحث باسم الشخص" />}
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
    [period, defaultPeriod, slice, query],
  );

  if (!data) return <LoadingBlock />;

  return (
    <div className="flex flex-col gap-4">
      <SetPageTitle titleAr="تقرير الأشخاص" descriptionAr="لكل شخص: كم صرف وفي كم يوم خلال الفترة، وهل معه عهدة، وكم له وكم عليه الآن." iconName="Users" />

      <PhoneStatsFold summary={<>صرفوا <Money value={spentTotal} /></>}>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <ReportSummaryCard label="صرفوا في الفترة" value={<Money value={spentTotal} />} hint={`${rows.length} شخص`} />
          <ReportSummaryCard label="معهم عهدة الآن" value={String(withCustody)} hint="من الظاهرة أسماؤهم" />
          <ReportSummaryCard label="لهم الآن" value={<Money value={owedTotal} />} valueClassName="text-success" />
          <ReportSummaryCard label="عليهم الآن" value={<Money value={oweTotal} />} valueClassName="text-destructive" />
        </div>
      </PhoneStatsFold>

      <LocalListTable
        list={list}
        rowKey={(row) => row.partyId}
        onRowClick={(row) => setSelectedId((current) => (current === row.partyId ? null : row.partyId))}
        empty={<EmptyState text="لا أشخاص ضمن الفلاتر الحالية." />}
        card={(row) => (
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
