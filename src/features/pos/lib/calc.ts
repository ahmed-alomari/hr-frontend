import type {
  PosDiscount,
  PosSaleLine,
  PosSaleTotals,
  PosSettings,
} from '@/features/pos/domain/types';

/** Money is rounded to 2 places at every stored step, in integer cents. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function discountOf(base: number, discount: PosDiscount | null): number {
  if (!discount || discount.value <= 0 || base <= 0) return 0;
  const raw = discount.type === 'percent' ? (base * Math.min(discount.value, 100)) / 100 : discount.value;
  return round2(Math.min(raw, base));
}

/** Percent a discount represents of `base` (for the cashier limit). */
export function discountPercentOf(base: number, discount: PosDiscount | null): number {
  if (!discount || base <= 0) return 0;
  return discount.type === 'percent' ? discount.value : (discount.value / base) * 100;
}

/** The highest discount of a cart, as the server measures it against the limit. */
export function highestDiscountPercent(
  lines: Array<Pick<PosSaleLine, 'unitPrice' | 'quantity' | 'discount'>>,
  orderDiscount: PosDiscount | null,
): number {
  const gross = lines.map((l) => round2(l.unitPrice * l.quantity));
  const lineDiscount = (base: number, discount: PosDiscount | null) => {
    if (!discount || base <= 0) return 0;
    const raw = discount.type === 'percent' ? (base * Math.min(discount.value, 100)) / 100 : discount.value;
    return round2(Math.min(raw, base));
  };
  const net = round2(gross.reduce((sum, g, i) => sum + g - lineDiscount(g, lines[i].discount), 0));
  return Math.max(0, ...lines.map((l, i) => discountPercentOf(gross[i], l.discount)), discountPercentOf(net, orderDiscount));
}

/**
 * Recomputes every line snapshot: line discount, its share of the sale
 * discount (spread by net value, remainder on the last line), tax, total.
 */
export function priceLines(
  lines: PosSaleLine[],
  orderDiscount: PosDiscount | null,
  tax: PosSettings['tax'],
): { lines: PosSaleLine[]; totals: PosSaleTotals } {
  const rate = tax.enabled ? tax.rate : 0;
  const gross = lines.map((l) => round2(l.unitPrice * l.quantity));
  const lineDiscounts = lines.map((l, i) => discountOf(gross[i]!, l.discount));
  const nets = gross.map((g, i) => round2(g - lineDiscounts[i]!));
  const netSum = round2(nets.reduce((a, b) => a + b, 0));
  const orderAmount = discountOf(netSum, orderDiscount);

  let allocated = 0;
  const priced = lines.map((line, i) => {
    const isLast = i === lines.length - 1;
    const share = isLast
      ? round2(orderAmount - allocated)
      : netSum > 0
        ? round2((orderAmount * nets[i]!) / netSum)
        : 0;
    allocated = round2(allocated + share);
    const net = round2(nets[i]! - share);
    const taxAmount = rate
      ? tax.pricesIncludeTax
        ? round2((net * rate) / (100 + rate))
        : round2((net * rate) / 100)
      : 0;
    const total = tax.pricesIncludeTax ? net : round2(net + taxAmount);
    return {
      ...line,
      discountAmount: round2(lineDiscounts[i]! + share),
      taxRate: rate,
      taxAmount,
      total,
    };
  });

  const totals: PosSaleTotals = {
    subtotal: round2(gross.reduce((a, b) => a + b, 0)),
    discount: round2(priced.reduce((a, l) => a + l.discountAmount, 0)),
    tax: round2(priced.reduce((a, l) => a + l.taxAmount, 0)),
    total: round2(priced.reduce((a, l) => a + l.total, 0)),
  };
  return { lines: priced, totals };
}

/**
 * Refund for `quantity` units of a sold line, from its snapshot: the value
 * of what will have come back minus the value of what already did, each
 * rounded, so the pieces add up to the line (3.33, 3.34, 3.33 of 10.00) —
 * the server's rule.
 */
export function lineRefundAmount(
  line: Pick<PosSaleLine, 'total' | 'quantity' | 'returnedQuantity'>,
  quantity: number,
): number {
  if (line.quantity <= 0 || quantity <= 0) return 0;
  const already = Math.min(line.returnedQuantity ?? 0, line.quantity);
  const after = Math.min(already + quantity, line.quantity);
  const valueOf = (units: number) => round2((line.total * units) / line.quantity);
  return round2(valueOf(after) - valueOf(already));
}

export function paidAmount(payments: Array<{ kind: string; status: string; amount: number }>): number {
  return round2(
    payments
      .filter((p) => p.kind === 'payment' && p.status === 'succeeded')
      .reduce((a, p) => a + p.amount, 0),
  );
}

/**
 * The tax a sale was priced with, read back from its own lines (rate, and
 * whether totals included it), so revising an old sale keeps its tax even
 * after the settings changed.
 */
export function saleTaxSettings(
  lines: PosSaleLine[],
  fallback: PosSettings['tax'],
): PosSettings['tax'] {
  const taxed = lines.find((l) => l.taxRate > 0);
  if (!taxed) return lines.length > 0 ? { ...fallback, enabled: false, rate: 0 } : fallback;
  const net = round2(taxed.unitPrice * taxed.quantity - taxed.discountAmount);
  return {
    ...fallback,
    enabled: true,
    rate: taxed.taxRate,
    // Inclusive: the line total is the net; exclusive: net + tax.
    pricesIncludeTax: Math.abs(taxed.total - net) < 0.005,
  };
}
