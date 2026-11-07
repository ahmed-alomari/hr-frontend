import { buildDefaultWarehouseLocations } from '@/features/inventory/admin/warehouses/lib/default-warehouse-locations';
import type { Warehouse } from '@/features/inventory/domain/types/warehouse';

const warehouse: Warehouse = {
  id: 'wh-1',
  companyId: '76e5bc4f-5adb-434d-a886-bcff05a9680b',
  code: 'WH',
  nameAr: 'المستودع الرئيسي',
  status: 'active',
  incomingSteps: 1,
  outgoingSteps: 1,
  buyToResupply: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('buildDefaultWarehouseLocations', () => {
  it('seeds the fixed locations per warehouse', () => {
    const drafts = buildDefaultWarehouseLocations(warehouse);

    expect(drafts.map((item) => item.code)).toEqual([
      'WH/Customers',
      'WH/Inventory adjustment',
      'WH/Production',
      'WH/Vendors',
      'WH',
      'WH/Stock',
      'WH/Transit',
    ]);

    expect(drafts.map((item) => item.locationType)).toEqual([
      'customer',
      'inventory',
      'production',
      'supplier',
      'view',
      'internal',
      'transit',
    ]);

    const stock = drafts.find((item) => item.tempKey === 'stock');
    expect(stock?.parentTempKey).toBe('view');
    const transit = drafts.find((item) => item.tempKey === 'transit');
    expect(transit?.parentTempKey).toBe('view');
    expect(drafts.every((item) => item.isSystem)).toBe(true);
  });
});
