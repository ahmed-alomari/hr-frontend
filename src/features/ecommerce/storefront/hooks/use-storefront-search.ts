'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { STOREFRONT_KEYS } from '@/features/ecommerce/storefront/hooks/query-keys';
import { storefrontSearchRepository } from '@/features/ecommerce/storefront/lib/repositories/search-repository';
import { useStorefrontCompanyId } from '@/features/ecommerce/storefront/components/storefront-company-provider';
import type { StorefrontLocale } from '@/i18n/routing';

export function storefrontSearchQueryFn(companyId: string, locale: StorefrontLocale, query: string) {
  return storefrontSearchRepository.search(companyId, locale, query);
}

export function useStorefrontSearch(query: string, enabled = true) {
  const companyId = useStorefrontCompanyId();
  const locale = useLocale() as StorefrontLocale;
  const trimmed = query.trim();

  return useQuery({
    queryKey: STOREFRONT_KEYS.search(companyId, locale, trimmed),
    queryFn: () => storefrontSearchQueryFn(companyId, locale, trimmed),
    enabled: enabled && trimmed.length > 0,
    staleTime: 30_000,
  });
}
