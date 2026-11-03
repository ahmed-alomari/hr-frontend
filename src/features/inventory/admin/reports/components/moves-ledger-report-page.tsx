'use client';

import * as React from 'react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { useInventoryLedger } from '@/features/inventory/admin/operations/hooks/use-inventory-ledger';
import { useWarehouseLocations } from '@/features/inventory/admin/locations/hooks/use-warehouse-locations';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import {
  WAREHOUSE_OPERATION_KINDS,
  WAREHOUSE_OPERATION_KIND_META,
} from '@/features/inventory/domain/constants/warehouse-operation-kinds';
import type { InboundProductValueSummary, InventoryLedgerEntry } from '@/features/inventory/domain/types/inventory-ledger';
import type {
  WarehouseLocation,
  WarehouseOperationKind,
} from '@/features/inventory/domain/types/warehouse';
import { useCan } from '@/features/auth/hooks/use-can';
import { companyCurrencyCode } from '@/features/auth/lib/company-currency';
import { currencySymbolAr } from '@/shared/currencies';
import { formatDateTime } from '@/shared/utils';
import {
  LocationRouteChips,
  WarehouseChip,
  WarehouseRouteChips,
} from '@/features/inventory/admin/operations/components/inventory-chips';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { DateRangeFilterTrigger, type DateRangeFilterValue } from '@/components/ui/date-range-filter-trigger';
import { GroupedDataTable } from '@/components/ui/grouped-data-table';
import { ListColumnsPicker, useColumnVisibility } from '@/components/ui/list-columns-picker';
import { ListGroupMenu, listGroupQuery, useGroupedList, useListGroup } from '@/components/ui/list-group';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import { ListSortMenu, listSortQuery, useListSort } from '@/components/ui/list-sort';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import { registerExportRows, visibleExportColumns } from '@/components/pdf/lib/register-export-rows';
import { fetchAllPaginatedItems } from '@/shared/api/client';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';
import { inventoryLedgerApi } from '@/features/inventory/admin/operations/lib/api/inventory-ledger';
import {
  LEDGER_COLUMN_OPTIONS,
  LEDGER_GROUP_MEASURES,
  LEDGER_GROUP_OPTIONS,
  LEDGER_SORT_OPTIONS,
  ledgerExportColumns,
  ledgerTotalsLabel,
} from '@/features/inventory/admin/reports/lib/ledger-list-options';

/**
 * Each ledger row holds its own side of the movement; the counterpart is the
 * other side. A negative delta means the row *is* the source, a positive one
 * means it is the destination — so the route has to be read from the sign.
 */
function movementRoute(entry: InventoryLedgerEntry) {
  const isDestination = entry.quantityDelta >= 0;
  const counterpartWarehouseId =
    entry.counterpartWarehouseId && entry.counterpartWarehouseId !== entry.warehouseId
      ? entry.counterpartWarehouseId
      : undefined;
  return {
    crossWarehouse: Boolean(counterpartWarehouseId),
    fromWarehouseId: isDestination ? counterpartWarehouseId : entry.warehouseId,
    toWarehouseId: isDestination ? entry.warehouseId : counterpartWarehouseId,
    fromLocationId: isDestination ? entry.counterpartLocationId : entry.locationId,
    toLocationId: isDestination ? entry.locationId : entry.counterpartLocationId,
  };
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbolAr(companyCurrencyCode())}`;
}

function localDateBoundary(date: string, endOfDay = false): string | undefined {
  if (!date) return undefined;
  const value = new Date(`${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
}

function formatLocationFilterLabel(
  location: WarehouseLocation,
  warehouseLabel: string | undefined,
  includeWarehouse: boolean,
): string {
  const name = location.nameAr?.trim() || location.code;
  const code =
    location.code && name !== location.code ? ` · ${location.code}` : '';
  if (!includeWarehouse) return `${name}${code}`;
  const wh = warehouseLabel?.trim() || '—';
  return `${wh} · ${name}${code}`;
}

