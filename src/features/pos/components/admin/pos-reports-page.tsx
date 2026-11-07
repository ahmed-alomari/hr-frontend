'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { Badge } from '@/components/ui/badge';
import { DataTable, usePagination, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { ListFilterBar, type PeriodRange } from '@/components/ui/list-filter-bar';
import { downloadXlsxFromAoA, type XlsxCell } from '@/shared/export/download-xlsx';
import { cn } from '@/shared/utils';
import {
  ReportExportMenu,
  ShareBar,
} from '@/features/expenses/components/report-common';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PAYMENT_METHOD_LABELS, resolvePosInvoiceStyle, type PosPaymentMethod } from '@/features/pos/domain/types';
import { usePosContext } from '@/features/pos/hooks/use-pos-context';
import { formatAmount, formatDateTime, formatMoney } from '@/features/pos/lib/format';
import { sessionToPrintable } from '@/features/pos/lib/receipt';
import { summarizeSession } from '@/features/pos/lib/session-summary';
import {
  GROUPINGS,
  NO_FILTERS,
  dayOf,
  discountedLines,
  groupBy as groupFacts,
  lineFacts,
  closingTotals,
  closingsByCashier,
  closingsInPeriod,
  collectionsByMethod,
  collectionsInPeriod,
  creditInvoices,
  openReceivables,
  paymentRows,
  refundMethodLabel,
  returnsInPeriod,
  sortedForTime,
  totalsOf,
  type ClosingRow,
  type CollectionRow,
  type CreditInvoiceRow,
  type GroupRow,
  type Grouping,
  type LineFact,
  type ReportFilters,
} from '@/features/pos/lib/sales-report';
import { PosGate, PrintPreviewDialog } from '@/features/pos/components/shared/pos-shared';

const ALL = 'all';

/** What the table shows: a grouping of the sales, or one of the lists. */
type View = Grouping | 'payments' | 'credit' | 'receivables' | 'collections' | 'closings' | 'discounts' | 'returns';

const VIEWS: Array<{ id: View; label: string; column: string }> = [
  { id: 'product', label: 'حسب الصنف', column: 'الصنف' },
  { id: 'category', label: 'حسب الفئة', column: 'الفئة' },
  { id: 'day', label: 'حسب اليوم', column: 'اليوم' },
  { id: 'hour', label: 'حسب الساعة', column: 'الساعة' },
  { id: 'weekday', label: 'حسب يوم الأسبوع', column: 'يوم الأسبوع' },
  { id: 'cashier', label: 'حسب الكاشير', column: 'الكاشير' },
  { id: 'register', label: 'حسب نقطة البيع', column: 'نقطة البيع' },
  { id: 'session', label: 'حسب الوردية', column: 'الوردية' },
  { id: 'customer', label: 'حسب العميل', column: 'العميل' },
  { id: 'invoice', label: 'الفواتير', column: 'الفاتورة' },
  { id: 'payments', label: 'وسائل الدفع', column: 'الوسيلة' },
  { id: 'credit', label: 'المبيعات الآجلة', column: 'الفاتورة' },
  { id: 'receivables', label: 'المستحق على العملاء (اليوم)', column: 'الفاتورة' },
  { id: 'collections', label: 'تحصيلات الآجل', column: 'التحصيل' },
  { id: 'closings', label: 'إغلاق الورديات والفروقات', column: 'الوردية' },
  { id: 'discounts', label: 'الخصومات وتغيير الأسعار', column: 'الصنف' },
  { id: 'returns', label: 'المرتجعات', column: 'المرتجع' },
];

const today = () => dayOf(new Date().toISOString());

function Profit({ value, currency }: { value: number; currency?: string | null }) {
  return (
    <span className={cn('tabular-nums', value > 0 ? 'text-success' : value < 0 ? 'text-destructive' : '')}>
      {formatMoney(value, currency)}
    </span>
  );
}

const marginText = (m: number | null) => (m == null ? '—' : `${m}%`);

