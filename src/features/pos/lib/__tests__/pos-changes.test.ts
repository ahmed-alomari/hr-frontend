jest.mock('@/shared/api/client', () => ({ apiRequest: jest.fn() }));

import { highestDiscountPercent } from '@/features/pos/lib/calc';
import { menuCategoryReport } from '@/features/pos/lib/menu-category-report';
import { NO_FILTERS, lineFacts } from '@/features/pos/lib/sales-report';
import { EMPTY_POS_DATA, mergePosChanges, type PosCompanyData } from '@/features/pos/lib/pos-store';
import type { PosSale, PosSaleLine } from '@/features/pos/domain/types';

const sale = (id: string, status = 'completed', lines: Partial<PosSaleLine>[] = []) =>
  ({ id, status, createdAt: '2026-11-09T10:00:00Z', completedAt: '2026-11-09T10:00:00Z', lines }) as unknown as PosSale;

const withSales = (sales: PosSale[], extra: Partial<PosCompanyData> = {}): PosCompanyData => ({ ...EMPTY_POS_DATA, sales, ...extra });

describe('mergePosChanges', () => {
  it('replaces a record the screen holds, adds a new one first, and keeps the rest', () => {
    const held = withSales([sale('old'), sale('kept')]);
    const merged = mergePosChanges(held, withSales([sale('old', 'cancelled'), sale('new')]));
    expect(merged.sales.map((s) => [s.id, s.status])).toEqual([
      ['new', 'completed'],
      ['old', 'cancelled'],
      ['kept', 'completed'],
    ]);
  });

  it('takes the state and the cursor from the answer, and is no longer a partial answer', () => {
    const merged = mergePosChanges(withSales([], { syncedAt: 'a', returnSequence: 1 }), withSales([], { syncedAt: 'b', returnSequence: 7, changedOnly: true }));
    expect(merged.syncedAt).toBe('b');
    expect(merged.returnSequence).toBe(7);
    expect(merged.changedOnly).toBeUndefined();
  });

  it('a screen that holds nothing yet keeps what arrived', () => {
    expect(mergePosChanges(undefined, withSales([sale('a')])).sales).toHaveLength(1);
  });
});

describe('highestDiscountPercent', () => {
  const line = (unitPrice: number, quantity: number, discount: PosSaleLine['discount'] = null) => ({ unitPrice, quantity, discount });

  it('measures each line on its gross and the sale discount on the net of the lines', () => {
    expect(highestDiscountPercent([line(100, 1, { type: 'percent', value: 20 })], null)).toBe(20);
    // 100 − 50 = 50 net: an amount of 25 off the sale is 50%, not 25%.
    expect(highestDiscountPercent([line(100, 1, { type: 'amount', value: 50 })], { type: 'amount', value: 25 })).toBe(50);
    expect(highestDiscountPercent([line(100, 1)], null)).toBe(0);
  });
});

describe('the cost in the reports', () => {
  const line = (over: Partial<PosSaleLine>) =>
    ({ id: 'l', productId: 'p', variantId: null, name: 'x', variantName: null, sku: 's', quantity: 3, returnedQuantity: 0, unitPrice: 5, sourcePrice: 5, discount: null, discountAmount: 0, taxRate: 0, taxAmount: 0, total: 15, ...over }) as PosSaleLine;
  const facts = (over: Partial<PosSaleLine>) =>
    lineFacts(
      withSales([{ ...sale('s'), number: 'N', registerId: 'r', sessionId: 'x', cashierName: 'c', customer: { kind: 'walk_in' }, payments: [], currency: 'YER', lines: [line(over)] } as unknown as PosSale]),
      NO_FILTERS,
    )[0];

  it('3 units worth 10.00: the total inventory charged, not 3 × 3.3333', () => {
    expect(facts({ unitCost: 3.3333, costTotal: 10 }).cost).toBe(10);
    expect(facts({ unitCost: 3.3333 }).cost).toBe(10);
  });

  it('a return takes its share of that total', () => {
    expect(facts({ unitCost: 3.3333, costTotal: 10, returnedQuantity: 3 }).cost).toBe(0);
    expect(facts({ unitCost: 5, costTotal: 15, returnedQuantity: 1 }).cost).toBe(10);
  });
});

describe('menuCategoryReport', () => {
  const lines: Partial<PosSaleLine>[] = [
    { menuCategoryId: 'drinks', menuCategoryName: 'مشروبات', quantity: 4, returnedQuantity: 1, total: 400 },
    { menuCategoryId: null, quantity: 1, returnedQuantity: 0, total: 50 },
  ];
  const categories = [
    { id: 'drinks', name: 'مشروبات', productCount: 3, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'empty', name: 'حلويات', productCount: 0 },
  ];

  it('nets returns out, lists a group that sold nothing, and puts lines of no group last', () => {
    const rows = menuCategoryReport(categories, [sale('s1', 'completed', lines)], null);
    expect(rows.map((r) => r.name)).toEqual(['مشروبات', 'حلويات', 'بلا فئة']);
    expect(rows[0]).toMatchObject({ productCount: 3, soldQuantity: 4, returnedQuantity: 1, netSales: 300, invoices: 1 });
    expect(rows[1]).toMatchObject({ soldQuantity: 0, netSales: 0, invoices: 0 });
  });

  it('counts only completed sales in the period', () => {
    const rows = menuCategoryReport(categories, [sale('open', 'awaiting_payment', lines), sale('old', 'completed', lines)], '2026-11-10T00:00:00Z');
    expect(rows.find((r) => r.id === 'drinks')?.soldQuantity).toBe(0);
  });
});
