import type { PosCollection, PosSale, PosSaleLine, PosSession } from '@/features/pos/domain/types';
import { EMPTY_POS_DATA, type PosCompanyData } from '@/features/pos/lib/pos-store';
import {
  GROUPINGS,
  NO_FILTERS,
  closingTotals,
  closingsByCashier,
  closingsInPeriod,
  collectionsByMethod,
  collectionsInPeriod,
  creditInvoices,
  groupBy,
  lineFacts,
  openReceivables,
  paymentRows,
  paymentSummaryOf,
  totalsOf,
} from '@/features/pos/lib/sales-report';
import { summarizeSession } from '@/features/pos/lib/session-summary';

/**
 * Each sale keeps the price it was sold at and the cost fixed at that moment:
 * the same item bought at 7 then at 9 and sold at 10 then 12 gives the profit
 * of each sale, not of today's cost.
 */
const line = (over: Partial<PosSaleLine>): PosSaleLine => ({
  id: 'l',
  productId: 'p1',
  variantId: null,
  name: 'قهوة',
  variantName: null,
  sku: 'CF',
  quantity: 1,
  sourcePrice: 10,
  unitPrice: 10,
  discount: null,
  discountAmount: 0,
  taxRate: 0,
  taxAmount: 0,
  total: 10,
  returnedQuantity: 0,
  unitCost: null,
  costSource: null,
  categoryId: 'c1',
  categoryName: 'مشروبات',
  ...over,
});

const sale = (id: string, completedAt: string, lines: PosSaleLine[], cashierName = 'سارة'): PosSale => ({
  id,
  number: `POS1-${id}`,
  registerId: 'r1',
  sessionId: 's1',
  cashierName,
  status: 'completed',
  stockSource: 'none',
  customer: { kind: 'walk_in' },
  lines,
  orderDiscount: null,
  totals: {
    subtotal: lines.reduce((a, l) => a + l.unitPrice * l.quantity, 0),
    discount: lines.reduce((a, l) => a + l.discountAmount, 0),
    tax: lines.reduce((a, l) => a + l.taxAmount, 0),
    total: lines.reduce((a, l) => a + l.total, 0),
  },
  payments: [
    {
      id: `pay-${id}`,
      kind: 'payment',
      method: 'cash',
      amount: lines.reduce((a, l) => a + l.total, 0),
      status: 'succeeded',
      reference: null,
      tendered: null,
      change: null,
      sessionId: 's1',
      createdAt: completedAt,
    },
  ],
  revisions: [],
  createdAt: completedAt,
  completedAt,
  cancelledAt: null,
  exceptionReason: null,
});

const data = (sales: PosSale[]): PosCompanyData => ({
  ...EMPTY_POS_DATA,
  registers: [
    { id: 'r1', name: 'الكاشير 1', code: 'POS1', branchId: null, branchName: null, warehouseName: null, isActive: true, createdAt: '', nextSequence: 1 },
  ],
  sales,
});

