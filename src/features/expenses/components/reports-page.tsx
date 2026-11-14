'use client';

import * as React from 'react';
import { PhoneStatsFold } from '@/components/layouts/phone-fold';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { ListFilterBar, type PeriodRange } from '@/components/ui/list-filter-bar';
import { LocalListTable, LocalListToolbar, useLocalList, type LocalListField } from '@/components/ui/local-list';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';
import { useExpensesStore } from '../data/store';
import { formatDisplayDate } from '@/shared/utils';
import { cashReport, expenseReport, expensesCsv, filterExpenses, type ExpenseReport, type ReportFilter, type Row } from '../domain/reports';
import { ORG } from '../domain/types';
import { EmptyState, LoadingBlock, Money } from './common';
import { last30Days, ReportExportMenu, ReportSummaryCard, ShareBar } from './report-common';
import { todayIso, useCurrency, useDirectory, useExpensesData } from './expenses-provider';

type GroupBy = 'day' | 'week' | 'month' | 'category' | 'bearer' | 'source' | 'group' | 'center' | 'creator';

const GROUP_BY_LABELS: Record<GroupBy, string> = {
  day: 'اليوم',
  week: 'الأسبوع',
  month: 'الشهر',
  category: 'الفئة',
  bearer: 'من يتحمل التكلفة',
  source: 'مصدر الدفع',
  group: 'المجموعة',
  center: 'مركز التكلفة',
  creator: 'من سجّل',
};

const ALL = 'all';

function rowsOf(report: ExpenseReport, groupBy: GroupBy): Row[] {
  switch (groupBy) {
    case 'day':
    case 'week':
    case 'month':
      return [...report.series].reverse();
    case 'category':
      return report.byCategory;
    case 'bearer':
      return report.byBearer;
    case 'source':
      return report.byPaymentSource;
    case 'group':
      return report.byGroup;
    case 'center':
      return report.byCostCenter;
    case 'creator':
      return report.byCreator;
  }
}

