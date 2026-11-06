'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, ScanBarcode, Trash2 } from 'lucide-react';
import { BarcodeScannerDialog } from '@/components/shared/barcode-scanner-dialog';
import { resolveScannedCode } from '@/features/catalog/products/lib/resolve-scanned-code';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { useWarehouseLocations } from '@/features/inventory/admin/locations/hooks/use-warehouse-locations';
import { useWarehouseOperations } from '@/features/inventory/admin/operations/hooks/use-warehouse-operations';
import { useOpenOperationProductReservations } from '@/features/inventory/admin/operations/hooks/use-open-operation-product-reservations';
import { operationListLineTotals } from '@/features/inventory/admin/operations/lib/operation-list-line-totals';
import { useWarehouseOperationMutations } from '@/features/inventory/admin/operations/hooks/use-warehouse-operation-mutations';
import { WarehouseOperationDetailDialog } from '@/features/inventory/admin/operations/components/warehouse-operation-detail-dialog';
import {
  WAREHOUSE_OPERATION_FORM_DEFAULT_VALUES,
  warehouseOperationFormSchema,
  type WarehouseOperationFormValues,
} from '@/features/inventory/admin/schemas/warehouse-schemas';
import { WAREHOUSE_OPERATION_KIND_META } from '@/features/inventory/domain/constants/warehouse-operation-kinds';
import {
  PURCHASE_ORDER_RECEIPT_STATE_BADGE,
  PURCHASE_ORDER_RECEIPT_STATE_LABELS_AR,
  REPLENISHMENT_REQUEST_DECISION_BADGE,
  REPLENISHMENT_REQUEST_DECISION_LABELS_AR,
  REPLENISHMENT_REQUEST_STATUS_LABELS_AR,
  WAREHOUSE_OPERATION_STATUS_LABELS_AR,
  replenishmentRequestDecision,
} from '@/features/inventory/domain/constants/warehouse-operation-status';
import type {
  PurchaseOrderReceiptState,
  WarehouseOperation,
  WarehouseOperationKind,
  WarehouseOperationStatus,
} from '@/features/inventory/domain/types/warehouse';
import { useCan } from '@/features/auth/hooks/use-can';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { useProduct } from '@/features/catalog/products/hooks/use-products';
import { ProductSinglePicker } from '@/features/catalog/products/components/product-single-picker';
import { PartnerSinglePicker } from '@/features/contacts/admin/partners/components/partner-single-picker';
import { WarehouseOperationLinesEditor } from '@/features/inventory/admin/operations/components/warehouse-operation-lines-editor';
import { FlexibleQuantityInput } from '@/features/inventory/admin/operations/components/flexible-quantity-input';
import {
  DemandActualChips,
  LocationRouteChips,
  ProductQuantityChips,
  QuantityChip,
  WarehouseChip,
  WarehouseRouteChips,
} from '@/features/inventory/admin/operations/components/inventory-chips';
import { inventoryStockService } from '@/features/inventory/services/inventory-stock.service';
import {
  collectStockShortages,
  formatStockShortageMessage,
} from '@/features/inventory/admin/operations/lib/validate-operation-stock';
import {
  emptyOperationLineDraft,
  hasDuplicateOperationLineProducts,
  lineCapturesLot,
  lineNeedsUnitCost,
  operationLineDraftsToLines,
  supportsMultiProductLines,
  pickerUsesSourceLocationStock,
  type OperationLineDraft,
} from '@/features/inventory/admin/operations/lib/operation-line-draft';
import {
  filterOperationFromLocations,
  filterOperationToLocations,
  pickDefaultFromLocationId,
  pickDefaultToLocationId,
} from '@/features/inventory/admin/operations/lib/operation-location-filters';
import { operationPartnerLabel } from '@/features/inventory/admin/operations/lib/operation-partner-label';
import { toast } from 'sonner';
import { cn, formatDateTime } from '@/shared/utils';
import { OperationFormSection } from '@/features/inventory/admin/operations/components/operation-form-section';
import {
  OperationLineCardShell,
  OperationLineField,
} from '@/features/inventory/admin/operations/components/operation-line-card-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ListToolbar } from '@/components/ui/list-toolbar';
import { DataTable, AppPagination, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMaxHeightClass,
  dialogMobileFullScreenClass,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GroupedDataTable } from '@/components/ui/grouped-data-table';
import { ListColumnsPicker, useColumnVisibility } from '@/components/ui/list-columns-picker';
import { ListGroupMenu, listGroupQuery, useGroupedList, useListGroup } from '@/components/ui/list-group';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import { ListSortMenu, listSortQuery, useListSort } from '@/components/ui/list-sort';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import { registerExportRows, visibleExportColumns } from '@/components/pdf/lib/register-export-rows';
import { fetchAllPaginatedItems } from '@/shared/api/client';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';
import {
  fetchWarehouseOperationGroups,
  warehouseOperationsApi,
} from '@/features/inventory/admin/operations/lib/api/warehouse-operations';
import {
  OPERATIONS_COLUMN_OPTIONS,
  operationsExportColumns,
  operationsGroupOptions,
  operationsSortOptions,
} from '@/features/inventory/admin/operations/lib/operations-list-options';

