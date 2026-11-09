'use client';

import { ListGroupMenu } from '@/components/ui/list-group';
import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import { PhoneStatsFold } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { useAllCategories } from '@/features/catalog/categories/hooks/use-categories';
import { inventoryAdminRoutes } from '@/features/inventory/admin/constants/routes';
import { inventoryReportsApi, type StockMovementQuery, type StockMovementRow } from '@/features/inventory/admin/reports/lib/api/inventory-reports';
import { ReportStat, ValueHiddenNote, currencyLine, currentMonthRange, formatQty, formatReportMoney, itemLabel, moneyCell, periodLabel, todayIso } from '@/features/inventory/admin/reports/lib/report-shared';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { DateRangeFilterTrigger, type DateRangeFilterValue } from '@/components/ui/date-range-filter-trigger';
import { Input } from '@/components/ui/input';
import { ListColumnsPicker, useColumnVisibility, type ListColumnOption } from '@/components/ui/list-columns-picker';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import { ListSortMenu, listSortQuery, useListSort, type ListSortOption } from '@/components/ui/list-sort';
import type { ListTotals } from '@/components/ui/list-group';
import { fetchAllPaginatedItems } from '@/shared/api/client';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';

type Mode = 'movement' | 'valuation';

const MOVEMENT_SORT_OPTIONS: readonly ListSortOption[] = [
  { key: 'product', label: 'الصنف' },
  { key: 'sku', label: 'SKU' },
  { key: 'openingQty', label: 'رصيد أول المدة' },
  { key: 'inQty', label: 'الوارد' },
  { key: 'outQty', label: 'الصادر' },
  { key: 'closingQty', label: 'رصيد آخر المدة' },
  { key: 'closingValue', label: 'قيمة آخر المدة' },
];

const VALUATION_SORT_OPTIONS: readonly ListSortOption[] = [
  { key: 'product', label: 'الصنف' },
  { key: 'sku', label: 'SKU' },
  { key: 'closingQty', label: 'الكمية' },
  { key: 'closingValue', label: 'القيمة' },
];

const MOVEMENT_COLUMN_OPTIONS: readonly ListColumnOption[] = [
  { key: 'category', label: 'الفئة' },
  { key: 'openingValue', label: 'قيمة أول المدة' },
  { key: 'inValue', label: 'قيمة الوارد' },
  { key: 'outValue', label: 'قيمة الصادر' },
  { key: 'closingValue', label: 'قيمة آخر المدة' },
];

const VALUATION_COLUMN_OPTIONS: readonly ListColumnOption[] = [
  { key: 'category', label: 'الفئة' },
  { key: 'unitCost', label: 'متوسط التكلفة' },
];

const VALUE_KEYS = new Set(['openingValue', 'inValue', 'outValue', 'closingValue', 'unitCost']);

function unitCost(row: StockMovementRow): number | null {
  if (row.closingValue == null || Math.abs(row.closingQty) < 1e-9) return null;
  return row.closingValue / row.closingQty;
}

