'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { useStorefrontWishlistUi } from '@/features/ecommerce/storefront/hooks/use-storefront-wishlist-ui';
import { storefrontProductsRepository } from '@/features/ecommerce/storefront/lib/repositories/products-repository';
import { getPublicStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import type { StorefrontLocale } from '@/i18n/routing';

export function useStorefrontWishlistProducts() {
  const locale = useLocale() as StorefrontLocale;
  const companyId = getPublicStorefrontCompanyId();
  const productIds = useStorefrontWishlistUi((state) => state.productIds);

  return useQuery({
    queryKey: ['storefront', 'wishlist-products', companyId, locale, productIds],
    queryFn: () => storefrontProductsRepository.getByIds(companyId, productIds, locale),
    enabled: productIds.length > 0,
    staleTime: 30_000,
  });
}
