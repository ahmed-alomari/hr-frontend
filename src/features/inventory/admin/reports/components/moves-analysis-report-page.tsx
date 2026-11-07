'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import {
  WAREHOUSE_OPERATION_KINDS,
  WAREHOUSE_OPERATION_KIND_META,
} from '@/features/inventory/domain/constants/warehouse-operation-kinds';
import type { WarehouseOperationKind } from '@/features/inventory/domain/types/warehouse';
import {
  inventoryReportsApi,
  type MovesAnalysisQuery,
  type MovesAnalysisRow,
} from '@/features/inventory/admin/reports/lib/api/inventory-reports';
import {
  ReportStat,
  ValueHiddenNote,
  currencyLine,
  currentMonthRange,
  formatQty,
  formatReportMoney,
  moneyCell,
  periodLabel,
} from '@/features/inventory/admin/reports/lib/report-shared';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { DateRangeFilterTrigger, type DateRangeFilterValue } from '@/components/ui/date-range-filter-trigger';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import type { ListTotals } from '@/components/ui/list-group';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import { registerExportRows, type RegisterExportColumn } from '@/components/pdf/lib/register-export-rows';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';

const KIND_LABELS = WAREHOUSE_OPERATION_KIND_META as Partial<Record<string, { labelAr: string }>>;
const kindLabel = (kind: string) => KIND_LABELS[kind]?.labelAr ?? kind;

/**
 * Per document kind and warehouse, from the server over every movement of the
 * period (company calendar days). A move between locations of one warehouse
 * nets to nothing; a transfer between warehouses is out of one and into the other.
 */
