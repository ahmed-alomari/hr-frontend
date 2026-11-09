'use client';

import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { Badge } from '@/components/ui/badge';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { Input } from '@/components/ui/input';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { batchColumns, BatchesTable } from '@/features/inventory/admin/batches/components/batches-table';
import { useInventoryBatches } from '@/features/inventory/admin/batches/hooks/use-inventory-batches';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { useWarehouseLocations } from '@/features/inventory/admin/locations/hooks/use-warehouse-locations';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { inventoryBatchesApi } from '@/features/inventory/admin/batches/lib/api/inventory-batches';
import type { InventoryBatch, InventoryBatchAvailability, InventoryBatchSort } from '@/features/inventory/domain/types/inventory-batch';
import { fetchAllPaginatedItems } from '@/shared/api/client';
import { formatDateTime, formatDisplayDate, formatMoneyDigits } from '@/shared/utils';

const AVAILABILITY_OPTIONS: { value: InventoryBatchAvailability; label: string }[] = [
  { value: 'available', label: 'دفعات متوفرة' },
  { value: 'depleted', label: 'دفعات مستنفدة' },
  { value: 'all', label: 'كل الدفعات' },
];

const SORT_OPTIONS: { value: InventoryBatchSort; label: string }[] = [
  { value: 'newest', label: 'الأحدث دخولًا' },
  { value: 'oldest', label: 'الأقدم دخولًا (FIFO)' },
  { value: 'expiry', label: 'الأقرب انتهاءً (FEFO)' },
  { value: 'remaining', label: 'الأكبر كمية متبقية' },
];