function Reports() {
  const { data, currency } = usePosContext();
  const defaultPeriod = React.useMemo<PeriodRange>(() => ({ from: today(), to: today() }), []);
  const [period, setPeriod] = React.useState<PeriodRange>(defaultPeriod);
  const [view, setView] = React.useState<View>('product');
  const [registerId, setRegisterId] = React.useState(ALL);
  const [cashierName, setCashierName] = React.useState(ALL);
  const [categoryId, setCategoryId] = React.useState(ALL);
  const [paymentMethod, setPaymentMethod] = React.useState(ALL);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters: ReportFilters = React.useMemo(
    () => ({
      from: period.from || null,
      to: period.to || null,
      currency,
      registerId: registerId === ALL ? null : registerId,
      cashierName: cashierName === ALL ? null : cashierName,
      categoryId: categoryId === ALL ? null : categoryId,
      paymentMethod: paymentMethod === ALL ? null : (paymentMethod as PosPaymentMethod),
      product: search,
    }),
    [period, registerId, cashierName, categoryId, paymentMethod, search, currency],
  );

  const facts = React.useMemo(() => lineFacts(data, filters), [data, filters]);
  const totals = React.useMemo(() => totalsOf(facts), [facts]);

  // Choices come from the period's sales, before the other filters.
  const periodFacts = React.useMemo(
    () => lineFacts(data, { ...NO_FILTERS, from: filters.from, to: filters.to }),
    [data, filters.from, filters.to],
  );
  const cashiers = React.useMemo(
    () => [...new Set(periodFacts.map((f) => f.cashierName))].sort((a, b) => a.localeCompare(b, 'ar')),
    [periodFacts],
  );
  const categories = React.useMemo(
    () => [...new Map(periodFacts.filter((f) => f.categoryId).map((f) => [f.categoryId!, f.categoryName])).entries()],
    [periodFacts],
  );

  const viewMeta = VIEWS.find((v) => v.id === view)!;
  const isGrouping = view in GROUPINGS;
  const groupRows = React.useMemo(
    () => (isGrouping ? sortedForTime(view as Grouping, groupFacts(facts, GROUPINGS[view as Grouping])) : []),
    [facts, view, isGrouping],
  );
  const payments = React.useMemo(() => paymentRows(data, filters), [data, filters]);
  const discounted = React.useMemo(() => discountedLines(facts), [facts]);
  const returns = React.useMemo(() => returnsInPeriod(data, filters), [data, filters]);
  const credit = React.useMemo(() => creditInvoices(data, filters), [data, filters]);
  const receivables = React.useMemo(() => openReceivables(data, filters), [data, filters]);
  const collections = React.useMemo(() => collectionsInPeriod(data, filters), [data, filters]);
  const collectionMethods = React.useMemo(() => collectionsByMethod(collections), [collections]);
  const closings = React.useMemo(() => closingsInPeriod(data, filters), [data, filters]);
  const closingCashiers = React.useMemo(() => closingsByCashier(closings), [closings]);
  const [zSessionId, setZSessionId] = React.useState<string | null>(null);
  const zSession = data.sessions.find((s) => s.id === zSessionId) ?? null;

  const isDefaultPeriod = period.from === defaultPeriod.from && period.to === defaultPeriod.to;
  const activeFilterCount =
    [registerId, cashierName, categoryId, paymentMethod].filter((v) => v !== ALL).length +
    (search ? 1 : 0) +
    (view !== 'product' ? 1 : 0) +
    (isDefaultPeriod ? 0 : 1);

  const stamp = `${filters.from ?? 'all'}-${filters.to ?? 'all'}`;

  const exportExcel = React.useCallback(async () => {
    let sheet: XlsxCell[][];
    if (isGrouping) {
      sheet = [
        [viewMeta.column, 'الفواتير', 'الكمية', 'صافي المبيعات', 'الخصم', 'المرتجع', 'الضريبة', 'التكلفة', 'الربح', 'الهامش %', 'بلا تكلفة'],
        ...groupRows.map((r) => [
          r.detail ? `${r.label} (${r.detail})` : r.label,
          r.invoices,
          r.units,
          r.revenue,
          r.discount,
          r.returned,
          r.tax,
          r.cost,
          r.profit,
          r.margin,
          r.uncostedRevenue,
        ]),
      ];
    } else if (view === 'payments') {
      sheet = [
        ['الوسيلة', 'العمليات', 'المحصّل', 'المردود', 'الصافي'],
        ...payments.map((p) => [p.label, p.count, p.collected, p.refunded, p.net]),
        ...collectionMethods
          .filter((c) => c.count > 0)
          .map((c) => [`تحصيل آجل · ${c.label}`, c.count, c.total, 0, c.total]),
      ];
    } else if (view === 'credit' || view === 'receivables') {
      sheet = [
        ['التاريخ', 'الفاتورة', 'العميل', 'نقطة البيع', 'الكاشير', 'الدفع', 'الإجمالي', 'آجل', 'المحصّل', 'المرتجع', 'المتبقي'],
        ...(view === 'credit' ? credit : receivables).map((r) => [
          formatDateTime(r.date),
          r.saleNumber,
          r.customer,
          r.registerName,
          r.cashierName,
          r.payment,
          r.total,
          r.credit,
          r.collected,
          r.returned,
          r.due,
        ]),
      ];
    } else if (view === 'collections') {
      sheet = [
        ['التاريخ', 'الفاتورة', 'العميل', 'الوسيلة', 'المرجع', 'المكان', 'بواسطة', 'المبلغ'],
        ...collections.map((c) => [
          formatDateTime(c.createdAt),
          c.saleNumber,
          c.partnerName,
          PAYMENT_METHOD_LABELS[c.method],
          c.reference,
          c.registerName,
          c.createdBy,
          c.amount,
        ]),
      ];
    } else if (view === 'closings') {
      sheet = [
        ['الإغلاق', 'الفتح', 'نقطة البيع', 'الكاشير', 'العهدة', 'المتوقع', 'المعدود', 'الفرق', 'النوع', 'سبب الفرق'],
        ...closings.map((c) => [
          formatDateTime(c.closedAt),
          formatDateTime(c.openedAt),
          c.registerName,
          c.cashierName,
          c.openingFloat,
          c.expectedCash,
          c.countedCash,
          c.difference,
          differenceKind(c.difference),
          c.reason ?? '',
        ]),
      ];
    } else if (view === 'discounts') {
      sheet = [
        ['التاريخ', 'الفاتورة', 'الصنف', 'الكاشير', 'السعر الأصلي', 'سعر البيع', 'الخصم', 'التكلفة'],
        ...discounted.map((f) => [formatDateTime(f.date), f.saleNumber, f.productName, f.cashierName, f.sourcePrice, f.unitPrice, f.discount, f.unitCost]),
      ];
    } else {
      sheet = [
        ['التاريخ', 'رقم المرتجع', 'على الفاتورة', 'السبب', 'الأصناف', 'الطريقة', 'المبلغ', 'حالة الرد'],
        ...returns.map((r) => [
          formatDateTime(r.createdAt),
          r.number,
          r.saleNumber,
          r.reason,
          r.lines.map((l) => `${l.name} × ${l.quantity}`).join('، '),
          refundMethodLabel(r.refund.method),
          r.refund.amount,
          r.refund.status === 'done' ? 'تم' : 'معلّق',
        ]),
      ];
    }
    if (sheet.length <= 1) {
      toast.error('لا توجد بيانات للتصدير ضمن الفلاتر الحالية.');
      return;
    }
    try {
      await downloadXlsxFromAoA(`pos-${view}-${stamp}.xlsx`, viewMeta.label, sheet);
      toast.success('تم تنزيل ملف Excel.');
    } catch {
      toast.error('تعذر تصدير التقرير.');
    }
  }, [isGrouping, view, viewMeta, groupRows, payments, collectionMethods, credit, receivables, collections, closings, discounted, returns, stamp]);

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <ReportExportMenu onExcel={() => void exportExcel()} />
      </div>
    ),
    [activeFilterCount, exportExcel],
  );

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
            onChange: (v) => setView(v === ALL ? 'product' : (v as View)),
            placeholder: 'حسب الصنف',
            options: [
              { value: ALL, label: 'حسب الصنف' },
              ...VIEWS.filter((v) => v.id !== 'product').map((v) => ({ value: v.id, label: v.label })),
            ],
          },
          {
            id: 'register',
            value: registerId,
            onChange: setRegisterId,
            placeholder: 'كل نقاط البيع',
            options: [{ value: ALL, label: 'كل نقاط البيع' }, ...data.registers.map((r) => ({ value: r.id, label: r.name }))],
          },
          {
            id: 'cashier',
            value: cashierName,
            onChange: setCashierName,
            placeholder: 'كل الكاشيرية',
            options: [{ value: ALL, label: 'كل الكاشيرية' }, ...cashiers.map((c) => ({ value: c, label: c }))],
          },
          ...(categories.length > 0
            ? [
                {
                  id: 'category',
                  value: categoryId,
                  onChange: setCategoryId,
                  placeholder: 'كل الفئات',
                  options: [{ value: ALL, label: 'كل الفئات' }, ...categories.map(([id, name]) => ({ value: id, label: name }))],
                },
              ]
            : []),
          {
            id: 'payment',
            value: paymentMethod,
            onChange: setPaymentMethod,
            placeholder: 'كل وسائل الدفع',
            options: [
              { value: ALL, label: 'كل وسائل الدفع' },
              ...(Object.keys(PAYMENT_METHOD_LABELS) as PosPaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] })),
            ],
          },
        ]}
      />
    ),
    [period, defaultPeriod, searchInput, view, registerId, cashierName, categoryId, paymentMethod, data.registers, cashiers, categories],
  );

  /* ── Grouped table ── */
  const maxRevenue = Math.max(0, ...groupRows.map((r) => r.revenue));
  const groupColumns: ColumnDef<GroupRow>[] = [
    {
      key: 'label',
      title: viewMeta.column,
      render: (r) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{r.label}</span>
          {r.detail ? <span className="text-xs text-muted-foreground" dir="auto">{r.detail}</span> : null}
        </div>
      ),
    },
    { key: 'units', title: 'الكمية', render: (r) => <span className="tabular-nums">{formatAmount(r.units)}</span> },
    { key: 'invoices', title: 'الفواتير', hideOnMobile: true, render: (r) => <span className="tabular-nums">{r.invoices}</span> },
    { key: 'revenue', title: 'صافي المبيعات', render: (r) => <span className="font-semibold tabular-nums">{formatMoney(r.revenue, currency)}</span> },
    {
      key: 'cost',
      title: 'التكلفة',
      render: (r) => (r.costedRevenue > 0 ? <span className="tabular-nums">{formatAmount(r.cost)}</span> : <span className="text-muted-foreground">—</span>),
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

  const grouped = usePagination(groupRows, DEFAULT_PAGE_SIZE);
  const discountsPage = usePagination(discounted, DEFAULT_PAGE_SIZE);
  const returnsPage = usePagination(returns, DEFAULT_PAGE_SIZE);
  const creditPage = usePagination(view === 'receivables' ? receivables : credit, DEFAULT_PAGE_SIZE);
  const collectionsPage = usePagination(collections, DEFAULT_PAGE_SIZE);
  const closingsPage = usePagination(closings, DEFAULT_PAGE_SIZE);
  const pagination = (p: { page: number; pageSize: number; total: number; setPage: (n: number) => void; setPageSize: (n: number) => void }) => ({
    page: p.page,
    pageSize: p.pageSize,
    total: p.total,
    totalPages: Math.max(1, Math.ceil(p.total / p.pageSize)),
    setPage: p.setPage,
    setPageSize: p.setPageSize,
  });

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr="تقارير المبيعات"
        descriptionAr="كل بيع بسعره الذي بيع به وتكلفته لحظة البيع."
        iconName="BarChart3"
      />

      {isGrouping ? (
        <DirectoryPagedViews items={grouped.slice} loading={false} serverPagination={pagination(grouped)}>
          {(rowsPage) => (
            <DataTable
              variant="directory"
              columns={groupColumns}
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
              emptyText="لا مبيعات ضمن الفلاتر الحالية."
            />
          )}
        </DirectoryPagedViews>
      ) : view === 'payments' ? (
        <DataTable
          variant="directory"
          columns={[
            { key: 'label', title: 'الوسيلة', render: (p) => <span className="font-medium">{p.label}</span> },
            { key: 'count', title: 'العمليات', render: (p) => <span className="tabular-nums">{p.count}</span> },
            { key: 'collected', title: 'المحصّل', render: (p) => <span className="tabular-nums">{formatAmount(p.collected)}</span> },
            { key: 'refunded', title: 'المردود', render: (p) => <span className="tabular-nums">{formatAmount(p.refunded)}</span> },
            { key: 'net', title: 'الصافي', render: (p) => <span className="font-semibold tabular-nums">{formatMoney(p.net, currency)}</span> },
          ]}
          data={payments}
          keyExtractor={(p) => p.method}
          emptyText="لا مدفوعات ضمن الفلاتر الحالية."
        />
      ) : view === 'credit' || view === 'receivables' ? (
        <div className="space-y-3">
          <CreditSummary rows={view === 'credit' ? credit : receivables} collections={collections} currency={currency} view={view} />
          <DirectoryPagedViews items={creditPage.slice} loading={false} serverPagination={pagination(creditPage)}>
            {(rowsPage) => (
              <DataTable
                variant="directory"
                columns={creditColumns(currency)}
                data={rowsPage}
                keyExtractor={(r) => r.saleId}
                emptyText={view === 'credit' ? 'لا مبيعات آجلة ضمن الفلاتر الحالية.' : 'لا مستحقات مفتوحة على العملاء.'}
              />
            )}
          </DirectoryPagedViews>
        </div>
      ) : view === 'collections' ? (
        <div className="space-y-3">
          <DataTable
            variant="directory"
            columns={[
              { key: 'label', title: 'الوسيلة', render: (c) => <span className="font-medium">{c.label}</span> },
              { key: 'count', title: 'العمليات', render: (c) => <span className="tabular-nums">{c.count}</span> },
              { key: 'inShift', title: 'في الوردية (الدرج)', render: (c) => <span className="tabular-nums">{formatAmount(c.inShift)}</span> },
              { key: 'outside', title: 'خارج الوردية', render: (c) => <span className="tabular-nums">{formatAmount(c.outside)}</span> },
              { key: 'total', title: 'الإجمالي', render: (c) => <span className="font-semibold tabular-nums">{formatMoney(c.total, currency)}</span> },
            ]}
            data={collectionMethods}
            keyExtractor={(c) => c.method}
            emptyText="لا تحصيلات."
          />
          <DirectoryPagedViews items={collectionsPage.slice} loading={false} serverPagination={pagination(collectionsPage)}>
            {(rowsPage) => (
              <DataTable
                variant="directory"
                columns={collectionColumns(currency)}
                data={rowsPage}
                keyExtractor={(c) => c.id}
                emptyText="لا تحصيلات آجل ضمن الفلاتر الحالية."
              />
            )}
          </DirectoryPagedViews>
        </div>
      ) : view === 'closings' ? (
        <div className="space-y-3">
          <ClosingSummary rows={closings} currency={currency} />
          {closingCashiers.length > 1 ? (
            <DataTable
              variant="directory"
              columns={[
                { key: 'cashier', title: 'الكاشير', render: (c) => <span className="font-medium">{c.cashierName}</span> },
                { key: 'shifts', title: 'الورديات', render: (c) => <span className="tabular-nums">{c.shifts}</span> },
                { key: 'with', title: 'بفرق', render: (c) => <span className="tabular-nums">{c.withDifference}</span> },
                { key: 'shortage', title: 'العجز', render: (c) => <DifferenceAmount value={c.shortage} /> },
                { key: 'overage', title: 'الزيادة', hideOnMobile: true, render: (c) => <DifferenceAmount value={c.overage} /> },
                { key: 'net', title: 'الصافي', hideOnMobile: true, render: (c) => <DifferenceAmount value={c.net} strong /> },
              ]}
              data={closingCashiers}
              keyExtractor={(c) => c.cashierName}
              emptyText="لا ورديات."
            />
          ) : null}
          <DirectoryPagedViews items={closingsPage.slice} loading={false} serverPagination={pagination(closingsPage)}>
            {(rowsPage) => (
              <DataTable
                variant="directory"
                columns={closingColumns(setZSessionId)}
                data={rowsPage}
                keyExtractor={(c) => c.sessionId}
                emptyText="لا ورديات أُغلقت ضمن الفلاتر الحالية."
              />
            )}
          </DirectoryPagedViews>
        </div>
      ) : view === 'discounts' ? (
        <DirectoryPagedViews items={discountsPage.slice} loading={false} serverPagination={pagination(discountsPage)}>
          {(rowsPage) => (
            <DataTable
              variant="directory"
              columns={discountColumns(currency)}
              data={rowsPage}
              keyExtractor={(f) => `${f.saleId}:${f.productKey}:${f.date}`}
              emptyText="لا خصومات ولا أسعار معدّلة ضمن الفلاتر الحالية."
            />
          )}
        </DirectoryPagedViews>
      ) : (
        <DirectoryPagedViews items={returnsPage.slice} loading={false} serverPagination={pagination(returnsPage)}>
          {(rowsPage) => (
            <DataTable
              variant="directory"
              columns={[
                {
                  key: 'number',
                  title: 'المرتجع',
                  render: (r) => (
                    <div className="flex flex-col">
                      <span className="font-medium" dir="ltr">
                        {r.number}
                      </span>
                      <span className="text-xs text-muted-foreground">على {r.saleNumber}</span>
                    </div>
                  ),
                },
                { key: 'date', title: 'التاريخ', hideOnMobile: true, render: (r) => formatDateTime(r.createdAt) },
                { key: 'reason', title: 'السبب', hideOnMobile: true, render: (r) => r.reason },
                {
                  key: 'lines',
                  title: 'الأصناف',
                  hideOnMobile: true,
                  render: (r) => r.lines.map((l) => `${l.name} × ${l.quantity}`).join('، '),
                },
                {
                  key: 'amount',
                  title: 'المبلغ',
                  render: (r) => <span className="font-semibold tabular-nums">{formatMoney(r.refund.amount, currency)}</span>,
                },
                {
                  key: 'status',
                  title: 'الرد',
                  render: (r) =>
                    r.refund.status === 'done' ? <Badge variant="success">تم</Badge> : <Badge variant="warning">معلّق</Badge>,
                },
              ]}
              data={rowsPage}
              keyExtractor={(r) => r.id}
              emptyText="لا مرتجعات ضمن الفلاتر الحالية."
            />
          )}
        </DirectoryPagedViews>
      )}
      <PrintPreviewDialog
        open={!!zSession}
        onOpenChange={(o) => !o && setZSessionId(null)}
        title="تقرير إغلاق الوردية"
        invoiceStyle={resolvePosInvoiceStyle(
          data.registers.find((r) => r.id === zSession?.registerId),
          data.settings,
        )}
        document={
          zSession
            ? sessionToPrintable(
                zSession,
                data.registers.find((r) => r.id === zSession.registerId),
                summarizeSession(data, zSession),
              )
            : null
        }
      />
    </div>
  );
}

