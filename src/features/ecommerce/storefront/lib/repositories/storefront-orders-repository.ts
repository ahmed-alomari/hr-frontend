import type {
  PlaceOrderInput,
  StorefrontCustomerOrder,
  StorefrontOrderStatus,
} from '@/features/ecommerce/storefront/domain/checkout';
import { isStoreHttpEnabled } from '@/features/ecommerce/storefront/lib/api/store-http';
import {
  fetchPartnerStoreOrders,
  fetchPublicStoreOrder,
  placePublicStoreOrder,
} from '@/features/ecommerce/shared/lib/api/store-orders-api';

/**
 * Customer-facing storefront orders — HTTP only (store-frontend-binding.md §3).
 */
export const storefrontOrdersRepository = {
  async placeOrder(
    input: PlaceOrderInput,
    clientHeaders?: Record<string, string>,
  ): Promise<StorefrontCustomerOrder> {
    if (input.lines.length === 0) {
      throw new Error('EMPTY_CART');
    }
    if (!isStoreHttpEnabled()) {
      throw new Error('STORE_HTTP_DISABLED');
    }
    return placePublicStoreOrder(input, input.accessToken, clientHeaders);
  },

  async getByOrderNumber(
    companyId: string,
    orderNumber: string,
    options?: {
      phone?: string | null;
      accessToken?: string | null;
      clientHeaders?: Record<string, string>;
    },
  ): Promise<StorefrontCustomerOrder | null> {
    if (!isStoreHttpEnabled()) return null;
    return fetchPublicStoreOrder({
      companyId,
      orderNumber,
      phone: options?.phone,
      partnerToken: options?.accessToken,
      clientHeaders: options?.clientHeaders,
    });
  },

  async listForPartner(
    accessToken: string,
    options?: { page?: number; limit?: number; status?: string },
  ): Promise<StorefrontCustomerOrder[]> {
    if (!isStoreHttpEnabled() || !accessToken) return [];
    const page = await fetchPartnerStoreOrders({
      accessToken,
      page: options?.page ?? 1,
      limit: options?.limit ?? 50,
      status: options?.status,
    });
    return page.items;
  },

  /** @deprecated Use listForPartner — company scope comes from the partner token. */
  async listByCompany(_companyId: string): Promise<StorefrontCustomerOrder[]> {
    return [];
  },

  async updateStatus(
    _companyId: string,
    _orderNumber: string,
    _status: StorefrontOrderStatus,
  ): Promise<StorefrontCustomerOrder | null> {
    return null;
  },

  async updateStatusById(
    _companyId: string,
    _orderId: string,
    _status: StorefrontOrderStatus,
  ): Promise<StorefrontCustomerOrder | null> {
    return null;
  },
};
