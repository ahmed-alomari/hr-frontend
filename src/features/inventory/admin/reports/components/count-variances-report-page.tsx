'use client';

import * as React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { WAREHOUSE_OPERATION_KIND_META } from '@/features/inventory/domain/constants/warehouse-operation-kinds';
import {
  inventoryReportsApi,
  type CountVarianceQuery,
  type CountVarianceRow,
} from '@/features/inventory/admin/reports/lib/api/inventory-reports';
import {
  ReportStat,
  ValueHiddenNote,
  currencyLine,
  currentMonthRange,
  formatQty,
  formatReportMoney,
  itemLabel,
  moneyCell,
  periodLabel,
} from '@/features/inventory/admin/reports/lib/report-shared';
import { formatDateTime } from '@/shared/utils';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { DateRangeFilterTrigger, type DateRangeFilterValue } from '@/components/ui/date-range-filter-trigger';
import { ListColumnsPicker, useColumnVisibility, type ListColumnOption } from '@/components/ui/list-columns-picker';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import { ListSortMenu, listSortQuery, useListSort, type ListSortOption } from '@/components/ui/list-sort';
import type { ListTotals } from '@/components/ui/list-group';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import {
  registerExportRows,
  visibleExportColumns,
  type RegisterExportColumn,
} from '@/components/pdf/lib/register-export-rows';
import { fetchAllPaginatedItems } from '@/shared/api/client';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';

const SORT_OPTIONS: readonly ListSortOption[] = [
  { key: 'occurredAt', label: 'التاريخ' },
  { key: 'product', label: 'الصنف' },
  { key: 'difference', label: 'الفرق' },
  { key: 'differenceValue', label: 'قيمة الفرق' },
];

const COLUMN_OPTIONS: readonly ListColumnOption[] = [
  { key: 'location', label: 'الموقع' },
  { key: 'systemQty', label: 'رصيد النظام' },
  { key: 'countedQty', label: 'المعدود' },
];

type Direction = 'all' | 'shortage' | 'surplus';

