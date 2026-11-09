'use client';

import { ListToolsTable, useListTools, type ListToolField, type ListToolsModel } from '@/components/ui/list-tools';
import * as React from 'react';
import { PhoneStatsFold } from '@/components/layouts/phone-fold';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { Badge } from '@/components/ui/badge';
import { DataTable, usePagination, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { ListFilterBar, type PeriodRange } from '@/components/ui/list-filter-bar';
import { cn } from '@/shared/utils';
import { ShareBar } from '@/features/expenses/components/report-common';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PAYMENT_METHOD_LABELS, resolvePosInvoiceStyle, type PosPaymentMethod } from '@/features/pos/domain/types';
import { PosDataScope, usePosContext } from '@/features/pos/hooks/use-pos-context';
import { formatAmount, formatDateTime, formatMoney } from '@/features/pos/lib/format';
import { sessionToPrintable } from '@/features/pos/lib/receipt';
import { summarizeSession } from '@/features/pos/lib/session-summary';
import { GROUPINGS, NO_FILTERS, dayOf, discountedLines, groupBy as groupFacts, lineFacts, closingTotals, closingsByCashier, closingsInPeriod, collectionsByMethod, collectionsInPeriod, creditInvoices, openReceivables, paymentRows, refundMethodLabel, returnsInPeriod, sortedForTime, totalsOf, type ClosingRow, type CollectionRow, type CreditInvoiceRow, type GroupRow, type Grouping, type LineFact, type ReportFilters } from '@/features/pos/lib/sales-report';
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

