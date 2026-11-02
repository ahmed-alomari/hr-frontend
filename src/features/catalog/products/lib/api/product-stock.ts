import { apiRequest } from '@/features/hr/lib/api/client';

/**
 * The product's own quantity (backend decisions.md §21): the one quantity the
 * channels not linked to inventory sell from — the store and the point of
 * sale take from the same number. A product or variant with a level is
 * tracked (deducted on sale, the sale refused when short); without one it is
 * not tracked.
 */
export type ProductStockLevel = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  updatedAt: string;
  updatedBy: string | null;
};

const base = (productId: string) => `/inventory/products/${productId}/stock-levels`;

export const productStockApi = {
  list(productId: string): Promise<ProductStockLevel[]> {
    return apiRequest<ProductStockLevel[]>(base(productId), { throwOnError: true });
  },

  set(
    productId: string,
    input: { variantId?: string | null; quantity: number },
  ): Promise<ProductStockLevel> {
    return apiRequest<ProductStockLevel>(base(productId), {
      method: 'PUT',
      throwOnError: true,
      body: input,
    });
  },

  async remove(productId: string, levelId: string): Promise<void> {
    await apiRequest<void>(`${base(productId)}/${levelId}`, {
      method: 'DELETE',
      throwOnError: true,
    });
  },
};
