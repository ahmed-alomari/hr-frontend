'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PhoneStatsFold } from '@/components/layouts/phone-fold';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { ListFilterBar, type PeriodRange } from '@/components/ui/list-filter-bar';
import { cn } from '@/shared/utils';
import { last30Days, ReportSummaryCard, ShareBar } from '@/features/expenses/components/report-common';
import { posRoutes } from '@/features/pos/constants/routes';
import { PosDataScope, usePosContext } from '@/features/pos/hooks/use-pos-context';
import { formatAmount, formatMoney } from '@/features/pos/lib/format';
import {
  GROUPINGS,
  NO_FILTERS,
  dayOf,
  groupBy,
  lineFacts,
  sortedForTime,
  totalsOf,
  type GroupRow,
  type ReportFilters,
} from '@/features/pos/lib/sales-report';
import { PosGate } from '@/features/pos/components/shared/pos-shared';

const ALL = 'all';

/**
 * Series colours: teal for sales, amber for profit — validated together
 * (lightness band, chroma, colour-blind separation, contrast) on the light
 * and the dark surface; the same pair serves both modes.
 */
const SALES_COLOR = '#0d9488';
const PROFIT_COLOR = '#d97706';

const marginText = (m: number | null) => (m == null ? '—' : `${m}%`);

/** YYYY-MM-DD days from `from` to `to` inclusive (capped at a year). */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (d <= end && out.length < 366) {
    out.push(dayOf(d.toISOString()));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function Analytics({ period, setPeriod, defaultPeriod }: { period: PeriodRange; setPeriod: (p: PeriodRange) => void; defaultPeriod: PeriodRange }) {
  const { data, currency } = usePosContext();
  const [registerId, setRegisterId] = React.useState(ALL);
  const [cashierName, setCashierName] = React.useState(ALL);
  const [categoryId, setCategoryId] = React.useState(ALL);

  const filters: ReportFilters = React.useMemo(
    () => ({
      ...NO_FILTERS,
      from: period.from || null,
      to: period.to || null,
      currency,
      registerId: registerId === ALL ? null : registerId,
      cashierName: cashierName === ALL ? null : cashierName,
      categoryId: categoryId === ALL ? null : categoryId,
    }),
    [period, registerId, cashierName, categoryId, currency],
  );

  const facts = React.useMemo(() => lineFacts(data, filters), [data, filters]);
  const totals = React.useMemo(() => totalsOf(facts), [facts]);

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

  // One day: by hour; longer: by day.
  const oneDay = Boolean(filters.from && filters.from === filters.to);
  const trend = React.useMemo(() => {
    const grouping = oneDay ? 'hour' : 'day';
    const rows = new Map(
      sortedForTime(grouping, groupBy(facts, GROUPINGS[grouping])).map((r) => [r.key, r]),
    );
    if (rows.size === 0) return [];
    // Every hour / day of the period, the quiet ones at zero, so the bars
    // read as a timeline (a lone sale day is not stretched across the chart).
    const keys = oneDay
      ? Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
      : daysBetween(filters.from ?? [...rows.keys()][0]!, filters.to ?? [...rows.keys()].at(-1)!);
    return keys.map((key) => {
      const r = rows.get(key);
      return {
        key: oneDay ? `${key}:00` : key.slice(5),
        revenue: r?.revenue ?? 0,
        profit: r && r.costedRevenue > 0 ? r.profit : 0,
      };
    });
  }, [facts, oneDay, filters.from, filters.to]);

  const products = React.useMemo(() => groupBy(facts, GROUPINGS.product), [facts]);
  const topSelling = products.slice(0, 5);
  const topProfit = [...products]
    .filter((r) => r.costedRevenue > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  const isDefaultPeriod = period.from === defaultPeriod.from && period.to === defaultPeriod.to;
  const activeFilterCount =
    [registerId, cashierName, categoryId].filter((v) => v !== ALL).length + (isDefaultPeriod ? 0 : 1);

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
      </div>
    ),
    [activeFilterCount],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showStatusSection={false}
        showEmployeePicker={false}
        periodValue={period}
        onPeriodChange={setPeriod}
        defaultPeriod={defaultPeriod}
        inlineSelects={[
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
        ]}
      />
    ),
    [period, defaultPeriod, registerId, cashierName, categoryId, data.registers, cashiers, categories],
  );

  const profitClass = totals.profit > 0 ? 'text-success' : totals.profit < 0 ? 'text-destructive' : '';

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr="تحليل المبيعات"
        descriptionAr="المبيعات والتكلفة والربح في الفترة، واتجاهها، وأعلى الأصناف."
        iconName="BarChart3"
      />

      <PhoneStatsFold summary={formatMoney(totals.revenue, currency)}>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <ReportSummaryCard
            label="صافي المبيعات"
            value={formatMoney(totals.revenue, currency)}
            hint={`قبل الخصم ${formatAmount(totals.gross)} · بدون ضريبة`}
          />
          <ReportSummaryCard
            label="تكلفة البضاعة المباعة"
            value={formatMoney(totals.cost, currency)}
            hint={`${formatAmount(totals.units)} قطعة`}
          />
          <ReportSummaryCard
            label={totals.profit < 0 ? 'الخسارة' : 'مجمل الربح'}
            value={formatMoney(totals.profit, currency)}
            valueClassName={profitClass}
            hint={
              totals.uncostedRevenue > 0 ? (
                <span className="text-warning">{formatAmount(totals.uncostedRevenue)} مبيعات بلا تكلفة (خارج الربح)</span>
              ) : (
                `هامش ${marginText(totals.margin)}`
              )
            }
          />
          <ReportSummaryCard
            label="الفواتير"
            value={String(totals.invoices)}
            hint={`متوسط الفاتورة ${formatAmount(totals.averageInvoice)}`}
          />
          <ReportSummaryCard label="الخصومات" value={formatMoney(totals.discount, currency)} />
          <ReportSummaryCard label="المرتجعات" value={formatMoney(totals.returned, currency)} />
          <ReportSummaryCard label="الضريبة" value={formatMoney(totals.tax, currency)} />
          <ReportSummaryCard label="الهامش" value={marginText(totals.margin)} hint="الربح ÷ صافي المبيعات" />
        </div>
      </PhoneStatsFold>

      <section className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">{oneDay ? 'المبيعات والربح حسب الساعة' : 'المبيعات والربح حسب اليوم'}</h2>
          <p className="text-xs text-muted-foreground">صافي المبيعات بدون ضريبة، والربح من المبيعات التي لها تكلفة.</p>
        </div>
        {trend.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">لا مبيعات ضمن الفلاتر الحالية.</p>
        ) : (
          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} className="stroke-border" strokeOpacity={0.6} />
                <XAxis dataKey="key" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatAmount(v)} />
                <Tooltip
                  cursor={{ fillOpacity: 0.08 }}
                  formatter={(value, name) => [formatMoney(Number(value), currency), name === 'revenue' ? 'صافي المبيعات' : 'الربح']}
                  contentStyle={{ direction: 'rtl', borderRadius: 8, fontSize: 12 }}
                />
                <Legend formatter={(name) => (name === 'revenue' ? 'صافي المبيعات' : 'الربح')} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill={SALES_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="profit" fill={PROFIT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopList
          title="الأكثر مبيعًا"
          rows={topSelling}
          value={(r) => r.revenue}
          render={(r) => formatMoney(r.revenue, currency)}
        />
        <TopList
          title="الأكثر ربحًا"
          rows={topProfit}
          value={(r) => Math.max(0, r.profit)}
          render={(r) => (
            <span className={cn(r.profit < 0 && 'text-destructive')}>
              {formatMoney(r.profit, currency)} <span className="text-xs text-muted-foreground">({marginText(r.margin)})</span>
            </span>
          )}
        />
      </div>
    </div>
  );
}

