import { apiRequest } from '@/features/hr/lib/api/client';
import { resolveStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';

/**
 * The store's own quantity (phase 3): used when the company sells without
 * inventory (no store-stock-sync bridge). A product or variant with a level
 * is tracked — deducted when an order is placed, the order refused when short.
 */
export type StoreStockLevel = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  updatedAt: string;
  updatedBy: string | null;
};

const base = (companyId: string) =>
  `/store-admin/companies/${resolveStorefrontCompanyId(companyId)}/stock-levels`;

/** After the inventory link was disabled: the local quantities wait for an approved opening. */
export type StoreStockOpening = {
  state: 'ready' | 'needs_opening';
  levels: StoreStockLevel[];
};

export const storeStockOpeningApi = {
  get(companyId: string): Promise<StoreStockOpening> {
    return apiRequest<StoreStockOpening>(`${base(companyId)}/opening`, { throwOnError: true });
  },
  approve(
    companyId: string,
    levels: Array<{ productId: string; variantId?: string | null; quantity: number }>,
  ): Promise<StoreStockOpening> {
    return apiRequest<StoreStockOpening>(`${base(companyId)}/opening`, {
      method: 'POST',
      throwOnError: true,
      body: { levels },
    });
  },
};