describe('sales report', () => {
  const first = sale('1', '2026-10-01T09:00:00', [
    line({ id: 'a', quantity: 2, unitPrice: 10, total: 20, unitCost: 7, costSource: 'purchase_price' }),
  ]);
  const second = sale('2', '2026-10-02T15:00:00', [
    line({ id: 'b', quantity: 3, unitPrice: 12, sourcePrice: 12, total: 36, unitCost: 9, costSource: 'purchase_price' }),
  ], 'خالد');

  it('profit uses the cost each sale had, not one cost for the item', () => {
    const t = totalsOf(lineFacts(data([first, second]), NO_FILTERS));
    expect(t.revenue).toBe(56);
    expect(t.cost).toBe(2 * 7 + 3 * 9);
    expect(t.profit).toBe(56 - 41);
    expect(t.margin).toBe(26.79);
    expect(t.invoices).toBe(2);
    expect(t.units).toBe(5);
  });

  it('a loss shows as a negative profit', () => {
    const atLoss = sale('3', '2026-10-03T10:00:00', [
      line({ id: 'c', quantity: 1, unitPrice: 5, total: 5, unitCost: 8 }),
    ]);
    expect(totalsOf(lineFacts(data([atLoss]), NO_FILTERS)).profit).toBe(-3);
  });

  it('a return takes its share of revenue and cost off the sale', () => {
    const withReturn = sale('4', '2026-10-03T10:00:00', [
      line({ id: 'd', quantity: 4, unitPrice: 10, total: 40, unitCost: 6, returnedQuantity: 1 }),
    ]);
    const t = totalsOf(lineFacts(data([withReturn]), NO_FILTERS));
    expect(t.revenue).toBe(30);
    expect(t.cost).toBe(18);
    expect(t.profit).toBe(12);
    expect(t.returned).toBe(10);
  });

  it('tax is not revenue; discounts lower it', () => {
    const taxed = sale('5', '2026-10-03T10:00:00', [
      line({ id: 'e', quantity: 1, unitPrice: 100, discountAmount: 10, taxAmount: 13.5, total: 103.5, unitCost: 50 }),
    ]);
    const t = totalsOf(lineFacts(data([taxed]), NO_FILTERS));
    expect(t.revenue).toBe(90);
    expect(t.tax).toBe(13.5);
    expect(t.discount).toBe(10);
    expect(t.profit).toBe(40);
  });

  it('revenue without a cost is kept apart from profit', () => {
    const old = sale('6', '2026-10-03T10:00:00', [line({ id: 'f', quantity: 1, total: 10 })]);
    const costed = sale('7', '2026-10-03T11:00:00', [line({ id: 'g', quantity: 1, total: 10, unitCost: 4 })]);
    const t = totalsOf(lineFacts(data([old, costed]), NO_FILTERS));
    expect(t.revenue).toBe(20);
    expect(t.costedRevenue).toBe(10);
    expect(t.uncostedRevenue).toBe(10);
    expect(t.profit).toBe(6);
  });

  it('filters by date, cashier and product; groups by cashier and day', () => {
    const d = data([first, second]);
    expect(lineFacts(d, { ...NO_FILTERS, from: '2026-10-02' })).toHaveLength(1);
    expect(lineFacts(d, { ...NO_FILTERS, cashierName: 'سارة' })[0]!.saleId).toBe('1');
    expect(lineFacts(d, { ...NO_FILTERS, product: 'شاي' })).toHaveLength(0);
    const byCashier = groupBy(lineFacts(d, NO_FILTERS), GROUPINGS.cashier);
    expect(byCashier.map((r) => [r.label, r.revenue, r.profit])).toEqual([
      ['خالد', 36, 9],
      ['سارة', 20, 6],
    ]);
    expect(groupBy(lineFacts(d, NO_FILTERS), GROUPINGS.day).map((r) => r.key).sort()).toEqual([
      '2026-10-01',
      '2026-10-02',
    ]);
  });

  it('payment rows sum what was collected for the kept sales', () => {
    const rows = paymentRows(data([first, second]), NO_FILTERS);
    expect(rows.find((r) => r.method === 'cash')).toMatchObject({ collected: 56, net: 56, count: 2 });
  });
});

/**
 * 500 = cash 300 + credit 200 to a contact; 80 collected in cash in the
 * shift, 20 by transfer outside any shift: 100 still owed, and the drawer
 * expects 50 + 300 + 80 = 430.
 */
describe('credit sales (آجل) in the reports and the shift', () => {
  const base = sale('9', '2026-11-07T10:00:00', [line({ id: 'x', quantity: 2, unitPrice: 250, total: 500 })]);
  const credit: PosSale = {
    ...base,
    customer: { kind: 'partner', partnerId: 'pt1', name: 'عميل الآجل' },
    splitPayment: true,
    payments: [
      { ...base.payments[0]!, id: 'p-cash', amount: 300, tendered: 300 },
      { ...base.payments[0]!, id: 'p-credit', method: 'credit', amount: 200 },
    ],
    credit: { partnerId: 'pt1', partnerName: 'عميل الآجل', amount: 200, collected: 100, returned: 0, due: 100 },
  };
  const collection = (id: string, method: PosCollection['method'], amount: number, sessionId: string | null): PosCollection => ({
    id,
    saleId: '9',
    saleNumber: 'POS1-9',
    partnerId: 'pt1',
    partnerName: 'عميل الآجل',
    method,
    amount,
    reference: method === 'cash' ? null : 'TR-77',
    sessionId,
    currency: null,
    createdAt: '2026-11-07T12:00:00',
    createdBy: 'سارة',
  });
  const session: PosSession = {
    id: 's1',
    registerId: 'r1',
    cashierId: 'u1',
    cashierName: 'سارة',
    status: 'open',
    stockMode: 'none',
    openedAt: '2026-11-07T08:00:00',
    openingFloat: 50,
    closedAt: null,
    countedCash: null,
    expectedCash: null,
    difference: null,
    differenceReason: null,
    denominationCounts: null,
  };
  const d: PosCompanyData = {
    ...data([credit]),
    sessions: [session],
    collections: [collection('c1', 'cash', 80, 's1'), collection('c2', 'transfer', 20, null)],
  };

  it('the invoice shows how it was split, and the customer by contact', () => {
    expect(paymentSummaryOf(credit)).toBe('نقد 300 + آجل 200');
    const facts = lineFacts(d, NO_FILTERS);
    expect(groupBy(facts, GROUPINGS.customer).map((r) => [r.key, r.label])).toEqual([['partner:pt1', 'عميل الآجل']]);
    expect(groupBy(facts, GROUPINGS.invoice)[0]!.detail).toContain('نقد 300 + آجل 200');
  });

  it('sold on credit is its own row, apart from the money taken', () => {
    const rows = paymentRows(d, NO_FILTERS);
    expect(rows.find((r) => r.method === 'cash')).toMatchObject({ collected: 300 });
    expect(rows.find((r) => r.method === 'credit')).toMatchObject({ collected: 200, label: 'آجل (على العملاء)' });
  });

  it('collections: 80 cash in the shift, 20 transfer outside; 100 still owed', () => {
    const rows = collectionsInPeriod(d, NO_FILTERS);
    expect(rows.map((r) => [r.method, r.amount, r.inShift, r.registerName])).toEqual([
      ['cash', 80, true, 'الكاشير 1'],
      ['transfer', 20, false, 'خارج الوردية'],
    ]);
    const byMethod = collectionsByMethod(rows);
    expect(byMethod.find((m) => m.method === 'cash')).toMatchObject({ inShift: 80, outside: 0, total: 80 });
    expect(byMethod.find((m) => m.method === 'transfer')).toMatchObject({ inShift: 0, outside: 20, total: 20 });
    expect(collectionsInPeriod(d, { ...NO_FILTERS, from: '2026-11-08' })).toHaveLength(0);
    expect(openReceivables(d, { ...NO_FILTERS, from: '2026-12-01' }).map((r) => r.due)).toEqual([100]);
    expect(creditInvoices(d, NO_FILTERS)[0]).toMatchObject({ credit: 200, collected: 100, due: 100 });
  });

  it('the drawer expects 50 + 300 + 80 = 430: credit and outside collections are not in it', () => {
    const summary = summarizeSession(d, session);
    expect(summary.expectedCash).toBe(430);
    expect(summary.collectionsByMethod).toEqual({ cash: 80 });
    expect(summary.byMethod).toMatchObject({ cash: 300, credit: 200 });
  });
});

