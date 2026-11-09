'use client';

import { ListGroupMenu } from '@/components/ui/list-group';
import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import { PhoneStatsFold } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { useAllCategories } from '@/features/catalog/categories/hooks/use-categories';
import { inventoryReportsApi, type SlowMovingQuery, type SlowMovingRow } from '@/features/inventory/admin/reports/lib/api/inventory-reports';
import { ReportStat, ValueHiddenNote, currencyLine, formatQty, formatReportMoney, itemLabel, moneyCell } from '@/features/inventory/admin/reports/lib/report-shared';
import { formatDisplayDate } from '@/shared/utils';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { ListColumnsPicker, useColumnVisibility, type ListColumnOption } from '@/components/ui/list-columns-picker';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import { ListSortMenu, listSortQuery, useListSort, type ListSortOption } from '@/components/ui/list-sort';
import type { ListTotals } from '@/components/ui/list-group';
import { fetchAllPaginatedItems } from '@/shared/api/client';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';

const SORT_OPTIONS: readonly ListSortOption[] = [
  { key: 'idleDays', label: 'أيام الركود' },
  { key: 'product', label: 'الصنف' },
  { key: 'onHand', label: 'الرصيد' },
  { key: 'value', label: 'القيمة' },
];

const COLUMN_OPTIONS: readonly ListColumnOption[] = [
  { key: 'category', label: 'الفئة' },
  { key: 'lastOut', label: 'آخر صرف' },
];

const IDLE_OPTIONS = ['30', '60', '90', '180', '365'] as const;

function lastOutLabel(row: SlowMovingRow): string {
  if (row.lastOutAt) return formatDisplayDate(row.lastOutAt);
  return row.firstInAt ? `لم يُصرف (دخل ${formatDisplayDate(row.firstInAt)})` : 'لم يُصرف';
}

