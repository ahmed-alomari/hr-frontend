'use client';

import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { DataTable, usePagination, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { ListFilterBar, type PeriodRange } from '@/components/ui/list-filter-bar';
import { downloadXlsxFromAoA, type XlsxCell } from '@/shared/export/download-xlsx';
import { cn } from '@/shared/utils';
import { ReportExportMenu, ShareBar } from '@/features/expenses/components/report-common';
import { useCan } from '@/features/auth/hooks/use-can';
import { companyCurrencyCode } from '@/features/auth/lib/company-currency';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { ORDER_STATUS_LABELS_AR } from '@/features/ecommerce/domain/constants/order-status';
import { SALES_REPORTS_READ } from '@/features/ecommerce/admin/reports/permissions';
import {
  GROUPINGS,
  dayOf,
  factsOf,
  fetchProfitLines,
  formatAmount,
  formatMoney,
  groupBy,
  sortedForTime,
  totalsOf,
  type GroupRow,
  type Grouping,
} from '@/features/ecommerce/admin/reports/lib/profit-report';

const ALL = 'all';

const VIEWS: Array<{ id: Grouping; label: string; column: string }> = [
  { id: 'product', label: 'حسب الصنف', column: 'الصنف' },
  { id: 'category', label: 'حسب الفئة', column: 'الفئة' },
  { id: 'day', label: 'حسب اليوم', column: 'اليوم' },
  { id: 'weekday', label: 'حسب يوم الأسبوع', column: 'يوم الأسبوع' },
  { id: 'hour', label: 'حسب الساعة', column: 'الساعة' },
  { id: 'order', label: 'الطلبات', column: 'الطلب' },
  { id: 'customer', label: 'حسب العميل', column: 'العميل' },
  { id: 'city', label: 'حسب المدينة', column: 'المدينة' },
  { id: 'payment', label: 'حسب طريقة الدفع', column: 'طريقة الدفع' },
];

/** Statuses the owner can narrow to (cancelled / refunded stay out by default). */
const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;

const startOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

function Profit({ value, currency }: { value: number; currency?: string | null }) {
  return (
    <span className={cn('tabular-nums', value > 0 ? 'text-success' : value < 0 ? 'text-destructive' : '')}>
      {currency ? formatMoney(value, currency) : formatAmount(value)}
    </span>
  );
}

const marginText = (m: number | null) => (m == null ? '—' : `${m}%`);

export function StoreProfitReportPage() {
  const can = useCan();
  const canRead = can(SALES_REPORTS_READ);
  const companyId = getStorefrontCompanyId();
  const defaultPeriod = React.useMemo<PeriodRange>(
    () => ({ from: startOfMonth(), to: dayOf(new Date().toISOString()) }),
    [],
  );
  const [period, setPeriod] = React.useState<PeriodRange>(defaultPeriod);
  const [view, setView] = React.useState<Grouping>('product');
  const [status, setStatus] = React.useState(ALL);
  const [categoryId, setCategoryId] = React.useState(ALL);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query = useQuery({
    queryKey: ['store-profit-lines', companyId, period.from, period.to, status],
    queryFn: () =>
      fetchProfitLines({
        companyId,
        from: period.from || undefined,
        to: period.to || undefined,
        status: status === ALL ? undefined : status,
      }),
    enabled: Boolean(companyId) && canRead,
  });
  const lines = React.useMemo(() => query.data ?? [], [query.data]);
  const currency = lines[0]?.currencyCode ?? companyCurrencyCode();

  // Category choices come from the period's lines, before the other filters.
  const categories = React.useMemo(
    () => [
      ...new Map(lines.filter((l) => l.categoryId).map((l) => [l.categoryId!, l.categoryName ?? ''])).entries(),
    ],
    [lines],
  );
  const facts = React.useMemo(
    () => factsOf(lines, search).filter((f) => categoryId === ALL || f.categoryId === categoryId),
    [lines, search, categoryId],
  );
  const totals = React.useMemo(() => totalsOf(facts), [facts]);
  const viewMeta = VIEWS.find((v) => v.id === view)!;
  const rows = React.useMemo(() => sortedForTime(view, groupBy(facts, GROUPINGS[view])), [facts, view]);

  const isDefaultPeriod = period.from === defaultPeriod.from && period.to === defaultPeriod.to;
  const activeFilterCount =
    [status, categoryId].filter((v) => v !== ALL).length +
    (search ? 1 : 0) +
    (view !== 'product' ? 1 : 0) +
    (isDefaultPeriod ? 0 : 1);

  const exportExcel = React.useCallback(async () => {
    const sheet: XlsxCell[][] = [
      [viewMeta.column, 'الطلبات', 'الكمية', 'صافي المبيعات', 'التكلفة', 'الربح', 'الهامش %', 'بلا تكلفة'],
      ...rows.map((r) => [
        r.detail ? `${r.label} (${r.detail})` : r.label,
        r.orders,
        r.units,
        r.revenue,
        r.cost,
        r.profit,
        r.margin,
        r.uncostedRevenue,
      ]),
    ];
    if (sheet.length <= 1) {
      toast.error('لا توجد بيانات للتصدير ضمن الفلاتر الحالية.');
      return;
    }
    try {
      await downloadXlsxFromAoA(
        `store-profit-${view}-${period.from ?? 'all'}-${period.to ?? 'all'}.xlsx`,
        viewMeta.label,
        sheet,
      );
      toast.success('تم تنزيل ملف Excel.');
    } catch {
      toast.error('تعذر تصدير التقرير.');
    }
  }, [rows, view, viewMeta, period]);


  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showStatusSection={false}
        showEmployeePicker={false}
        periodValue={period}
        onPeriodChange={setPeriod}
        defaultPeriod={defaultPeriod}
        leadingFilters={
          <EntityFilterSearchField value={searchInput} onChange={setSearchInput} placeholder="ابحث بالصنف أو رمزه…" />
        }
        inlineSelects={[
          {
            id: 'view',
            value: view === 'product' ? ALL : view,
            onChange: (v) => setView(v === ALL ? 'product' : (v as Grouping)),
            placeholder: 'حسب الصنف',
            options: [
              { value: ALL, label: 'حسب الصنف' },
              ...VIEWS.filter((v) => v.id !== 'product').map((v) => ({ value: v.id, label: v.label })),
            ],
          },
          {
            id: 'status',
            value: status,
            onChange: setStatus,
            placeholder: 'كل الطلبات القائمة',
            options: [
              { value: ALL, label: 'كل الطلبات القائمة' },
              ...STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS_AR[s] })),
            ],
          },
          ...(categories.length > 0
            ? [
                {
                  id: 'category',
                  value: categoryId,
                  onChange: setCategoryId,
                  placeholder: 'كل الفئات',
                  options: [
                    { value: ALL, label: 'كل الفئات' },
                    ...categories.map(([id, name]) => ({ value: id, label: name })),
                  ],
                },
              ]
            : []),
        ]}
      />
    ),
    [period, defaultPeriod, searchInput, view, status, categoryId, categories],
  );

  const maxRevenue = Math.max(0, ...rows.map((r) => r.revenue));
  const columns: ColumnDef<GroupRow>[] = [
    {
      key: 'label',
      title: viewMeta.column,
      render: (r) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{r.label}</span>
          {r.detail ? (
            <span className="text-xs text-muted-foreground" dir="auto">
              {r.detail}
            </span>
          ) : null}
        </div>
      ),
    },
    { key: 'units', title: 'الكمية', render: (r) => <span className="tabular-nums">{formatAmount(r.units)}</span> },
    { key: 'orders', title: 'الطلبات', hideOnMobile: true, render: (r) => <span className="tabular-nums">{r.orders}</span> },
    {
      key: 'revenue',
      title: 'صافي المبيعات',
      render: (r) => <span className="font-semibold tabular-nums">{formatMoney(r.revenue, currency)}</span>,
    },
    {
      key: 'cost',
      title: 'التكلفة',
      render: (r) =>
        r.costedRevenue > 0 ? (
          <span className="tabular-nums">{formatAmount(r.cost)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'profit',
      title: 'الربح',
      render: (r) => (r.costedRevenue > 0 ? <Profit value={r.profit} /> : <span className="text-muted-foreground">—</span>),
    },
    { key: 'margin', title: 'الهامش', hideOnMobile: true, render: (r) => <span className="tabular-nums">{marginText(r.margin)}</span> },
    {
      key: 'share',
      title: 'من المبيعات',
      hideOnMobile: true,
      render: (r) => <ShareBar value={r.revenue} max={maxRevenue} total={totals.revenue} />,
    },
  ];

  const tools = useListTools<GroupRow>({
    section: 'store',
    page: 'profit-report',
    columns,
    rows,
    fields: {
      label: { kind: 'name', text: (r) => r.label },
      units: { kind: 'number', text: (r) => formatAmount(r.units), sort: (r) => r.units, sum: (r) => r.units, formatSum: formatAmount },
      orders: { kind: 'number', text: (r) => String(r.orders), sort: (r) => r.orders },
      revenue: { kind: 'number', text: (r) => formatAmount(r.revenue), sort: (r) => r.revenue, sum: (r) => r.revenue, formatSum: formatAmount },
      cost: { kind: 'number', text: (r) => formatAmount(r.cost), sort: (r) => r.cost, sum: (r) => r.cost, formatSum: formatAmount },
      profit: { kind: 'number', text: (r) => formatAmount(r.profit), sort: (r) => r.profit, sum: (r) => r.profit, formatSum: formatAmount },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        {tools.exportMenu('ربح المتجر', 'store-profit')}
        <ReportExportMenu onExcel={() => void exportExcel()} label="Excel بالتفاصيل" />
      </div>
    ),
    [activeFilterCount, exportExcel, tools.depsKey],
  );

  const paged = usePagination(tools.rows, DEFAULT_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr="أرباح المبيعات"
        descriptionAr="كل طلب بسعره الذي بيع به وتكلفته لحظة الطلب. التكلفة من سعر الشراء في بطاقة المنتج (يحسبه المخزون عند تفعيل احتساب التكلفة، وإلا يُدخل يدويًا)."
        iconName="TrendingUp"
      />

      {!canRead ? (
        <p className="rounded-xl border px-4 py-6 text-center text-sm text-muted-foreground">
          لا تملك صلاحية عرض تقارير المتجر.
        </p>
      ) : (
        <DirectoryPagedViews
          items={paged.slice}
          loading={query.isLoading}
          serverPagination={{
            page: paged.page,
            pageSize: paged.pageSize,
            total: paged.total,
            totalPages: Math.max(1, Math.ceil(paged.total / paged.pageSize)),
            setPage: paged.setPage,
            setPageSize: paged.setPageSize,
          }}
        >
          {(rowsPage) => (
            <DataTable
              variant="directory"
              columns={tools.columns}
              data={rowsPage}
              keyExtractor={(r) => r.key}
              mobileCard={(r) => (
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.label}</p>
                      {r.detail ? <p className="truncate text-xs text-muted-foreground">{r.detail}</p> : null}
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{formatMoney(r.revenue, currency)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>الكمية {formatAmount(r.units)}</span>
                    {r.costedRevenue > 0 ? (
                      <>
                        <span>
                          التكلفة <span className="text-foreground">{formatAmount(r.cost)}</span>
                        </span>
                        <span>
                          الربح <Profit value={r.profit} />
                        </span>
                        <span>الهامش {marginText(r.margin)}</span>
                      </>
                    ) : (
                      <span>بلا تكلفة</span>
                    )}
                  </div>
                </div>
              )}
              emptyText={query.isError ? 'تعذر تحميل التقرير.' : 'لا مبيعات ضمن الفلاتر الحالية.'}
            />
          )}
        </DirectoryPagedViews>
      )}
    </div>
  );
}