export function MovesAnalysisReportPage() {
  const companyId = getInventoryCompanyId();
  const filterKey = (field: string) => hrFiltersKey('inventory', 'moves-analysis', companyId, field);
  const [warehouseId, setWarehouseId] = usePersistedFilterState(filterKey('warehouse'), 'all');
  const [kind, setKind] = usePersistedFilterState<'all' | WarehouseOperationKind>(filterKey('kind'), 'all');
  const [period, setPeriod] = usePersistedFilterState<DateRangeFilterValue>(filterKey('period'), currentMonthRange());
  const stateKeys = listStateKeys('inventory', 'moves-analysis', companyId);

  const filters: MovesAnalysisQuery = {
    companyId,
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
    kind: kind === 'all' ? undefined : kind,
    dateFrom: period.from || undefined,
    dateTo: period.to || undefined,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory', 'reports', 'moves-analysis', filters],
    queryFn: () => inventoryReportsApi.movesAnalysis(filters),
    enabled: Boolean(companyId),
  });
  const { data: warehousesData } = useWarehouses({ companyId, limit: 100 });
  const warehouses = React.useMemo(() => warehousesData?.items ?? [], [warehousesData?.items]);

  const valueVisible = data?.valueVisible === true;
  const money = (v: number | null) => formatReportMoney(v, data?.currency);
  const rows = data?.items ?? [];
  const t = data?.totals;
  const totals: ListTotals | null = t
    ? {
        count: rows.length,
        sums: {
          operationCount: t.operationCount,
          lineCount: t.lineCount,
          inQty: t.inQty,
          outQty: t.outQty,
          netQty: t.netQty,
          inValue: t.inValue ?? 0,
          outValue: t.outValue ?? 0,
        },
      }
    : null;

  const num = (value: number, className = 'tabular-nums') => (
    <span className={className} dir="ltr">
      {formatQty(value)}
    </span>
  );
  const IN_CLASS = 'font-medium tabular-nums text-emerald-700 dark:text-emerald-400';
  const OUT_CLASS = 'font-medium tabular-nums text-rose-700 dark:text-rose-400';

  const columns: ColumnDef<MovesAnalysisRow>[] = [
    {
      key: 'kind',
      title: 'نوع الحركة',
      sticky: 'start',
      render: (row) => <span className="font-medium">{kindLabel(row.kind)}</span>,
    },
    {
      key: 'warehouse',
      title: 'المستودع',
      render: (row) => <span className="text-sm">{row.warehouseName ?? '—'}</span>,
    },
    {
      key: 'docs',
      title: 'المستندات',
      total: (s) => num(s.sums.operationCount ?? 0),
      render: (row) => num(row.operationCount),
    },
    {
      key: 'lines',
      title: 'البنود',
      hideOnMobile: true,
      total: (s) => num(s.sums.lineCount ?? 0),
      render: (row) => num(row.lineCount),
    },
    { key: 'in', title: 'وارد', total: (s) => num(s.sums.inQty ?? 0, IN_CLASS), render: (row) => num(row.inQty, IN_CLASS) },
    {
      key: 'out',
      title: 'صادر',
      total: (s) => num(s.sums.outQty ?? 0, OUT_CLASS),
      render: (row) => num(row.outQty, OUT_CLASS),
    },
    {
      key: 'net',
      title: 'صافي',
      total: (s) => num(s.sums.netQty ?? 0, 'font-semibold tabular-nums'),
      render: (row) => num(row.netQty, 'font-semibold tabular-nums'),
    },
    ...(valueVisible
      ? ([
          {
            key: 'inValue',
            title: 'قيمة الوارد',
            total: (s) => <span className="tabular-nums">{money(s.sums.inValue ?? 0)}</span>,
            render: (row) => <span className="tabular-nums">{money(row.inValue)}</span>,
          },
          {
            key: 'outValue',
            title: 'قيمة الصادر',
            total: (s) => <span className="tabular-nums">{money(s.sums.outValue ?? 0)}</span>,
            render: (row) => <span className="tabular-nums">{money(row.outValue)}</span>,
          },
        ] satisfies ColumnDef<MovesAnalysisRow>[])
      : []),
  ];

  const exportColumns: RegisterExportColumn<MovesAnalysisRow>[] = [
    { label: 'نوع الحركة', kind: 'name', value: (r) => kindLabel(r.kind) },
    { label: 'المستودع', kind: 'text', value: (r) => r.warehouseName ?? '' },
    { label: 'المستندات', kind: 'number', value: (r) => String(r.operationCount), total: (s) => String(s.sums.operationCount) },
    { label: 'البنود', kind: 'number', value: (r) => String(r.lineCount), total: (s) => String(s.sums.lineCount) },
    { label: 'وارد', kind: 'number', value: (r) => formatQty(r.inQty), total: (s) => formatQty(s.sums.inQty) },
    { label: 'صادر', kind: 'number', value: (r) => formatQty(r.outQty), total: (s) => formatQty(s.sums.outQty) },
    { label: 'صافي', kind: 'number', value: (r) => formatQty(r.netQty), total: (s) => formatQty(s.sums.netQty) },
    ...(valueVisible
      ? ([
          { label: 'قيمة الوارد', kind: 'number', value: (r) => moneyCell(r.inValue), total: (s) => moneyCell(s.sums.inValue) },
          { label: 'قيمة الصادر', kind: 'number', value: (r) => moneyCell(r.outValue), total: (s) => moneyCell(s.sums.outValue) },
        ] satisfies RegisterExportColumn<MovesAnalysisRow>[])
      : []),
  ];

  const warehouseLabel = warehouseId !== 'all' ? warehouses.find((w) => w.id === warehouseId)?.nameAr : null;
  const filterSummary = [
    `الفترة: ${periodLabel(period.from, period.to)}`,
    warehouseLabel ? `المستودع: ${warehouseLabel}` : 'كل المستودعات',
    kind !== 'all' ? `النوع: ${kindLabel(kind)}` : null,
    currencyLine(data),
  ].filter((line): line is string => Boolean(line));
  const activeFilterCount = (warehouseId !== 'all' ? 1 : 0) + (kind !== 'all' ? 1 : 0) + 1;

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <ListSavedViews storageKey={stateKeys.views} prefixes={stateKeys.prefixes} />
        <RegisterExportMenu
          title="تحليل الحركات"
          fileName="inventory-moves-analysis"
          columns={exportColumns}
          getRows={async () => registerExportRows({ columns: exportColumns, rows, total: totals })}
          subtitleLines={filterSummary}
          landscape={valueVisible}
          pinnedColumnCount={1}
          emptyMessage="لا توجد حركات ضمن الفلاتر الحالية."
        />
      </div>
    ),
    [activeFilterCount, JSON.stringify(data), exportColumns.length, filterSummary.join('|'), stateKeys.views],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
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
            id: 'kind',
            value: kind,
            onChange: (value) => setKind(value as typeof kind),
            placeholder: 'كل الأنواع',
            options: [
              { value: 'all', label: 'كل الأنواع' },
              ...WAREHOUSE_OPERATION_KINDS.map((item) => ({
                value: item,
                label: WAREHOUSE_OPERATION_KIND_META[item].labelAr,
              })),
            ],
          },
        ]}
        trailingActions={
          <DateRangeFilterTrigger value={period} onChange={setPeriod} placeholder="الفترة" allowEmpty />
        }
      />
    ),
    [warehouseId, kind, period, warehouses],
  );

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr="تحليل الحركات"
        descriptionAr="الحركات المرحّلة في الفترة مجمّعة حسب نوع المستند والمستودع: وارد / صادر / صافي، بالكمية والقيمة."
        iconName="BarChart3"
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        <ReportStat label="مستندات" value={(t?.operationCount ?? 0).toLocaleString('en-US')} />
        <ReportStat label="بنود" value={(t?.lineCount ?? 0).toLocaleString('en-US')} />
        <ReportStat
          label="وارد"
          tone="in"
          value={formatQty(t?.inQty ?? 0)}
          hint={valueVisible ? money(t?.inValue ?? 0) : undefined}
        />
        <ReportStat
          label="صادر"
          tone="out"
          value={formatQty(t?.outQty ?? 0)}
          hint={valueVisible ? money(t?.outValue ?? 0) : undefined}
        />
        <ReportStat label="صافي" value={formatQty(t?.netQty ?? 0)} />
      </div>

      <ValueHiddenNote header={data} />

      {isError ? (
        <div className="flex items-center gap-3 text-sm text-destructive">
          <span>تعذر تحميل تحليل الحركات.</span>
          <button type="button" className="underline" onClick={() => void refetch()}>
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      <DataTable
        variant="directory"
        keepHeaderWhenEmpty
        className="inv-table-host"
        columns={columns}
        data={rows}
        keyExtractor={(row) => row.key}
        totals={totals}
        mobileCard={(row) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{kindLabel(row.kind)}</p>
              <span className="text-xs text-muted-foreground">{row.warehouseName ?? '—'}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{row.operationCount} مستندات</span>
              <span>
                وارد <span className={IN_CLASS}>{formatQty(row.inQty)}</span>
              </span>
              <span>
                صادر <span className={OUT_CLASS}>{formatQty(row.outQty)}</span>
              </span>
              <span>
                صافي <span className="font-semibold tabular-nums text-foreground">{formatQty(row.netQty)}</span>
              </span>
            </div>
          </div>
        )}
        loading={isLoading}
        emptyText="لا توجد حركات مرحّلة في الفترة."
      />
    </div>
  );
}
