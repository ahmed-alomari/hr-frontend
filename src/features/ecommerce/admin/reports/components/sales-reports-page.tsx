'use client';

import { companyCurrencyCode } from '@/features/auth/lib/company-currency';
import * as React from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Ban,
  Download,
  MessageSquare,
  Package,
  RefreshCw,
  ShoppingBag,
  Star,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCan } from '@/features/auth/hooks/use-can';
import { ApiError } from '@/features/hr/lib/api/client';
import { ecommerceAdminRoutes } from '@/features/ecommerce/admin/constants/routes';
import {
  useCatalogByBrand,
  useCatalogByCategory,
  useFulfillmentByShipStatus,
  useGeoByDistrict,
  useOperationsSummary,
  useOrdersBySource,
  usePaymentsByAccount,
  useReportsDashboard,
} from '@/features/ecommerce/admin/reports/hooks/use-store-reports';
import {
  useSalesByCity,
  useSalesByPartner,
  useSalesByPayment,
  useSalesByProduct,
  useSalesByStatus,
  useSalesLines,
  useSalesSummary,
  useSalesTimeseries,
} from '@/features/ecommerce/admin/reports/hooks/use-sales-reports';
import type {
  SalesReportFilters,
  SalesReportGranularity,
  StoreOrderSource,
  StorePaymentMethod,
  StorePaymentStatus,
} from '@/features/ecommerce/admin/reports/lib/api/sales-reports-api';
import { SALES_REPORTS_READ } from '@/features/ecommerce/admin/reports/permissions';
import {
  ORDER_STATUS_LABELS_AR,
  PAYMENT_METHOD_LABELS_AR,
  PAYMENT_STATUS_LABELS_AR,
} from '@/features/ecommerce/domain/constants/order-status';
import type { OrderStatus } from '@/features/ecommerce/domain/types/order';
import { formatPrice } from '@/features/ecommerce/shared/utils/format-price';
import { fromDecimalString } from '@/features/ecommerce/storefront/lib/api/store-http';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { cn, formatDateTime } from '@/shared/utils';

const CHART_COLORS = ['#0f766e', '#0369a1', '#b45309', '#be123c', '#7c3aed', '#15803d', '#475569'];

type ReportTab =
  | 'overview'
  | 'sales'
  | 'products'
  | 'customers'
  | 'geo'
  | 'payment'
  | 'fulfillment'
  | 'engagement'
  | 'lines';

const REPORT_PAGE_COPY: Record<ReportTab, { titleAr: string; descriptionAr: string }> = {
  overview: {
    titleAr: 'لوحة التحكم',
    descriptionAr: 'ملخص أداء المتجر: الإيراد، الطلبات، والتنبيهات.',
  },
  sales: {
    titleAr: 'المبيعات',
    descriptionAr: 'الإيراد، عدد الطلبات، والاتجاه خلال الفترة.',
  },
  products: {
    titleAr: 'المنتجات',
    descriptionAr: 'أكثر المنتجات والتصنيفات والعلامات مبيعاً.',
  },
  customers: {
    titleAr: 'العملاء',
    descriptionAr: 'العملاء الأعلى إنفاقاً في الفترة.',
  },
  geo: {
    titleAr: 'الجغرافيا',
    descriptionAr: 'المبيعات حسب المدينة والحي.',
  },
  payment: {
    titleAr: 'الدفع',
    descriptionAr: 'طرق الدفع وحسابات التحصيل.',
  },
  fulfillment: {
    titleAr: 'التنفيذ',
    descriptionAr: 'الطلبات بانتظار الشحن أو الدفع.',
  },
  engagement: {
    titleAr: 'التفاعل',
    descriptionAr: 'الرسائل، المفضلة، والتقييمات.',
  },
  lines: {
    titleAr: 'تفصيلي',
    descriptionAr: 'بنود الطلبات سطراً بسطر.',
  },
};

function formatChangePercent(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function startOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function money(amount: string | number | null | undefined, currency = companyCurrencyCode()): string {
  return formatPrice({ amount: fromDecimalString(amount), currency: currency || companyCurrencyCode() });
}

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map((cell) => escape(cell)).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return null;
}

