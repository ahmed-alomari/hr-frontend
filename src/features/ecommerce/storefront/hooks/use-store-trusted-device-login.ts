'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { clientStorefrontData } from '@/features/ecommerce/storefront/lib/client-storefront-data';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import type { StorefrontLocale } from '@/i18n/routing';

/** The store setting: customers sign in without the password from a trusted device. */
export function useStoreTrustedDeviceLogin(): boolean {
  const locale = useLocale() as StorefrontLocale;
  const { data } = useQuery({
    queryKey: ['storefront', 'trusted-device-login', getStorefrontCompanyId(), locale],
    queryFn: async () =>
      (await clientStorefrontData.getConfig(locale))?.trustedDeviceLogin === true,
    staleTime: 10 * 60_000,
  });
  return data === true;
}
