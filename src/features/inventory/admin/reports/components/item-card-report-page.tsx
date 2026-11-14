'use client';

import { useListTools } from '@/components/ui/list-tools';
import { PhoneStatsFold } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { ProductSinglePicker } from '@/features/catalog/products/components/product-single-picker';
import { OperationLineVariantSelect } from '@/features/inventory/admin/operations/components/operation-line-variant-select';
import { WAREHOUSE_OPERATION_KIND_META } from '@/features/inventory/domain/constants/warehouse-operation-kinds';
import {
  inventoryReportsApi,
  type ItemCardReport,
  type ItemCardRow,
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
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews } from '@/components/ui/paged-list';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { DateRangeFilterTrigger, type DateRangeFilterValue } from '@/components/ui/date-range-filter-trigger';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import type { RegisterExportColumn } from '@/components/pdf/lib/register-export-rows';
import type { RegisterRow } from '@/components/pdf/print/register-document';
import { fetchAllPaginatedItems } from '@/shared/api/client';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';

const PAGE_SIZE = 100;

const KIND_LABELS = WAREHOUSE_OPERATION_KIND_META as Partial<Record<string, { labelAr: string }>>;

function kindLabel(row: Pick<ItemCardRow, 'kind'>): string {
  return row.kind ? (KIND_LABELS[row.kind]?.labelAr ?? row.kind) : '—';
}

function documentLabel(row: ItemCardRow): string {
  const parts = [row.reference, kindLabel(row)].filter(Boolean);
  return `${parts.join(' · ')}${row.isUndo ? ' (تراجع)' : ''}`;
}

