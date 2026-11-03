'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { useStorefrontCartUi } from '@/features/ecommerce/storefront/hooks/use-storefront-cart-ui';
import { storefrontProductsRepository } from '@/features/ecommerce/storefront/lib/repositories/products-repository';
import { getPublicStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import type { StorefrontLocale } from '@/i18n/routing';

export function useStorefrontCartProducts() {
  const locale = useLocale() as StorefrontLocale;
  const companyId = getPublicStorefrontCompanyId();
  const lines = useStorefrontCartUi((state) => state.lines);
  const productIds = lines.map((line) => line.productId);

  return useQuery({
    queryKey: ['storefront', 'cart-products', companyId, locale, productIds],
    queryFn: () => storefrontProductsRepository.getByIds(companyId, productIds, locale),
    enabled: productIds.length > 0,
    staleTime: 30_000,
  });
}
