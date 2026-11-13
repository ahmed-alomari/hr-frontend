import { cache } from 'react';
import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { storefrontCategoriesRepository } from '@/features/ecommerce/storefront/lib/repositories/categories-repository';
import { getRequestStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company.server';
import type { StorefrontCategory } from '@/features/ecommerce/storefront/domain/storefront-models';
import type { StorefrontLocale } from '@/i18n/routing';

export const getStorefrontNavCategories = cache(async (): Promise<StorefrontCategory[]> => {
  const locale = (await getLocale()) as StorefrontLocale;
  const companyId = await getRequestStorefrontCompanyId();
  const result = await storefrontCategoriesRepository.list({ companyId, locale, limit: 200 });
  return result.items;
});

export const getStorefrontCategoryBySlug = cache(async (slug: string): Promise<StorefrontCategory> => {
  const locale = (await getLocale()) as StorefrontLocale;
  const companyId = await getRequestStorefrontCompanyId();
  const category = await storefrontCategoriesRepository.getBySlug(companyId, slug, locale);
  if (!category) notFound();
  return category;
});