export function CountVariancesReportPage() {
  const companyId = getInventoryCompanyId();
  const filterKey = (field: string) => hrFiltersKey('inventory', 'count-variances', companyId, field);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [warehouseId, setWarehouseId] = usePersistedFilterState(filterKey('warehouse'), 'all');
  const [direction, setDirection] = usePersistedFilterState<Direction>(filterKey('direction'), 'all');
  const [period, setPeriod] = usePersistedFilterState<DateRangeFilterValue>(filterKey('period'), currentMonthRange());
  const stateKeys = listStateKeys('inventory', 'count-variances', companyId);
  const sort = useListSort(stateKeys.sort, SORT_OPTIONS);
  const columnVisibility = useColumnVisibility(filterKey('hiddenColumns'), COLUMN_OPTIONS);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  React.useEffect(() => {
    setPage(1);
  }, [warehouseId, direction, period, sort.sortKey]);

  const filters: CountVarianceQuery = {
    companyId,
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
    direction: direction === 'all' ? undefined : direction,
    search: search || undefined,
    dateFrom: period.from || undefined,
    dateTo: period.to || undefined,
    ...listSortQuery(sort.sort),
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory', 'reports', 'count-variances', { ...filters, page, limit: pageSize }],
    queryFn: () => inventoryReportsApi.countVariances({ ...filters, page, limit: pageSize }),
    enabled: Boolean(companyId),
    placeholderData: keepPreviousData,
  });

  const { data: warehousesData } = useWarehouses({ companyId, limit: 100 });
  const warehouses = React.useMemo(() => warehousesData?.items ?? [], [warehousesData?.items]);

  const valueVisible = data?.valueVisible === true;
  const money = (v: number | null) => formatReportMoney(v, data?.currency);
  const rows = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const t = data?.totals;
  const totals: ListTotals | null = t
    ? {
        count: total,
        sums: { difference: t.surplusQty - t.shortageQty, differenceValue: t.netValue ?? 0 },
      }
    : null;
  const isShown = (key: string) => (key !== 'differenceValue' || valueVisible) && columnVisibility.isVisible(key);

  const diffCell = (value: number) => (
    <span
      className={
        value < 0
          ? 'font-semibold tabular-nums text-rose-700 dark:text-rose-400'
          : 'font-semibold tabular-nums text-emerald-700 dark:text-emerald-400'
      }
      dir="ltr"
    >
      {value > 0 ? `+${formatQty(value)}` : formatQty(value)}
    </span>
  );

  const columns: ColumnDef<CountVarianceRow>[] = [
    {
      key: 'date',
      title: 'التاريخ',
      sortKey: 'occurredAt',
      sticky: 'start',
      render: (row) => <span className="whitespace-nowrap text-sm">{formatDateTime(row.occurredAt)}</span>,
    },
    {
      key: 'document',
      title: 'المستند',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium" dir="ltr">
            {row.reference}
          </span>
          <span className="text-xs text-muted-foreground">{WAREHOUSE_OPERATION_KIND_META[row.kind]?.labelAr}</span>
        </div>
      ),
    },
    {
      key: 'product',
      title: 'الصنف',
      sortKey: 'product',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{itemLabel(row)}</span>
          <span className="text-xs text-muted-foreground" dir="ltr">
            {row.sku || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'location',
      title: 'المستودع / الموقع',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm">
          {row.warehouseName ?? '—'}
          {row.locationName ? <span className="text-muted-foreground"> · {row.locationName}</span> : null}
        </span>
      ),
    },
    {
      key: 'systemQty',
      title: 'رصيد النظام',
      render: (row) => (
        <span className="tabular-nums" dir="ltr">
          {formatQty(row.systemQty)}
        </span>
      ),
    },
    {
      key: 'countedQty',
      title: 'المعدود',
      render: (row) => (
        <span className="tabular-nums" dir="ltr">
          {formatQty(row.countedQty)}
        </span>
      ),
    },
    {
      key: 'difference',
      title: 'الفرق',
      sortKey: 'difference',
      total: (tt) => diffCell(tt.sums.difference ?? 0),
      render: (row) => diffCell(row.difference),
    },
    {
      key: 'differenceValue',
      title: 'قيمة الفرق',
      sortKey: 'differenceValue',
      total: (tt) => (
        <span className="font-semibold tabular-nums" dir="ltr">
          {money(tt.sums.differenceValue ?? 0)}
        </span>
      ),
      render: (row) => (
        <span className="font-semibold tabular-nums" dir="ltr">
          {money(row.differenceValue)}
        </span>
      ),
    },
  ];
  const visibleColumns = columns.filter((column) => isShown(column.key));

  const exportColumns = visibleExportColumns<CountVarianceRow>(
    [
      { label: 'التاريخ', kind: 'date', value: (r) => formatDateTime(r.occurredAt) },
      { label: 'المستند', kind: 'code', value: (r) => r.reference },
      { label: 'الصنف', kind: 'name', value: (r) => itemLabel(r) },
      { label: 'SKU', kind: 'code', value: (r) => r.sku ?? '' },
      {
        label: 'المستودع / الموقع',
        kind: 'text',
        key: 'location',
        value: (r) => [r.warehouseName, r.locationName].filter(Boolean).join(' · '),
      },
      { label: 'رصيد النظام', kind: 'number', key: 'systemQty', value: (r) => formatQty(r.systemQty) },
      { label: 'المعدود', kind: 'number', key: 'countedQty', value: (r) => formatQty(r.countedQty) },
      {
        label: 'الفرق',
        kind: 'number',
        key: 'difference',
        value: (r) => formatQty(r.difference),
        total: (tt) => formatQty(tt.sums.difference),
      },
      {
        label: 'قيمة الفرق',
        kind: 'number',
        key: 'differenceValue',
        value: (r) => moneyCell(r.differenceValue),
        total: (tt) => moneyCell(tt.sums.differenceValue),
      },
    ] satisfies RegisterExportColumn<CountVarianceRow>[],
    isShown,
  );

  const warehouseLabel = warehouseId !== 'all' ? warehouses.find((w) => w.id === warehouseId)?.nameAr : null;
  const filterSummary = [
    `الفترة: ${periodLabel(period.from, period.to)}`,
    warehouseLabel ? `المستودع: ${warehouseLabel}` : 'كل المستودعات',
    direction === 'shortage' ? 'العجز فقط' : direction === 'surplus' ? 'الزيادة فقط' : null,
    search ? `بحث: ${search}` : null,
    currencyLine(data),
    sort.label,
  ].filter((line): line is string => Boolean(line));
  const activeFilterCount = (warehouseId !== 'all' ? 1 : 0) + (direction !== 'all' ? 1 : 0) + 1;

  const getExportRows = async () => {
    const { items } = await fetchAllPaginatedItems((p, l) =>
      inventoryReportsApi.countVariances({ ...filters, page: p, limit: l }),
    );
    return registerExportRows({ columns: exportColumns, rows: items, total: totals });
  };

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <ListColumnsPicker model={columnVisibility} />
        <ListSortMenu model={sort} />
        <ListSavedViews storageKey={stateKeys.views} prefixes={stateKeys.prefixes} />
        <RegisterExportMenu
          title="فروقات الجرد"
          fileName="inventory-count-variances"
          columns={exportColumns}
          getRows={getExportRows}
          subtitleLines={filterSummary}
          landscape
          pinnedColumnCount={1}
          emptyMessage="لا توجد فروقات جرد ضمن الفلاتر الحالية."
        />
      </div>
    ),
    [
      activeFilterCount,
      sort.sortKey,
      sort.label,
      columnVisibility.hiddenKey,
      JSON.stringify(filters),
      JSON.stringify(totals),
      exportColumns.length,
      filterSummary.join('|'),
      stateKeys.views,
    ],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        leadingFilters={
          <EntityFilterSearchField value={searchInput} onChange={setSearchInput} placeholder="ابحث بالصنف أو SKU…" />
        }
        inlineSelects={[
          {
            id: 'warehouse',
            value: warehouseId,
            onChange: setWarehouseId,
            placeholder: 'كل المستودعات',
            options: [
              { value: 'all', label: 'كل المستودعات' },
              ...warehouses.map((w) => ({ value: w.id, label: w.nameAr })),
            ],
          },
          {
            id: 'direction',
            value: direction,
            onChange: (value) => setDirection(value as Direction),
            placeholder: 'العجز والزيادة',
            options: [
              { value: 'all', label: 'العجز والزيادة' },
              { value: 'shortage', label: 'العجز فقط' },
              { value: 'surplus', label: 'الزيادة فقط' },
            ],
          },
        ]}
        trailingActions={
          <DateRangeFilterTrigger value={period} onChange={setPeriod} placeholder="الفترة" allowEmpty />
        }
      />
    ),
    [searchInput, warehouseId, direction, period, warehouses],
  );

  const mobileCard = (row: CountVarianceRow) => (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{itemLabel(row)}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {row.sku || '—'}
          </p>
        </div>
        <div className="shrink-0 text-end text-lg">{diffCell(row.difference)}</div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          النظام <span className="tabular-nums text-foreground">{formatQty(row.systemQty)}</span>
        </span>
        <span>
          المعدود <span className="tabular-nums text-foreground">{formatQty(row.countedQty)}</span>
        </span>
        {valueVisible ? (
          <span>
            القيمة <span className="font-semibold tabular-nums text-foreground">{money(row.differenceValue)}</span>
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground" dir="ltr">
            {row.reference}
          </span>{' '}
          · {row.warehouseName ?? '—'}
        </span>
        <span className="whitespace-nowrap">{formatDateTime(row.occurredAt)}</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr="فروقات الجرد"
        descriptionAr="الفرق بين رصيد النظام والمعدود في كل جرد وتسوية منتهية: العجز والزيادة بالكمية والقيمة."
        iconName="ClipboardList"
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <ReportStat label="مستندات" value={(t?.documents ?? 0).toLocaleString('en-US')} hint={`${total} بند`} />
        <ReportStat
          label="العجز"
          tone="out"
          value={formatQty(t?.shortageQty ?? 0)}
          hint={valueVisible ? money(t?.shortageValue ?? 0) : undefined}
        />
        <ReportStat
          label="الزيادة"
          tone="in"
          value={formatQty(t?.surplusQty ?? 0)}
          hint={valueVisible ? money(t?.surplusValue ?? 0) : undefined}
        />
        {valueVisible ? <ReportStat label="صافي القيمة" value={money(t?.netValue ?? 0)} /> : null}
      </div>

      <ValueHiddenNote header={data} />

      {isError ? (
        <div className="flex items-center gap-3 text-sm text-destructive">
          <span>تعذر تحميل التقرير.</span>
          <button type="button" className="underline" onClick={() => void refetch()}>
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      <DirectoryPagedViews
        items={rows}
        loading={isLoading}
        serverPagination={{
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          setPage,
          setPageSize: (size) => {
            setPageSize(size);
            setPage(1);
          },
        }}
      >
        {(rowsPage) => (
          <DataTable
            variant="directory"
            keepHeaderWhenEmpty
            className="inv-table-host"
            columns={visibleColumns}
            mobileCard={mobileCard}
            data={rowsPage}
            keyExtractor={(row) => row.lineId}
            loading={isLoading}
            emptyText="لا توجد فروقات جرد ضمن الفلاتر الحالية."
            sort={sort.sort}
            onSort={sort.toggle}
            totals={totals}
          />
        )}
      </DirectoryPagedViews>
    </div>
  );
}