const differenceKind = (d: number) => (d < -0.004 ? 'عجز' : d > 0.004 ? 'زيادة' : 'مطابق');

function DifferenceAmount({ value, strong }: { value: number; strong?: boolean }) {
  return (
    <span
      className={cn(
        'tabular-nums',
        strong && 'font-semibold',
        value < -0.004 ? 'text-destructive' : value > 0.004 ? 'text-warning' : 'text-success',
      )}
    >
      {formatAmount(value)}
    </span>
  );
}

function ClosingSummary({ rows, currency }: { rows: ClosingRow[]; currency: string | null }) {
  const t = closingTotals(rows);
  const cards = [
    { label: 'ورديات أُغلقت', value: String(t.shifts) },
    { label: 'منها بفرق', value: String(t.withDifference) },
    { label: 'إجمالي العجز', value: formatMoney(t.shortage, currency), tone: t.shortage < 0 ? 'text-destructive' : '' },
    { label: 'إجمالي الزيادة', value: formatMoney(t.overage, currency), tone: t.overage > 0 ? 'text-warning' : '' },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className={cn('text-lg font-semibold tabular-nums', c.tone)}>{c.value}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        الفرق = المعدود − المتوقع. السالب عجز (نقد أقل مما يجب في الدرج) والموجب زيادة. يُجمع العجز والزيادة كلٌّ على
        حدة حتى لا تُخفي زيادةُ وردية عجزَ أخرى.
      </p>
    </div>
  );
}