/**
 * Closing differences: سارة 430 expected, 400 counted (short 30, "خطأ في الباقي");
 * سارة again 200 / 200; علي 150 expected, 160 counted (over 10). Shortage and
 * overage are summed apart (−30 and +10), never netted into a hidden −20 only.
 */
describe('closing differences report', () => {
  const closed = (
    id: string,
    cashierName: string,
    closedAt: string,
    expectedCash: number,
    countedCash: number,
    differenceReason: string | null = null,
  ): PosSession => ({
    id,
    registerId: 'r1',
    cashierId: cashierName,
    cashierName,
    status: 'closed',
    stockMode: 'none',
    openedAt: closedAt.replace('T22', 'T08'),
    openingFloat: 50,
    closedAt,
    countedCash,
    expectedCash,
    difference: Math.round((countedCash - expectedCash) * 100) / 100,
    differenceReason,
    denominationCounts: null,
  });
  const d: PosCompanyData = {
    ...EMPTY_POS_DATA,
    registers: [{ id: 'r1', name: 'الكاشير 1', code: 'POS1' } as PosCompanyData['registers'][number]],
    sessions: [
      closed('a', 'سارة', '2026-11-07T22:00:00', 430, 400, 'خطأ في الباقي'),
      closed('b', 'سارة', '2026-11-06T22:00:00', 200, 200),
      closed('c', 'علي', '2026-11-07T22:30:00', 150, 160, 'زيادة من عميل'),
      { ...closed('open', 'علي', '2026-11-07T22:00:00', 0, 0), status: 'open', closedAt: null },
    ],
  };

  it('lists closed shifts only, newest first, with the reason', () => {
    const rows = closingsInPeriod(d, NO_FILTERS);
    expect(rows.map((r) => r.sessionId)).toEqual(['c', 'a', 'b']);
    expect(rows[1]).toMatchObject({ expectedCash: 430, countedCash: 400, difference: -30, reason: 'خطأ في الباقي', registerName: 'الكاشير 1' });
  });

  it('shortage −30 and overage +10 are summed apart; net −20', () => {
    expect(closingTotals(closingsInPeriod(d, NO_FILTERS))).toEqual({
      shifts: 3,
      withDifference: 2,
      shortage: -30,
      overage: 10,
      net: -20,
      expected: 780,
      counted: 760,
    });
  });

  it('filters by closing day and cashier; per cashier the most short comes first', () => {
    expect(closingsInPeriod(d, { ...NO_FILTERS, from: '2026-11-07', to: '2026-11-07' }).map((r) => r.sessionId)).toEqual(['c', 'a']);
    expect(closingsInPeriod(d, { ...NO_FILTERS, cashierName: 'علي' }).map((r) => r.sessionId)).toEqual(['c']);
    const byCashier = closingsByCashier(closingsInPeriod(d, NO_FILTERS));
    expect(byCashier.map((c) => [c.cashierName, c.shifts, c.shortage, c.overage])).toEqual([
      ['سارة', 2, -30, 0],
      ['علي', 1, 0, 10],
    ]);
  });
});