'use client';

import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import { PhoneStatsFold } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { inventoryAdminRoutes } from '@/features/inventory/admin/constants/routes';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { useLocationStockList } from '@/features/inventory/admin/hooks/use-product-on-hand';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { useReportProducts } from '@/features/inventory/admin/reports/hooks/use-report-products';
import { Badge } from '@/components/ui/badge';
import { DataTable, usePagination, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { formatQty } from '@/features/inventory/admin/reports/lib/report-shared';

type StockOverviewRow = {
  key: string;
  productId: string;
  productName: string;
  sku: string;
  trackInventory: boolean;
  onHand: number;
  reserved: number;
  available: number;
  warehouseCount: number;
  locationCount: number;
  lowStockThreshold: number;
  isLow: boolean;
};

export function StockOverviewReportPage() {
  const companyId = getInventoryCompanyId();
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [warehouseId, setWarehouseId] = React.useState('all');
  const [stockFilter, setStockFilter] = React.useState<'all' | 'in_stock' | 'low' | 'out'>('all');

  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: stockRows = [], isLoading: stockLoading, isError: stockError } = useLocationStockList({
    companyId,
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
  });
  const { data: productsData, isLoading: productsLoading } = useReportProducts(companyId);
  const { data: warehousesData } = useWarehouses({ companyId, limit: 100 });

  const products = React.useMemo(() => productsData ?? [], [productsData]);
  const warehouses = warehousesData?.items ?? [];

  const rows = React.useMemo(() => {
    const byProduct = new Map<
      string,
      { onHand: number; reserved: number; warehouses: Set<string>; locations: Set<string> }
    >();

    for (const row of stockRows) {
      if (row.locationType !== 'internal') continue;
      let agg = byProduct.get(row.productId);
      if (!agg) {
        agg = { onHand: 0, reserved: 0, warehouses: new Set(), locations: new Set() };
        byProduct.set(row.productId, agg);
      }
      agg.onHand += row.quantity;
      agg.reserved += row.reservedQuantity ?? 0;
      agg.warehouses.add(row.warehouseId);
      agg.locations.add(row.locationId);
    }

    const result: StockOverviewRow[] = products.map((product) => {
      const agg = byProduct.get(product.id);
      const onHand = agg?.onHand ?? 0;
      const reserved = agg?.reserved ?? 0;
      const available = Math.max(0, onHand - reserved);
      const threshold = product.lowStockThreshold;
      return {
        key: product.id,
        productId: product.id,
        productName: product.nameAr,
        sku: product.sku,
        trackInventory: product.trackInventory,
        onHand,
        reserved,
        available,
        warehouseCount: agg?.warehouses.size ?? 0,
        locationCount: agg?.locations.size ?? 0,
        lowStockThreshold: threshold,
        isLow: product.trackInventory && threshold > 0 && available > 0 && available <= threshold,
      };
    });

    return result;
  }, [stockRows, products]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((row) => {
      if (stockFilter === 'in_stock' && row.available <= 0) return false;
      if (stockFilter === 'out' && row.available !== 0) return false;
      if (stockFilter === 'low' && !row.isLow) return false;
      if (!q) return true;
      return row.productName.toLowerCase().includes(q) || row.sku.toLowerCase().includes(q);
    });
  }, [rows, search, stockFilter]);

  const totals = React.useMemo(() => {
    const onHand = filtered.reduce((sum, row) => sum + row.onHand, 0);
    const low = filtered.filter((row) => row.isLow).length;
    const out = filtered.filter((row) => row.onHand <= 0 && row.trackInventory).length;
    return { onHand, low, out, products: filtered.length };
  }, [filtered]);

  const columns: ColumnDef<StockOverviewRow>[] = [
    {
      key: 'product',
      title: 'المنتج',
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
      key: 'onHand',
      title: 'الكمية',
      render: (row) => (
        <span className="font-medium tabular-nums" dir="ltr">
          {row.onHand}
        </span>
      ),
    },
    {
      key: 'reserved',
      title: 'المحجوز',
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-nums text-muted-foreground" dir="ltr">
          {row.reserved}
        </span>
      ),
    },
    {
      key: 'available',
      title: 'المتاح',
      render: (row) => (
        <span className="font-semibold tabular-nums" dir="ltr">
          {row.available}
        </span>
      ),
    },
    {
      key: 'warehouses',
      title: 'مستودعات',
      hideOnMobile: true,
      render: (row) => <span className="tabular-nums">{row.warehouseCount}</span>,
    },
    {
      key: 'locations',
      title: 'مواقع',
      hideOnMobile: true,
      render: (row) => <span className="tabular-nums">{row.locationCount}</span>,
    },
    {
      key: 'status',
      title: 'الحالة',
      render: (row) => stockStatusBadge(row),
    },
  ];

  const tools = useListTools<StockOverviewRow>({
    section: 'inventory',
    page: 'stock-overview',
    columns,
    rows: filtered,
    fields: {
      product: { kind: 'name', text: (r) => r.productName },
      onHand: { kind: 'number', text: (r) => formatQty(r.onHand), sort: (r) => r.onHand, sum: (r) => r.onHand, formatSum: formatQty },
      reserved: { kind: 'number', text: (r) => formatQty(r.reserved), sort: (r) => r.reserved, sum: (r) => r.reserved, formatSum: formatQty },
      available: { kind: 'number', text: (r) => formatQty(r.available), sort: (r) => r.available, sum: (r) => r.available, formatSum: formatQty },
      warehouses: { kind: 'number', text: (r) => String(r.warehouseCount), sort: (r) => r.warehouseCount },
      locations: { kind: 'number', text: (r) => String(r.locationCount), sort: (r) => r.locationCount },
      status: { kind: 'status', text: stockStatusLabel, group: stockStatusLabel },
    },
  });

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    slice: pagedRows,
    total,
  } = usePagination(tools.rows, DEFAULT_PAGE_SIZE);

  const warehouseLabel = warehouseId !== 'all' ? warehouses.find((w) => w.id === warehouseId)?.nameAr : null;
  const stockFilterLabel = { all: null, in_stock: 'متوفر', low: 'منخفض', out: 'نفد' }[stockFilter];
  const filterSummary = [
    warehouseLabel ? `المستودع: ${warehouseLabel}` : 'كل المستودعات',
    stockFilterLabel ? `الحالة: ${stockFilterLabel}` : null,
    search ? `بحث: ${search}` : null,
  ].filter((line): line is string => Boolean(line));

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={(warehouseId !== 'all' ? 1 : 0) + (stockFilter !== 'all' ? 1 : 0)} />
        {tools.buttons}
        {tools.exportMenu('المخزون', 'inventory-stock', filterSummary)}
      </div>
    ),
    [warehouseId, stockFilter, filterSummary.join('|'), tools.depsKey],
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
            placeholder="ابحث بالمنتج أو SKU…"
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
            id: 'stock',
            value: stockFilter,
            onChange: (value) => setStockFilter(value as typeof stockFilter),
            placeholder: 'كل الحالات',
            options: [
              { value: 'all', label: 'كل الحالات' },
              { value: 'in_stock', label: 'متوفر' },
              { value: 'low', label: 'منخفض' },
              { value: 'out', label: 'نفد' },
            ],
          },
        ]}
      />
    ),
    [searchInput, warehouseId, stockFilter, warehouses],
  );

  const router = useRouter();

  /** Phones: name and status, then on hand / reserved / available on one line. */
  const stockMobileCard = (row: StockOverviewRow) => (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{row.productName}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {row.sku || '—'}
          </p>
        </div>
        <div className="shrink-0">{stockStatusBadge(row)}</div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          الكمية <span className="font-medium tabular-nums text-foreground">{row.onHand}</span>
        </span>
        <span>
          المحجوز <span className="tabular-nums text-foreground">{row.reserved}</span>
        </span>
        <span>
          المتاح <span className="font-semibold tabular-nums text-foreground">{row.available}</span>
        </span>
        <span>
          {row.locationCount} مواقع
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr="المخزون"
        descriptionAr="ملخص الكميات المتاحة لكل منتج من مواقع التخزين الداخلية."
        iconName="Package"
      />

      <PhoneStatsFold summary={<>منتجات {totals.products}</>}>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <SummaryCard label="منتجات" value={totals.products} />
          <SummaryCard label="إجمالي الكمية" value={totals.onHand} />
          <SummaryCard label="منخفض المخزون" value={totals.low} />
          <SummaryCard label="نفد" value={totals.out} />
        </div>
      </PhoneStatsFold>

      {stockError ? <p className="text-sm text-destructive">تعذر تحميل بيانات المخزون.</p> : null}

<ListToolsTable tools={tools} keyExtractor={(row) => row.key} onRowClick={(row) => router.push(inventoryAdminRoutes.productDetail(row.productId))}>
      <DirectoryPagedViews
        items={pagedRows}
        loading={stockLoading || productsLoading}
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
            columns={tools.columns}
            {...tools.tableSort}
            data={rowsPage}
            keyExtractor={(row) => row.key}
            mobileCard={stockMobileCard}
            onRowClick={(row) => router.push(inventoryAdminRoutes.productDetail(row.productId))}
            loading={stockLoading || productsLoading}
            emptyText="لا توجد بيانات مخزون."
          />
        )}
      </DirectoryPagedViews>
</ListToolsTable>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card px-4 py-3 shadow-soft max-sm:px-3 max-sm:py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums" dir="ltr">
        {value}
      </p>
    </div>
  );
}

function stockStatusLabel(row: StockOverviewRow): string {
  if (!row.trackInventory) return 'بدون تتبع';
  if (row.available <= 0) return 'نفد';
  if (row.isLow) return 'منخفض';
  return 'متوفر';
}

function stockStatusBadge(row: StockOverviewRow) {
  if (!row.trackInventory) return <Badge variant="subtle">بدون تتبع</Badge>;
  if (row.available <= 0) return <Badge variant="destructive">نفد</Badge>;
  if (row.isLow) return <Badge variant="warning">منخفض</Badge>;
  return <Badge variant="success">متوفر</Badge>;
}