function closingColumns(openZ: (sessionId: string) => void): ColumnDef<ClosingRow>[] {
  return [
    {
      key: 'shift',
      title: 'الوردية',
      render: (c) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {c.registerName} · {c.cashierName}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(c.openedAt)} ← {formatDateTime(c.closedAt)}
          </span>
        </div>
      ),
    },
    { key: 'expected', title: 'المتوقع', hideOnMobile: true, render: (c) => <span className="tabular-nums">{formatAmount(c.expectedCash)}</span> },
    { key: 'counted', title: 'المعدود', hideOnMobile: true, render: (c) => <span className="tabular-nums">{formatAmount(c.countedCash)}</span> },
    {
      key: 'difference',
      title: 'الفرق',
      render: (c) => (
        <span className="inline-flex items-center gap-1.5">
          <DifferenceAmount value={c.difference} strong />
          {Math.abs(c.difference) > 0.004 ? (
            <Badge variant={c.difference < 0 ? 'destructive' : 'warning'}>{differenceKind(c.difference)}</Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: 'reason',
      title: 'سبب الفرق',
      hideOnMobile: true,
      render: (c) => (c.reason ? <span className="text-xs">{c.reason}</span> : <span className="text-muted-foreground">—</span>),
    },
    {
      key: 'z',
      title: '',
      render: (c) => (
        <Button size="sm" variant="ghost" onClick={() => openZ(c.sessionId)} aria-label={`تقرير Z لوردية ${c.cashierName}`}>
          <FileText className="h-4 w-4" />Z
        </Button>
      ),
    },
  ];
}

function CreditSummary({
  rows,
  collections,
  currency,
  view,
}: {
  rows: CreditInvoiceRow[];
  collections: CollectionRow[];
  currency: string | null;
  view: 'credit' | 'receivables';
}) {
  const sum = (pick: (r: CreditInvoiceRow) => number) => rows.reduce((a, r) => a + pick(r), 0);
  const cards =
    view === 'credit'
      ? [
          { label: 'بيع آجل', value: sum((r) => r.credit) },
          { label: 'حُصّل منه', value: sum((r) => r.collected) },
          { label: 'أُرجع منه', value: sum((r) => r.returned) },
          { label: 'المتبقي منه اليوم', value: sum((r) => r.due) },
        ]
      : [
          { label: 'المستحق على العملاء', value: sum((r) => r.due) },
          { label: 'عدد الفواتير', value: rows.length, count: true },
          { label: 'عدد العملاء', value: new Set(rows.map((r) => r.partnerId)).size, count: true },
          { label: 'تحصيلات الفترة', value: collections.reduce((a, c) => a + c.amount, 0) },
        ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">{c.label}</div>
          <div className="text-lg font-semibold tabular-nums">
            {'count' in c && c.count ? c.value : formatMoney(c.value, currency)}
          </div>
        </div>
      ))}
    </div>
  );
}

