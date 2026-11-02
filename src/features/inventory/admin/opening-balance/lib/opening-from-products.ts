import { apiRequest } from '@/features/hr/lib/api/client';

/**
 * Products → inventory (backend decisions.md §21.2): the product quantities
 * at each item's purchase price, as a warehouse's opening. Items the
 * warehouse already moved are left out; nothing is written by the preview.
 */
export type OpeningFromProductsPreview = {
  warehouseId: string;
  lines: Array<{
    productId: string;
    variantId: string | null;
    name: string;
    quantity: number;
    unitCost: number | null;
  }>;
  skipped: Array<{
    productId: string;
    variantId: string | null;
    name: string;
    quantity: number;
    reason: 'zero' | 'warehouse_has_moves';
  }>;
  blockers: Array<'channels_linked' | 'nothing_to_move'>;
  canCreate: boolean;
};

const path = '/inventory/opening-imports/from-products';

export const openingFromProductsApi = {
  preview(companyId: string, warehouseId: string): Promise<OpeningFromProductsPreview> {
    return apiRequest<OpeningFromProductsPreview>(path, {
      query: { companyId, warehouseId },
      throwOnError: true,
    });
  },
  /** A draft opening document; stock moves when it is posted. */
  create(
    companyId: string,
    warehouseId: string,
  ): Promise<{ operationId: string; reference: string; lines: number }> {
    return apiRequest<{ operationId: string; reference: string; lines: number }>(path, {
      method: 'POST',
      throwOnError: true,
      body: { companyId, warehouseId },
    });
  },
};
