'use server';

import type {
  PlaceOrderInput,
  StorefrontCustomerOrder,
  StorefrontOrderStatus,
} from '@/features/ecommerce/storefront/domain/checkout';
import { storefrontOrdersRepository } from '@/features/ecommerce/storefront/lib/repositories/storefront-orders-repository';
import { getPublicStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { StoreHttpError } from '@/features/ecommerce/storefront/lib/api/store-http';
import {
  STORE_CURRENCY_MISMATCH_ERROR,
  isProductStoreCurrencyMismatch,
} from '@/features/ecommerce/domain/constants/store-currency';
import {
  STORE_COUNTRY_UNAVAILABLE_ERROR,
  STORE_INVENTORY_UNAVAILABLE_ERROR,
  STORE_STOCK_SHORT_ERROR,
  isStoreInventoryUnavailable,
  isStoreStockShort,
  isStoreCountryUnavailable,
} from '@/features/ecommerce/domain/constants/store-checkout-errors';
import type { OrderStatus } from '@/features/ecommerce/domain/types/order';

export type PlaceStorefrontOrderResult =
  | { ok: true; order: StorefrontCustomerOrder }
  | { ok: false; error: string };

export async function placeStorefrontOrder(
  input: Omit<PlaceOrderInput, 'companyId'>,
): Promise<PlaceStorefrontOrderResult> {
  const companyId = getPublicStorefrontCompanyId();
  const address = input.address;

  if (
    !address.fullName.trim() ||
    !address.phone.trim() ||
    !address.city.trim() ||
    !address.district.trim() ||
    !address.street.trim()
  ) {
    return { ok: false, error: 'INVALID_ADDRESS' };
  }

  if (input.lines.length === 0) {
    return { ok: false, error: 'EMPTY_CART' };
  }

  try {
    const order = await storefrontOrdersRepository.placeOrder({
      ...input,
      companyId,
      address: {
        fullName: address.fullName.trim(),
        phone: address.phone.trim(),
        countryId: address.countryId ?? null,
        cityId: address.cityId ?? null,
        districtId: address.districtId ?? null,
        city: address.city.trim(),
        district: address.district.trim(),
        street: address.street.trim(),
        notes: address.notes?.trim() || undefined,
        lat: address.lat,
        lng: address.lng,
        mapAddress: address.mapAddress?.trim() || undefined,
      },
      customerNote: input.customerNote?.trim() || null,
    });
    return { ok: true, order };
  } catch (error) {
    if (error instanceof StoreHttpError) {
      if (isStoreStockShort(error.payload, error.message)) {
        return { ok: false, error: STORE_STOCK_SHORT_ERROR };
      }
      if (isStoreInventoryUnavailable(error.payload)) {
        return { ok: false, error: STORE_INVENTORY_UNAVAILABLE_ERROR };
      }
      if (
        error.message === STORE_CURRENCY_MISMATCH_ERROR ||
        isProductStoreCurrencyMismatch(error.message)
      ) {
        return { ok: false, error: STORE_CURRENCY_MISMATCH_ERROR };
      }
      if (
        error.message === STORE_COUNTRY_UNAVAILABLE_ERROR ||
        isStoreCountryUnavailable(error.message)
      ) {
        return { ok: false, error: STORE_COUNTRY_UNAVAILABLE_ERROR };
      }
      // No answer (network, timeout): the generic "try again" message.
      if (error.status === 0) return { ok: false, error: '' };
      return { ok: false, error: error.message };
    }
    if (error instanceof Error && error.message) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: 'ORDER_CREATE_FAILED' };
  }
}

export async function getStorefrontOrderByNumber(
  orderNumber: string,
  options?: { phone?: string | null; accessToken?: string | null },
): Promise<StorefrontCustomerOrder | null> {
  const companyId = getPublicStorefrontCompanyId();
  return storefrontOrdersRepository.getByOrderNumber(companyId, orderNumber, options);
}

export async function getStorefrontOrdersByNumbers(
  lookups: Array<string | { orderNumber: string; phone?: string | null }>,
): Promise<StorefrontCustomerOrder[]> {
  const companyId = getPublicStorefrontCompanyId();
  const unique = new Map<string, { orderNumber: string; phone?: string | null }>();
  for (const entry of lookups) {
    if (typeof entry === 'string') {
      const orderNumber = entry.trim();
      if (orderNumber) unique.set(orderNumber, { orderNumber });
    } else {
      const orderNumber = entry.orderNumber.trim();
      if (orderNumber) unique.set(orderNumber, { orderNumber, phone: entry.phone });
    }
  }
  const orders: StorefrontCustomerOrder[] = [];
  for (const lookup of unique.values()) {
    const order = await storefrontOrdersRepository.getByOrderNumber(
      companyId,
      lookup.orderNumber,
      { phone: lookup.phone },
    );
    if (order) orders.push(order);
  }
  return orders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function toStorefrontStatus(status: OrderStatus): StorefrontOrderStatus {
  if (status === 'refunded') return 'cancelled';
  return status;
}

/** Sync dashboard status changes onto the customer tracking page. */
export async function syncStorefrontOrderStatus(input: {
  orderId?: string;
  orderNumber?: string;
  status: OrderStatus;
}): Promise<StorefrontCustomerOrder | null> {
  const companyId = getPublicStorefrontCompanyId();
  const status = toStorefrontStatus(input.status);

  if (input.orderNumber?.trim()) {
    const byNumber = await storefrontOrdersRepository.updateStatus(
      companyId,
      input.orderNumber.trim(),
      status,
    );
    if (byNumber) return byNumber;
  }

  if (input.orderId?.trim()) {
    return storefrontOrdersRepository.updateStatusById(companyId, input.orderId.trim(), status);
  }

  return null;
}