function Reports({ period, setPeriod, defaultPeriod }: { period: PeriodRange; setPeriod: (p: PeriodRange) => void; defaultPeriod: PeriodRange }) {
  const { data, currency } = usePosContext();
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


  /* ── The open view's table: columns, rows and what its tools need ── */
  const paymentColumns: ColumnDef<PaymentRow>[] = [
            { key: 'label', title: 'الوسيلة', render: (p) => <span className="font-medium">{p.label}</span> },
            { key: 'count', title: 'العمليات', render: (p) => <span className="tabular-nums">{p.count}</span> },
            { key: 'collected', title: 'المحصّل', render: (p) => <span className="tabular-nums">{formatAmount(p.collected)}</span> },
            { key: 'refunded', title: 'المردود', render: (p) => <span className="tabular-nums">{formatAmount(p.refunded)}</span> },
            { key: 'net', title: 'الصافي', render: (p) => <span className="font-semibold tabular-nums">{formatMoney(p.net, currency)}</span> },
          ];
  const returnColumns: ColumnDef<ReturnRow>[] = [
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
              ];
  const amount = (n: number) => formatAmount(n);
  const table: ReportTable = isGrouping
    ? reportTable<GroupRow>(groupColumns, groupRows, {
        label: {
          kind: 'name',
          text: (r) => (r.detail ? `${r.label} (${r.detail})` : r.label),
          alsoExport: [{ label: 'إيراد بلا تكلفة', text: (r) => amount(r.uncostedRevenue) }],
        },
        units: { kind: 'number', text: (r) => amount(r.units), sort: (r) => r.units, sum: (r) => r.units, formatSum: amount },
        invoices: { kind: 'number', text: (r) => String(r.invoices), sort: (r) => r.invoices, sum: (r) => r.invoices },
        revenue: {
          kind: 'number',
          text: (r) => amount(r.revenue),
          sort: (r) => r.revenue,
          sum: (r) => r.revenue,
          formatSum: amount,
          alsoExport: [
            { label: 'الخصم', text: (r) => amount(r.discount) },
            { label: 'المرتجع', text: (r) => amount(r.returned) },
            { label: 'الضريبة', text: (r) => amount(r.tax) },
          ],
        },
        cost: { kind: 'number', text: (r) => (r.costedRevenue > 0 ? amount(r.cost) : '—'), sort: (r) => r.cost, sum: (r) => r.cost, formatSum: amount },
        profit: { kind: 'number', text: (r) => (r.costedRevenue > 0 ? amount(r.profit) : '—'), sort: (r) => r.profit, sum: (r) => r.profit, formatSum: amount },
        margin: { kind: 'number', text: (r) => marginText(r.margin), sort: (r) => Number(r.margin) || 0 },
      })
    : view === 'payments'
      ? reportTable<PaymentRow>(paymentColumns, payments, {
          label: { kind: 'name', text: (p) => p.label },
          count: { kind: 'number', text: (p) => String(p.count), sort: (p) => p.count, sum: (p) => p.count },
          collected: { kind: 'number', text: (p) => amount(p.collected), sort: (p) => p.collected, sum: (p) => p.collected, formatSum: amount },
          refunded: { kind: 'number', text: (p) => amount(p.refunded), sort: (p) => p.refunded, sum: (p) => p.refunded, formatSum: amount },
          net: { kind: 'number', text: (p) => amount(p.net), sort: (p) => p.net, sum: (p) => p.net, formatSum: amount },
        })
      : view === 'credit' || view === 'receivables'
        ? reportTable<CreditInvoiceRow>(creditColumns(currency), view === 'credit' ? credit : receivables, {
            invoice: {
              kind: 'code',
              text: (r) => r.saleNumber,
              alsoExport: [
                { label: 'التاريخ', text: (r) => formatDateTime(r.date) },
                { label: 'العميل', text: (r) => r.customer },
                { label: 'نقطة البيع', text: (r) => r.registerName },
                { label: 'الكاشير', text: (r) => r.cashierName },
              ],
            },
            payment: { text: (r) => r.payment, group: (r) => r.payment },
            total: { kind: 'number', text: (r) => amount(r.total), sort: (r) => r.total, sum: (r) => r.total, formatSum: amount },
            credit: { kind: 'number', text: (r) => amount(r.credit), sort: (r) => r.credit, sum: (r) => r.credit, formatSum: amount },
            collected: { kind: 'number', text: (r) => amount(r.collected), sort: (r) => r.collected, sum: (r) => r.collected, formatSum: amount },
            returned: { kind: 'number', text: (r) => amount(r.returned), sort: (r) => r.returned, sum: (r) => r.returned, formatSum: amount },
            due: { kind: 'number', text: (r) => amount(r.due), sort: (r) => r.due, sum: (r) => r.due, formatSum: amount },
          })
        : view === 'collections'
          ? reportTable<CollectionRow>(collectionColumns(currency), collections, {
              customer: {
                kind: 'name',
                text: (c) => c.partnerName,
                group: (c) => c.partnerName,
                alsoExport: [
                  { label: 'الفاتورة', text: (c) => c.saleNumber },
                  { label: 'التاريخ', text: (c) => formatDateTime(c.createdAt) },
                ],
              },
              method: {
                text: (c) => PAYMENT_METHOD_LABELS[c.method],
                group: (c) => PAYMENT_METHOD_LABELS[c.method],
                alsoExport: [{ label: 'المرجع', text: (c) => c.reference ?? '' }],
              },
              where: { text: (c) => c.registerName ?? '—', group: (c) => c.registerName ?? null },
              by: { text: (c) => c.createdBy, group: (c) => c.createdBy },
              amount: { kind: 'number', text: (c) => amount(c.amount), sort: (c) => c.amount, sum: (c) => c.amount, formatSum: amount },
            })
          : view === 'closings'
            ? reportTable<ClosingRow>(closingColumns(setZSessionId), closings, {
                shift: {
                  kind: 'name',
                  text: (c) => `${c.registerName} · ${c.cashierName}`,
                  sort: (c) => c.closedAt,
                  group: (c) => c.cashierName,
                  alsoExport: [
                    { label: 'الفتح', text: (c) => formatDateTime(c.openedAt) },
                    { label: 'الإغلاق', text: (c) => formatDateTime(c.closedAt) },
                    { label: 'العهدة', text: (c) => amount(c.openingFloat) },
                  ],
                },
                expected: { kind: 'number', text: (c) => amount(c.expectedCash), sort: (c) => c.expectedCash, sum: (c) => c.expectedCash, formatSum: amount },
                counted: { kind: 'number', text: (c) => amount(c.countedCash), sort: (c) => c.countedCash, sum: (c) => c.countedCash, formatSum: amount },
                difference: {
                  kind: 'number',
                  text: (c) => `${amount(c.difference)} (${differenceKind(c.difference)})`,
                  sort: (c) => c.difference,
                  group: (c) => differenceKind(c.difference),
                  sum: (c) => c.difference,
                  formatSum: amount,
                },
                reason: { text: (c) => c.reason ?? '', sortable: false },
              })
            : view === 'discounts'
              ? reportTable<LineFact>(discountColumns(currency), discounted, {
                  product: {
                    kind: 'name',
                    text: (f) => f.productName,
                    group: (f) => f.productName,
                    alsoExport: [
                      { label: 'الفاتورة', text: (f) => f.saleNumber },
                      { label: 'الكاشير', text: (f) => f.cashierName },
                    ],
                  },
                  date: { kind: 'date', text: (f) => formatDateTime(f.date), sort: (f) => f.date, group: (f) => f.date.slice(0, 10) },
                  source: { kind: 'number', text: (f) => amount(f.sourcePrice ?? 0), sort: (f) => f.sourcePrice ?? 0 },
                  price: { kind: 'number', text: (f) => amount(f.unitPrice), sort: (f) => f.unitPrice },
                  discount: { kind: 'number', text: (f) => amount(f.discount), sort: (f) => f.discount, sum: (f) => f.discount, formatSum: amount },
                  cost: { kind: 'number', text: (f) => (f.unitCost == null ? '—' : amount(f.unitCost)), sort: (f) => f.unitCost ?? 0 },
                })
              : reportTable<ReturnRow>(returnColumns, returns, {
                  number: { kind: 'code', text: (r) => r.number, alsoExport: [{ label: 'على الفاتورة', text: (r) => r.saleNumber }] },
                  date: { kind: 'date', text: (r) => formatDateTime(r.createdAt), sort: (r) => r.createdAt, group: (r) => r.createdAt.slice(0, 10) },
                  reason: { text: (r) => r.reason, group: (r) => r.reason },
                  lines: { text: (r) => r.lines.map((l) => `${l.name} × ${l.quantity}`).join('، '), sortable: false },
                  amount: {
                    kind: 'number',
                    text: (r) => amount(r.refund.amount),
                    sort: (r) => r.refund.amount,
                    sum: (r) => r.refund.amount,
                    formatSum: amount,
                    alsoExport: [{ label: 'الطريقة', text: (r) => refundMethodLabel(r.refund.method) }],
                  },
                  status: { kind: 'status', text: (r) => (r.refund.status === 'done' ? 'تم' : 'معلّق'), group: (r) => (r.refund.status === 'done' ? 'تم' : 'معلّق') },
                });
  // Credit collections count as money in: the payments export lists them after the methods.
  const extraPaymentRows: PaymentRow[] = view === 'payments'
    ? collectionMethods
        .filter((c) => c.count > 0)
        .map((c) => ({ ...payments[0], method: c.method, label: `تحصيل آجل · ${c.label}`, count: c.count, collected: c.total, refunded: 0, net: c.total }))
    : [];
  const tools = useListTools<unknown>({
    section: 'pos',
    page: `reports-${isGrouping ? 'grouped' : view}`,
    columns: table.columns,
    rows: table.rows,
    resetKey: `${view}|${stamp}|${search}|${registerId}|${cashierName}|${categoryId}|${paymentMethod}`,
    fields: table.fields,
    extraExportRows: extraPaymentRows,
  });
  const toolsFor = <T,>() => tools as unknown as ListToolsModel<T>;

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        {tools.exportMenu(viewMeta.label, `pos-${view}-${stamp}`, [`الفترة: ${filters.from ?? '…'} — ${filters.to ?? '…'}`])}
      </div>
    ),
    [activeFilterCount, view, stamp, tools.depsKey],
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


  const paged = usePagination(tools.rows, DEFAULT_PAGE_SIZE);
  const pagedAs = <T,>() => paged.slice as unknown as T[];
  // A new view starts on its first page, even with the same number of rows.
  const setPagedPage = paged.setPage;
  React.useEffect(() => { setPagedPage(1); }, [view, setPagedPage]);
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
        <ListToolsTable tools={toolsFor<GroupRow>()} keyExtractor={(r) => r.key}>
        <DirectoryPagedViews items={pagedAs<GroupRow>()} loading={tools.loading} serverPagination={pagination(paged)}>
          {(rowsPage) => (
            <DataTable
              variant="directory"
              columns={toolsFor<GroupRow>().columns}
              {...tools.tableSort}
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
        </ListToolsTable>
      ) : view === 'payments' ? (
        <DataTable
          variant="directory"
          columns={toolsFor<PaymentRow>().columns}
          {...tools.tableSort}
          data={toolsFor<PaymentRow>().rows}
          keyExtractor={(p) => p.method}
          emptyText="لا مدفوعات ضمن الفلاتر الحالية."
        />
      ) : view === 'credit' || view === 'receivables' ? (
        <div className="space-y-3">
          <CreditSummary rows={view === 'credit' ? credit : receivables} collections={collections} currency={currency} view={view} />
          <ListToolsTable tools={toolsFor<CreditInvoiceRow>()} keyExtractor={(r) => r.saleId}>
          <DirectoryPagedViews items={pagedAs<CreditInvoiceRow>()} loading={tools.loading} serverPagination={pagination(paged)}>
            {(rowsPage) => (
              <DataTable
                variant="directory"
                columns={toolsFor<CreditInvoiceRow>().columns}
                {...tools.tableSort}
                data={rowsPage}
                keyExtractor={(r) => r.saleId}
                emptyText={view === 'credit' ? 'لا مبيعات آجلة ضمن الفلاتر الحالية.' : 'لا مستحقات مفتوحة على العملاء.'}
              />
            )}
          </DirectoryPagedViews>
          </ListToolsTable>
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
          <ListToolsTable tools={toolsFor<CollectionRow>()} keyExtractor={(c) => c.id}>
          <DirectoryPagedViews items={pagedAs<CollectionRow>()} loading={tools.loading} serverPagination={pagination(paged)}>
            {(rowsPage) => (
              <DataTable
                variant="directory"
                columns={toolsFor<CollectionRow>().columns}
                {...tools.tableSort}
                data={rowsPage}
                keyExtractor={(c) => c.id}
                emptyText="لا تحصيلات آجل ضمن الفلاتر الحالية."
              />
            )}
          </DirectoryPagedViews>
          </ListToolsTable>
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
          <ListToolsTable tools={toolsFor<ClosingRow>()} keyExtractor={(c) => c.sessionId}>
          <DirectoryPagedViews items={pagedAs<ClosingRow>()} loading={tools.loading} serverPagination={pagination(paged)}>
            {(rowsPage) => (
              <DataTable
                variant="directory"
                columns={toolsFor<ClosingRow>().columns}
                {...tools.tableSort}
                data={rowsPage}
                keyExtractor={(c) => c.sessionId}
                emptyText="لا ورديات أُغلقت ضمن الفلاتر الحالية."
              />
            )}
          </DirectoryPagedViews>
          </ListToolsTable>
        </div>
      ) : view === 'discounts' ? (
        <ListToolsTable tools={toolsFor<LineFact>()} keyExtractor={(f) => `${f.saleId}:${f.productKey}:${f.date}`}>
        <DirectoryPagedViews items={pagedAs<LineFact>()} loading={tools.loading} serverPagination={pagination(paged)}>
          {(rowsPage) => (
            <DataTable
              variant="directory"
              columns={toolsFor<LineFact>().columns}
              {...tools.tableSort}
              data={rowsPage}
              keyExtractor={(f) => `${f.saleId}:${f.productKey}:${f.date}`}
              emptyText="لا خصومات ولا أسعار معدّلة ضمن الفلاتر الحالية."
            />
          )}
        </DirectoryPagedViews>
        </ListToolsTable>
      ) : (
        <ListToolsTable tools={toolsFor<ReturnRow>()} keyExtractor={(r) => r.id}>
        <DirectoryPagedViews items={pagedAs<ReturnRow>()} loading={tools.loading} serverPagination={pagination(paged)}>
          {(rowsPage) => (
            <DataTable
              variant="directory"
              columns={toolsFor<ReturnRow>().columns}
              {...tools.tableSort}
              data={rowsPage}
              keyExtractor={(r) => r.id}
              emptyText="لا مرتجعات ضمن الفلاتر الحالية."
            />
          )}
        </DirectoryPagedViews>
        </ListToolsTable>
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

type PaymentRow = ReturnType<typeof paymentRows>[number];
type ReturnRow = ReturnType<typeof returnsInPeriod>[number];
type ReportTable = {
  columns: ColumnDef<unknown>[];
  rows: unknown[];
  fields: Partial<Record<string, ListToolField<unknown>>>;
};
const reportTable = <T,>(
  columns: ColumnDef<T>[],
  rows: readonly T[],
  fields: Partial<Record<string, ListToolField<T>>>,
) => ({ columns, rows, fields }) as unknown as ReportTable;

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
    <PhoneStatsFold summary={<>العجز {formatMoney(t.shortage, currency)}</>}>
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
    </PhoneStatsFold>
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
    <PhoneStatsFold>
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
    </PhoneStatsFold>
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
  const defaultPeriod = React.useMemo<PeriodRange>(() => ({ from: today(), to: today() }), []);
  const [period, setPeriod] = React.useState<PeriodRange>(defaultPeriod);
  // The report reads its own period, of any age.
  return (
    <PosDataScope range={period.from && period.to ? { from: period.from, to: period.to } : undefined}>
      <PosGate permission="pos.reports.read">
        <Reports period={period} setPeriod={setPeriod} defaultPeriod={defaultPeriod} />
      </PosGate>
    </PosDataScope>
  );
}
