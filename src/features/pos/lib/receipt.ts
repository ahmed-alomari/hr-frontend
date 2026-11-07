import type { PrintableDocument } from '@/features/print-templates/domain/types';
import {
  customerLabel,
  PAYMENT_METHOD_LABELS,
  type PosRegister,
  type PosReturn,
  type PosSale,
  type PosSession,
  RETURN_CONDITION_LABELS,
} from '@/features/pos/domain/types';
import { formatAmount, formatDateTime } from '@/features/pos/lib/format';

/** A completed sale as a printable receipt (company template applies). */
export function saleToPrintable(
  sale: PosSale,
  register: PosRegister | undefined,
  options: { copy?: boolean; invoiceStyle?: 'thermal' | 'standard' } = {},
): PrintableDocument {
  const customer = sale.customer.kind === 'walk_in' ? null : sale.customer;
  return {
    title: options.invoiceStyle === 'standard' ? 'فاتورة بيع' : 'إيصال بيع',
    number: sale.number ?? sale.id.slice(0, 8),
    issuedAt: formatDateTime(sale.completedAt ?? sale.createdAt),
    meta: [
      { label: 'الكاشير', value: sale.cashierName },
      { label: 'نقطة البيع', value: register?.name ?? '—' },
      { label: 'العميل', value: customerLabel(sale.customer) },
      ...(sale.splitPayment ? [{ label: 'الدفع', value: 'مقسّم' }] : []),
      ...(customer?.taxNumber ? [{ label: 'الرقم الضريبي للعميل', value: customer.taxNumber }] : []),
      ...(sale.credit ? [{ label: 'المتبقي على العميل', value: formatAmount(sale.credit.due) }] : []),
    ],
    lines: sale.lines.map((l) => ({
      name: l.name,
      detail: [l.variantName, l.discountAmount > 0 ? `خصم ${formatAmount(l.discountAmount)}` : null]
        .filter(Boolean)
        .join(' · ') || undefined,
      quantity: l.quantity,
      unitPrice: formatAmount(l.unitPrice),
      total: formatAmount(l.total),
    })),
    totals: [
      { label: 'المجموع', value: formatAmount(sale.totals.subtotal) },
      ...(sale.totals.discount > 0 ? [{ label: 'الخصم', value: formatAmount(sale.totals.discount) }] : []),
      ...(sale.totals.tax > 0 ? [{ label: 'الضريبة', value: formatAmount(sale.totals.tax) }] : []),
      { label: 'الإجمالي', value: formatAmount(sale.totals.total), emphasize: true },
    ],
    payments: sale.payments
      .filter((p) => p.kind === 'payment' && p.status === 'succeeded')
      .flatMap((p) => [
        { label: PAYMENT_METHOD_LABELS[p.method], value: formatAmount(p.tendered ?? p.amount) },
        ...(p.change ? [{ label: 'الباقي', value: formatAmount(p.change) }] : []),
      ]),
    copyLabel: options.copy ? '— نسخة —' : undefined,
  };
}

export function returnToPrintable(ret: PosReturn): PrintableDocument {
  return {
    title: 'إشعار مرتجع',
    number: ret.number,
    issuedAt: formatDateTime(ret.createdAt),
    meta: [
      { label: 'البيع الأصلي', value: ret.saleNumber },
      { label: 'السبب', value: ret.reason || '—' },
    ],
    lines: ret.lines.map((l) => ({
      name: l.name,
      detail: RETURN_CONDITION_LABELS[l.condition],
      quantity: l.quantity,
      unitPrice: formatAmount(l.quantity ? l.amount / l.quantity : 0),
      total: formatAmount(l.amount),
    })),
    totals: [{ label: 'المبلغ المردود', value: formatAmount(ret.refund.amount), emphasize: true }],
    payments: [
      {
        label: `${ret.refund.method === 'credit' ? 'إلى حساب العميل' : PAYMENT_METHOD_LABELS[ret.refund.method]}${ret.refund.status === 'pending' ? ' (بانتظار التنفيذ)' : ''}`,
        value: formatAmount(ret.refund.amount),
      },
    ],
  };
}

/** Shift report: X while open, Z when closed. */
export function sessionToPrintable(
  session: PosSession,
  register: PosRegister | undefined,
  summary: {
    salesCount: number;
    salesTotal: number;
    byMethod: Record<string, number>;
    collectionsByMethod?: Record<string, number>;
    refundsCash: number;
    cashIn: number;
    cashOut: number;
    expectedCash: number;
  },
): PrintableDocument {
  const closed = session.status === 'closed';
  return {
    title: closed ? 'تقرير إغلاق الوردية (Z)' : 'تقرير الوردية (X)',
    number: `${register?.code ?? 'POS'}-${session.id.slice(0, 6).toUpperCase()}`,
    issuedAt: formatDateTime(closed ? session.closedAt : new Date().toISOString()),
    meta: [
      { label: 'الكاشير', value: session.cashierName },
      { label: 'نقطة البيع', value: register?.name ?? '—' },
      { label: 'الفتح', value: formatDateTime(session.openedAt) },
    ],
    lines: [],
    totals: [
      { label: 'عدد المبيعات', value: String(summary.salesCount) },
      { label: 'إجمالي المبيعات', value: formatAmount(summary.salesTotal) },
      ...Object.entries(summary.byMethod).map(([method, amount]) => ({
        label:
          method === 'credit'
            ? 'مبيعات آجلة (على العملاء)'
            : `محصّل ${PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method}`,
        value: formatAmount(amount),
      })),
      ...Object.entries(summary.collectionsByMethod ?? {}).map(([method, amount]) => ({
        label: `تحصيل آجل ${PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method}`,
        value: formatAmount(amount),
      })),
      { label: 'العهدة', value: formatAmount(session.openingFloat) },
      { label: 'مردود نقدًا', value: formatAmount(summary.refundsCash) },
      { label: 'مقبوضات', value: formatAmount(summary.cashIn) },
      { label: 'مصروفات', value: formatAmount(summary.cashOut) },
      { label: 'النقد المتوقع', value: formatAmount(summary.expectedCash), emphasize: true },
      ...(closed
        ? [
            { label: 'النقد المعدود', value: formatAmount(session.countedCash ?? 0) },
            { label: 'الفرق', value: formatAmount(session.difference ?? 0), emphasize: true },
          ]
        : []),
    ],
    payments: [],
    note: session.differenceReason ? `سبب الفرق: ${session.differenceReason}` : undefined,
  };
}