function TopList({
  title,
  rows,
  value,
  render,
}: {
  title: string;
  rows: GroupRow[];
  value: (r: GroupRow) => number;
  render: (r: GroupRow) => React.ReactNode;
}) {
  const max = Math.max(0, ...rows.map(value));
  const total = rows.reduce((a, r) => a + value(r), 0);
  return (
    <section className="rounded-xl border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link href={posRoutes.reports} className="text-xs text-primary hover:underline">
          تقارير المبيعات
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">لا بيانات ضمن الفلاتر الحالية.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((r, i) => (
            <li key={r.key} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{r.label}</span>
                  <span className="shrink-0 text-sm tabular-nums">{render(r)}</span>
                </div>
                <ShareBar value={value(r)} max={max} total={total} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PosAnalyticsPage() {
  const defaultPeriod = React.useMemo<PeriodRange>(() => last30Days(dayOf(new Date().toISOString())), []);
  const [period, setPeriod] = React.useState<PeriodRange>(defaultPeriod);
  return (
    <PosDataScope range={period.from && period.to ? { from: period.from, to: period.to } : undefined}>
      <PosGate permission="pos.reports.read">
        <Analytics period={period} setPeriod={setPeriod} defaultPeriod={defaultPeriod} />
      </PosGate>
    </PosDataScope>
  );
}
