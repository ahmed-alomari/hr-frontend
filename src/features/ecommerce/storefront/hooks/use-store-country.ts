'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import {
  DEFAULT_STORE_COUNTRY,
  type StoreCountry,
} from '@/features/ecommerce/domain/constants/store-country';
import { clientStorefrontData } from '@/features/ecommerce/storefront/lib/client-storefront-data';
import { getPublicStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import type { StorefrontLocale } from '@/i18n/routing';

/**
 * The store's country (the company's base country): mobile rules, map region,
 * addresses. `initial` is the server config when the page has it.
 */
export function useStoreCountry(initial?: StoreCountry): StoreCountry {
  const locale = useLocale() as StorefrontLocale;
  const { data } = useQuery({
    queryKey: ['storefront', 'country', getPublicStorefrontCompanyId(), locale],
    queryFn: async () => (await clientStorefrontData.getConfig(locale))?.country ?? null,
    enabled: !initial,
    staleTime: 10 * 60_000,
  });
  return initial ?? data ?? DEFAULT_STORE_COUNTRY;
}