export function StoreReportsPage({ section = 'overview' }: { section?: ReportTab }) {
  const tab = section;
  const can = useCan();
  const canRead = can(SALES_REPORTS_READ);
  const companyId = getStorefrontCompanyId();

  const [from, setFrom] = React.useState(startOfMonthIso);
  const [to, setTo] = React.useState(todayIso);
  const [status, setStatus] = React.useState<OrderStatus | 'all'>('all');
  const [paymentStatus, setPaymentStatus] = React.useState<StorePaymentStatus | 'all'>('all');
  const [paymentMethod, setPaymentMethod] = React.useState<StorePaymentMethod | 'all'>('all');
  const [source, setSource] = React.useState<StoreOrderSource | 'all'>('all');
  const [hasPartner, setHasPartner] = React.useState<'all' | 'yes' | 'no'>('all');
  const [city, setCity] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [granularity, setGranularity] = React.useState<SalesReportGranularity>('day');
  const [linesPage, setLinesPage] = React.useState(1);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filters = React.useMemo<SalesReportFilters>(
    () => ({
      companyId,
      from: from || undefined,
      to: to || undefined,
      status,
      paymentStatus,
      paymentMethod,
      source,
      hasPartner: hasPartner === 'all' ? undefined : hasPartner === 'yes',
      city: city.trim() || undefined,
      search: search || undefined,
    }),
    [companyId, from, to, status, paymentStatus, paymentMethod, source, hasPartner, city, search],
  );

  React.useEffect(() => {
    setLinesPage(1);
  }, [from, to, status, paymentStatus, paymentMethod, source, hasPartner, city, search]);

  // Always attempt load when company is set — backend enforces `sta.reports.read`.
  const dashboard = useReportsDashboard(
    filters,
    granularity,
    Boolean(companyId) && (tab === 'overview' || tab === 'fulfillment'),
  );
  const summary = useSalesSummary(filters, Boolean(companyId) && (tab === 'sales' || tab === 'overview'));
  const timeseries = useSalesTimeseries(filters, granularity, Boolean(companyId) && tab === 'sales');
  const byProduct = useSalesByProduct(filters, 15, Boolean(companyId) && (tab === 'sales' || tab === 'products'));
  const byCity = useSalesByCity(filters, 15, Boolean(companyId) && (tab === 'sales' || tab === 'geo'));
  const byPartner = useSalesByPartner(filters, 15, Boolean(companyId) && (tab === 'sales' || tab === 'customers'));
  const byStatus = useSalesByStatus(
    filters,
    Boolean(companyId) && (tab === 'sales' || tab === 'overview' || tab === 'fulfillment'),
  );
  const byPayment = useSalesByPayment(filters, Boolean(companyId) && (tab === 'sales' || tab === 'payment'));
  const byDistrict = useGeoByDistrict(filters, 15, Boolean(companyId) && tab === 'geo');
  const byAccount = usePaymentsByAccount(filters, 15, Boolean(companyId) && tab === 'payment');
  const byCategory = useCatalogByCategory(filters, 15, Boolean(companyId) && tab === 'products');
  const byBrand = useCatalogByBrand(filters, 15, Boolean(companyId) && tab === 'products');
  const byShipStatus = useFulfillmentByShipStatus(filters, Boolean(companyId) && tab === 'fulfillment');
  const bySource = useOrdersBySource(filters, Boolean(companyId) && tab === 'sales');
  const operations = useOperationsSummary(companyId, from, to, Boolean(companyId) && tab === 'engagement');
  const lines = useSalesLines(filters, linesPage, 50, Boolean(companyId) && tab === 'lines');

  const currency = summary.data?.currencyCode || companyCurrencyCode();

  const salesChartPoints = React.useMemo(
    () =>
      (timeseries.data?.points ?? []).map((point) => ({
        key: point.periodKey,
        orders: point.ordersCount,
        revenue: fromDecimalString(point.revenueTotal),
        units: point.unitsSold,
      })),
    [timeseries.data?.points],
  );

  const overviewChart = React.useMemo(
    () =>
      (dashboard.data?.timeseries.points ?? timeseries.data?.points ?? []).map((point) => ({
        key: point.periodKey,
        orders: point.ordersCount,
        revenue: fromDecimalString(point.revenueTotal),
        units: point.unitsSold,
      })),
    [dashboard.data?.timeseries.points, timeseries.data?.points],
  );

  const statusChart = React.useMemo(() => {
    const rows = dashboard.data?.byStatus ?? byStatus.data ?? [];
    return rows.map((row) => ({
      name: ORDER_STATUS_LABELS_AR[row.status] ?? row.status,
      value: row.ordersCount,
      revenue: fromDecimalString(row.revenueTotal),
    }));
  }, [dashboard.data?.byStatus, byStatus.data]);

  function exportLines() {
    const items = lines.data?.items ?? [];
    downloadCsv('sales-lines.csv', [
      [
        'orderNumber',
        'orderCreatedAt',
        'status',
        'paymentStatus',
        'paymentMethod',
        'customer',
        'city',
        'product',
        'quantity',
        'unitPrice',
        'lineTotal',
      ],
      ...items.map((row) => [
        row.orderNumber,
        row.orderCreatedAt,
        row.status,
        row.paymentStatus,
        row.paymentMethod,
        row.customerNameAr,
        row.shipCity,
        row.productName,
        String(row.quantity),
        row.unitPriceAmount,
        row.lineTotalAmount,
      ]),
    ]);
  }

  const activeError =
    summary.error ??
    (tab === 'overview'
      ? dashboard.error ?? byStatus.error
      : null) ??
    (tab === 'sales'
      ? timeseries.error ?? byProduct.error ?? byCity.error ?? byPartner.error ?? byStatus.error ?? bySource.error
      : null) ??
    (tab === 'products' ? byProduct.error ?? byCategory.error ?? byBrand.error : null) ??
    (tab === 'customers' ? byPartner.error : null) ??
    (tab === 'geo' ? byCity.error ?? byDistrict.error : null) ??
    (tab === 'payment' ? byPayment.error ?? byAccount.error : null) ??
    (tab === 'fulfillment' ? byShipStatus.error ?? byStatus.error : null) ??
    (tab === 'engagement' ? operations.error : null) ??
    (tab === 'lines' ? lines.error : null);
  const anyError = Boolean(activeError);
  const apiMsg = errorMessage(activeError);

  function refreshAll() {
    void dashboard.refetch();
    void summary.refetch();
    void timeseries.refetch();
    void byProduct.refetch();
    void byCity.refetch();
    void byPartner.refetch();
    void byStatus.refetch();
    void byPayment.refetch();
    void byDistrict.refetch();
    void byAccount.refetch();
    void byCategory.refetch();
    void byBrand.refetch();
    void byShipStatus.refetch();
    void bySource.refetch();
    void operations.refetch();
    void lines.refetch();
  }

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton />
      </div>
    ),
    [],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showStatusSection={false}
        showEmployeePicker={false}
        showDateSection
        optionalDateRange
        periodValue={{ from, to }}
        onPeriodChange={({ from: nextFrom, to: nextTo }) => {
          setFrom(nextFrom);
          setTo(nextTo);
        }}
        leadingFilters={
          <EntityFilterSearchField
            value={searchInput}
            onChange={setSearchInput}
            placeholder="رقم طلب / اسم / هاتف"
          />
        }
        inlineSelects={[
          {
            id: 'status',
            value: status,
            onChange: (v) => setStatus(v as OrderStatus | 'all'),
            placeholder: 'حالة الطلب',
            options: [
              { value: 'all', label: 'كل الحالات' },
              ...Object.entries(ORDER_STATUS_LABELS_AR).map(([value, label]) => ({ value, label })),
            ],
          },
          {
            id: 'paymentStatus',
            value: paymentStatus,
            onChange: (v) => setPaymentStatus(v as StorePaymentStatus | 'all'),
            placeholder: 'حالة الدفع',
            options: [
              { value: 'all', label: 'كل حالات الدفع' },
              ...Object.entries(PAYMENT_STATUS_LABELS_AR).map(([value, label]) => ({ value, label })),
            ],
          },
          {
            id: 'paymentMethod',
            value: paymentMethod,
            onChange: (v) => setPaymentMethod(v as StorePaymentMethod | 'all'),
            placeholder: 'طريقة الدفع',
            options: [
              { value: 'all', label: 'كل طرق الدفع' },
              ...Object.entries(PAYMENT_METHOD_LABELS_AR).map(([value, label]) => ({ value, label })),
            ],
          },
          {
            id: 'source',
            value: source,
            onChange: (v) => setSource(v as StoreOrderSource | 'all'),
            placeholder: 'المصدر',
            options: [
              { value: 'all', label: 'كل المصادر' },
              { value: 'storefront', label: 'المتجر' },
              { value: 'seed', label: 'Seed' },
            ],
          },
          {
            id: 'hasPartner',
            value: hasPartner,
            onChange: (v) => setHasPartner(v as 'all' | 'yes' | 'no'),
            placeholder: 'العميل',
            options: [
              { value: 'all', label: 'الكل' },
              { value: 'yes', label: 'مسجّل' },
              { value: 'no', label: 'ضيف' },
            ],
          },
        ]}
        beforeEmployeePicker={
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="المدينة"
            className="h-8 w-32 text-xs"
          />
        }
        trailingActions={
          <Button type="button" size="sm" variant="outline" onClick={refreshAll}>
            <RefreshCw className="me-1.5 h-3.5 w-3.5" />
            تحديث
          </Button>
        }
      />
    ),
    [
      from,
      to,
      status,
      paymentStatus,
      paymentMethod,
      source,
      hasPartner,
      city,
      searchInput,
    ],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <SetPageTitle
        titleAr={REPORT_PAGE_COPY[tab].titleAr}
        descriptionAr={REPORT_PAGE_COPY[tab].descriptionAr}
        iconName="BarChart3"
      />

      {!companyId ? (
        <p className="text-sm text-muted-foreground">اختر شركة لعرض التقارير.</p>
      ) : (
        <>
          {!canRead ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
              قد تحتاج صلاحية <span dir="ltr">{SALES_REPORTS_READ}</span> — بعد سحب الـ Backend شغّل{' '}
              <span dir="ltr">npm run system:init</span> ثم أعد تسجيل الدخول.
            </div>
          ) : null}

          {anyError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              تعذر تحميل بعض بيانات التقرير
              {apiMsg ? <> — {apiMsg}</> : null}. تحقق من الصلاحية{' '}
              <span dir="ltr">{SALES_REPORTS_READ}</span> وأن الـ Backend محدّث.
            </div>
          ) : null}

          {tab === 'overview' ? (
            <div className="space-y-5">
              <OverviewTab
                dashboard={dashboard}
                summary={summary}
                statusChart={statusChart}
                overviewChart={overviewChart}
                granularity={granularity}
                onGranularityChange={setGranularity}
                currency={currency}
              />
            </div>
          ) : null}

          {tab === 'sales' ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <KpiCard
                  label="الإيراد (مبيعات مؤكدة)"
                  value={money(summary.data?.revenueTotal, currency)}
                  hint={`${summary.data?.revenueOrdersCount ?? 0} طلب مدفوع أو محصّل`}
                  icon={TrendingUp}
                  loading={summary.isLoading}
                />
                <KpiCard
                  label="الطلبات"
                  value={String(summary.data?.ordersCount ?? 0)}
                  hint={`${summary.data?.partnerOrdersCount ?? 0} مسجّل · ${summary.data?.guestOrdersCount ?? 0} ضيف`}
                  icon={ShoppingBag}
                  loading={summary.isLoading}
                />
                <KpiCard
                  label="متوسط الطلب"
                  value={money(summary.data?.averageOrderValue, currency)}
                  hint="AOV"
                  icon={Wallet}
                  loading={summary.isLoading}
                />
                <KpiCard
                  label="قيمة كل الطلبات"
                  value={money(summary.data?.bookedTotal, currency)}
                  hint={`${summary.data?.bookedOrdersCount ?? 0} طلب · لم يُحصّل بعد ${money(
                    Math.max(
                      0,
                      Number(summary.data?.bookedTotal ?? 0) - Number(summary.data?.revenueTotal ?? 0),
                    ),
                    currency,
                  )}`}
                  icon={Wallet}
                  loading={summary.isLoading}
                />
                <KpiCard
                  label="وحدات مباعة"
                  value={String(summary.data?.unitsSold ?? 0)}
                  hint={`تسليم ${summary.data?.deliveredOrdersCount ?? 0}`}
                  icon={Package}
                  loading={summary.isLoading}
                />
                <KpiCard
                  label="ملغى"
                  value={String(summary.data?.cancelledOrdersCount ?? 0)}
                  hint={`مسترد ${summary.data?.refundedOrdersCount ?? 0}`}
                  icon={Ban}
                  loading={summary.isLoading}
                  tone="warn"
                />
              </div>

              <section className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">الاتجاه الزمني</h2>
                    <p className="text-xs text-muted-foreground">إيراد وعدد الطلبات</p>
                  </div>
                  <Select
                    value={granularity}
                    onValueChange={(v) => setGranularity(v as SalesReportGranularity)}
                  >
                    <SelectTrigger className="h-9 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">يومي</SelectItem>
                      <SelectItem value="week">أسبوعي</SelectItem>
                      <SelectItem value="month">شهري</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {timeseries.isLoading ? (
                  <div className="h-72 animate-pulse rounded-xl bg-muted/40" />
                ) : salesChartPoints.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <div className="h-72 w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={salesChartPoints} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="right" dataKey="orders" name="طلبات" fill="#94a3b8" radius={4} />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="revenue"
                          name="إيراد"
                          stroke="#0f766e"
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              <div className="grid gap-4 xl:grid-cols-2">
                <SimpleTable
                  title="أفضل المنتجات"
                  loading={byProduct.isLoading}
                  empty="لا مبيعات منتجات في الفترة."
                  headers={['المنتج', 'طلبات', 'وحدات', 'إيراد البنود']}
                  rows={(byProduct.data ?? []).map((row) => [
                    row.productName,
                    String(row.ordersCount),
                    String(row.unitsSold),
                    money(row.lineRevenueTotal, currency),
                  ])}
                />
                <SimpleTable
                  title="المدن"
                  loading={byCity.isLoading}
                  empty="لا بيانات مدن في الفترة."
                  headers={['المدينة', 'طلبات', 'وحدات', 'إيراد']}
                  rows={(byCity.data ?? []).map((row) => [
                    row.cityName || '—',
                    String(row.ordersCount),
                    String(row.unitsSold),
                    money(row.revenueTotal, currency),
                  ])}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <SimpleTable
                  title="أفضل العملاء"
                  loading={byPartner.isLoading}
                  empty="لا بيانات عملاء في الفترة."
                  headers={['العميل', 'طلبات', 'وحدات', 'إيراد']}
                  rows={(byPartner.data ?? []).map((row) => [
                    row.label || (row.partnerId ? 'شريك' : 'ضيوف مجمّعون'),
                    String(row.ordersCount),
                    String(row.unitsSold),
                    money(row.revenueTotal, currency),
                  ])}
                />
                <section className="rounded-2xl border border-border bg-card p-4">
                  <h2 className="mb-1 text-sm font-semibold">توزيع الحالات</h2>
                  <p className="mb-4 text-xs text-muted-foreground">أين تتوقف الطلبات في المسار</p>
                  {byStatus.isLoading ? (
                    <div className="h-56 animate-pulse rounded-xl bg-muted/40" />
                  ) : statusChart.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <div className="h-56 w-full" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusChart} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={48} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="value" name="طلبات" radius={4}>
                            {statusChart.map((_, index) => (
                              <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </section>
              </div>
            </div>
          ) : null}

          {tab === 'products' ? (
            <div className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <SimpleTable
                  title="أفضل المنتجات"
                  loading={byProduct.isLoading}
                  empty="لا مبيعات منتجات في الفترة."
                  headers={['المنتج', 'طلبات', 'وحدات', 'إيراد البنود']}
                  rows={(byProduct.data ?? []).map((row) => [
                    row.productName,
                    String(row.ordersCount),
                    String(row.unitsSold),
                    money(row.lineRevenueTotal, currency),
                  ])}
                />
                <SimpleTable
                  title="حسب التصنيف"
                  loading={byCategory.isLoading}
                  empty="لا بيانات تصنيفات."
                  headers={['التصنيف', 'طلبات', 'وحدات', 'إيراد']}
                  rows={(byCategory.data ?? []).map((row) => [
                    row.categoryName || '—',
                    String(row.ordersCount),
                    String(row.unitsSold),
                    money(row.revenueTotal, currency),
                  ])}
                />
              </div>
              <SimpleTable
                title="حسب العلامة التجارية"
                loading={byBrand.isLoading}
                empty="لا بيانات علامات."
                headers={['العلامة', 'طلبات', 'وحدات', 'إيراد']}
                rows={(byBrand.data ?? []).map((row) => [
                  row.brandName || '—',
                  String(row.ordersCount),
                  String(row.unitsSold),
                  money(row.revenueTotal, currency),
                ])}
              />
            </div>
          ) : null}

          {tab === 'customers' ? (
            <div className="space-y-5">
              <SimpleTable
                title="أفضل العملاء"
                loading={byPartner.isLoading}
                empty="لا بيانات عملاء في الفترة."
                headers={['العميل', 'طلبات', 'وحدات', 'إيراد']}
                rows={(byPartner.data ?? []).map((row) => [
                  row.label || (row.partnerId ? 'شريك' : 'ضيوف مجمّعون'),
                  String(row.ordersCount),
                  String(row.unitsSold),
                  money(row.revenueTotal, currency),
                ])}
              />
            </div>
          ) : null}

          {tab === 'geo' ? (
            <div className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <SimpleTable
                  title="المدن"
                  loading={byCity.isLoading}
                  empty="لا بيانات مدن."
                  headers={['المدينة', 'طلبات', 'وحدات', 'التوصيل', 'إيراد']}
                  rows={(byCity.data ?? []).map((row) => [
                    row.cityName || '—',
                    String(row.ordersCount),
                    String(row.unitsSold),
                    money(row.deliveryTotal ?? '0', currency),
                    money(row.revenueTotal, currency),
                  ])}
                />
                <SimpleTable
                  title="الأحياء / المناطق"
                  loading={byDistrict.isLoading}
                  empty="لا بيانات أحياء."
                  headers={['الحي', 'المدينة', 'طلبات', 'التوصيل', 'إيراد']}
                  rows={(byDistrict.data ?? []).map((row) => [
                    row.districtName || '—',
                    row.cityName || '—',
                    String(row.ordersCount),
                    money(row.deliveryTotal ?? '0', currency),
                    money(row.revenueTotal, currency),
                  ])}
                />
              </div>
            </div>
          ) : null}

          {tab === 'payment' ? (
            <div className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <section className="rounded-2xl border border-border bg-card p-4">
                  <h2 className="mb-1 text-sm font-semibold">طرق الدفع</h2>
                  <p className="mb-4 text-xs text-muted-foreground">طريقة × حالة الدفع</p>
                  {byPayment.isLoading ? (
                    <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
                  ) : (byPayment.data ?? []).length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ul className="space-y-2">
                      {(byPayment.data ?? []).map((row) => (
                        <li
                          key={`${row.paymentMethod}-${row.paymentStatus}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                        >
                          <span>
                            {PAYMENT_METHOD_LABELS_AR[row.paymentMethod]} ·{' '}
                            {PAYMENT_STATUS_LABELS_AR[row.paymentStatus]}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {row.ordersCount} · {money(row.revenueTotal, currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <SimpleTable
                  title="حسب حساب الدفع"
                  loading={byAccount.isLoading}
                  empty="لا بيانات حسابات."
                  headers={['الحساب', 'طلبات', 'مدفوع', 'غير مدفوع', 'إيراد']}
                  rows={(byAccount.data ?? []).map((row) => [
                    row.accountLabel || '—',
                    String(row.ordersCount),
                    String(row.paidOrdersCount),
                    String(row.unpaidOrdersCount),
                    money(row.revenueTotal, currency),
                  ])}
                />
              </div>
            </div>
          ) : null}

          {tab === 'fulfillment' ? (
            <div className="space-y-5">
              {dashboard.data?.alerts ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <AlertCard
                    label="بانتظار التنفيذ"
                    value={dashboard.data.alerts.pendingFulfillmentOrdersCount}
                    href={ecommerceAdminRoutes.orders}
                    icon={Truck}
                  />
                  <AlertCard
                    label="بانتظار الدفع"
                    value={dashboard.data.alerts.pendingPaymentOrdersCount}
                    href={ecommerceAdminRoutes.orders}
                    icon={Wallet}
                  />
                  <AlertCard
                    label="بنود غير مُسندة"
                    value={dashboard.data.alerts.unassignedLineUnitsCount}
                    href={ecommerceAdminRoutes.orders}
                    icon={Package}
                  />
                  <AlertCard
                    label="تسليم متأخر"
                    value={dashboard.data.alerts.overdueDeliveryOrdersCount}
                    href={ecommerceAdminRoutes.orders}
                    icon={Truck}
                  />
                </div>
              ) : null}
              <SimpleTable
                title="حالة شحن البنود"
                loading={byShipStatus.isLoading}
                empty="لا بيانات تنفيذ."
                headers={['الحالة', 'بنود', 'وحدات', 'طلبات']}
                rows={(byShipStatus.data ?? []).map((row) => [
                  row.lineShipStatus,
                  String(row.lineCount),
                  String(row.unitsCount),
                  String(row.ordersCount),
                ])}
              />
            </div>
          ) : null}

          {tab === 'engagement' ? (
            <div className="space-y-5">
              {operations.isLoading ? (
                <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
              ) : operations.data ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    label="رسائل اتصل بنا"
                    value={String(operations.data.contactMessagesTotal)}
                    icon={MessageSquare}
                  />
                  <KpiCard
                    label="إضافات المفضلة"
                    value={String(operations.data.wishlistAddsInPeriodCount)}
                    hint={`${operations.data.wishlistTotalActiveCount} نشطة`}
                    icon={Star}
                  />
                  <KpiCard
                    label="تقييمات جديدة"
                    value={String(operations.data.reviewsSubmittedInPeriodCount)}
                    hint={`${operations.data.pendingReviewsCount} بانتظار المراجعة`}
                    icon={Star}
                  />
                  <KpiCard
                    label="متوسط التقييم"
                    value={
                      operations.data.averageApprovedRating != null
                        ? operations.data.averageApprovedRating.toFixed(2)
                        : '—'
                    }
                    hint={`${operations.data.approvedReviewsCount} معتمد`}
                    icon={Star}
                  />
                </div>
              ) : (
                <EmptyChart />
              )}
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={ecommerceAdminRoutes.contactMessages}>الشكاوى والمقترحات</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={ecommerceAdminRoutes.reviews}>مراجعة التقييمات</Link>
                </Button>
              </div>
            </div>
          ) : null}

          {tab === 'lines' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="tabular-nums">
                  {lines.data?.pagination.total ?? 0} بند
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ms-auto"
                  disabled={(lines.data?.items.length ?? 0) === 0}
                  onClick={exportLines}
                >
                  <Download className="me-1.5 h-3.5 w-3.5" />
                  تصدير CSV
                </Button>
              </div>

              {lines.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/40" />
                  ))}
                </div>
              ) : (lines.data?.items.length ?? 0) === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                  لا توجد بنود ضمن الفلاتر.
                </div>
              ) : (
                <>
                {/* Phones: one card per line — product, order, customer, total. */}
                <div className="space-y-2 md:hidden">
                  {(lines.data?.items ?? []).map((row) => (
                    <article key={row.lineId} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-medium">{row.productName}</p>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                          {money(row.lineTotalAmount, row.currencyCode || currency)}
                        </p>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <Link
                          href={`${ecommerceAdminRoutes.orders}?order=${row.orderId}`}
                          className="font-medium text-primary hover:underline"
                          dir="ltr"
                        >
                          {row.orderNumber}
                        </Link>
                        <span dir="ltr">{formatDateTime(row.orderCreatedAt)}</span>
                        <span className="tabular-nums">× {row.quantity}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <Badge variant="subtle">{ORDER_STATUS_LABELS_AR[row.status] ?? row.status}</Badge>
                        <span className="text-muted-foreground">
                          {PAYMENT_METHOD_LABELS_AR[row.paymentMethod]} · {PAYMENT_STATUS_LABELS_AR[row.paymentStatus]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.customerNameAr || '—'}
                        {row.shipCity ? ` — ${row.shipCity}` : ''}
                      </p>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/40 text-start text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">الطلب</th>
                        <th className="px-3 py-2.5 font-medium">التاريخ</th>
                        <th className="px-3 py-2.5 font-medium">الحالة</th>
                        <th className="px-3 py-2.5 font-medium">الدفع</th>
                        <th className="px-3 py-2.5 font-medium">العميل</th>
                        <th className="px-3 py-2.5 font-medium">المدينة</th>
                        <th className="px-3 py-2.5 font-medium">المنتج</th>
                        <th className="px-3 py-2.5 font-medium">الكمية</th>
                        <th className="px-3 py-2.5 font-medium">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(lines.data?.items ?? []).map((row) => (
                        <tr key={row.lineId} className="border-t border-border/70">
                          <td className="px-3 py-2.5">
                            <Link
                              href={`${ecommerceAdminRoutes.orders}?order=${row.orderId}`}
                              className="font-medium text-primary hover:underline"
                              dir="ltr"
                            >
                              {row.orderNumber}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground" dir="ltr">
                            {formatDateTime(row.orderCreatedAt)}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="subtle">
                              {ORDER_STATUS_LABELS_AR[row.status] ?? row.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {PAYMENT_METHOD_LABELS_AR[row.paymentMethod]} ·{' '}
                            {PAYMENT_STATUS_LABELS_AR[row.paymentStatus]}
                          </td>
                          <td className="px-3 py-2.5">{row.customerNameAr || '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{row.shipCity || '—'}</td>
                          <td className="px-3 py-2.5">{row.productName}</td>
                          <td className="px-3 py-2.5 tabular-nums">{row.quantity}</td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {money(row.lineTotalAmount, row.currencyCode || currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}

              {(lines.data?.pagination.totalPages ?? 1) > 1 ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    صفحة {linesPage} من {lines.data?.pagination.totalPages ?? 1}
                  </p>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={linesPage <= 1 || lines.isFetching}
                      onClick={() => setLinesPage((p) => Math.max(1, p - 1))}
                    >
                      السابق
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        linesPage >= (lines.data?.pagination.totalPages ?? 1) || lines.isFetching
                      }
                      onClick={() => setLinesPage((p) => p + 1)}
                    >
                      التالي
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}


/** @deprecated use StoreReportsPage */
export const SalesReportsPage = StoreReportsPage;

function OverviewTab({
  dashboard,
  summary,
  statusChart,
  overviewChart,
  granularity,
  onGranularityChange,
  currency,
}: {
  dashboard: ReturnType<typeof useReportsDashboard>;
  summary: ReturnType<typeof useSalesSummary>;
  statusChart: { name: string; value: number; revenue: number }[];
  overviewChart: { key: string; orders: number; revenue: number; units: number }[];
  granularity: SalesReportGranularity;
  onGranularityChange: (value: SalesReportGranularity) => void;
  currency: string;
}) {
  const current = dashboard.data?.current;
  const change = dashboard.data?.changePercent;
  const alerts = dashboard.data?.alerts;
  const paymentRows = dashboard.data?.byPayment ?? [];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="الإيراد"
          value={money(current?.revenueTotal ?? summary.data?.revenueTotal, currency)}
          hint={formatChangePercent(change?.revenueTotal) ?? undefined}
          icon={TrendingUp}
          loading={dashboard.isLoading}
          delta={change?.revenueTotal}
        />
        <KpiCard
          label="الطلبات"
          value={String(current?.ordersCount ?? summary.data?.ordersCount ?? 0)}
          hint={formatChangePercent(change?.ordersCount) ?? undefined}
          icon={ShoppingBag}
          loading={dashboard.isLoading}
          delta={change?.ordersCount}
        />
        <KpiCard
          label="متوسط الطلب"
          value={money(current?.averageOrderValue ?? summary.data?.averageOrderValue, currency)}
          hint={formatChangePercent(change?.averageOrderValue) ?? undefined}
          icon={Wallet}
          loading={dashboard.isLoading}
          delta={change?.averageOrderValue}
        />
        <KpiCard
          label="وحدات مباعة"
          value={String(current?.unitsSold ?? summary.data?.unitsSold ?? 0)}
          hint={formatChangePercent(change?.unitsSold) ?? undefined}
          icon={Package}
          loading={dashboard.isLoading}
          delta={change?.unitsSold}
        />
      </div>

      {alerts ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AlertCard
            label="بانتظار التنفيذ"
            value={alerts.pendingFulfillmentOrdersCount}
            href={ecommerceAdminRoutes.orders}
            icon={Truck}
          />
          <AlertCard
            label="بانتظار الدفع"
            value={alerts.pendingPaymentOrdersCount}
            href={ecommerceAdminRoutes.orders}
            icon={Wallet}
          />
          <AlertCard
            label="بنود غير مُسندة"
            value={alerts.unassignedLineUnitsCount}
            href={ecommerceAdminRoutes.orders}
            icon={Package}
          />
          <AlertCard
            label="شكاوى ومقترحات الفترة"
            value={alerts.contactMessagesInPeriodCount}
            href={ecommerceAdminRoutes.contactMessages}
            icon={MessageSquare}
          />
          <AlertCard
            label="تقييمات معلّقة"
            value={alerts.pendingReviewsCount}
            href={ecommerceAdminRoutes.reviews}
            icon={Star}
          />
          <AlertCard
            label="تسليم متأخر"
            value={alerts.overdueDeliveryOrdersCount}
            href={ecommerceAdminRoutes.orders}
            icon={Truck}
          />
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">الاتجاه الزمني</h2>
            <p className="text-xs text-muted-foreground">مقارنة بالفترة السابقة</p>
          </div>
          <Select value={granularity} onValueChange={(v) => onGranularityChange(v as SalesReportGranularity)}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">يومي</SelectItem>
              <SelectItem value="week">أسبوعي</SelectItem>
              <SelectItem value="month">شهري</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {dashboard.isLoading ? (
          <div className="h-72 animate-pulse rounded-xl bg-muted/40" />
        ) : overviewChart.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={overviewChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="right" dataKey="orders" name="طلبات" fill="#94a3b8" radius={4} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  name="إيراد"
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">حالات الطلب</h2>
          {statusChart.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-56 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                    {statusChart.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">طرق الدفع</h2>
          {paymentRows.length === 0 ? (
            <EmptyChart />
          ) : (
            <ul className="space-y-2">
              {paymentRows.map((row) => (
                <li
                  key={`${row.paymentMethod}-${row.paymentStatus}`}
                  className="flex justify-between gap-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {PAYMENT_METHOD_LABELS_AR[row.paymentMethod]} ·{' '}
                    {PAYMENT_STATUS_LABELS_AR[row.paymentStatus]}
                  </span>
                  <span className="tabular-nums">{row.ordersCount}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function AlertCard({
  label,
  value,
  href,
  icon: Icon,
}: {
  label: string;
  value: number;
  href: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-4 transition hover:border-primary/30 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}

function KpiCard(props: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  loading?: boolean;
  tone?: 'default' | 'warn';
  delta?: number | null;
}) {
  const Icon = props.icon;
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-4',
        props.tone === 'warn' && 'border-amber-500/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{props.label}</p>
        <span className="rounded-lg bg-muted p-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      {props.loading ? (
        <div className="mt-3 h-7 w-24 animate-pulse rounded bg-muted/50" />
      ) : (
        <p className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-foreground">
          {props.value}
        </p>
      )}
      {props.hint ? <p className="mt-1 text-[11px] text-muted-foreground">{props.hint}</p> : null}
      {props.delta != null && !Number.isNaN(props.delta) ? (
        <p
          className={cn(
            'mt-1 flex items-center gap-1 text-[11px] font-medium',
            props.delta >= 0 ? 'text-emerald-600' : 'text-rose-600',
          )}
        >
          {props.delta >= 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {formatChangePercent(props.delta)}
        </p>
      ) : null}
    </div>
  );
}

function SimpleTable(props: {
  title: string;
  loading?: boolean;
  empty: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{props.title}</h2>
      {props.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : props.rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{props.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {props.headers.map((header) => (
                  <th key={header} className="px-2 py-2 text-start font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row, index) => (
                <tr key={index} className="border-t border-border/60">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        'px-2 py-2',
                        cellIndex === 0 ? 'font-medium text-foreground' : 'tabular-nums text-muted-foreground',
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      لا بيانات للرسم في هذه الفترة.
    </div>
  );
}
