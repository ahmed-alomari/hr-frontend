'use client';

import { useCan } from '@/features/auth/hooks/use-can';
import { companyCurrencyCode } from '@/features/auth/lib/company-currency';
import { currencySymbolAr } from '@/shared/currencies';
import * as React from 'react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { useLocationStockList } from '@/features/inventory/admin/hooks/use-product-on-hand';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import type { WarehouseLocationType } from '@/features/inventory/domain/types/warehouse';
import { formatDateTime } from '@/shared/utils';
import { Badge } from '@/components/ui/badge';
import { DataTable, usePagination, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { Button } from '@/components/ui/button';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import { registerExportRows, type RegisterExportColumn } from '@/components/pdf/lib/register-export-rows';
import { formatQty, moneyCell } from '@/features/inventory/admin/reports/lib/report-shared';

const LOCATION_TYPE_LABELS: Record<WarehouseLocationType, string> = {
  supplier: 'المورد',
  view: 'افتراضي',
  internal: 'داخلي',
  customer: 'العميل',
  inventory: 'خسارة المخزون',
  production: 'الإنتاج',
  transit: 'العابر',
};
type DetailedStockRow = {
  key: string;
  warehouseName: string;
  locationName: string;
  locationCode: string;
  locationType: WarehouseLocationType;
  productName: string;
  sku: string;
  variantLabel: string;
  quantity: number;
  reservedQuantity: number;
  /** Real historical unit cost when available; catalog price only as a labeled estimate. */
  unitCost: number | null;
  stockValue: number;
  /** true when stockValue falls back to the catalog purchase price (costing disabled for the company). */
  isEstimatedValue: boolean;
  /** true when neither historical cost nor a catalog estimate exists yet for this bucket. */
  valueUnavailable: boolean;
  costCurrency: string;
  updatedAt: string;
};

export function DetailedStockReportPage() {
  const companyId = getInventoryCompanyId();
  const canReadCost = useCan()('inv.warehouse.costs.read');
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [warehouseId, setWarehouseId] = React.useState('all');
  const [locationType, setLocationType] = React.useState<'all' | WarehouseLocationType>('internal');
  const [hideZero, setHideZero] = React.useState(true);

  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: stockRows = [], isLoading, isError } = useLocationStockList({
    companyId,
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
  });
  const { data: warehousesData } = useWarehouses({ companyId, limit: 100 });

  const warehouses = React.useMemo(() => warehousesData?.items ?? [], [warehousesData?.items]);
  const warehouseById = React.useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);

  const rows = React.useMemo(() => {
    const result: DetailedStockRow[] = [];
    for (const row of stockRows) {
      const warehouse = warehouseById.get(row.warehouseId);
      // Prefer the real historical inventory cost (cost buckets / batch layers).
      // Only fall back to the catalog purchase price when costing is disabled for
      // the company entirely — never for `missing_cost_basis`, where the catalog
      // price would silently misrepresent an unpriced bucket as valued stock.
      const hasHistoricalCost =
        row.costingStatus === 'active' &&
        row.historicalUnitCost != null &&
        row.historicalValue != null;
      const isEstimatedValue = !hasHistoricalCost && row.costingStatus === 'disabled';
      const unitCost = hasHistoricalCost
        ? row.historicalUnitCost!
        : isEstimatedValue
          ? row.unitCost ?? null
          : null;
      const stockValue = hasHistoricalCost
        ? row.historicalValue!
        : isEstimatedValue
          ? row.quantity * (row.unitCost ?? 0)
          : 0;
      result.push({
        key: row.id,
        warehouseName: row.warehouseNameAr ?? warehouse?.nameAr ?? '—',
        locationName: row.locationNameAr ?? '—',
        locationCode: row.locationCode ?? '—',
        locationType: row.locationType ?? 'internal',
        productName: row.productNameAr ?? row.productId,
        sku: row.variantSku || row.productSku || '—',
        variantLabel: row.variantNameAr ?? '—',
        quantity: row.quantity,
        reservedQuantity: row.reservedQuantity ?? 0,
        unitCost,
        stockValue,
        isEstimatedValue,
        valueUnavailable: !hasHistoricalCost && !isEstimatedValue,
        costCurrency: row.costCurrency ?? companyCurrencyCode(),
        updatedAt: row.updatedAt,
      });
    }
    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [stockRows, warehouseById]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((row) => {
      if (hideZero && row.quantity === 0) return false;
      if (locationType !== 'all' && row.locationType !== locationType) return false;
      if (!q) return true;
      return (
        row.productName.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        row.warehouseName.toLowerCase().includes(q) ||
        row.locationName.toLowerCase().includes(q) ||
        row.locationCode.toLowerCase().includes(q)
      );
    });
  }, [rows, search, hideZero, locationType]);

  const summary = React.useMemo(
    () => ({
      rows: filtered.length,
      onHand: filtered.reduce((sum, row) => sum + row.quantity, 0),
      available: filtered.reduce(
        (sum, row) => sum + Math.max(0, row.quantity - row.reservedQuantity),
        0,
      ),
      value: filtered.reduce((sum, row) => sum + row.stockValue, 0),
    }),
    [filtered],
  );

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    slice: pagedRows,
    total,
  } = usePagination(filtered, DEFAULT_PAGE_SIZE);

  const exportColumns: RegisterExportColumn<DetailedStockRow>[] = [
    { label: 'المستودع', kind: 'text', value: (r) => r.warehouseName },
    { label: 'الموقع', kind: 'text', value: (r) => `${r.locationName} (${r.locationCode})` },
    { label: 'نوع الموقع', kind: 'status', value: (r) => LOCATION_TYPE_LABELS[r.locationType] },
    {
      label: 'المنتج',
      kind: 'name',
      value: (r) => (r.variantLabel !== '—' ? `${r.productName} — ${r.variantLabel}` : r.productName),
    },
    { label: 'SKU', kind: 'code', value: (r) => r.sku },
    { label: 'الكمية', kind: 'number', value: (r) => formatQty(r.quantity), total: (t) => formatQty(t.sums.onHand) },
    { label: 'المحجوز', kind: 'number', value: (r) => formatQty(r.reservedQuantity) },
    {
      label: 'المتاح',
      kind: 'number',
      value: (r) => formatQty(Math.max(0, r.quantity - r.reservedQuantity)),
      total: (t) => formatQty(t.sums.available),
    },
    ...(canReadCost
      ? ([
          { label: 'متوسط التكلفة', kind: 'number', value: (r) => moneyCell(r.unitCost) },
          {
            label: 'قيمة المخزون',
            kind: 'number',
            value: (r) => (r.valueUnavailable ? '' : `${moneyCell(r.stockValue)}${r.isEstimatedValue ? ' *' : ''}`),
            total: (t) => moneyCell(t.sums.value),
          },
        ] satisfies RegisterExportColumn<DetailedStockRow>[])
      : []),
  ];
  const warehouseLabel = warehouseId !== 'all' ? warehouseById.get(warehouseId)?.nameAr : null;
  const filterSummary = [
    warehouseLabel ? `المستودع: ${warehouseLabel}` : 'كل المستودعات',
    locationType !== 'all' ? `نوع الموقع: ${LOCATION_TYPE_LABELS[locationType]}` : null,
    hideZero ? 'بدون الأرصدة الصفرية' : null,
    search ? `بحث: ${search}` : null,
    canReadCost && filtered.some((r) => r.isEstimatedValue) ? '* قيمة تقديرية من سعر الشراء في المنتج' : null,
  ].filter((line): line is string => Boolean(line));

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={(warehouseId !== 'all' ? 1 : 0) + (locationType !== 'all' ? 1 : 0)} />
        <RegisterExportMenu
          title="المخزون التفصيلي"
          fileName="inventory-detailed-stock"
          columns={exportColumns}
          getRows={async () =>
            registerExportRows({
              columns: exportColumns,
              rows: filtered,
              total: {
                count: summary.rows,
                sums: { onHand: summary.onHand, available: summary.available, value: summary.value },
              },
            })
          }
          subtitleLines={filterSummary}
          landscape
          pinnedColumnCount={1}
          emptyMessage="لا توجد صفوف مخزون ضمن الفلاتر الحالية."
        />
      </div>
    ),
    [warehouseId, locationType, canReadCost, filtered, summary, filterSummary.join('|')],
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
            placeholder="ابحث بالمنتج أو الموقع…"
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
            id: 'locationType',
            value: locationType,
            onChange: (value) => setLocationType(value as typeof locationType),
            placeholder: 'كل الأنواع',
            options: [
              { value: 'all', label: 'كل الأنواع' },
              ...(Object.keys(LOCATION_TYPE_LABELS) as WarehouseLocationType[]).map((type) => ({
                value: type,
                label: LOCATION_TYPE_LABELS[type],
              })),
            ],
          },
        ]}
        trailingActions={
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setHideZero((prev) => !prev)}>
            {hideZero ? 'إخفاء الصفر: نعم' : 'إخفاء الصفر: لا'}
          </Button>
        }
      />
    ),
    [searchInput, warehouseId, locationType, hideZero, warehouses],
  );

  const columns: ColumnDef<DetailedStockRow>[] = [
    {
      key: 'warehouse',
      title: 'المستودع',
      render: (row) => <span className="text-sm">{row.warehouseName}</span>,
    },
    {
      key: 'location',
      title: 'الموقع',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.locationName}</span>
          <span className="text-xs text-muted-foreground" dir="ltr">
            {row.locationCode}
          </span>
        </div>
      ),
    },
    {
      key: 'type',
      title: 'نوع الموقع',
      hideOnMobile: true,
      render: (row) => (
        <Badge variant="subtle">{LOCATION_TYPE_LABELS[row.locationType]}</Badge>
      ),
    },
    {
      key: 'product',
      title: 'المنتج',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.productName}</span>
          <span className="text-xs text-muted-foreground">
            {row.variantLabel !== '—' ? row.variantLabel : null}
            {row.variantLabel !== '—' ? ' · ' : null}
            <span dir="ltr">{row.sku}</span>
          </span>
        </div>
      ),
    },
    {
      key: 'unitCost',
      title: 'متوسط التكلفة',
      hideOnMobile: true,
      render: (row) =>
        row.unitCost == null ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span className="font-semibold tabular-nums" dir="ltr">
            {row.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            {currencySymbolAr(row.costCurrency)}
          </span>
        ),
    },
    {
      key: 'qty',
      title: 'الكمية',
      render: (row) => (
        <span className="font-semibold tabular-nums" dir="ltr">
          {row.quantity}
        </span>
      ),
    },
    {
      key: 'reserved',
      title: 'المحجوز',
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-nums text-muted-foreground" dir="ltr">
          {row.reservedQuantity}
        </span>
      ),
    },
    {
      key: 'available',
      title: 'المتاح',
      render: (row) => (
        <span className="font-semibold tabular-nums" dir="ltr">
          {Math.max(0, row.quantity - row.reservedQuantity)}
        </span>
      ),
    },
    {
      key: 'value',
      title: 'قيمة المخزون',
      hideOnMobile: true,
      render: (row) =>
        row.valueUnavailable ? (
          <span className="text-xs text-muted-foreground">غير متاحة</span>
        ) : (
          <div className="flex flex-col">
            <span className="tabular-nums" dir="ltr">
              {row.stockValue.toLocaleString('en-US', { maximumFractionDigits: 2 })} {row.costCurrency}
            </span>
            {row.isEstimatedValue ? (
              <span className="text-[11px] text-muted-foreground">تقديري (سعر الشراء بالمنتج)</span>
            ) : null}
          </div>
        ),
    },
    {
      key: 'updated',
      title: 'آخر تحديث',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatDateTime(row.updatedAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr="المخزون التفصيلي"
        descriptionAr="كمية كل منتج في كل موقع، مع متوسط تكلفة المستودع الحالي. يتحدث بعد كل استلام أو صرف."
        iconName="ClipboardList"
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <SummaryCard label="صفوف المخزون" value={summary.rows} />
        <SummaryCard label="الكمية الفعلية" value={summary.onHand} />
        <SummaryCard label="المتاح" value={summary.available} />
        {canReadCost ? (
          <SummaryCard label="قيمة المخزون" value={summary.value} suffix={currencySymbolAr(companyCurrencyCode())} />
        ) : null}
      </div>

      {isError ? <p className="text-sm text-destructive">تعذر تحميل المخزون التفصيلي.</p> : null}

      <DirectoryPagedViews
        items={pagedRows}
        loading={isLoading}
        serverPagination={{
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          setPage,
          setPageSize,
        }}
      >
        {(rowsPage) => (
          <DataTable
            variant="directory"
            className="inv-table-host"
            columns={
              canReadCost
                ? columns
                : columns.filter((column) => column.key !== 'unitCost' && column.key !== 'value')
            }
            data={rowsPage}
            keyExtractor={(row) => row.key}
            mobileCard={(row) => (
              // Phones: the product and how many there are at this location.
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.variantLabel !== '—' ? `${row.variantLabel} · ` : null}
                      <span dir="ltr">{row.sku}</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-lg font-semibold tabular-nums" dir="ltr">
                    {row.quantity}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {row.locationName} <span dir="ltr">({row.locationCode})</span> · {row.warehouseName}
                  </span>
                  <span>
                    المتاح{' '}
                    <span className="font-semibold tabular-nums text-foreground">
                      {Math.max(0, row.quantity - row.reservedQuantity)}
                    </span>
                    {row.reservedQuantity > 0 ? ` · محجوز ${row.reservedQuantity}` : ''}
                  </span>
                </div>
              </div>
            )}
            loading={isLoading}
            emptyText="لا توجد صفوف مخزون تفصيلي."
          />
        )}
      </DirectoryPagedViews>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card px-4 py-3 shadow-soft max-sm:px-3 max-sm:py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums" dir="ltr">
        {value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        {suffix ? ` ${suffix}` : ''}
      </p>
    </div>
  );
}