/** The start (or end) of a local calendar day as an ISO instant. */
function localDayBoundary(date: string, endOfDay = false): string | undefined {
  if (!date) return undefined;
  const value = new Date(`${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
}

function statusBadgeVariant(
  status: WarehouseOperationStatus,
): 'subtle' | 'warning' | 'success' | 'destructive' {
  if (status === 'ready') return 'warning';
  if (status === 'done') return 'success';
  if (status === 'cancelled') return 'destructive';
  return 'subtle';
}

/** A confirmed purchase order's receiving progress (nothing for other documents). */
function ReceiptStateBadge({ operation }: { operation: WarehouseOperation }) {
  const state = operation.receiptState;
  if (!state) return null;
  return (
    <Badge variant={PURCHASE_ORDER_RECEIPT_STATE_BADGE[state]}>
      {PURCHASE_ORDER_RECEIPT_STATE_LABELS_AR[state]}
    </Badge>
  );
}

/** Matches inventory-stock-mode-contract.md */
type StockLineMode = 'product' | 'variants';

type Props = {
  /** عند الحذف: قائمة على مستوى المخزون (كل المستودعات) مع اختيار المستودع عند الإنشاء */
  warehouseId?: string;
  kind: WarehouseOperationKind;
  /** فلاتر المستودع/الحالة لصفحات المخزون المستقلة */
  enableInventoryFilters?: boolean;
  /** Extra page-header actions (e.g. Excel import), app-level pages only. */
  headerExtra?: React.ReactNode;
  /**
   * Purchase orders drafted as replenishment requests only, their status read
   * as the request's decision. They are created from the suggestions, not here.
   */
  origin?: 'replenishment';
};

export function WarehouseOperationsPanel({
  warehouseId,
  kind,
  enableInventoryFilters = false,
  headerExtra,
  origin,
}: Props) {
  const meta = WAREHOUSE_OPERATION_KIND_META[kind];
  const listTitle = origin ? 'طلبات التجديد' : meta.title;
  const statusLabels = origin ? REPLENISHMENT_REQUEST_STATUS_LABELS_AR : WAREHOUSE_OPERATION_STATUS_LABELS_AR;
  const isCountLike = kind === 'physical_count' || kind === 'adjustment';
  const scopedToWarehouse = Boolean(warehouseId);
  const showFilters = enableInventoryFilters || !scopedToWarehouse;
  const companyId = getInventoryCompanyId();
  const can = useCan();
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  // The standalone pages keep their filters, sort, grouping and columns per
  // user, company and kind (list-screens skill); a warehouse's tab does not.
  const listPage = origin ? `operations-${kind}-${origin}` : `operations-${kind}`;
  const filterKey = (field: string) =>
    scopedToWarehouse ? null : hrFiltersKey('inventory', listPage, companyId, field);
  const [filterWarehouseId, setFilterWarehouseId] = usePersistedFilterState<string>(filterKey('warehouse'), 'all');
  const [filterStatus, setFilterStatus] = usePersistedFilterState<WarehouseOperationStatus | 'all'>(
    filterKey('status'),
    'all',
  );
  const [period, setPeriod] = usePersistedFilterState(filterKey('period'), { from: '', to: '' });
  const isPurchaseOrder = kind === 'purchase_order';
  const canCreate = !meta.retired && !origin;
  const [storedReceiptState, setFilterReceiptState] = usePersistedFilterState<
    PurchaseOrderReceiptState | 'all'
  >(filterKey('receiptState'), 'all');
  const filterReceiptState = isPurchaseOrder ? storedReceiptState : 'all';
  const partnerLabel = operationPartnerLabel(kind);
  const stateKeys = listStateKeys('inventory', listPage, scopedToWarehouse ? null : companyId);
  const sort = useListSort(stateKeys.sort, operationsSortOptions(partnerLabel));
  const group = useListGroup(
    stateKeys.group,
    operationsGroupOptions({ partnerLabel, hasDestination: meta.needsDestWarehouse || kind === 'transfer' }),
  );
  const groupBy = scopedToWarehouse ? null : group.groupBy;
  const columnVisibility = useColumnVisibility(filterKey('hiddenColumns'), OPERATIONS_COLUMN_OPTIONS);
  const sortQuery = listSortQuery(sort.sort);
  const [open, setOpen] = React.useState(false);
  const [singleScanOpen, setSingleScanOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  /** Until the list refetches, keep the create response so the detail dialog opens immediately. */
  const [detailOperationFallback, setDetailOperationFallback] =
    React.useState<WarehouseOperation | null>(null);
  const [toDelete, setToDelete] = React.useState<WarehouseOperation | null>(null);
  const [stockMode, setStockMode] = React.useState<StockLineMode>('product');
  const [variantQuantities, setVariantQuantities] = React.useState<Record<string, number>>({});
  const multiProductMode = supportsMultiProductLines(kind);
  const checksSourceStock =
    meta.stockEffect === 'outbound' || meta.stockEffect === 'move' || meta.stockEffect === 'transfer';
  const actualQuantityLabel =
    meta.stockEffect === 'outbound'
      ? 'المصروف'
      : meta.stockEffect === 'inbound'
        ? 'المستلَم'
        : meta.stockEffect === 'adjust_set'
          ? 'المعدود'
          : 'المنقول';
  const [lineDrafts, setLineDrafts] = React.useState<OperationLineDraft[]>([emptyOperationLineDraft()]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  React.useEffect(() => {
    setPage(1);
  }, [filterWarehouseId, filterStatus, filterReceiptState, kind, warehouseId, period.from, period.to, sort.sortKey]);

  const listWarehouseId = scopedToWarehouse
    ? warehouseId
    : filterWarehouseId !== 'all'
      ? filterWarehouseId
      : undefined;

  const listFilters = {
    companyId,
    warehouseId: listWarehouseId,
    kind,
    status: filterStatus !== 'all' ? filterStatus : undefined,
    receiptState: filterReceiptState !== 'all' ? filterReceiptState : undefined,
    origin,
    search: search || undefined,
    // A day is the user's whole day (its local start and end), as the moves report reads it.
    occurredAtFrom: localDayBoundary(period.from),
    occurredAtTo: localDayBoundary(period.to, true),
  };
  const { data, isLoading, isError } = useWarehouseOperations(
    { ...listFilters, ...sortQuery, page, limit: pageSize },
    { enabled: !groupBy },
  );
  // Grouped: the groups (counts) and the documents of the open ones.
  const grouped = useGroupedList<WarehouseOperation>({
    enabled: Boolean(companyId) && Boolean(groupBy),
    groupBy,
    resetKey: JSON.stringify({ ...listFilters, ...sortQuery }),
    fetchGroups: () => fetchWarehouseOperationGroups({ ...listFilters, ...listGroupQuery(groupBy) }),
    fetchGroupRows: (groupValue, p, l) =>
      warehouseOperationsApi.getAll({ ...listFilters, ...sortQuery, ...listGroupQuery(groupBy), groupValue, page: p, limit: l }),
  });
  const needsWarehouseDirectory =
    showFilters || open || Boolean(selectedId) || meta.needsDestWarehouse || kind === 'transfer';
  const { data: warehousesData } = useWarehouses(
    { companyId, limit: 100 },
    { enabled: Boolean(companyId && needsWarehouseDirectory) },
  );
  const allWarehouses = warehousesData?.items ?? [];
  const items = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const form = useForm<WarehouseOperationFormValues>({
    resolver: zodResolver(warehouseOperationFormSchema),
    defaultValues: WAREHOUSE_OPERATION_FORM_DEFAULT_VALUES,
  });
  const destinationWarehouseId = form.watch('destinationWarehouseId');
  const formWarehouseId = form.watch('sourceWarehouseId');
  const selectedProductId = form.watch('productId');
  const fromLocationId = form.watch('fromLocationId');
  const toLocationId = form.watch('toLocationId');
  const effectiveWarehouseId = warehouseId || formWarehouseId || '';
  const locationsReady =
    (!meta.needsFrom || Boolean(fromLocationId)) &&
    (!meta.needsTo || Boolean(toLocationId)) &&
    (!meta.needsDestWarehouse || Boolean(destinationWarehouseId));

  const { data: selectedProduct, isLoading: isLoadingSelectedProduct } = useProduct(
    companyId,
    selectedProductId || null,
    { enabled: open && Boolean(selectedProductId) },
  );
  const activeVariants = React.useMemo(
    () => (selectedProduct?.variants ?? []).filter((variant) => variant.isActive !== false),
    [selectedProduct?.variants],
  );
  const hasActiveVariants = activeVariants.length > 0;

  // Single-product outbound docs: on-hand at the chosen source location caps the
  // quantity, so an over-available draft can never be created in the first place.
  const [sourceAvailable, setSourceAvailable] = React.useState<number | null>(null);
  const [variantAvailable, setVariantAvailable] = React.useState<Record<string, number>>({});
  const tracksSourceAvailability = checksSourceStock && !multiProductMode;

  React.useEffect(() => {
    if (
      !open ||
      !companyId ||
      !tracksSourceAvailability ||
      !fromLocationId ||
      !selectedProductId
    ) {
      setSourceAvailable(null);
      setVariantAvailable({});
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const base = await inventoryStockService.getQuantityAtLocation(
          companyId,
          selectedProductId,
          fromLocationId,
        );
        const perVariant: Record<string, number> = {};
        await Promise.all(
          activeVariants.map(async (variant) => {
            const qty = await inventoryStockService.getQuantityAtLocation(
              companyId,
              selectedProductId,
              fromLocationId,
              variant.id,
            );
            perVariant[variant.id] = Math.max(0, qty);
          }),
        );
        if (cancelled) return;
        setSourceAvailable(Math.max(0, base));
        setVariantAvailable(perVariant);
      } catch {
        if (cancelled) return;
        setSourceAvailable(null);
        setVariantAvailable({});
        toast.error('تعذر قراءة رصيد المنتج في الموقع المحدد.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    companyId,
    tracksSourceAvailability,
    fromLocationId,
    selectedProductId,
    activeVariants,
  ]);

  // Products on draft/ready docs — one lightweight query instead of listing 500 ops + N line fetches.
  const { data: openProductReservations } = useOpenOperationProductReservations({
    companyId,
    warehouseId: effectiveWarehouseId,
    kind,
    enabled: open && locationsReady && Boolean(companyId && effectiveWarehouseId),
  });

  const takenProductIds = React.useMemo(() => {
    const taken = new Map<string, string>();
    for (const row of openProductReservations ?? []) {
      if (row.productId) taken.set(row.productId, row.operationReference);
    }
    return taken;
  }, [openProductReservations]);

  const takenProductIdList = React.useMemo(() => Array.from(takenProductIds.keys()), [takenProductIds]);

  const warehousesForDest = allWarehouses.filter((item) => item.id !== effectiveWarehouseId);

  /** Locations/partners/reservations load only while create or detail dialog is open. */
  const needsLocationQueries = open || Boolean(selectedId);
  const sourceLocationsWarehouseId = scopedToWarehouse ? warehouseId : effectiveWarehouseId || undefined;

  const { data: locationsData } = useWarehouseLocations(
    {
      companyId,
      warehouseId: sourceLocationsWarehouseId,
      page: 1,
      limit: 200,
    },
    {
      enabled: needsLocationQueries && Boolean(companyId && sourceLocationsWarehouseId),
    },
  );
  const locations = locationsData?.items ?? [];

  const { data: allLocationsData } = useWarehouseLocations(
    {
      companyId: scopedToWarehouse ? '' : companyId,
      page: 1,
      limit: 500,
    },
    { enabled: needsLocationQueries && open && !scopedToWarehouse && Boolean(companyId) },
  );

  const { data: destLocationsData } = useWarehouseLocations(
    {
      companyId,
      warehouseId: destinationWarehouseId || undefined,
      page: 1,
      limit: 200,
    },
    { enabled: needsLocationQueries && Boolean(destinationWarehouseId) },
  );
  const destLocations = destLocationsData?.items ?? [];
  // Source locations always come from the source warehouse (`locations`).
  // Destination-only pool is `destLocations` — never mix them on the «from» picker.
  const fromLocations = React.useMemo(
    () =>
      filterOperationFromLocations(
        kind,
        locations,
        toLocationId || undefined,
        fromLocationId || undefined,
      ),
    [kind, locations, toLocationId, fromLocationId],
  );

  const toLocations = React.useMemo(() => {
    const pool = meta.needsDestWarehouse ? destLocations : locations;
    return filterOperationToLocations(
      kind,
      pool,
      fromLocationId || undefined,
      toLocationId || undefined,
    );
  }, [kind, meta.needsDestWarehouse, destLocations, locations, fromLocationId, toLocationId]);

  // Pre-fill system stock bin (WH/Stock), customer, or adjustment locations when empty.
  React.useEffect(() => {
    if (!open || !effectiveWarehouseId) return;

    const fromPool = locations;
    const toPool = meta.needsDestWarehouse ? destLocations : locations;

    if (meta.needsFrom && !form.getValues('fromLocationId')?.trim()) {
      const fromId = pickDefaultFromLocationId(kind, fromPool);
      if (fromId) form.setValue('fromLocationId', fromId);
    }

    if (meta.needsTo && !form.getValues('toLocationId')?.trim()) {
      if (meta.needsDestWarehouse && !destinationWarehouseId) return;
      const fromId = form.getValues('fromLocationId')?.trim() || undefined;
      const toId = pickDefaultToLocationId(kind, toPool, { fromLocationId: fromId });
      if (toId) form.setValue('toLocationId', toId);
    }
  }, [
    open,
    kind,
    meta.needsFrom,
    meta.needsTo,
    meta.needsDestWarehouse,
    effectiveWarehouseId,
    destinationWarehouseId,
    locations,
    destLocations,
    form,
  ]);

  const locationNameById = React.useMemo(() => {
    const source = scopedToWarehouse
      ? [...locations, ...destLocations]
      : (allLocationsData?.items ?? []);
    return new Map(source.map((location) => [location.id, location.nameAr]));
  }, [scopedToWarehouse, locations, destLocations, allLocationsData?.items]);

  const warehouseNameById = React.useMemo(
    () => new Map(allWarehouses.map((item) => [item.id, item.nameAr])),
    [allWarehouses],
  );

  const selectedOperation = React.useMemo(() => {
    if (!selectedId) return null;
    return (
      items.find((item) => item.id === selectedId) ??
      (detailOperationFallback?.id === selectedId ? detailOperationFallback : null)
    );
  }, [selectedId, items, detailOperationFallback]);

  React.useEffect(() => {
    if (!selectedId || !detailOperationFallback) return;
    if (items.some((item) => item.id === selectedId)) {
      setDetailOperationFallback(null);
    }
  }, [selectedId, detailOperationFallback, items]);

  const { create, remove } = useWarehouseOperationMutations(effectiveWarehouseId || 'global', kind);

  const openDraftAfterCreate = React.useCallback((created: WarehouseOperation) => {
    setOpen(false);
    setDetailOperationFallback(created);
    setSelectedId(created.id);
  }, []);

  // Standalone inventory pages (kind pages) get the shared topbar add-button + collapsible
  // filter bar pattern; the warehouse-detail embedded tab keeps its original inline toolbar
  // untouched so this change stays scoped to the standalone pages only.
  const exportColumns = visibleExportColumns(
    operationsExportColumns({
      partnerLabel,
      warehouseName: (id) => (id ? (warehouseNameById.get(id) ?? '') : ''),
      receiptState: isPurchaseOrder,
    }),
    columnVisibility.isVisible,
  );
  const filterSummary = [
    search ? `بحث: ${search}` : null,
    filterWarehouseId !== 'all' ? `المستودع: ${warehouseNameById.get(filterWarehouseId) ?? ''}` : null,
    filterStatus !== 'all' ? `الحالة: ${statusLabels[filterStatus]}` : null,
    filterReceiptState !== 'all'
      ? `الاستلام: ${PURCHASE_ORDER_RECEIPT_STATE_LABELS_AR[filterReceiptState]}`
      : null,
    period.from || period.to ? `الفترة: ${period.from || '…'} — ${period.to || '…'}` : null,
    sort.label,
    group.label,
  ].filter((line): line is string => Boolean(line));
  const activeFilterCount =
    (filterWarehouseId !== 'all' ? 1 : 0) +
    (filterStatus !== 'all' ? 1 : 0) +
    (filterReceiptState !== 'all' ? 1 : 0) +
    (period.from || period.to ? 1 : 0);

  /** Every filtered document (all pages) in the screen's order, grouped like the screen. */
  const getExportRows = async () => {
    const query = { ...listFilters, ...sortQuery, ...listGroupQuery(groupBy) };
    const [{ items: all }, summary] = await Promise.all([
      fetchAllPaginatedItems((p, l) => warehouseOperationsApi.getAll({ ...query, page: p, limit: l })),
      groupBy ? fetchWarehouseOperationGroups(query) : Promise.resolve(null),
    ]);
    return registerExportRows({
      columns: exportColumns,
      rows: all,
      grouping:
        groupBy && group.option && summary
          ? {
              fieldLabel: group.option.label,
              groups: group.sortGroups(summary.groups),
              labelOf: group.labelOf,
              groupKeyOf: (operation) => operation.groupKey,
            }
          : undefined,
    });
  };

  usePageHeaderActions(
    () =>
      scopedToWarehouse ? null : (
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
          <FilterToggleButton activeFilterCount={activeFilterCount} />
          <ListColumnsPicker model={columnVisibility} />
          <ListSortMenu model={sort} />
          <ListGroupMenu model={group} />
          <ListSavedViews storageKey={stateKeys.views} prefixes={stateKeys.prefixes} />
          {headerExtra}
          {canCreate ? (
            <PageHeaderPrimaryButton
              icon={Plus}
              label={meta.createLabel}
              onClick={() => setOpen(true)}
              disabled={!companyId || allWarehouses.length === 0}
            >
              {meta.createLabel}
            </PageHeaderPrimaryButton>
          ) : null}
          <RegisterExportMenu
            title={`سجل ${listTitle}`}
            fileName={`inventory-${listPage.replace('operations-', '')}`}
            columns={exportColumns}
            getRows={getExportRows}
            subtitleLines={filterSummary}
            landscape
            emptyMessage={`لا توجد ${listTitle} للتصدير ضمن الفلاتر الحالية.`}
          />
        </div>
      ),
    [
      scopedToWarehouse,
      canCreate,
      meta.createLabel,
      listTitle,
      listPage,
      companyId,
      allWarehouses.length,
      headerExtra,
      activeFilterCount,
      sort.sortKey,
      sort.label,
      group.groupKey,
      group.label,
      columnVisibility.hiddenKey,
      JSON.stringify(listFilters),
      stateKeys.views,
    ],
  );

  useEntityFilterSlot(
    () =>
      scopedToWarehouse ? null : (
        <ListFilterBar
          showDateSection
          optionalDateRange
          periodValue={period}
          onPeriodChange={(range) => setPeriod({ from: range.from, to: range.to })}
          periodFilterActive={Boolean(period.from || period.to)}
          onPeriodFilterClear={() => setPeriod({ from: '', to: '' })}
          onClearAll={() => {
            setSearchInput('');
            setFilterWarehouseId('all');
            setFilterStatus('all');
            setFilterReceiptState('all');
            setPeriod({ from: '', to: '' });
          }}
          showStatusSection={false}
          showEmployeePicker={false}
          leadingFilters={
            <EntityFilterSearchField
              value={searchInput}
              onChange={setSearchInput}
              placeholder="ابحث بالمرجع أو المنتج أو الجهة…"
            />
          }
          inlineSelects={[
            {
              id: 'warehouse',
              value: filterWarehouseId,
              onChange: setFilterWarehouseId,
              placeholder: 'كل المستودعات',
              options: [
                { value: 'all', label: 'كل المستودعات' },
                ...allWarehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.nameAr })),
              ],
            },
            {
              id: 'status',
              value: filterStatus,
              onChange: (value) => setFilterStatus(value as WarehouseOperationStatus | 'all'),
              placeholder: 'كل الحالات',
              options: [
                { value: 'all', label: 'كل الحالات' },
                ...(Object.keys(statusLabels) as WarehouseOperationStatus[]).map((status) => ({
                  value: status,
                  label: statusLabels[status],
                })),
              ],
            },
            ...(isPurchaseOrder
              ? [
                  {
                    id: 'receiptState',
                    value: filterReceiptState,
                    onChange: (value: string) =>
                      setFilterReceiptState(value as PurchaseOrderReceiptState | 'all'),
                    placeholder: 'كل حالات الاستلام',
                    options: [
                      { value: 'all', label: 'كل حالات الاستلام' },
                      ...(
                        Object.keys(PURCHASE_ORDER_RECEIPT_STATE_LABELS_AR) as PurchaseOrderReceiptState[]
                      ).map((state) => ({
                        value: state,
                        label: PURCHASE_ORDER_RECEIPT_STATE_LABELS_AR[state],
                      })),
                    ],
                  },
                ]
              : []),
          ]}
        />
      ),
    [
      scopedToWarehouse,
      searchInput,
      filterWarehouseId,
      filterStatus,
      filterReceiptState,
      isPurchaseOrder,
      allWarehouses,
      period.from,
      period.to,
    ],
  );

  React.useEffect(() => {
    if (!open) return;
    const defaultWh = warehouseId || allWarehouses[0]?.id || '';
    setStockMode('product');
    setVariantQuantities({});
    setLineDrafts([emptyOperationLineDraft()]);
    form.reset({
      ...WAREHOUSE_OPERATION_FORM_DEFAULT_VALUES,
      occurredAt: new Date().toISOString().slice(0, 16),
      quantity: isCountLike ? 0 : 1,
      theoreticalQuantity: isCountLike ? 0 : undefined,
      sourceWarehouseId: defaultWh,
      sourceDocument: '',
    });
  }, [open, form, isCountLike, kind, warehouseId, allWarehouses]);

  React.useEffect(() => {
    if (!open || !selectedProductId) return;
    if (!selectedProduct || selectedProduct.id !== selectedProductId) return;
    const variants = (selectedProduct.variants ?? []).filter((variant) => variant.isActive !== false);
    if (variants.length > 0) {
      setStockMode('variants');
      setVariantQuantities(Object.fromEntries(variants.map((variant) => [variant.id, 0])));
    } else {
      setStockMode('product');
      setVariantQuantities({});
    }
    form.setValue('productName', selectedProduct.nameAr);
    form.setValue('sku', selectedProduct.sku);
  }, [open, selectedProductId, selectedProduct, form]);

  function applyStockMode(mode: StockLineMode) {
    setStockMode(mode);
    if (mode === 'variants') {
      setVariantQuantities(Object.fromEntries(activeVariants.map((variant) => [variant.id, 0])));
    } else {
      setVariantQuantities({});
      if (!isCountLike && form.getValues('quantity') <= 0) {
        form.setValue('quantity', 1);
      }
    }
  }

  const onSubmit = async (values: WarehouseOperationFormValues) => {
    if (!companyId) return;
    const sourceWh = warehouseId || values.sourceWarehouseId;
    if (!sourceWh) return;
    if (meta.needsDestWarehouse && !values.destinationWarehouseId) return;

    if (meta.needsFrom && !values.fromLocationId?.trim()) {
      toast.error('اختر موقع المصدر قبل إضافة المنتجات.');
      return;
    }
    if (meta.needsTo && !values.toLocationId?.trim()) {
      toast.error(kind === 'issue' ? 'اختر موقع العميل (الوجهة).' : 'اختر موقع الوجهة قبل إضافة المنتجات.');
      return;
    }

    const lineLocations = {
      fromLocationId: values.fromLocationId || undefined,
      toLocationId: values.toLocationId || undefined,
    };

    if (
      meta.stockEffect === 'move' &&
      lineLocations.fromLocationId &&
      lineLocations.toLocationId &&
      lineLocations.fromLocationId === lineLocations.toLocationId
    ) {
      toast.error('اختر موقعين مختلفين داخل نفس المستودع.');
      return;
    }

    if (multiProductMode) {
      if (hasDuplicateOperationLineProducts(lineDrafts)) {
        toast.error('لا يمكن تكرار نفس المنتج/المتغير في أكثر من سطر.');
        return;
      }
      const lines = operationLineDraftsToLines(lineDrafts, lineLocations, {
        includeUnitCost: lineNeedsUnitCost(kind) && can('inv.warehouse.costs.read'),
      });
      if (lines.length === 0) {
        toast.error('أضف صنفًا واحدًا على الأقل مع كمية أكبر من صفر.');
        return;
      }
      for (const line of lines) {
        const pid = line.productId?.trim();
        if (!pid) continue;
        const duplicateReference = takenProductIds.get(pid);
        if (duplicateReference) {
          toast.error(
            `المنتج «${line.productName || pid}» مضاف بالفعل في مستند ${meta.labelAr} «${duplicateReference}» غير المصدَّق. عدّل ذلك المستند بدل إنشاء مستند مكرر.`,
          );
          return;
        }
      }
      if (checksSourceStock && lineLocations.fromLocationId) {
        const issues = await collectStockShortages({
          companyId,
          warehouseId: sourceWh,
          kind,
          destinationWarehouseId: values.destinationWarehouseId || undefined,
          lines,
        });
        if (issues.length > 0) {
          toast.error(formatStockShortageMessage(issues[0]!));
          return;
        }
      }
      const created = await create.mutateAsync({
        companyId,
        warehouseId: sourceWh,
        kind,
        status: 'draft',
        occurredAt: new Date(values.occurredAt).toISOString(),
        notes: values.notes?.trim() || undefined,
        partnerId: values.partnerId?.trim() || undefined,
        partnerName: values.partnerName?.trim() || undefined,
        sourceDocument: values.sourceDocument?.trim() || undefined,
        destinationWarehouseId: values.destinationWarehouseId || undefined,
        transferMode: kind === 'transfer' ? values.transferMode ?? 'direct' : undefined,
        lines,
      });
      openDraftAfterCreate(created);
      return;
    }

    if (!values.productId?.trim()) return;

    const duplicateReference = takenProductIds.get(values.productId.trim());
    if (duplicateReference) {
      toast.error(
        `هذا المنتج مضاف بالفعل في مستند ${meta.labelAr} «${duplicateReference}» غير المصدَّق. عدّل ذلك المستند بدل إنشاء مستند مكرر.`,
      );
      return;
    }

    const qty = values.quantity;
    const theoretical = values.theoreticalQuantity ?? qty;
    const useVariants = hasActiveVariants && stockMode === 'variants';
    const lines = useVariants
      ? activeVariants
          .filter((variant) => (variantQuantities[variant.id] ?? 0) > 0)
          .map((variant) => {
            const lineQty = variantQuantities[variant.id] ?? 0;
            return {
              id: `opl-${Math.random().toString(36).slice(2, 8)}`,
              productId: values.productId.trim(),
              variantId: variant.id,
              productName: variant.nameAr,
              sku: variant.sku || values.sku?.trim() || undefined,
              demandQuantity: isCountLike ? theoretical : lineQty,
              quantity: lineQty,
              ...lineLocations,
            };
          })
      : [
          {
            id: `opl-${Math.random().toString(36).slice(2, 8)}`,
            productId: values.productId.trim(),
            variantId: undefined,
            productName: values.productName.trim() || 'المنتج الأساسي',
            sku: values.sku?.trim() || undefined,
            demandQuantity: isCountLike ? theoretical : qty,
            quantity: qty,
            ...lineLocations,
          },
        ];

    if (lines.length === 0 || lines.every((line) => line.quantity <= 0 && !isCountLike)) {
      toast.error(
        useVariants
          ? 'أدخل كمية لمتغير واحد على الأقل.'
          : 'أدخل كمية للمنتج.',
      );
      return;
    }

    if (checksSourceStock && lineLocations.fromLocationId) {
      const issues = await collectStockShortages({
        companyId,
        warehouseId: sourceWh,
        kind,
        destinationWarehouseId: values.destinationWarehouseId || undefined,
        lines,
      });
      if (issues.length > 0) {
        toast.error(formatStockShortageMessage(issues[0]!));
        return;
      }
    }

    const created = await create.mutateAsync({
      companyId,
      warehouseId: sourceWh,
      kind,
      status: 'draft',
      occurredAt: new Date(values.occurredAt).toISOString(),
      notes: values.notes?.trim() || undefined,
      partnerName: values.partnerName?.trim() || undefined,
      sourceDocument: values.sourceDocument?.trim() || undefined,
      destinationWarehouseId: values.destinationWarehouseId || undefined,
      transferMode: kind === 'transfer' ? values.transferMode ?? 'direct' : undefined,
      lines,
    });
    openDraftAfterCreate(created);
  };

  /** One-product documents (count, scrap, adjustment): a scan picks the product. */
  async function pickScannedProduct(code: string) {
    if (!companyId) return;
    try {
      const item = await resolveScannedCode(companyId, code);
      if (!item) {
        toast.error(`لا يوجد منتج بالرمز ${code}`);
        return;
      }
      if (takenProductIdList.includes(item.productId)) {
        toast.error(`«${item.productName}» محجوز في مستند آخر مفتوح`);
        return;
      }
      form.setValue('productId', item.productId, { shouldDirty: true, shouldValidate: true });
      form.setValue('productName', item.productName);
      form.setValue('sku', item.sku);
      setStockMode('product');
      setVariantQuantities({});
      toast.success(
        item.variantName
          ? `اختير «${item.productName}» — حدّد المتغير «${item.variantName}» إن لزم`
          : `اختير «${item.productName}»`,
      );
    } catch {
      // The API client already showed why.
    }
  }

  const statusBadge = (row: WarehouseOperation) => {
    if (!origin) {
      return <Badge variant={statusBadgeVariant(row.status)}>{WAREHOUSE_OPERATION_STATUS_LABELS_AR[row.status]}</Badge>;
    }
    const decision = replenishmentRequestDecision(row.status);
    return (
      <Badge variant={REPLENISHMENT_REQUEST_DECISION_BADGE[decision]}>
        {REPLENISHMENT_REQUEST_DECISION_LABELS_AR[decision]}
      </Badge>
    );
  };

  const rejectReason = (row: WarehouseOperation) =>
    row.status === 'cancelled' && row.cancelReason ? (
      <p className="line-clamp-2 text-xs text-muted-foreground">سبب الرفض: {row.cancelReason}</p>
    ) : null;

  const columns: ColumnDef<WarehouseOperation>[] = [
    {
      key: 'reference',
      title: 'المرجع',
      sortKey: 'occurredAt',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium" dir="ltr">
            {row.reference || '—'}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(row.occurredAt)}
          </span>
        </div>
      ),
    },
    ...(!scopedToWarehouse
      ? [
          {
            key: 'warehouse',
            title: meta.needsDestWarehouse ? 'المستودعات' : 'المستودع',
            sortKey: 'warehouse',
            render: (row: WarehouseOperation) =>
              row.destinationWarehouseId && row.destinationWarehouseId !== row.warehouseId ? (
                <WarehouseRouteChips
                  from={warehouseNameById.get(row.warehouseId)}
                  to={warehouseNameById.get(row.destinationWarehouseId)}
                />
              ) : (
                <WarehouseChip name={warehouseNameById.get(row.warehouseId)} />
              ),
          } satisfies ColumnDef<WarehouseOperation>,
        ]
      : []),
    {
      key: 'partner',
      title: operationPartnerLabel(kind),
      sortKey: 'partner',
      hideOnMobile: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.partnerName || '—'}</span>
          {row.sourceDocument ? (
            <span className="text-xs text-muted-foreground">{row.sourceDocument}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'lines',
      title: 'البنود',
      hideOnMobile: true,
      render: (row) => (
        <ProductQuantityChips
          lines={row.lines.map((line) => ({
            id: line.id,
            productName: line.productName,
            quantity: line.quantity,
            demandQuantity: line.demandQuantity,
            sku: line.sku,
          }))}
        />
      ),
    },
    {
      key: 'qty',
      title: 'الكمية',
      render: (row) => {
        const { demand, actual } = operationListLineTotals(row);
        return <DemandActualChips demand={demand} actual={actual} actualLabel={actualQuantityLabel} />;
      },
    },
    {
      key: 'locations',
      title: 'المواقع',
      hideOnMobile: true,
      render: (row) => {
        const line = row.lines[0];
        if (!line) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <LocationRouteChips
            from={line.fromLocationId ? locationNameById.get(line.fromLocationId) ?? '—' : null}
            to={line.toLocationId ? locationNameById.get(line.toLocationId) ?? '—' : null}
          />
        );
      },
    },
    {
      key: 'status',
      title: 'الحالة',
      sortKey: 'status',
      render: (row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1">
            {statusBadge(row)}
            <ReceiptStateBadge operation={row} />
          </div>
          {rejectReason(row)}
        </div>
      ),
    },
    {
      key: 'actions',
      title: '',
      isActions: true,
      render: (row) =>
        row.status === 'done' ? null : (
          <Button variant="ghost" size="icon" aria-label="حذف المستند" onClick={() => setToDelete(row)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        ),
    },
  ];

  const visibleColumns = scopedToWarehouse
    ? columns
    : columns.filter((column) => columnVisibility.isVisible(column.key));

  /** Phones: reference, date and status on top, then what moved and where (one tap opens it). */
  const operationMobileCard = (row: WarehouseOperation) => {
    const { demand, actual } = operationListLineTotals(row);
    const products = row.lines.map((line) => line.productName).filter(Boolean);
    return (
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold" dir="ltr">
              {row.reference || '—'}
            </p>
            <p className="text-xs text-muted-foreground">{formatDateTime(row.occurredAt)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {statusBadge(row)}
            <ReceiptStateBadge operation={row} />
            {row.status === 'done' ? null : (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="حذف المستند"
                onClick={(event) => {
                  event.stopPropagation();
                  setToDelete(row);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
        {products.length > 0 ? (
          <p className="truncate text-sm">
            {products[0]}
            {products.length > 1 ? (
              <span className="text-muted-foreground"> +{products.length - 1} أصناف</span>
            ) : null}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            {!scopedToWarehouse ? (
              row.destinationWarehouseId && row.destinationWarehouseId !== row.warehouseId ? (
                <WarehouseRouteChips
                  from={warehouseNameById.get(row.warehouseId)}
                  to={warehouseNameById.get(row.destinationWarehouseId)}
                />
              ) : (
                <WarehouseChip name={warehouseNameById.get(row.warehouseId)} />
              )
            ) : row.partnerName ? (
              <span className="text-xs text-muted-foreground">{row.partnerName}</span>
            ) : null}
          </div>
          <DemandActualChips demand={demand} actual={actual} actualLabel={actualQuantityLabel} />
        </div>
        {rejectReason(row)}
      </div>
    );
  };

  const dialogs = (
    <>
      <WarehouseOperationDetailDialog
        open={Boolean(selectedId)}
        onOpenChange={(next) => {
          if (!next) {
            setSelectedId(null);
            setDetailOperationFallback(null);
          }
        }}
        operation={selectedOperation}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            dialogMaxHeightClass,
            'flex max-h-[min(92vh,900px)] flex-col overflow-hidden max-w-[min(96vw,72rem)] sm:max-w-6xl',
            dialogMobileFullScreenClass,
            'max-sm:gap-3 max-sm:p-4',
          )}
        >
          <DialogHeader className="max-sm:text-right">
            <DialogTitle>{meta.createLabel}</DialogTitle>
            <DialogDescription className="sr-only">
              يُنشأ المستند كمسودة ثم تُفتح شاشة التفاصيل.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (multiProductMode) {
                void onSubmit(form.getValues());
                return;
              }
              void form.handleSubmit(onSubmit)(e);
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pe-1">
              <OperationFormSection>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {!scopedToWarehouse ? (
              <div className="space-y-1.5">
                <Label>{meta.needsDestWarehouse ? 'مستودع الصرف (المصدر)' : 'المستودع'}</Label>
                <Controller
                  control={form.control}
                  name="sourceWarehouseId"
                  render={({ field }) => (
                    <Select
                      value={field.value || ''}
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('fromLocationId', '');
                        form.setValue('productId', '');
                        form.setValue('productName', '');
                        form.setValue('sku', '');
                        setLineDrafts([emptyOperationLineDraft()]);
                        setStockMode('product');
                        setVariantQuantities({});
                        if (!meta.needsDestWarehouse) {
                          form.setValue('toLocationId', '');
                        } else if (form.getValues('destinationWarehouseId') === value) {
                          // A warehouse cannot transfer to itself.
                          form.setValue('destinationWarehouseId', '');
                          form.setValue('toLocationId', '');
                        }
                      }}
                    >
                      <SelectTrigger aria-label={meta.needsDestWarehouse ? 'مستودع الصرف' : 'المستودع'}>
                        <SelectValue placeholder="اختر مستودعًا" />
                      </SelectTrigger>
                      <SelectContent>
                        {allWarehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.nameAr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>{meta.needsDestWarehouse ? 'مستودع الصرف (المصدر)' : 'المستودع'}</Label>
                <Input
                  value={warehouseNameById.get(warehouseId ?? '') ?? '—'}
                  disabled
                />
              </div>
            )}

            {meta.needsFrom ? (
              <div className="space-y-1.5">
                <Label htmlFor="op-from">
                  {kind === 'transfer'
                    ? 'موقع الصرف (المصدر)'
                    : kind === 'issue'
                      ? 'موقع المخزون (من)'
                      : meta.stockEffect === 'move'
                        ? 'الموقع الحالي (من)'
                        : 'الموقع المصدر'}
                </Label>
                <Controller
                  control={form.control}
                  name="fromLocationId"
                  render={({ field }) => (
                    <Select
                      value={field.value || ''}
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (multiProductMode) {
                          setLineDrafts([emptyOperationLineDraft()]);
                        } else {
                          form.setValue('productId', '');
                          form.setValue('productName', '');
                          form.setValue('sku', '');
                          setStockMode('product');
                          setVariantQuantities({});
                        }
                      }}
                      disabled={!effectiveWarehouseId}
                    >
                      <SelectTrigger id="op-from" aria-label="من موقع">
                        <SelectValue placeholder="اختر موقع المصدر أولًا" />
                      </SelectTrigger>
                      <SelectContent>
                        {fromLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.nameAr || location.code}
                            {location.code ? ` · ${location.code}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ) : null}

            {meta.needsDestWarehouse ? (
              <div className="space-y-1.5">
                <Label>المستودع الوجهة</Label>
                <Controller
                  control={form.control}
                  name="destinationWarehouseId"
                  render={({ field }) => (
                    <Select
                      value={field.value || ''}
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('toLocationId', '');
                      }}
                    >
                      <SelectTrigger aria-label="المستودع الوجهة">
                        <SelectValue placeholder="اختر المستودع الوجهة" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehousesForDest.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.nameAr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ) : null}

            {kind === 'transfer' ? (
              <div className="space-y-1.5">
                <Label>طريقة التحويل</Label>
                <Controller
                  control={form.control}
                  name="transferMode"
                  render={({ field }) => (
                    <Select value={field.value || 'direct'} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="طريقة التحويل">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="direct">مباشر — تصل للمستودع الوجهة فور التصديق</SelectItem>
                        <SelectItem value="two_step">على مرحلتين — تُخصم ثم يؤكد المستلم الوصول</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ) : null}

            {meta.needsTo ? (
              <div className="space-y-1.5">
                <Label htmlFor="op-to">
                  {kind === 'issue'
                    ? 'موقع العميل (إلى)'
                    : kind === 'supplier_return'
                      ? 'موقع المورد (إلى)'
                      : meta.needsDestWarehouse
                      ? 'موقع الاستلام (الوجهة)'
                      : meta.stockEffect === 'inbound'
                        ? 'موقع الاستلام'
                        : meta.stockEffect === 'adjust_set'
                          ? 'موقع المخزون'
                          : meta.stockEffect === 'move'
                            ? 'الموقع الجديد (إلى)'
                            : 'الموقع الوجهة'}
                </Label>
                <Controller
                  control={form.control}
                  name="toLocationId"
                  render={({ field }) => (
                    <Select
                      value={field.value || ''}
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Availability is read at the source location, so picking a
                        // destination keeps the products. Inbound/count docs have no
                        // source: there this field *is* the stock reference.
                        if (meta.needsFrom) return;
                        if (multiProductMode) {
                          setLineDrafts([emptyOperationLineDraft()]);
                        } else {
                          form.setValue('productId', '');
                          form.setValue('productName', '');
                          form.setValue('sku', '');
                          setStockMode('product');
                          setVariantQuantities({});
                        }
                      }}
                      disabled={
                        meta.needsDestWarehouse
                          ? !destinationWarehouseId
                          : !effectiveWarehouseId
                      }
                    >
                      <SelectTrigger id="op-to" aria-label="إلى موقع">
                        <SelectValue
                          placeholder={
                            meta.needsDestWarehouse && !destinationWarehouseId
                              ? 'اختر المستودع الوجهة أولًا'
                              : 'اختر موقع الوجهة'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {toLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.nameAr || location.code}
                            {location.code ? ` · ${location.code}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ) : null}

            {!locationsReady && (meta.needsFrom || meta.needsTo) ? (
              <p className="sm:col-span-2 lg:col-span-3 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                أكمل حقول المواقع المطلوبة لتفعيل اختيار الأصناف.
              </p>
            ) : null}
                </div>
              </OperationFormSection>

              <OperationFormSection>
                {!locationsReady ? (
                  <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                    اختر المستودع والموقع أولاً.
                  </p>
                ) : null}

            {multiProductMode ? (
              <WarehouseOperationLinesEditor
                companyId={companyId}
                lines={lineDrafts}
                onChange={setLineDrafts}
                fromLocationId={fromLocationId || undefined}
                checksSourceStock={checksSourceStock}
                restrictToSourceLocation={pickerUsesSourceLocationStock(kind)}
                excludeProductIds={takenProductIdList}
                needsUnitCost={lineNeedsUnitCost(kind) && can('inv.warehouse.costs.read')}
                capturesLot={lineCapturesLot(kind)}
                disabled={!locationsReady}
              />
            ) : (
              <OperationLineCardShell
                index={0}
                title={form.watch('productName') || undefined}
                subtitle={form.watch('sku') || undefined}
              >
                <OperationLineField label="المنتج" fullWidth>
                  <Controller
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <ProductSinglePicker
                        companyId={companyId}
                        value={field.value ?? ''}
                        status="active"
                        excludeIds={takenProductIdList}
                        sourceLocationId={
                          pickerUsesSourceLocationStock(kind) ? fromLocationId || undefined : undefined
                        }
                        disabled={!locationsReady}
                        placeholder={
                          locationsReady
                            ? pickerUsesSourceLocationStock(kind)
                              ? 'ابحث عن منتج في الموقع…'
                              : 'ابحث عن منتج من الكتالوج…'
                            : 'حدّد المواقع أولًا…'
                        }
                        onChange={field.onChange}
                        onProductSelect={(product) => {
                          form.setValue('productName', product.nameAr ?? '');
                          form.setValue('sku', product.sku ?? '');
                          setStockMode('product');
                          setVariantQuantities({});
                        }}
                      />
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 h-10 w-full gap-2 sm:w-fit"
                    disabled={!locationsReady}
                    onClick={() => setSingleScanOpen(true)}
                  >
                    <ScanBarcode className="h-4 w-4" />
                    مسح باركود المنتج
                  </Button>
                  <BarcodeScannerDialog
                    open={singleScanOpen}
                    onOpenChange={setSingleScanOpen}
                    title="مسح باركود المنتج"
                    onCode={(code) => void pickScannedProduct(code)}
                  />
                  {form.formState.errors.productId ? (
                    <p className="text-xs text-destructive">{form.formState.errors.productId.message}</p>
                  ) : null}
                  {selectedProductId && isLoadingSelectedProduct ? (
                    <p className="text-xs text-muted-foreground">جاري تحميل المتغيرات…</p>
                  ) : null}
                </OperationLineField>
                {kind === 'adjustment' ? (
                  <OperationLineField label="الكمية النظامية" htmlFor="op-theo">
                    <Input
                      id="op-theo"
                      type="number"
                      min={0}
                      step={1}
                      dir="ltr"
                      className="h-10"
                      disabled={!locationsReady}
                      {...form.register('theoreticalQuantity', { valueAsNumber: true })}
                    />
                  </OperationLineField>
                ) : stockMode === 'product' || !hasActiveVariants ? (
                  <OperationLineField
                    label="الكمية"
                    htmlFor="op-qty"
                    hint={
                      tracksSourceAvailability && sourceAvailable != null
                        ? `المتاح في الموقع: ${sourceAvailable}`
                        : undefined
                    }
                  >
                    <Controller
                      control={form.control}
                      name="quantity"
                      render={({ field }) => (
                        <FlexibleQuantityInput
                          id="op-qty"
                          className="h-10 w-full max-w-none"
                          value={field.value ?? 0}
                          max={tracksSourceAvailability ? sourceAvailable : null}
                          disabled={!locationsReady || !selectedProductId}
                          onChange={field.onChange}
                        />
                      )}
                    />
                    {form.formState.errors.quantity ? (
                      <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>
                    ) : null}
                  </OperationLineField>
                ) : (
                  <OperationLineField label="الكمية" hint="أدخل الكميات في جدول المتغيرات بالأسفل">
                    <p className="text-sm text-muted-foreground">حسب المتغيرات</p>
                  </OperationLineField>
                )}
              </OperationLineCardShell>
            )}

            {!multiProductMode && hasActiveVariants ? (
              <div className="space-y-1.5">
                <Label>نطاق الكمية</Label>
                <Select
                  value={stockMode}
                  onValueChange={(value) => applyStockMode(value as StockLineMode)}
                  disabled={!locationsReady}
                >
                  <SelectTrigger aria-label="نطاق الكمية">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">المنتج الأساسي فقط</SelectItem>
                    <SelectItem value="variants">حسب المتغيرات</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  لا يمكن مزج الوضعين في نفس الطلب لنفس المنتج.
                </p>
              </div>
            ) : null}

            {!multiProductMode && hasActiveVariants && stockMode === 'variants' ? (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                      <th className="px-3 py-2 text-start font-medium">المتغير</th>
                      <th className="px-3 py-2 text-start font-medium">الكمية</th>
                      {tracksSourceAvailability ? (
                        <th className="px-3 py-2 text-start font-medium">المتاح في الموقع</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {activeVariants.map((variant) => (
                      <tr key={variant.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <div className="font-medium">{variant.nameAr}</div>
                          <div className="text-xs text-muted-foreground" dir="ltr">
                            {variant.sku}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <FlexibleQuantityInput
                            className="h-8 w-28"
                            value={variantQuantities[variant.id] ?? 0}
                            max={tracksSourceAvailability ? (variantAvailable[variant.id] ?? null) : null}
                            disabled={!locationsReady}
                            onChange={(nextQty) => {
                              setVariantQuantities((prev) => ({ ...prev, [variant.id]: nextQty }));
                            }}
                          />
                        </td>
                        {tracksSourceAvailability ? (
                          <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums" dir="ltr">
                            {variantAvailable[variant.id] ?? '—'}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {isCountLike ? (
              <div className="space-y-1.5">
                <Label htmlFor="op-counted">الكمية المعدودة</Label>
                <Input
                  id="op-counted"
                  type="number"
                  min={0}
                  step={1}
                  dir="ltr"
                  disabled={!locationsReady}
                  {...form.register('quantity', { valueAsNumber: true })}
                />
              </div>
            ) : null}

            {!multiProductMode ? (
              <div className="space-y-1.5">
                <Label htmlFor="op-sku">رمز المنتج (SKU)</Label>
                <Input
                  id="op-sku"
                  dir="ltr"
                  {...form.register('sku')}
                  disabled={!locationsReady || (hasActiveVariants && stockMode === 'variants')}
                />
                {stockMode === 'product' && hasActiveVariants ? (
                  <p className="text-xs text-muted-foreground">سيُرسل السطر بدون متغير (variantId = null).</p>
                ) : null}
              </div>
            ) : null}
              </OperationFormSection>

              <OperationFormSection>
                {/* One row: date · source document · party (contact, or a typed name). */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="op-date">التاريخ</Label>
                      <Input id="op-date" type="datetime-local" dir="ltr" className="h-10" {...form.register('occurredAt')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="op-source">
                        {kind === 'customer_return' ? 'رقم مستند البيع الأصلي' : 'المستند المصدر'}
                      </Label>
                      <Input
                        id="op-source"
                        className="h-10"
                        {...form.register('sourceDocument')}
                        placeholder={
                          kind === 'customer_return'
                            ? 'مثال: رقم فاتورة البيع أو مستند الصرف — منه تُؤخذ التكلفة'
                            : 'اختياري'
                        }
                      />
                      {kind === 'customer_return' ? (
                        <p className="text-xs text-muted-foreground">
                          يرجع الصنف بتكلفة ذلك البيع نفسها، ولا يُقبل إرجاع أكثر مما بيع فيه.
                          إن تُرك فارغاً يرجع بمتوسط تكلفة الصنف الحالي.
                        </p>
                      ) : null}
                    </div>

                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                    <Label htmlFor="op-partner">
                      {operationPartnerLabel(kind)}
                    </Label>
                    <Controller
                      control={form.control}
                      name="partnerId"
                      render={({ field }) => (
                        <PartnerSinglePicker
                          companyId={companyId}
                          value={field.value || ''}
                          onChange={field.onChange}
                          onPartnerSelect={(partner) => form.setValue('partnerName', partner.displayName)}
                          placeholder="اختر جهة اتصال (اختياري)"
                          deferSearchUntilOpen
                          aria-label="op-partner"
                        />
                      )}
                    />
                    {form.watch('partnerId') ? null : (
                      <Input
                        id="op-partner-manual"
                        {...form.register('partnerName')}
                        placeholder="أو اكتب الاسم"
                        className="h-10 bg-background"
                      />
                    )}
                  </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="op-notes">ملاحظات</Label>
                    <Textarea id="op-notes" className="min-h-[64px] resize-none" {...form.register('notes')} />
                  </div>
                </div>
              </OperationFormSection>
            </div>

            <DialogFooter className="mt-3 shrink-0 border-t border-border pt-3 max-sm:[&>button]:h-11 max-sm:[&>button]:flex-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={create.isPending || !companyId || !effectiveWarehouseId}
              >
                {create.isPending ? 'جاري الحفظ…' : 'إنشاء مسودة'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(toDelete)} onOpenChange={(openDialog) => !openDialog && setToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>حذف المستند؟</DialogTitle>
            <DialogDescription>حذف «{toDelete?.reference}» نهائيًا من هذه القائمة.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={remove.isPending}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={!toDelete || remove.isPending}
              onClick={() => {
                if (!toDelete || !companyId) return;
                void remove.mutateAsync({ companyId, id: toDelete.id }).then(() => setToDelete(null));
              }}
            >
              {remove.isPending ? 'جاري الحذف…' : 'حذف'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (scopedToWarehouse) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ListToolbar
            className="w-full"
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="ابحث بالمرجع أو المنتج…"
            filters={
              showFilters ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={filterWarehouseId} onValueChange={setFilterWarehouseId}>
                    <SelectTrigger className="inv-filter-select h-10" aria-label="تصفية المستودع">
                      <SelectValue placeholder="المستودع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المستودعات</SelectItem>
                      {allWarehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filterStatus}
                    onValueChange={(value) => setFilterStatus(value as WarehouseOperationStatus | 'all')}
                  >
                    <SelectTrigger className="inv-filter-select-sm h-10" aria-label="تصفية الحالة">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      {(Object.keys(statusLabels) as WarehouseOperationStatus[]).map(
                        (status) => (
                          <SelectItem key={status} value={status}>
                            {statusLabels[status]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ) : undefined
            }
            actions={
              canCreate ? (
                <Button onClick={() => setOpen(true)} disabled={!companyId || allWarehouses.length === 0}>
                  <Plus className="h-4 w-4" />
                  {meta.createLabel}
                </Button>
              ) : undefined
            }
          />
        </div>

        {isError ? <p className="text-sm text-destructive">تعذر تحميل {listTitle}.</p> : null}

        <DataTable
          className="inv-table-host"
          columns={columns}
          data={items}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          emptyText={origin ? 'لا توجد طلبات تجديد بعد. أنشئها من تبويب «الاقتراحات».' : meta.empty}
          onRowClick={(row) => setSelectedId(row.id)}
          mobileCard={operationMobileCard}
        />

        {data ? (
          <AppPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        ) : null}

        {dialogs}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {meta.retired ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          لم يعد يُنشأ هذا النوع من المستندات، والمستندات السابقة تبقى هنا للعرض والتصديق والتراجع.
          للشراء: أنشئ «أمر شراء» ثم استلمه بسند استلام. لإدخال بضاعة مباشرة: استخدم «استلام مخزون».
        </p>
      ) : null}
      {isError ? <p className="text-sm text-destructive">تعذر تحميل {listTitle}.</p> : null}

      {groupBy ? (
        <GroupedDataTable
          columns={visibleColumns}
          group={group}
          list={grouped}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => setSelectedId(row.id)}
          sort={sort.sort}
          onSort={sort.toggle}
          emptyText={origin ? 'لا توجد طلبات تجديد بعد. أنشئها من تبويب «الاقتراحات».' : meta.empty}
        />
      ) : (
        <DirectoryPagedViews
          items={items}
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
          {(pageItems) => (
            <DataTable
              variant="directory"
              className="inv-table-host"
              columns={visibleColumns}
              data={pageItems}
              keyExtractor={(row) => row.id}
              loading={isLoading}
              emptyText={origin ? 'لا توجد طلبات تجديد بعد. أنشئها من تبويب «الاقتراحات».' : meta.empty}
              onRowClick={(row) => setSelectedId(row.id)}
              mobileCard={operationMobileCard}
              sort={sort.sort}
              onSort={sort.toggle}
            />
          )}
        </DirectoryPagedViews>
      )}

      {dialogs}
    </div>
  );
}
