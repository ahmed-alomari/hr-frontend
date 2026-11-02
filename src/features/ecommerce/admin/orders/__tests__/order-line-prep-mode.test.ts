import {
  orderLinePrepNote,
  resolveOrderLinePrepMode,
} from '@/features/ecommerce/admin/orders/lib/order-line-prep-mode';

describe('resolveOrderLinePrepMode (decided by the order, not by settings)', () => {
  it('keeps the source the order was placed with', () => {
    expect(resolveOrderLinePrepMode('inventory')).toBe('inventory');
    expect(resolveOrderLinePrepMode('local')).toBe('local');
    expect(resolveOrderLinePrepMode('none')).toBe('none');
  });

  it('treats an older order without a source as unresolved', () => {
    expect(resolveOrderLinePrepMode('unresolved')).toBe('unresolved');
    expect(resolveOrderLinePrepMode(null)).toBe('unresolved');
    expect(resolveOrderLinePrepMode(undefined)).toBe('unresolved');
  });
});

describe('orderLinePrepNote', () => {
  it('inventory order with a tracked product: allocate (no note)', () => {
    expect(orderLinePrepNote('inventory', true)).toBeNull();
  });

  it('inventory order with an untracked product: not deducted', () => {
    expect(orderLinePrepNote('inventory', false)).toContain('تتبع المخزون معطّل');
  });

  it('local order: from the store quantity, never "tracking disabled"', () => {
    const note = orderLinePrepNote('local', true);
    expect(note).toContain('يُصرف من كمية المنتج');
    expect(note).not.toContain('تتبع المخزون معطّل');
  });

  it('unresolved order: choose the source first', () => {
    expect(orderLinePrepNote('unresolved', true)).toContain('تبويب «المخزون»');
  });
});