export function MovesLedgerReportPage({ inboundOnly = false }: { inboundOnly?: boolean } = {}) {
  const companyId = getInventoryCompanyId();
  const canReadCost = useCan()('inv.warehouse.costs.read');
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  // Filters, sort, grouping and columns: kept per user and company, and per
  // report (the moves log and the inbound report keep their own).
  const listPage = inboundOnly ? 'inbound' : 'moves';
  const filterKey = (field: string) => hrFiltersKey('inventory', listPage, companyId, field);
  const [warehouseId, setWarehouseId] = usePersistedFilterState(filterKey('warehouse'), 'all');
  const [locationId, setLocationId] = usePersistedFilterState(filterKey('location'), 'all');
  const [kind, setKind] = usePersistedFilterState<'all' | WarehouseOperationKind>(filterKey('kind'), 'all');
  const [dateRange, setDateRange] = usePersistedFilterState<DateRangeFilterValue>(filterKey('period'), {
    from: '',
    to: '',
  });
  const stateKeys = listStateKeys('inventory', listPage, companyId);
  const sort = useListSort(stateKeys.sort, LEDGER_SORT_OPTIONS);
  const group = useListGroup(stateKeys.group, LEDGER_GROUP_OPTIONS, LEDGER_GROUP_MEASURES);
  // The inbound report has its own per-item summary; it is not grouped.
  const groupBy = inboundOnly ? null : group.groupBy;
  const columnVisibility = useColumnVisibility(filterKey('hiddenColumns'), LEDGER_COLUMN_OPTIONS);
  const sortQuery = listSortQuery(sort.sort);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  React.useEffect(() => {
    setPage(1);
  }, [warehouseId, locationId, kind, dateRange, sort.sortKey]);

  // A location belongs to one warehouse — clear it when the user picks
  // another warehouse (not on the first render: the saved pair stays).
  const lastWarehouseRef = React.useRef(warehouseId);
  React.useEffect(() => {
    if (lastWarehouseRef.current === warehouseId) return;
    lastWarehouseRef.current = warehouseId;
    setLocationId('all');
  }, [warehouseId, setLocationId]);

  const ledgerFilters = {
    companyId,
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
    locationId: locationId === 'all' ? undefined : locationId,
    kind: kind === 'all' ? undefined : kind,
    flow: inboundOnly && kind === 'all' ? ('inbound' as const) : undefined,
    occurredAtFrom: localDateBoundary(dateRange.from),
    occurredAtTo: localDateBoundary(dateRange.to, true),
    search: search || undefined,
  };
  const { data, isLoading, isError } = useInventoryLedger(
    { ...ledgerFilters, ...sortQuery, page, limit: pageSize },
    { enabled: !groupBy },
  );
  // Grouped: the groups (count, in / out / net) and the movements of the open
  // ones; flat: the grand total over every page (the totals row).
  const grouped = useGroupedList<InventoryLedgerEntry>({
    enabled: Boolean(companyId) && !inboundOnly,
    groupBy,
    resetKey: JSON.stringify({ ...ledgerFilters, ...sortQuery }),
    fetchGroups: () => inventoryLedgerApi.groups({ ...ledgerFilters, ...listGroupQuery(groupBy) }),
    fetchGroupRows: (groupValue, p, l) =>
      inventoryLedgerApi.list({ ...ledgerFilters, ...sortQuery, ...listGroupQuery(groupBy), groupValue, page: p, limit: l }),
  });
  const { data: warehousesData } = useWarehouses({ companyId, limit: 100 });
  // Unscoped — a cross-warehouse transfer's counterpart location can belong to
  // a warehouse other than the one selected in the filter, so the name lookup
  // needs every location, not just the filtered warehouse's.
  const { data: locationsData } = useWarehouseLocations({ companyId, all: true, limit: 500 });

  const warehouses = React.useMemo(() => warehousesData?.items ?? [], [warehousesData?.items]);
  const warehouseName = React.useMemo(
    () => new Map(warehouses.map((item) => [item.id, item.nameAr])),
    [warehouses],
  );
  const locations = React.useMemo(() => locationsData?.items ?? [], [locationsData?.items]);
  const locationName = React.useMemo(() => {
    const map = new Map(locations.map((item) => [item.id, item.nameAr || item.code]));
    return (id?: string) => (id ? (map.get(id) ?? id) : '—');
  }, [locations]);
  const scopedToWarehouse = warehouseId !== 'all';
  // Scoped to one warehouse when picked; otherwise every location is labeled
  // with its warehouse so duplicate names (e.g. several «داخلي») stay distinct.
  const locationOptions = React.useMemo(() => {
    const pool = scopedToWarehouse
      ? locations.filter((item) => item.warehouseId === warehouseId)
      : locations;
    return [...pool].sort((a, b) => {
      if (!scopedToWarehouse) {
        const whCmp = (warehouseName.get(a.warehouseId) ?? '').localeCompare(
          warehouseName.get(b.warehouseId) ?? '',
          'ar',
        );
        if (whCmp !== 0) return whCmp;
      }
      return (a.nameAr || a.code).localeCompare(b.nameAr || b.code, 'ar');
    });
  }, [locations, warehouseId, scopedToWarehouse, warehouseName]);

  const rows = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const productSummary = data?.productSummary ?? [];
  const inboundValue = productSummary.reduce((sum, row) => sum + row.totalValue, 0);

  const exportColumns = visibleExportColumns(
    ledgerExportColumns({
      warehouse: (id) => (id ? (warehouseName.get(id) ?? '') : ''),
      location: (id) => (id ? locationName(id) : ''),
    }),
    columnVisibility.isVisible,
  );
  const filterSummary = [
    search ? `بحث: ${search}` : null,
    warehouseId !== 'all' ? `المستودع: ${warehouseName.get(warehouseId) ?? ''}` : null,
    locationId !== 'all' ? `الموقع: ${locationName(locationId)}` : null,
    kind !== 'all' ? `النوع: ${WAREHOUSE_OPERATION_KIND_META[kind].labelAr}` : null,
    dateRange.from || dateRange.to ? `الفترة: ${dateRange.from || '…'} — ${dateRange.to || '…'}` : null,
    sort.label,
    groupBy ? group.label : null,
  ].filter((line): line is string => Boolean(line));
  const activeFilterCount =
    (warehouseId !== 'all' ? 1 : 0) +
    (locationId !== 'all' ? 1 : 0) +
    (kind !== 'all' ? 1 : 0) +
    (dateRange.from || dateRange.to ? 1 : 0);

  /** Every filtered movement (all pages) in the screen's order, grouped like the screen. */
  const getExportRows = async () => {
    const query = { ...ledgerFilters, ...sortQuery, ...listGroupQuery(groupBy) };
    const [{ items: all }, summary] = await Promise.all([
      fetchAllPaginatedItems((p, l) => inventoryLedgerApi.list({ ...query, page: p, limit: l })),
      inventoryLedgerApi.groups(query),
    ]);
    return registerExportRows({
      columns: exportColumns,
      rows: all,
      total: summary.total,
      grouping:
        groupBy && group.option
          ? {
              fieldLabel: group.option.label,
              groups: group.sortGroups(summary.groups),
              labelOf: group.labelOf,
              groupKeyOf: (entry) => entry.groupKey,
            }
          : undefined,
    });
  };

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <ListColumnsPicker model={columnVisibility} />
        <ListSortMenu model={sort} />
        {inboundOnly ? null : <ListGroupMenu model={group} />}
        <ListSavedViews storageKey={stateKeys.views} prefixes={stateKeys.prefixes} />
        <RegisterExportMenu
          title={inboundOnly ? 'سجل وارد الأصناف' : 'سجل الحركات'}
          fileName={inboundOnly ? 'inventory-inbound' : 'inventory-moves'}
          columns={exportColumns}
          getRows={getExportRows}
          subtitleLines={filterSummary}
          landscape
          pinnedColumnCount={1}
          emptyMessage="لا توجد حركات للتصدير ضمن الفلاتر الحالية."
        />
      </div>
    ),
    [
      inboundOnly,
      activeFilterCount,
      sort.sortKey,
      sort.label,
      group.groupKey,
      group.label,
      columnVisibility.hiddenKey,
      JSON.stringify(ledgerFilters),
      exportColumns.length,
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
            placeholder="ابحث بالمرجع أو المنتج…"
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
              ...warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.nameAr })),
            ],
          },
          {
            id: 'location',
            value: locationId,
            onChange: setLocationId,
            placeholder: scopedToWarehouse ? 'كل المواقع' : 'الموقع (مع المستودع)',
            options: [
              { value: 'all', label: 'كل المواقع' },
              ...locationOptions.map((location) => ({
                value: location.id,
                label: formatLocationFilterLabel(
                  location,
                  warehouseName.get(location.warehouseId),
                  !scopedToWarehouse,
                ),
              })),
            ],
          },
          {
            id: 'kind',
            value: kind,
            onChange: (value) => setKind(value as typeof kind),
            placeholder: 'كل الأنواع',
            options: [
              { value: 'all', label: inboundOnly ? 'كل الوارد' : 'كل الأنواع' },
              ...WAREHOUSE_OPERATION_KINDS.filter(
                (item) =>
                  !inboundOnly ||
                  WAREHOUSE_OPERATION_KIND_META[item].stockEffect === 'inbound',
              ).map((item) => ({
                value: item,
                label: WAREHOUSE_OPERATION_KIND_META[item].labelAr,
              })),
            ],
          },
        ]}
        trailingActions={
          <DateRangeFilterTrigger
            value={dateRange}
            onChange={setDateRange}
            placeholder="نطاق التاريخ"
            allowEmpty
          />
        }
      />
    ),
    [
      searchInput,
      warehouseId,
      locationId,
      locationOptions,
      scopedToWarehouse,
      warehouseName,
      kind,
      dateRange,
      warehouses,
      inboundOnly,
    ],
  );

  const columns: ColumnDef<InventoryLedgerEntry>[] = [
    {
      key: 'date',
      title: 'التاريخ',
      sortKey: 'occurredAt',
      sticky: 'start',
      render: (row) => (
        <span className="text-sm whitespace-nowrap">
          {formatDateTime(row.occurredAt)}
        </span>
      ),
    },
    {
      key: 'reference',
      title: 'المرجع',
      sortKey: 'reference',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium" dir="ltr">
            {row.operationReference}
          </span>
          <span className="text-xs text-muted-foreground">
            {WAREHOUSE_OPERATION_KIND_META[row.kind].labelAr}
          </span>
        </div>
      ),
    },
    {
      key: 'warehouse',
      title: 'المستودع',
      sortKey: 'warehouse',
      render: (row) => {
        const route = movementRoute(row);
        return route.crossWarehouse ? (
          <WarehouseRouteChips
            from={warehouseName.get(route.fromWarehouseId ?? '')}
            to={warehouseName.get(route.toWarehouseId ?? '')}
          />
        ) : (
          <WarehouseChip name={warehouseName.get(row.warehouseId)} />
        );
      },
    },
    {
      key: 'product',
      title: 'المنتج',
      sortKey: 'product',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.productName}</span>
          <span className="text-xs text-muted-foreground" dir="ltr">
            {row.sku || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'location',
      title: 'الموقع',
      hideOnMobile: true,
      render: (row) => {
        const route = movementRoute(row);
        return (
          <LocationRouteChips
            from={route.fromLocationId ? locationName(route.fromLocationId) : null}
            to={route.toLocationId ? locationName(route.toLocationId) : null}
          />
        );
      },
    },
    {
      key: 'delta',
      title: inboundOnly ? 'الكمية الداخلة' : 'التغيير',
      sortKey: 'quantity',
      total: (totals) => <span className="text-xs font-semibold tabular-nums">{ledgerTotalsLabel(totals)}</span>,
      render: (row) => (
        <span
          className={
            row.quantityDelta >= 0
              ? 'font-semibold text-emerald-700 tabular-nums dark:text-emerald-400'
              : 'font-semibold text-rose-700 tabular-nums dark:text-rose-400'
          }
          dir="ltr"
        >
          {row.quantityDelta >= 0 ? `+${row.quantityDelta}` : row.quantityDelta}
        </span>
      ),
    },
    ...(inboundOnly && canReadCost
      ? ([
          {
            key: 'unitCost',
            title: 'سعر الدخول',
            render: (row) => (
              <span className="tabular-nums" dir="ltr">
                {formatMoney(row.unitCost)}
              </span>
            ),
          },
          {
            key: 'lineValue',
            title: 'قيمة الدخلة',
            render: (row) => (
              <span className="font-semibold tabular-nums" dir="ltr">
                {row.unitCost == null ? '—' : formatMoney(row.quantityDelta * row.unitCost)}
              </span>
            ),
          },
        ] satisfies ColumnDef<InventoryLedgerEntry>[])
      : []),
    {
      key: 'source',
      title: 'المصدر',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.sourceDocument || row.partnerName || '—'}</span>
      ),
    },
  ];

  const visibleColumns = columns.filter((column) => columnVisibility.isVisible(column.key));

  /** Phones: what moved and by how much first, then the document, when and where. */
  const ledgerMobileCard = (row: InventoryLedgerEntry) => {
    const route = movementRoute(row);
    const hasLocations = Boolean(route.fromLocationId || route.toLocationId);
    return (
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{row.productName}</p>
            <p className="text-xs text-muted-foreground" dir="ltr">
              {row.sku || '—'}
            </p>
          </div>
          <span
            className={
              row.quantityDelta >= 0
                ? 'shrink-0 text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400'
                : 'shrink-0 text-lg font-semibold tabular-nums text-rose-700 dark:text-rose-400'
            }
            dir="ltr"
          >
            {row.quantityDelta >= 0 ? `+${row.quantityDelta}` : row.quantityDelta}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground" dir="ltr">
              {row.operationReference}
            </span>{' '}
            · {WAREHOUSE_OPERATION_KIND_META[row.kind].labelAr}
          </span>
          <span className="whitespace-nowrap">{formatDateTime(row.occurredAt)}</span>
        </div>
        {hasLocations ? (
          <LocationRouteChips
            from={route.fromLocationId ? locationName(route.fromLocationId) : null}
            to={route.toLocationId ? locationName(route.toLocationId) : null}
          />
        ) : null}
        {inboundOnly && canReadCost ? (
          <p className="text-xs text-muted-foreground">
            سعر الدخول <span className="tabular-nums text-foreground" dir="ltr">{formatMoney(row.unitCost)}</span>
            {row.unitCost != null ? (
              <>
                {' '}
                · القيمة{' '}
                <span className="font-semibold tabular-nums text-foreground" dir="ltr">
                  {formatMoney(row.quantityDelta * row.unitCost)}
                </span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    );
  };

  const productColumns: ColumnDef<InboundProductValueSummary>[] = [
    {
      key: 'product',
      title: 'الصنف',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.productName}</span>
          <span className="text-xs text-muted-foreground" dir="ltr">
            {row.sku || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'entries',
      title: 'عدد الدخلات',
      render: (row) => <span className="tabular-nums">{row.entries}</span>,
    },
    {
      key: 'quantity',
      title: 'الكمية الداخلة',
      render: (row) => (
        <span className="font-semibold tabular-nums" dir="ltr">
          {row.quantity}
        </span>
      ),
    },
    {
      key: 'average',
      title: 'متوسط سعر الدخول',
      render: (row) => (
        <span className="tabular-nums" dir="ltr">
          {formatMoney(row.averageUnitCost)}
        </span>
      ),
    },
    {
      key: 'value',
      title: 'إجمالي القيمة',
      render: (row) => (
        <span className="font-semibold tabular-nums" dir="ltr">
          {formatMoney(row.totalValue)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr={inboundOnly ? 'وارد الأصناف' : 'سجل الحركات'}
        descriptionAr={
          inboundOnly
            ? 'كل صنف دخل إلى المخزون: متوسط سعر دخوله على مستوى الصنف، ثم كل دخلة بتاريخها وكمية وسعرها.'
            : 'دفتر قيود ثابت — كل تصديق يكتب بنودًا غير قابلة للتعديل. التراجع يضيف قيود عكس.'
        }
        iconName={inboundOnly ? 'Package' : 'FileText'}
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="subtle">قيود: {data?.summary.entries ?? total}</Badge>
        <Badge variant="success">
          وارد: {(inboundOnly ? data?.summary.net : data?.summary.qtyIn) ?? 0}
        </Badge>
        {inboundOnly && canReadCost ? (
          <Badge variant="subtle">قيمة الداخل: {formatMoney(inboundValue)}</Badge>
        ) : inboundOnly ? null : (
          <>
            <Badge variant="destructive">صادر: {data?.summary.qtyOut ?? 0}</Badge>
            <Badge variant="subtle">الصافي: {data?.summary.net ?? 0}</Badge>
          </>
        )}
      </div>

      {isError ? <p className="text-sm text-destructive">تعذر تحميل سجل الحركات.</p> : null}

      {inboundOnly ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">على مستوى الصنف</h2>
          <p className="text-xs text-muted-foreground">
            مجموع كميات الصنف التي دخلت، ومتوسط أسعار تلك الدخلات، وإجمالي قيمتها.
          </p>
          <DataTable
            variant="directory"
            keepHeaderWhenEmpty
            className="inv-table-host"
            columns={
              canReadCost
                ? productColumns
                : productColumns.filter((column) => column.key !== 'average' && column.key !== 'value')
            }
            mobileCard={(row) => (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.productName}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {row.sku || '—'}
                    </p>
                  </div>
                  <span className="shrink-0 text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400" dir="ltr">
                    +{row.quantity}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {row.entries} دخلات
                    {canReadCost ? (
                      <>
                        {' '}
                        · متوسط{' '}
                        <span className="tabular-nums text-foreground" dir="ltr">
                          {formatMoney(row.averageUnitCost)}
                        </span>
                      </>
                    ) : null}
                  </span>
                  {canReadCost ? (
                    <span>
                      القيمة{' '}
                      <span className="font-semibold tabular-nums text-foreground" dir="ltr">
                        {formatMoney(row.totalValue)}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
            )}
            data={productSummary}
            keyExtractor={(row) => `${row.productId}:${row.variantId ?? ''}:${row.sku ?? ''}`}
            loading={isLoading}
            emptyText="لا توجد دخلات في هذا النطاق."
          />
        </section>
      ) : null}

      {inboundOnly ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">دخلات الصنف</h2>
          <DataTable
            variant="directory"
            keepHeaderWhenEmpty
            className="inv-table-host"
            columns={columns}
            mobileCard={ledgerMobileCard}
            data={rows}
            keyExtractor={(row) => row.id}
            loading={isLoading}
            emptyText="لا توجد قيود بعد — صدّق مستندًا لتسجيل أول حركة."
          />
        </section>
      ) : (
      groupBy ? (
        <GroupedDataTable
          columns={visibleColumns}
          group={group}
          list={grouped}
          keyExtractor={(row) => row.id}
          sort={sort.sort}
          onSort={sort.toggle}
          emptyText="لا توجد حركات ضمن الفلاتر الحالية."
        />
      ) : (
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
            mobileCard={ledgerMobileCard}
            data={rowsPage}
            keyExtractor={(row) => row.id}
            loading={isLoading}
            emptyText="لا توجد قيود بعد — صدّق مستندًا لتسجيل أول حركة."
            sort={sort.sort}
            onSort={sort.toggle}
            totals={grouped.summary?.total}
          />
        )}
      </DirectoryPagedViews>
      )
      )}
    </div>
  );
}