function creditColumns(currency: string | null): ColumnDef<CreditInvoiceRow>[] {
  return [
    {
      key: 'invoice',
      title: 'الفاتورة',
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">{r.customer}</span>
          <span className="text-xs text-muted-foreground">
            <span dir="ltr">{r.saleNumber}</span> · {formatDateTime(r.date)}
          </span>
        </div>
      ),
    },
    { key: 'payment', title: 'الدفع', hideOnMobile: true, render: (r) => <span className="text-xs">{r.payment}</span> },
    { key: 'total', title: 'الإجمالي', hideOnMobile: true, render: (r) => <span className="tabular-nums">{formatAmount(r.total)}</span> },
    { key: 'credit', title: 'آجل', render: (r) => <span className="tabular-nums">{formatAmount(r.credit)}</span> },
    { key: 'collected', title: 'المحصّل', hideOnMobile: true, render: (r) => <span className="tabular-nums">{formatAmount(r.collected)}</span> },
    { key: 'returned', title: 'المرتجع', hideOnMobile: true, render: (r) => <span className="tabular-nums">{formatAmount(r.returned)}</span> },
    {
      key: 'due',
      title: 'المتبقي',
      render: (r) =>
        r.due > 0.004 ? (
          <span className="font-semibold tabular-nums text-warning">{formatMoney(r.due, currency)}</span>
        ) : (
          <Badge variant="success">مسدّدة</Badge>
        ),
    },
  ];
}