export function ReportsPage() {
  const data = useExpensesData();
  const currency = useCurrency();
  const directory = useDirectory();
  const defaultPeriod = React.useMemo(() => last30Days(todayIso()), []);
  const companyId = useExpensesStore((s) => s.companyId);
  const filterKey = (field: string) => hrFiltersKey('expenses', 'reports', companyId, field);
  const [period, setPeriod] = usePersistedFilterState<PeriodRange>(filterKey('period'), defaultPeriod);
  const [groupBy, setGroupBy] = usePersistedFilterState<GroupBy>(filterKey('groupBy'), 'day');
  const [personId, setPersonId] = usePersistedFilterState(filterKey('person'), ALL);
  const [categoryId, setCategoryId] = usePersistedFilterState(filterKey('category'), ALL);
  const [groupId, setGroupId] = usePersistedFilterState(filterKey('group'), ALL);
  const [centerId, setCenterId] = usePersistedFilterState(filterKey('center'), ALL);
  const [status, setStatus] = usePersistedFilterState<'all' | 'pending'>(filterKey('status'), ALL);

  const advanced = data?.settings.mode === 'advanced';
  const groups = React.useMemo(() => data?.groups ?? [], [data?.groups]);
  const centers = React.useMemo(() => (advanced ? (data?.costCenters ?? []) : []), [advanced, data?.costCenters]);
  const categories = React.useMemo(() => data?.categories ?? [], [data?.categories]);

  const filter = React.useMemo<ReportFilter>(
    () => ({
      currency: currency.code,
      from: period.from || null,
      to: period.to || null,
      participantIds: personId === ALL ? [] : [personId],
      categoryIds: categoryId === ALL ? [] : [categoryId],
      groupIds: groupId === ALL ? [] : [groupId],
      costCenterIds: centerId === ALL ? [] : [centerId],
      includePending: status === 'pending',
    }),
    [currency.code, period, personId, categoryId, groupId, centerId, status],
  );

  const periodBucket = groupBy === 'week' || groupBy === 'month' ? groupBy : 'day';
  const report = React.useMemo(() => (data ? expenseReport(data, filter, periodBucket) : null), [data, filter, periodBucket]);
  const cash = React.useMemo(() => (data ? cashReport(data, filter) : null), [data, filter]);
  const rows = React.useMemo(() => (report ? rowsOf(report, groupBy) : []), [report, groupBy]);
  const maxAmount = React.useMemo(() => Math.max(0, ...rows.map((r) => r.amount)), [rows]);
  const totalAmount = React.useMemo(() => rows.reduce((t, r) => t + r.amount, 0), [rows]);

  const labelOf = React.useCallback(
    (key: string) => {
      switch (groupBy) {
        case 'day':
          return formatDisplayDate(key);
        case 'week':
          return `أسبوع ${formatDisplayDate(key)}`;
        case 'month':
          return key;
        case 'category':
          return categories.find((c) => c.id === key)?.name ?? '—';
        case 'bearer':
          return key === ORG ? 'المنشأة' : directory.nameOf(key);
        case 'source':
          return key === 'org' ? 'صندوق المنشأة' : key === 'custody' ? 'من العهد' : 'من مال الأشخاص';
        case 'group':
          return key === '—' ? 'بلا مجموعة' : (groups.find((g) => g.id === key)?.name ?? key);
        case 'center': {
          if (key === '—') return 'بلا مركز';
          const c = centers.find((x) => x.id === key);
          return c ? `${c.code} ${c.name}` : key;
        }
        case 'creator':
          return directory.nameOf(key);
      }
    },
    [groupBy, categories, groups, centers, directory],
  );

  const isDefaultPeriod = period.from === defaultPeriod.from && period.to === defaultPeriod.to;
  const activeFilterCount =
    [personId, categoryId, groupId, centerId, status].filter((v) => v !== ALL).length
    + (groupBy !== 'day' ? 1 : 0)
    + (isDefaultPeriod ? 0 : 1);

  const exportCsv = React.useCallback(() => {
    if (!data) return;
    const csv = expensesCsv(filterExpenses(data, filter), {
      category: (id) => categories.find((c) => c.id === id)?.name ?? '—',
      party: (id) => directory.nameOf(id),
      money: currency.format,
    });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${filter.from ?? 'all'}-${filter.to ?? 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, filter, categories, directory, currency]);

  const fields = React.useMemo<LocalListField<Row>[]>(() => [
    { key: 'label', label: GROUP_BY_LABELS[groupBy], kind: 'name', text: (r) => labelOf(r.key), cell: (r) => <span className="font-medium">{labelOf(r.key)}</span> },
    { key: 'count', label: 'العمليات', kind: 'number', text: (r) => String(r.count), sortValue: (r) => r.count, sum: (r) => r.count, formatSum: String },
    { key: 'amount', label: 'المبلغ', kind: 'number', text: (r) => currency.format(r.amount), sortValue: (r) => r.amount, sum: (r) => r.amount, formatSum: currency.format, cell: (r) => <Money value={r.amount} className="font-semibold" /> },
    { key: 'share', label: 'النسبة', optional: true, kind: 'number', sortValue: (r) => r.amount, text: (r) => `${totalAmount > 0 ? Math.round((r.amount / totalAmount) * 100) : 0}%`, cell: (r) => <ShareBar value={r.amount} max={maxAmount} total={totalAmount} /> },
  ], [groupBy, labelOf, currency, totalAmount, maxAmount]);
  const list = useLocalList({ section: 'expenses', page: 'reports', fields, rows });
  const periodLine = period.from || period.to ? `الفترة: ${period.from || '…'} إلى ${period.to || '…'}` : null;

  usePageHeaderActions(
    () => (
      <LocalListToolbar
        list={list}
        title={`تحليل المصروفات حسب ${GROUP_BY_LABELS[groupBy]}`}
        fileName={`expenses-report-${period.from || 'all'}-${period.to || 'all'}`}
        subtitleLines={periodLine ? [periodLine] : []}
        before={<><FilterToggleButton activeFilterCount={activeFilterCount} /><ReportExportMenu onCsv={exportCsv} label="تصدير العمليات CSV" /></>}
      />
    ),
    [activeFilterCount, exportCsv, groupBy, period.from, period.to, periodLine, list.rows, list.visibleFields, list.groups, list.sort.sortKey],
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
            id: 'groupBy',
            value: groupBy === 'day' ? ALL : groupBy,
            onChange: (v) => setGroupBy(v === ALL ? 'day' : (v as GroupBy)),
            placeholder: `حسب ${GROUP_BY_LABELS.day}`,
            options: [
              { value: ALL, label: `حسب ${GROUP_BY_LABELS.day}` },
              ...(Object.keys(GROUP_BY_LABELS) as GroupBy[])
                .filter((k) => k !== 'day' && (k !== 'center' || advanced) && (k !== 'group' || groups.length > 0))
                .map((k) => ({ value: k, label: `حسب ${GROUP_BY_LABELS[k]}` })),
            ],
          },
          {
            id: 'person',
            value: personId,
            onChange: setPersonId,
            placeholder: 'كل الأشخاص',
            options: [{ value: ALL, label: 'كل الأشخاص' }, ...directory.choices.map((p) => ({ value: p.id, label: p.name }))],
          },
          {
            id: 'category',
            value: categoryId,
            onChange: setCategoryId,
            placeholder: 'كل الفئات',
            options: [{ value: ALL, label: 'كل الفئات' }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
          },
          ...(groups.length > 0
            ? [{
                id: 'group',
                value: groupId,
                onChange: setGroupId,
                placeholder: 'كل المجموعات',
                options: [{ value: ALL, label: 'كل المجموعات' }, ...groups.map((g) => ({ value: g.id, label: g.name }))],
              }]
            : []),
          ...(centers.length > 0
            ? [{
                id: 'center',
                value: centerId,
                onChange: setCenterId,
                placeholder: 'كل مراكز التكلفة',
                options: [{ value: ALL, label: 'كل مراكز التكلفة' }, ...centers.map((c) => ({ value: c.id, label: `${c.code} ${c.name}` }))],
              }]
            : []),
          {
            id: 'status',
            value: status,
            onChange: (v) => setStatus(v === 'pending' ? 'pending' : ALL),
            placeholder: 'المعتمد فقط',
            options: [
              { value: ALL, label: 'المعتمد فقط' },
              { value: 'pending', label: 'يشمل المعلق' },
            ],
          },
        ]}
      />
    ),
    [period, defaultPeriod, groupBy, personId, categoryId, groupId, centerId, status, advanced, groups, centers, categories, directory.choices],
  );

  if (!data) return <LoadingBlock />;

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle titleAr="تحليل المصروفات" descriptionAr="المصروفات حسب الفترة والأشخاص والمجموعات والفئات ومراكز التكلفة." iconName="BarChart3" />

      <PhoneStatsFold summary={<Money value={report?.total ?? 0} />}>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <ReportSummaryCard label="إجمالي المصروفات" value={<Money value={report?.total ?? 0} />} hint={`${report?.count ?? 0} عملية`} />
          <ReportSummaryCard label="معلق (خارج الإجمالي)" value={<Money value={report?.pendingTotal ?? 0} />} valueClassName="text-warning" hint={`${report?.pendingCount ?? 0} عملية`} />
          <ReportSummaryCard label="صافي خروج النقد" value={<Money value={cash?.netOutflow ?? 0} />} hint="يشمل تمويل العهد" />
          <ReportSummaryCard label="متوسط العملية" value={<Money value={report?.count ? Math.round(report.total / report.count) : 0} />} />
        </div>
      </PhoneStatsFold>

      <LocalListTable
        list={list}
        rowKey={(row) => row.key}
        empty={<EmptyState text="لا مصروفات ضمن الفلاتر الحالية." />}
        card={(row) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate font-medium">{labelOf(row.key)}</p>
              <Money value={row.amount} className="shrink-0 font-semibold" />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{row.count} عملية</span>
              <div className="flex-1"><ShareBar value={row.amount} max={maxAmount} total={totalAmount} /></div>
            </div>
          </div>
        )}
      />
    </div>
  );
}