export function StockMovementReportPage({ mode }: { mode: Mode }) {
  const valuation = mode === 'valuation';
  const router = useRouter();
  const companyId = getInventoryCompanyId();
  const listPage = valuation ? 'valuation' : 'stock-movement';
  const filterKey = (field: string) => hrFiltersKey('inventory', listPage, companyId, field);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [warehouseId, setWarehouseId] = usePersistedFilterState(filterKey('warehouse'), 'all');
  const [categoryId, setCategoryId] = usePersistedFilterState(filterKey('category'), 'all');
  const [period, setPeriod] = usePersistedFilterState<DateRangeFilterValue>(filterKey('period'), currentMonthRange());
  const [asOf, setAsOf] = usePersistedFilterState(filterKey('asOf'), '');
  const stateKeys = listStateKeys('inventory', listPage, companyId);
  const sortOptions = valuation ? VALUATION_SORT_OPTIONS : MOVEMENT_SORT_OPTIONS;
  const sort = useListSort(stateKeys.sort, sortOptions);
  const columnVisibility = useColumnVisibility(
    filterKey('hiddenColumns'),
    valuation ? VALUATION_COLUMN_OPTIONS : MOVEMENT_COLUMN_OPTIONS,
  );

  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  React.useEffect(() => {
    setPage(1);
  }, [warehouseId, categoryId, period, asOf, sort.sortKey]);

  const filters: StockMovementQuery = {
    companyId,
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
    categoryId: categoryId === 'all' ? undefined : categoryId,
    search: search || undefined,
    ...(valuation
      ? { rows: 'closing' as const, dateTo: asOf || undefined }
      : { rows: 'moved' as const, dateFrom: period.from || undefined, dateTo: period.to || undefined }),
    ...listSortQuery(sort.sort),
  };

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['inventory', 'reports', 'stock-movement', { ...filters, page, limit: pageSize }],
    queryFn: () => inventoryReportsApi.stockMovement({ ...filters, page, limit: pageSize }),
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
  const currency = data?.currency;
  const money = (v: number | null) => formatReportMoney(v, currency);
  const rows = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const totals: ListTotals | null = data
    ? {
        count: total,
        sums: {
          openingQty: data.totals.openingQty,
          inQty: data.totals.inQty,
          outQty: data.totals.outQty,
          closingQty: data.totals.closingQty,
          openingValue: data.totals.openingValue ?? 0,
          inValue: data.totals.inValue ?? 0,
          outValue: data.totals.outValue ?? 0,
          closingValue: data.totals.closingValue ?? 0,
        },
      }
    : null;
  const isShown = (key: string) => (!VALUE_KEYS.has(key) || valueVisible) && columnVisibility.isVisible(key);

  const qtyCell = (value: number, tone?: 'in' | 'out') => (
    <span
      className={
        tone === 'in'
          ? 'tabular-nums text-emerald-700 dark:text-emerald-400'
          : tone === 'out'
            ? 'tabular-nums text-rose-700 dark:text-rose-400'
            : 'font-semibold tabular-nums'
      }
      dir="ltr"
    >
      {formatQty(value)}
    </span>
  );
  const moneyText = (value: number | null, strong = false) => (
    <span className={strong ? 'font-semibold tabular-nums' : 'tabular-nums'} dir="ltr">
      {money(value)}
    </span>
  );

  const columns: ColumnDef<StockMovementRow>[] = [
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
    ...(valuation
      ? ([
          {
            key: 'closingQty',
            title: 'الكمية',
            sortKey: 'closingQty',
            total: (t) => qtyCell(t.sums.closingQty ?? 0),
            render: (row) => qtyCell(row.closingQty),
          },
          {
            key: 'unitCost',
            title: 'متوسط التكلفة',
            render: (row) => moneyText(unitCost(row)),
          },
          {
            key: 'closingValue',
            title: 'القيمة',
            sortKey: 'closingValue',
            total: (t) => moneyText(t.sums.closingValue ?? 0, true),
            render: (row) => moneyText(row.closingValue, true),
          },
        ] satisfies ColumnDef<StockMovementRow>[])
      : ([
          {
            key: 'openingQty',
            title: 'أول المدة',
            sortKey: 'openingQty',
            total: (t) => qtyCell(t.sums.openingQty ?? 0),
            render: (row) => qtyCell(row.openingQty),
          },
          {
            key: 'openingValue',
            title: 'قيمة أول المدة',
            hideOnMobile: true,
            total: (t) => moneyText(t.sums.openingValue ?? 0),
            render: (row) => moneyText(row.openingValue),
          },
          {
            key: 'inQty',
            title: 'الوارد',
            sortKey: 'inQty',
            total: (t) => qtyCell(t.sums.inQty ?? 0, 'in'),
            render: (row) => qtyCell(row.inQty, 'in'),
          },
          {
            key: 'inValue',
            title: 'قيمة الوارد',
            hideOnMobile: true,
            total: (t) => moneyText(t.sums.inValue ?? 0),
            render: (row) => moneyText(row.inValue),
          },
          {
            key: 'outQty',
            title: 'الصادر',
            sortKey: 'outQty',
            total: (t) => qtyCell(t.sums.outQty ?? 0, 'out'),
            render: (row) => qtyCell(row.outQty, 'out'),
          },
          {
            key: 'outValue',
            title: 'قيمة الصادر',
            hideOnMobile: true,
            total: (t) => moneyText(t.sums.outValue ?? 0),
            render: (row) => moneyText(row.outValue),
          },
          {
            key: 'closingQty',
            title: 'آخر المدة',
            sortKey: 'closingQty',
            total: (t) => qtyCell(t.sums.closingQty ?? 0),
            render: (row) => qtyCell(row.closingQty),
          },
          {
            key: 'closingValue',
            title: 'قيمة آخر المدة',
            sortKey: 'closingValue',
            total: (t) => moneyText(t.sums.closingValue ?? 0, true),
            render: (row) => moneyText(row.closingValue, true),
          },
        ] satisfies ColumnDef<StockMovementRow>[])),
  ];
  const visibleColumns = columns.filter((column) => isShown(column.key));


  const warehouseLabel = warehouseId !== 'all' ? warehouses.find((w) => w.id === warehouseId)?.nameAr : null;
  const categoryLabel = categoryId !== 'all' ? categories.find((c) => c.id === categoryId)?.nameAr : null;
  const filterSummary = [
    valuation ? `في تاريخ: ${asOf || todayIso()}` : `الفترة: ${periodLabel(period.from, period.to)}`,
    warehouseLabel ? `المستودع: ${warehouseLabel}` : 'كل المستودعات',
    categoryLabel ? `الفئة: ${categoryLabel}` : null,
    search ? `بحث: ${search}` : null,
    currencyLine(data),
    sort.label,
  ].filter((line): line is string => Boolean(line));
  const activeFilterCount =
    (warehouseId !== 'all' ? 1 : 0) + (categoryId !== 'all' ? 1 : 0) + (valuation ? (asOf ? 1 : 0) : 1);

  const groupingPage = `${listPage}-grouping`;
  const tools = useListTools<StockMovementRow>({
    section: 'inventory',
    page: groupingPage,
    columns: visibleColumns,
    rows,
    fetchAll: async () =>
      (await fetchAllPaginatedItems((p, l) => inventoryReportsApi.stockMovement({ ...filters, page: p, limit: l }))).items,
    resetKey: JSON.stringify(filters),
    fields: {
      product: { kind: 'name', sortable: false, text: (r) => itemLabel(r), alsoExport: [{ label: 'SKU', text: (r) => r.sku ?? '' }] },
      category: { sortable: false, text: (r) => r.categoryName ?? '', group: (r) => r.categoryName ?? null },
      unitCost: { kind: 'number', sortable: false, text: (r) => moneyCell(unitCost(r)) },
      openingQty: { kind: 'number', sortable: false, text: (r) => formatQty(r.openingQty), sum: (r) => r.openingQty ?? 0, formatSum: formatQty },
      openingValue: { kind: 'number', sortable: false, text: (r) => moneyCell(r.openingValue), sum: (r) => r.openingValue ?? 0, formatSum: moneyCell },
      inQty: { kind: 'number', sortable: false, text: (r) => formatQty(r.inQty), sum: (r) => r.inQty ?? 0, formatSum: formatQty },
      inValue: { kind: 'number', sortable: false, text: (r) => moneyCell(r.inValue), sum: (r) => r.inValue ?? 0, formatSum: moneyCell },
      outQty: { kind: 'number', sortable: false, text: (r) => formatQty(r.outQty), sum: (r) => r.outQty ?? 0, formatSum: formatQty },
      outValue: { kind: 'number', sortable: false, text: (r) => moneyCell(r.outValue), sum: (r) => r.outValue ?? 0, formatSum: moneyCell },
      closingQty: { kind: 'number', sortable: false, text: (r) => formatQty(r.closingQty), sum: (r) => r.closingQty ?? 0, formatSum: formatQty },
      closingValue: { kind: 'number', sortable: false, text: (r) => moneyCell(r.closingValue), sum: (r) => r.closingValue ?? 0, formatSum: moneyCell },
    },
  });

  const title = valuation ? 'تقييم المخزون' : 'حركة المخزون الدورية';
  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <ListColumnsPicker model={columnVisibility} />
        <ListSortMenu model={sort} />
        <ListSavedViews storageKey={stateKeys.views} prefixes={[...stateKeys.prefixes, ...listStateKeys('inventory', groupingPage, companyId).prefixes]} />
        <ListGroupMenu model={tools.group} />
        {tools.exportMenu(title, valuation ? 'inventory-valuation' : 'inventory-stock-movement', filterSummary)}
      </div>
    ),
    [
      title,
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
          <EntityFilterSearchField
            value={searchInput}
            onChange={setSearchInput}
            placeholder="ابحث بالاسم أو SKU أو الباركود…"
          />
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
        trailingActions={
          valuation ? (
            <div className="inv-date-filters">
              <Input
                type="date"
                className="inv-date-input h-8"
                value={asOf}
                max={todayIso()}
                onChange={(e) => setAsOf(e.target.value)}
                aria-label="في تاريخ"
                title="في تاريخ (فارغ = اليوم)"
              />
            </div>
          ) : (
            <DateRangeFilterTrigger value={period} onChange={setPeriod} placeholder="الفترة" allowEmpty />
          )
        }
      />
    ),
    [searchInput, warehouseId, categoryId, period, asOf, warehouses, categories, valuation],
  );

  const openItemCard = (row: StockMovementRow) => {
    const params = new URLSearchParams({ productId: row.productId });
    if (row.variantId) params.set('variantId', row.variantId);
    if (warehouseId !== 'all') params.set('warehouseId', warehouseId);
    if (valuation) {
      if (asOf) params.set('to', asOf);
    } else {
      if (period.from) params.set('from', period.from);
      if (period.to) params.set('to', period.to);
    }
    router.push(`${inventoryAdminRoutes.reportItemCard}?${params.toString()}`);
  };

  const mobileCard = (row: StockMovementRow) => (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{itemLabel(row)}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {row.sku || '—'}
          </p>
        </div>
        <div className="shrink-0 text-end">
          <p className="text-lg font-semibold tabular-nums" dir="ltr">
            {formatQty(row.closingQty)}
          </p>
          {valueVisible ? (
            <p className="text-xs tabular-nums text-muted-foreground" dir="ltr">
              {money(row.closingValue)}
            </p>
          ) : null}
        </div>
      </div>
      {valuation ? null : (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            أول المدة <span className="tabular-nums text-foreground">{formatQty(row.openingQty)}</span>
          </span>
          <span>
            وارد <span className="tabular-nums text-emerald-700 dark:text-emerald-400">{formatQty(row.inQty)}</span>
          </span>
          <span>
            صادر <span className="tabular-nums text-rose-700 dark:text-rose-400">{formatQty(row.outQty)}</span>
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr={title}
        descriptionAr={
          valuation
            ? 'رصيد كل صنف وقيمته في تاريخ محدد (نهاية اليوم بتوقيت الشركة). اضغط صنفًا لفتح كرت الصنف.'
            : 'لكل صنف: رصيد أول المدة، والوارد، والصادر، ورصيد آخر المدة — بالكمية والقيمة. اضغط صنفًا لفتح كرت الصنف.'
        }
        iconName={valuation ? 'Coins' : 'CalendarRange'}
      />

      <PhoneStatsFold>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {valuation ? (
            <>
              <ReportStat label="عدد الأصناف" value={total.toLocaleString('en-US')} />
              <ReportStat label="إجمالي الكمية" value={formatQty(data?.totals.closingQty ?? 0)} />
              {valueVisible ? (
                <ReportStat label="قيمة المخزون" value={money(data?.totals.closingValue ?? 0)} />
              ) : null}
            </>
          ) : (
            <>
              <ReportStat
                label="أول المدة"
                value={formatQty(data?.totals.openingQty ?? 0)}
                hint={valueVisible ? money(data?.totals.openingValue ?? 0) : undefined}
              />
              <ReportStat
                label="الوارد"
                tone="in"
                value={formatQty(data?.totals.inQty ?? 0)}
                hint={valueVisible ? money(data?.totals.inValue ?? 0) : undefined}
              />
              <ReportStat
                label="الصادر"
                tone="out"
                value={formatQty(data?.totals.outQty ?? 0)}
                hint={valueVisible ? money(data?.totals.outValue ?? 0) : undefined}
              />
              <ReportStat
                label="آخر المدة"
                value={formatQty(data?.totals.closingQty ?? 0)}
                hint={valueVisible ? money(data?.totals.closingValue ?? 0) : undefined}
              />
            </>
          )}
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

      <ListToolsTable tools={tools} keyExtractor={(row) => row.key} onRowClick={openItemCard}>
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
            loading={isLoading || (isFetching && rows.length === 0)}
            emptyText="لا توجد أصناف ضمن الفلاتر الحالية — جرّب تعديل الفترة أو الفلاتر."
            sort={sort.sort}
            onSort={sort.toggle}
            totals={totals}
            onRowClick={openItemCard}
          />
        )}
      </DirectoryPagedViews>
      </ListToolsTable>
    </div>
  );
}