function collectionColumns(currency: string | null): ColumnDef<CollectionRow>[] {
  return [
    {
      key: 'customer',
      title: 'العميل',
      render: (c) => (
        <div className="flex flex-col">
          <span className="font-medium">{c.partnerName}</span>
          <span className="text-xs text-muted-foreground">
            على <span dir="ltr">{c.saleNumber}</span> · {formatDateTime(c.createdAt)}
          </span>
        </div>
      ),
    },
    {
      key: 'method',
      title: 'الوسيلة',
      render: (c) => (
        <span>
          {PAYMENT_METHOD_LABELS[c.method]}
          {c.reference ? <span className="text-xs text-muted-foreground" dir="ltr"> · {c.reference}</span> : null}
        </span>
      ),
    },
    {
      key: 'where',
      title: 'المكان',
      hideOnMobile: true,
      render: (c) => (c.inShift ? c.registerName : <Badge variant="outline">خارج الوردية</Badge>),
    },
    { key: 'by', title: 'بواسطة', hideOnMobile: true, render: (c) => c.createdBy },
    { key: 'amount', title: 'المبلغ', render: (c) => <span className="font-semibold tabular-nums">{formatMoney(c.amount, currency)}</span> },
  ];
}

function discountColumns(currency: string | null): ColumnDef<LineFact>[] {
  return [
    {
      key: 'product',
      title: 'الصنف',
      render: (f) => (
        <div className="flex flex-col">
          <span className="font-medium">{f.productName}</span>
          <span className="text-xs text-muted-foreground">
            {f.saleNumber} · {f.cashierName}
          </span>
        </div>
      ),
    },
    { key: 'date', title: 'التاريخ', hideOnMobile: true, render: (f) => formatDateTime(f.date) },
    { key: 'source', title: 'السعر الأصلي', render: (f) => <span className="tabular-nums">{formatAmount(f.sourcePrice)}</span> },
    {
      key: 'price',
      title: 'سعر البيع',
      render: (f) => (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          {formatAmount(f.unitPrice)}
          {f.priceOverridden ? <Badge variant="warning">معدّل</Badge> : null}
        </span>
      ),
    },
    { key: 'discount', title: 'الخصم', render: (f) => <span className="tabular-nums">{formatMoney(f.discount, currency)}</span> },
    {
      key: 'cost',
      title: 'تكلفة الوحدة',
      hideOnMobile: true,
      render: (f) => (f.unitCost == null ? '—' : <span className="tabular-nums">{formatAmount(f.unitCost)}</span>),
    },
  ];
}

export function PosReportsPage() {
  return (
    <PosGate permission="pos.reports.read">
      <Reports />
    </PosGate>
  );
}
