import { cache } from 'react';
import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { storefrontCategoriesRepository } from '@/features/ecommerce/storefront/lib/repositories/categories-repository';
import { getPublicStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import type { StorefrontCategory } from '@/features/ecommerce/storefront/domain/storefront-models';
import type { StorefrontLocale } from '@/i18n/routing';

export const getStorefrontNavCategories = cache(async (): Promise<StorefrontCategory[]> => {
  const locale = (await getLocale()) as StorefrontLocale;
  const companyId = getPublicStorefrontCompanyId();
  const result = await storefrontCategoriesRepository.list({ companyId, locale, limit: 200 });
  return result.items;
});

export const getStorefrontCategoryBySlug = cache(async (slug: string): Promise<StorefrontCategory> => {
  const locale = (await getLocale()) as StorefrontLocale;
  const companyId = getPublicStorefrontCompanyId();
  const category = await storefrontCategoriesRepository.getBySlug(companyId, slug, locale);
  if (!category) notFound();
  return category;
});
