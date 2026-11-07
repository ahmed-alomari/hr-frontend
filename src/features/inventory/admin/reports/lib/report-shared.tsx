'use client';

import * as React from 'react';
import { Info } from 'lucide-react';
import { companyCurrencyCode } from '@/features/auth/lib/company-currency';
import { currencySymbolAr } from '@/shared/currencies';
import type { DateRangeFilterValue } from '@/components/ui/date-range-filter-trigger';
import type { ReportHeader } from '@/features/inventory/admin/reports/lib/api/inventory-reports';

export function formatQty(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

/** A money figure for exports: two decimals, no symbol (the currency is in the subtitle). */
export function moneyCell(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatReportMoney(value: number | null | undefined, currency?: string | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${moneyCell(value)} ${currencySymbolAr(currency || companyCurrencyCode())}`;
}

export function itemLabel(row: { productName: string; variantName?: string | null }): string {
  return row.variantName ? `${row.productName} — ${row.variantName}` : row.productName;
}

function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayIso(): string {
  return isoDay(new Date());
}

/** From the first of this month to today. */
export function currentMonthRange(): DateRangeFilterValue {
  const now = new Date();
  return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDay(now) };
}

export function periodLabel(from: string | null | undefined, to: string | null | undefined): string {
  if (!from && !to) return 'حتى اليوم';
  if (!from) return `حتى ${to}`;
  return `${from} — ${to || 'اليوم'}`;
}

export function currencyLine(header: Pick<ReportHeader, 'valueVisible' | 'currency'> | undefined): string | null {
  if (!header?.valueVisible) return null;
  return `العملة: ${currencySymbolAr(header.currency || companyCurrencyCode())}`;
}

/** Why the report shows quantities only. */
export function valueHiddenMessage(header: Pick<ReportHeader, 'valueHiddenReason' | 'warehouseId'>): string | null {
  switch (header.valueHiddenReason) {
    case 'no_permission':
      return 'تُعرض الكميات فقط: ليس لديك صلاحية عرض التكاليف.';
    case 'costing_disabled':
      return 'تُعرض الكميات فقط: احتساب التكلفة غير مفعّل في إعدادات المخازن.';
    case 'company_average':
      return header.warehouseId
        ? 'القيم لا تُعرض لمستودع واحد: التكلفة تُحسب بمتوسط واحد على مستوى الشركة، فلا قيمة مستقلة لكل مستودع. اختر «كل المستودعات» لعرض القيم.'
        : 'القيم لا تُعرض: التكلفة تُحسب بمتوسط واحد على مستوى الشركة، وصلاحيتك على فروع محددة فقط.';
    default:
      return null;
  }
}

export function ValueHiddenNote({ header }: { header: ReportHeader | undefined }) {
  const message = header ? valueHiddenMessage(header) : null;
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground sm:text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

export function ReportStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'in' | 'out';
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card px-4 py-3 shadow-soft max-sm:px-3 max-sm:py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === 'in'
            ? 'mt-1 truncate text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400'
            : tone === 'out'
              ? 'mt-1 truncate text-lg font-semibold tabular-nums text-rose-700 dark:text-rose-400'
              : 'mt-1 truncate text-lg font-semibold tabular-nums'
        }
        dir="ltr"
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