function localDateBoundary(date: string, endOfDay = false): string | undefined {
  if (!date) return undefined;
  const value = new Date(`${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
}

function qty(value: number): string {
  return formatMoneyDigits(value, Number.isInteger(value) ? 0 : 2);
}

export function BatchesReportPage() {
  const companyId = getInventoryCompanyId();
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [warehouseId, setWarehouseId] = React.useState('all');
  const [locationId, setLocationId] = React.useState('all');
  const [availability, setAvailability] = React.useState<InventoryBatchAvailability>('available');
  const [sort, setSort] = React.useState<InventoryBatchSort>('newest');
  const [expiryBefore, setExpiryBefore] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  React.useEffect(() => {
    setPage(1);
  }, [warehouseId, locationId, availability, sort, expiryBefore]);

  // A location belongs to one warehouse, so a stale location would contradict it.
  React.useEffect(() => {
    setLocationId('all');
  }, [warehouseId]);

  const batchFilters = {
    companyId,
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
    locationId: locationId === 'all' ? undefined : locationId,
    availability,
    sort,
    expiryBefore: localDateBoundary(expiryBefore, true),
    search: search || undefined,
  };
  const { data, isLoading, isError } = useInventoryBatches({ ...batchFilters, page, limit: pageSize });
  const { data: warehousesData } = useWarehouses({ companyId, limit: 100 });
  const { data: locationsData } = useWarehouseLocations(
    {
      companyId,
      warehouseId: warehouseId === 'all' ? undefined : warehouseId,
      limit: 500,
    },
    { enabled: Boolean(companyId) },
  );

  const warehouses = React.useMemo(() => warehousesData?.items ?? [], [warehousesData?.items]);
  const locations = React.useMemo(() => locationsData?.items ?? [], [locationsData?.items]);

  const rows = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const summary = data?.summary;

  const warehouseLabel = warehouseId !== 'all' ? warehouses.find((w) => w.id === warehouseId)?.nameAr : null;
  const locationLabel = locationId !== 'all' ? locations.find((l) => l.id === locationId) : null;
  const filterSummary = [
    warehouseLabel ? `المستودع: ${warehouseLabel}` : 'كل المستودعات',
    locationLabel ? `الموقع: ${locationLabel.nameAr || locationLabel.code}` : null,
    AVAILABILITY_OPTIONS.find((o) => o.value === availability)?.label ?? null,
    expiryBefore ? `تنتهي قبل: ${expiryBefore}` : null,
    search ? `بحث: ${search}` : null,
    `الترتيب: ${SORT_OPTIONS.find((o) => o.value === sort)?.label ?? sort}`,
  ].filter((line): line is string => Boolean(line));

  const columns = React.useMemo(() => batchColumns(), []);
  const tools = useListTools<InventoryBatch>({
    section: 'inventory',
    page: 'batches',
    columns,
    rows,
    fetchAll: async () =>
      (await fetchAllPaginatedItems((p, l) => inventoryBatchesApi.list({ ...batchFilters, page: p, limit: l }))).items,
    resetKey: JSON.stringify(batchFilters),
    fields: {
      occurredAt: { kind: 'date', text: (b) => formatDateTime(b.occurredAt), sort: (b) => b.occurredAt, group: (b) => b.occurredAt.slice(0, 7) },
      product: {
        kind: 'name',
        text: (b) => b.productName,
        group: (b) => b.productName,
        alsoExport: [{ label: 'SKU', text: (b) => b.variantSku || b.sku || '' }],
      },
      variant: { text: (b) => b.variantName ?? '—', group: (b) => b.variantName ?? null },
      warehouse: { text: (b) => b.warehouseName, group: (b) => b.warehouseName },
      location: { text: (b) => b.locationName || b.locationCode, group: (b) => b.locationName || b.locationCode },
      quantity: { kind: 'number', text: (b) => qty(b.quantity), sort: (b) => b.quantity, sum: (b) => b.quantity, formatSum: qty },
      consumed: { kind: 'number', text: (b) => qty(b.consumedQuantity), sort: (b) => b.consumedQuantity, sum: (b) => b.consumedQuantity, formatSum: qty },
      remaining: { kind: 'number', text: (b) => qty(b.remainingQuantity), sort: (b) => b.remainingQuantity, sum: (b) => b.remainingQuantity, formatSum: qty },
      expiry: { kind: 'date', text: (b) => (b.expiryDate ? formatDisplayDate(b.expiryDate) : ''), sort: (b) => b.expiryDate ?? '', group: (b) => (b.expiryDate ? b.expiryDate.slice(0, 7) : null) },
      origin: { kind: 'code', text: (b) => (b.isOpening ? 'رصيد افتتاحي' : (b.sourceOperationReference ?? '')), sortable: false },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton />
        {tools.buttons}
        {tools.exportMenu('دفعات المخزون', 'inventory-batches', filterSummary)}
      </div>
    ),
    [JSON.stringify(batchFilters), filterSummary.join('|'), tools.depsKey],
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
            placeholder="ابحث بالمنتج أو الرمز أو مرجع الحركة…"
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
              ...warehouses.map((warehouse) => ({
                value: warehouse.id,
                label: warehouse.nameAr,
              })),
            ],
          },
          {
            id: 'location',
            value: locationId,
            onChange: setLocationId,
            placeholder: 'كل المواقع',
            options: [
              { value: 'all', label: 'كل المواقع' },
              ...locations.map((location) => ({
                value: location.id,
                label: location.nameAr || location.code,
              })),
            ],
          },
          {
            id: 'availability',
            value: availability,
            onChange: (value) => setAvailability(value as InventoryBatchAvailability),
            placeholder: 'التوفر',
            options: AVAILABILITY_OPTIONS,
          },
          {
            id: 'sort',
            value: sort,
            onChange: (value) => setSort(value as InventoryBatchSort),
            placeholder: 'الترتيب',
            options: SORT_OPTIONS,
          },
        ]}
        trailingActions={
          <div className="inv-date-filters">
            <Input
              type="date"
              className="inv-date-input h-8"
              value={expiryBefore}
              onChange={(e) => setExpiryBefore(e.target.value)}
              aria-label="تنتهي صلاحيتها قبل"
              title="تنتهي صلاحيتها قبل"
            />
          </div>
        }
      />
    ),
    [searchInput, warehouseId, locationId, availability, sort, expiryBefore, warehouses, locations],
  );

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr="دفعات المخزون"
        descriptionAr="طبقات الكمية التي أنشأتها حركات الاستلام والتحويل، ويُصرف منها بترتيب FIFO/LIFO/FEFO حسب إعدادات المخزون."
        iconName="Layers"
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="subtle">دفعات: {summary?.batches ?? total}</Badge>
        <Badge variant="success">متوفرة: {summary?.availableBatches ?? 0}</Badge>
        <Badge variant="subtle">الكمية الأصلية: {qty(summary?.quantity ?? 0)}</Badge>
        <Badge variant="success">المتبقي: {qty(summary?.remaining ?? 0)}</Badge>
        <Badge variant="subtle">المصروف: {qty(summary?.consumed ?? 0)}</Badge>
        {summary?.expiredBatches ? (
          <Badge variant="destructive">منتهية الصلاحية: {summary.expiredBatches}</Badge>
        ) : null}
      </div>

      {isError ? <p className="text-sm text-destructive">تعذر تحميل دفعات المخزون.</p> : null}

      <ListToolsTable tools={tools} keyExtractor={(b) => b.id}>
      <DirectoryPagedViews
        items={tools.rows}
        loading={isLoading || tools.loading}
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
          <BatchesTable
            rows={rowsPage}
            columns={tools.columns}
            tableSort={tools.tableSort}
            loading={isLoading || tools.loading}
            emptyText={
              availability === 'depleted'
                ? 'لا توجد دفعات مستنفدة بهذه الفلاتر.'
                : search || warehouseId !== 'all' || locationId !== 'all' || expiryBefore
                  ? 'لا توجد دفعات مطابقة للفلاتر.'
                  : 'لا توجد دفعات — تُنشأ الدفعات تلقائيًا عند ترحيل استلام أو تحويل.'
            }
          />
        )}
      </DirectoryPagedViews>
      </ListToolsTable>
    </div>
  );
}
