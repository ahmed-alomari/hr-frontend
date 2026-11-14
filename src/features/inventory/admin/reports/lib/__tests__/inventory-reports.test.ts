jest.mock('@/shared/api/client', () => ({ apiRequest: jest.fn() }));

import { apiRequest } from '@/shared/api/client';
import { inventoryReportsApi } from '@/features/inventory/admin/reports/lib/api/inventory-reports';
import { valueHiddenMessage } from '@/features/inventory/admin/reports/lib/report-shared';

const mockedRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

const header = {
  companyId: 'c1',
  warehouseId: null,
  dateFrom: '2026-10-01',
  dateTo: '2026-10-31',
  valueVisible: true,
  valueHiddenReason: null,
  currency: 'SAR',
};

describe('inventoryReportsApi', () => {
  beforeEach(() => mockedRequest.mockReset());

  it('maps the periodic movement figures and keeps one key per item', async () => {
    mockedRequest.mockResolvedValueOnce({
      ...header,
      items: [
        {
          productId: 'p1',
          variantId: null,
          productName: 'صنف',
          variantName: null,
          sku: 'SKU-1',
          categoryName: null,
          openingQty: '10.0000',
          inQty: '10.0000',
          outQty: '7.0000',
          closingQty: '13.0000',
          openingValue: '100.00000000',
          inValue: '200.00000000',
          outValue: '105.00000000',
          closingValue: '195.00000000',
        },
      ],
      totals: { openingQty: '10', inQty: '10', outQty: '7', closingQty: '13', openingValue: '100', inValue: '200', outValue: '105', closingValue: '195' },
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    const report = await inventoryReportsApi.stockMovement({ companyId: 'c1', dateFrom: '2026-10-01', dateTo: '2026-10-31' });

    expect(mockedRequest).toHaveBeenCalledWith(
      '/inventory/reports/stock-movement',
      expect.objectContaining({ throwOnError: true, query: expect.objectContaining({ companyId: 'c1', page: 1, limit: 50 }) }),
    );
    expect(report.items[0]).toMatchObject({
      key: 'p1:',
      openingQty: 10,
      inQty: 10,
      outQty: 7,
      closingQty: 13,
      closingValue: 195,
    });
    expect(report.totals.closingValue).toBe(195);
  });

  it('keeps hidden values as null, not zero', async () => {
    mockedRequest.mockResolvedValueOnce({
      ...header,
      warehouseId: 'w1',
      valueVisible: false,
      valueHiddenReason: 'company_average',
      items: [
        { productId: 'p1', variantId: 'v1', productName: 'صنف', openingQty: '1', inQty: '0', outQty: '0', closingQty: '1', openingValue: null, inValue: null, outValue: null, closingValue: null },
      ],
      totals: { openingQty: '1', inQty: '0', outQty: '0', closingQty: '1', openingValue: null, inValue: null, outValue: null, closingValue: null },
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    const report = await inventoryReportsApi.stockMovement({ companyId: 'c1', warehouseId: 'w1' });

    expect(report.valueVisible).toBe(false);
    expect(report.items[0]!.key).toBe('p1:v1');
    expect(report.items[0]!.closingValue).toBeNull();
    expect(report.totals.closingValue).toBeNull();
  });

  it('maps the item card running balance', async () => {
    mockedRequest.mockResolvedValueOnce({
      ...header,
      productId: 'p1',
      variantId: null,
      productName: 'صنف',
      variantName: null,
      sku: null,
      opening: { qty: '20.0000', value: '300.00000000' },
      totals: { inQty: '0', outQty: '7', inValue: '0', outValue: '105' },
      closing: { qty: '13.0000', value: '195.00000000' },
      items: [
        { key: 'l1', occurredAt: '2026-10-20T09:00:00.000Z', operationId: 'o1', reference: 'WH/OUT/1', kind: 'issue', isUndo: false, inQty: '0', outQty: '5', balanceQty: '15', valueDelta: '-75', unitCost: '15', balanceValue: '225' },
      ],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });

    const card = await inventoryReportsApi.itemCard({ companyId: 'c1', productId: 'p1' });

    expect(card.opening).toEqual({ qty: 20, value: 300 });
    expect(card.closing).toEqual({ qty: 13, value: 195 });
    expect(card.items[0]).toMatchObject({ outQty: 5, balanceQty: 15, valueDelta: -75, unitCost: 15, balanceValue: 225, partnerName: null });
  });
});

describe('valueHiddenMessage', () => {
  it('explains each reason, and nothing when values are shown', () => {
    expect(valueHiddenMessage({ valueHiddenReason: null, warehouseId: null })).toBeNull();
    expect(valueHiddenMessage({ valueHiddenReason: 'no_permission', warehouseId: null })).toContain('صلاحية');
    expect(valueHiddenMessage({ valueHiddenReason: 'costing_disabled', warehouseId: null })).toContain('غير مفعّل');
    expect(valueHiddenMessage({ valueHiddenReason: 'company_average', warehouseId: 'w1' })).toContain('كل المستودعات');
    expect(valueHiddenMessage({ valueHiddenReason: 'company_average', warehouseId: null })).toContain('فروع');
  });
});