export function ItemCardReportPage() {
  const companyId = getInventoryCompanyId();
  const searchParams = useSearchParams();
  const filterKey = (field: string) => hrFiltersKey('inventory', 'item-card', companyId, field);
  const [productId, setProductId] = usePersistedFilterState(filterKey('product'), '');
  const [variantId, setVariantId] = usePersistedFilterState(filterKey('variant'), '');
  const [warehouseId, setWarehouseId] = usePersistedFilterState(filterKey('warehouse'), 'all');
  const [period, setPeriod] = usePersistedFilterState<DateRangeFilterValue>(filterKey('period'), currentMonthRange());
  const [productName, setProductName] = React.useState('');
  const [page, setPage] = React.useState(1);
  const stateKeys = listStateKeys('inventory', 'item-card', companyId);

  // Opened from a report row: that item, warehouse and period.
  const urlApplied = React.useRef(false);
  React.useEffect(() => {
    if (urlApplied.current) return;
    urlApplied.current = true;
    const fromUrl = searchParams.get('productId');
    if (!fromUrl) return;
    setProductId(fromUrl);
    setVariantId(searchParams.get('variantId') ?? '');
    setWarehouseId(searchParams.get('warehouseId') ?? 'all');
    const from = searchParams.get('from') ?? '';
    const to = searchParams.get('to') ?? '';
    if (from || to) setPeriod({ from, to });
  }, [searchParams, setProductId, setVariantId, setWarehouseId, setPeriod]);

  React.useEffect(() => {
    setPage(1);
  }, [productId, variantId, warehouseId, period]);

  const filters = {
    companyId,
    productId,
    variantId: variantId || undefined,
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
    dateFrom: period.from || undefined,
    dateTo: period.to || undefined,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory', 'reports', 'item-card', { ...filters, page }],
    queryFn: () => inventoryReportsApi.itemCard({ ...filters, page, limit: PAGE_SIZE }),
    enabled: Boolean(companyId && productId),
    placeholderData: keepPreviousData,
  });

  const { data: warehousesData } = useWarehouses({ companyId, limit: 100 });
  const warehouses = React.useMemo(() => warehousesData?.items ?? [], [warehousesData?.items]);
  const warehouseLabel = warehouseId !== 'all' ? warehouses.find((w) => w.id === warehouseId)?.nameAr : null;

  const report: ItemCardReport | undefined = productId ? data : undefined;
  const valueVisible = report?.valueVisible === true;
  const money = (v: number | null) => formatReportMoney(v, report?.currency);
  const rows = report?.items ?? [];
  const total = report?.pagination.total ?? 0;

  const exportColumns: RegisterExportColumn<ItemCardRow>[] = [
    { label: 'التاريخ', kind: 'date', value: (r) => formatDateTime(r.occurredAt) },
    { label: 'المستند', kind: 'text', value: documentLabel },
    { label: 'المستودع', kind: 'text', value: (r) => r.warehouseName ?? '' },
    { label: 'الجهة / المصدر', kind: 'text', value: (r) => r.partnerName || r.sourceDocument || '' },
    { label: 'وارد', kind: 'number', value: (r) => (r.inQty ? formatQty(r.inQty) : '') },
    { label: 'صادر', kind: 'number', value: (r) => (r.outQty ? formatQty(r.outQty) : '') },
    { label: 'الرصيد', kind: 'number', value: (r) => formatQty(r.balanceQty) },
    ...(valueVisible
      ? ([
          { label: 'تكلفة الوحدة', kind: 'number', value: (r) => moneyCell(r.unitCost) },
          { label: 'القيمة', kind: 'number', value: (r) => moneyCell(r.valueDelta) },
          { label: 'رصيد القيمة', kind: 'number', value: (r) => moneyCell(r.balanceValue) },
        ] satisfies RegisterExportColumn<ItemCardRow>[])
      : []),
  ];

  const filterSummary = [
    report ? `الصنف: ${itemLabel(report)}${report.sku ? ` (${report.sku})` : ''}` : null,
    `الفترة: ${periodLabel(period.from, period.to)}`,
    warehouseLabel ? `المستودع: ${warehouseLabel}` : 'كل المستودعات',
    currencyLine(report),
  ].filter((line): line is string => Boolean(line));

  /** Opening line, every movement of the period in order, then the closing line. */
  const getExportRows = async (): Promise<RegisterRow[]> => {
    if (!report) return [];
    const { items } = await fetchAllPaginatedItems((p, l) =>
      inventoryReportsApi.itemCard({ ...filters, page: p, limit: l }),
    );
    const blank = exportColumns.map(() => '');
    const line = (label: string, qty: number, value: number | null): string[] => {
      const cells = [...blank];
      cells[0] = label;
      cells[6] = formatQty(qty);
      if (valueVisible) cells[9] = moneyCell(value);
      return cells;
    };
    const closing = line('رصيد آخر المدة', report.closing.qty, report.closing.value);
    closing[4] = formatQty(report.totals.inQty);
    closing[5] = formatQty(report.totals.outQty);
    return [
      line('رصيد أول المدة', report.opening.qty, report.opening.value),
      ...items.map((r) => exportColumns.map((c) => c.value(r))),
      { kind: 'total', cells: closing },
    ];
  };


  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        leadingFilters={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <ProductSinglePicker
              companyId={companyId}
              value={productId}
              onChange={(id) => {
                setProductId(id);
                setVariantId('');
              }}
              onProductSelect={(p) => setProductName(p.nameAr)}
              placeholder="اختر الصنف…"
              className="h-8 w-full sm:w-64"
              aria-label="الصنف"
            />
            {productId ? (
              <OperationLineVariantSelect
                companyId={companyId}
                productId={productId}
                catalogProductName={productName || report?.productName}
                variantId={variantId || undefined}
                variantName={report?.variantName ?? undefined}
                onChange={(id) => setVariantId(id ?? '')}
                className="h-8 w-full sm:w-52"
              />
            ) : null}
          </div>
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
        ]}
        trailingActions={
          <DateRangeFilterTrigger value={period} onChange={setPeriod} placeholder="الفترة" allowEmpty />
        }
      />
    ),
    [companyId, productId, variantId, productName, report?.productName, report?.variantName, warehouseId, warehouses, period],
  );

  const qty = (value: number, tone: 'in' | 'out') =>
    value ? (
      <span
        className={
          tone === 'in'
            ? 'font-medium tabular-nums text-emerald-700 dark:text-emerald-400'
            : 'font-medium tabular-nums text-rose-700 dark:text-rose-400'
        }
        dir="ltr"
      >
        {formatQty(value)}
      </span>
    ) : (
      <span className="text-muted-foreground">—</span>
    );

  const columns: ColumnDef<ItemCardRow>[] = [
    {
      key: 'date',
      title: 'التاريخ',
      sticky: 'start',
      render: (row) => <span className="whitespace-nowrap text-sm">{formatDateTime(row.occurredAt)}</span>,
    },
    {
      key: 'document',
      title: 'المستند',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium" dir="ltr">
            {row.reference ?? '—'}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {kindLabel(row)}
            {row.isUndo ? <Badge variant="subtle">تراجع</Badge> : null}
          </span>
        </div>
      ),
    },
    {
      key: 'warehouse',
      title: 'المستودع',
      hideOnMobile: true,
      render: (row) => <span className="text-sm">{row.warehouseName ?? '—'}</span>,
    },
    {
      key: 'source',
      title: 'الجهة / المصدر',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.partnerName || row.sourceDocument || '—'}</span>
      ),
    },
    { key: 'in', title: 'وارد', render: (row) => qty(row.inQty, 'in') },
    { key: 'out', title: 'صادر', render: (row) => qty(row.outQty, 'out') },
    {
      key: 'balance',
      title: 'الرصيد',
      render: (row) => (
        <span className="font-semibold tabular-nums" dir="ltr">
          {formatQty(row.balanceQty)}
        </span>
      ),
    },
    ...(valueVisible
      ? ([
          {
            key: 'unitCost',
            title: 'تكلفة الوحدة',
            hideOnMobile: true,
            render: (row) => (
              <span className="tabular-nums" dir="ltr">
                {money(row.unitCost)}
              </span>
            ),
          },
          {
            key: 'value',
            title: 'القيمة',
            hideOnMobile: true,
            render: (row) => (
              <span className="tabular-nums" dir="ltr">
                {money(row.valueDelta)}
              </span>
            ),
          },
          {
            key: 'balanceValue',
            title: 'رصيد القيمة',
            render: (row) => (
              <span className="font-semibold tabular-nums" dir="ltr">
                {money(row.balanceValue)}
              </span>
            ),
          },
        ] satisfies ColumnDef<ItemCardRow>[])
      : []),
  ];

  const tools = useListTools<ItemCardRow>({ section: 'inventory', page: 'item-card', columns: columns, rows: [], fields: {}, savedViews: false });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={(warehouseId !== 'all' ? 1 : 0) + 1} />
        {tools.buttons}
        <ListSavedViews storageKey={stateKeys.views} prefixes={stateKeys.prefixes} />
        <RegisterExportMenu
          title="كرت الصنف"
          fileName="inventory-item-card"
          columns={exportColumns}
          getRows={getExportRows}
          subtitleLines={filterSummary}
          landscape
          pinnedColumnCount={1}
          emptyMessage="اختر صنفًا أولًا."
        />
      </div>
    ),
    [warehouseId, JSON.stringify(filters), JSON.stringify(report?.closing), exportColumns.length, filterSummary.join('|'), stateKeys.views, tools.depsKey],
  );

  const mobileCard = (row: ItemCardRow) => (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium" dir="ltr">
            {row.reference ?? '—'}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {kindLabel(row)}
            {row.isUndo ? <Badge variant="subtle">تراجع</Badge> : null}
          </p>
        </div>
        <div className="shrink-0 text-end">
          {row.inQty ? qty(row.inQty, 'in') : qty(row.outQty, 'out')}
          <p className="text-xs text-muted-foreground">
            الرصيد <span className="font-semibold tabular-nums text-foreground">{formatQty(row.balanceQty)}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{row.warehouseName ?? '—'}</span>
        <span className="whitespace-nowrap">{formatDateTime(row.occurredAt)}</span>
      </div>
      {valueVisible ? (
        <p className="text-xs text-muted-foreground">
          القيمة <span className="tabular-nums text-foreground">{money(row.valueDelta)}</span> · رصيد القيمة{' '}
          <span className="font-semibold tabular-nums text-foreground">{money(row.balanceValue)}</span>
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr="كرت الصنف"
        descriptionAr="كل حركة على الصنف في الفترة بترتيبها، والرصيد بعد كل حركة — بالكمية والقيمة."
        iconName="FileText"
      />

      {!productId ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-16 text-center text-sm text-muted-foreground">
          اختر صنفًا من الفلاتر لعرض كرته.
        </div>
      ) : (
        <>
          {report ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-base font-semibold">{itemLabel(report)}</h2>
              {report.sku ? (
                <span className="text-xs text-muted-foreground" dir="ltr">
                  {report.sku}
                </span>
              ) : null}
            </div>
          ) : null}

          <PhoneStatsFold>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
              <ReportStat
                label="رصيد أول المدة"
                value={formatQty(report?.opening.qty ?? 0)}
                hint={valueVisible ? money(report?.opening.value ?? 0) : undefined}
              />
              <ReportStat
                label="الوارد"
                tone="in"
                value={formatQty(report?.totals.inQty ?? 0)}
                hint={valueVisible ? money(report?.totals.inValue ?? 0) : undefined}
              />
              <ReportStat
                label="الصادر"
                tone="out"
                value={formatQty(report?.totals.outQty ?? 0)}
                hint={valueVisible ? money(report?.totals.outValue ?? 0) : undefined}
              />
              <ReportStat
                label="رصيد آخر المدة"
                value={formatQty(report?.closing.qty ?? 0)}
                hint={valueVisible ? money(report?.closing.value ?? 0) : undefined}
              />
            </div>
          </PhoneStatsFold>

          <ValueHiddenNote header={report} />

          {isError ? (
            <div className="flex items-center gap-3 text-sm text-destructive">
              <span>تعذر تحميل كرت الصنف.</span>
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
              pageSize: PAGE_SIZE,
              total,
              totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
              setPage,
              setPageSize: () => setPage(1),
            }}
          >
            {(rowsPage) => (
              <DataTable
                variant="directory"
                keepHeaderWhenEmpty
                className="inv-table-host"
                columns={tools.columns}
                mobileCard={mobileCard}
                data={rowsPage}
                keyExtractor={(row) => row.key}
                loading={isLoading}
                emptyText="لا حركات على هذا الصنف في الفترة."
              />
            )}
          </DirectoryPagedViews>
        </>
      )}
    </div>
  );
}