export function SlowMovingReportPage() {
  const companyId = getInventoryCompanyId();
  const filterKey = (field: string) => hrFiltersKey('inventory', 'slow-moving', companyId, field);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [warehouseId, setWarehouseId] = usePersistedFilterState(filterKey('warehouse'), 'all');
  const [categoryId, setCategoryId] = usePersistedFilterState(filterKey('category'), 'all');
  const [idleDays, setIdleDays] = usePersistedFilterState(filterKey('idleDays'), '90');
  const stateKeys = listStateKeys('inventory', 'slow-moving', companyId);
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
  }, [warehouseId, categoryId, idleDays, sort.sortKey]);

  const filters: SlowMovingQuery = {
    companyId,
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
    categoryId: categoryId === 'all' ? undefined : categoryId,
    search: search || undefined,
    idleDays: Number(idleDays) || 90,
    ...listSortQuery(sort.sort),
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory', 'reports', 'slow-moving', { ...filters, page, limit: pageSize }],
    queryFn: () => inventoryReportsApi.slowMoving({ ...filters, page, limit: pageSize }),
    enabled: Boolean(companyId),
    placeholderData: keepPreviousData,
  });

  const { data: warehousesData } = useWarehouses({ companyId, limit: 100 });
  const warehouses = React.useMemo(() => warehousesData?.items ?? [], [warehousesData?.items]);
  const { data: categoriesData } = useAllCategories(companyId);
  const categories = React.useMemo(
    () => [...(categoriesData?.items ?? [])].sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar')),
    [categoriesData?.items],
  );

  const valueVisible = data?.valueVisible === true;
  const money = (v: number | null) => formatReportMoney(v, data?.currency);
  const rows = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const totals: ListTotals | null = data
    ? { count: total, sums: { onHand: data.totals.onHand, value: data.totals.value ?? 0 } }
    : null;
  const isShown = (key: string) => (key !== 'value' || valueVisible) && columnVisibility.isVisible(key);

  const columns: ColumnDef<SlowMovingRow>[] = [
    {
      key: 'product',
      title: 'الصنف',
      sortKey: 'product',
      sticky: 'start',
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
      key: 'category',
      title: 'الفئة',
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-muted-foreground">{row.categoryName ?? '—'}</span>,
    },
    {
      key: 'lastOut',
      title: 'آخر صرف',
      render: (row) => <span className="whitespace-nowrap text-sm">{lastOutLabel(row)}</span>,
    },
    {
      key: 'idleDays',
      title: 'أيام الركود',
      sortKey: 'idleDays',
      render: (row) => (
        <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400" dir="ltr">
          {row.idleDays}
        </span>
      ),
    },
    {
      key: 'onHand',
      title: 'الرصيد',
      sortKey: 'onHand',
      total: (t) => (
        <span className="font-semibold tabular-nums" dir="ltr">
          {formatQty(t.sums.onHand ?? 0)}
        </span>
      ),
      render: (row) => (
        <span className="font-semibold tabular-nums" dir="ltr">
          {formatQty(row.onHand)}
        </span>
      ),
    },
    {
      key: 'value',
      title: 'القيمة المجمّدة',
      sortKey: 'value',
      total: (t) => (
        <span className="font-semibold tabular-nums" dir="ltr">
          {money(t.sums.value ?? 0)}
        </span>
      ),
      render: (row) => (
        <span className="font-semibold tabular-nums" dir="ltr">
          {money(row.value)}
        </span>
      ),
    },
  ];
  const visibleColumns = columns.filter((column) => isShown(column.key));


  const warehouseLabel = warehouseId !== 'all' ? warehouses.find((w) => w.id === warehouseId)?.nameAr : null;
  const categoryLabel = categoryId !== 'all' ? categories.find((c) => c.id === categoryId)?.nameAr : null;
  const filterSummary = [
    `بلا صرف منذ ${filters.idleDays} يومًا أو أكثر`,
    warehouseLabel ? `المستودع: ${warehouseLabel}` : 'كل المستودعات',
    categoryLabel ? `الفئة: ${categoryLabel}` : null,
    search ? `بحث: ${search}` : null,
    currencyLine(data),
    sort.label,
  ].filter((line): line is string => Boolean(line));
  const activeFilterCount = (warehouseId !== 'all' ? 1 : 0) + (categoryId !== 'all' ? 1 : 0) + 1;

  const groupingPage = 'slow-moving-grouping';
  const tools = useListTools<SlowMovingRow>({
    section: 'inventory',
    page: groupingPage,
    columns: visibleColumns,
    rows,
    fetchAll: async () =>
      (await fetchAllPaginatedItems((p, l) => inventoryReportsApi.slowMoving({ ...filters, page: p, limit: l }))).items,
    resetKey: JSON.stringify(filters),
    fields: {
      product: { kind: 'name', sortable: false, text: (r) => itemLabel(r), alsoExport: [{ label: 'SKU', text: (r) => r.sku ?? '' }] },
      category: { sortable: false, text: (r) => r.categoryName ?? '', group: (r) => r.categoryName ?? null },
      lastOut: { sortable: false, text: lastOutLabel },
      idleDays: { kind: 'number', sortable: false, text: (r) => String(r.idleDays) },
      onHand: { kind: 'number', sortable: false, text: (r) => formatQty(r.onHand), sum: (r) => r.onHand, formatSum: formatQty },
      value: { kind: 'number', sortable: false, text: (r) => moneyCell(r.value), sum: (r) => r.value ?? 0, formatSum: moneyCell },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <ListColumnsPicker model={columnVisibility} />
        <ListSortMenu model={sort} />
        <ListSavedViews storageKey={stateKeys.views} prefixes={[...stateKeys.prefixes, ...listStateKeys('inventory', groupingPage, companyId).prefixes]} />
        <ListGroupMenu model={tools.group} />
        {tools.exportMenu('الأصناف الراكدة', 'inventory-slow-moving', filterSummary)}
      </div>
    ),
    [
      activeFilterCount,
      sort.sortKey,
      sort.label,
      columnVisibility.hiddenKey,
      JSON.stringify(filters),
      JSON.stringify(totals),
      tools.depsKey,
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
            id: 'idleDays',
            value: idleDays,
            onChange: setIdleDays,
            placeholder: 'مدة الركود',
            options: IDLE_OPTIONS.map((d) => ({ value: d, label: `بلا صرف ${d} يومًا+` })),
          },
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
            id: 'category',
            value: categoryId,
            onChange: setCategoryId,
            placeholder: 'كل الفئات',
            options: [
              { value: 'all', label: 'كل الفئات' },
              ...categories.map((c) => ({ value: c.id, label: c.nameAr })),
            ],
          },
        ]}
      />
    ),
    [searchInput, idleDays, warehouseId, categoryId, warehouses, categories],
  );

  const mobileCard = (row: SlowMovingRow) => (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{itemLabel(row)}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {row.sku || '—'}
          </p>
        </div>
        <span className="shrink-0 text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-400">
          {row.idleDays} يوم
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          الرصيد <span className="font-semibold tabular-nums text-foreground">{formatQty(row.onHand)}</span>
        </span>
        {valueVisible ? (
          <span>
            القيمة <span className="font-semibold tabular-nums text-foreground">{money(row.value)}</span>
          </span>
        ) : null}
        <span>آخر صرف: {lastOutLabel(row)}</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr="الأصناف الراكدة"
        descriptionAr="أصناف لها رصيد ولم يُصرف منها شيء (بيع أو تسليم) منذ المدة المختارة — والقيمة المجمّدة فيها."
        iconName="CalendarClock"
      />

      <PhoneStatsFold summary={<>راكدة {total.toLocaleString('en-US')}</>}>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
          <ReportStat label="أصناف راكدة" value={total.toLocaleString('en-US')} />
          <ReportStat label="إجمالي الرصيد" value={formatQty(data?.totals.onHand ?? 0)} />
          {valueVisible ? <ReportStat label="القيمة المجمّدة" value={money(data?.totals.value ?? 0)} /> : null}
        </div>
      </PhoneStatsFold>

      <ValueHiddenNote header={data} />

      {isError ? (
        <div className="flex items-center gap-3 text-sm text-destructive">
          <span>تعذر تحميل التقرير.</span>
          <button type="button" className="underline" onClick={() => void refetch()}>
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      <ListToolsTable tools={tools} keyExtractor={(row) => row.key}>
      <DirectoryPagedViews
        items={rows}
        loading={isLoading}
        serverPagination={tools.pagination({
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          setPage,
          setPageSize: (size) => {
            setPageSize(size);
            setPage(1);
          },
        })}
      >
        {(rowsPage) => (
          <DataTable
            variant="directory"
            keepHeaderWhenEmpty
            className="inv-table-host"
            columns={visibleColumns}
            mobileCard={mobileCard}
            data={rowsPage}
            keyExtractor={(row) => row.key}
            loading={isLoading}
            emptyText="لا توجد أصناف راكدة ضمن الفلاتر الحالية."
            sort={sort.sort}
            onSort={sort.toggle}
            totals={totals}
          />
        )}
      </DirectoryPagedViews>
      </ListToolsTable>
    </div>
  );
}
