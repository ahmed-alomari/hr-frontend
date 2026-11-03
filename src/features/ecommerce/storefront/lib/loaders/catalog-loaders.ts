import { cache } from 'react';
import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import {
  storefrontProductsRepository,
  type StorefrontProductListQuery,
} from '@/features/ecommerce/storefront/lib/repositories/products-repository';
import { storefrontBrandsRepository } from '@/features/ecommerce/storefront/lib/repositories/brands-repository';
import { storefrontCategoriesRepository } from '@/features/ecommerce/storefront/lib/repositories/categories-repository';
import { getPublicStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import type {
  StorefrontBrand,
  StorefrontCategory,
  StorefrontPaginated,
  StorefrontProduct,
} from '@/features/ecommerce/storefront/domain/storefront-models';
import type { StorefrontLocale } from '@/i18n/routing';

export const getStorefrontProductBySlug = cache(async (slug: string): Promise<StorefrontProduct> => {
  const locale = (await getLocale()) as StorefrontLocale;
  const companyId = getPublicStorefrontCompanyId();
  const product = await storefrontProductsRepository.getBySlug(companyId, slug, locale);
  if (!product) notFound();
  return product;
});

export const getStorefrontBrandBySlug = cache(async (slug: string): Promise<StorefrontBrand> => {
  const locale = (await getLocale()) as StorefrontLocale;
  const companyId = getPublicStorefrontCompanyId();
  const brand = await storefrontBrandsRepository.getBySlug(companyId, slug, locale);
  if (!brand) notFound();
  return brand;
});

export const getStorefrontProductsByIds = cache(async (ids: string[]): Promise<StorefrontProduct[]> => {
  const locale = (await getLocale()) as StorefrontLocale;
  const companyId = getPublicStorefrontCompanyId();
  return storefrontProductsRepository.getByIds(companyId, ids, locale);
});

type ProductListOptions = Omit<StorefrontProductListQuery, 'companyId' | 'locale'>;

export const getStorefrontProductsList = cache(
  async (options: ProductListOptions): Promise<StorefrontPaginated<StorefrontProduct>> => {
    const locale = (await getLocale()) as StorefrontLocale;
    const companyId = getPublicStorefrontCompanyId();
    return storefrontProductsRepository.list({ companyId, locale, ...options });
  },
);

export const getStorefrontCatalogProducts = cache(async (limit = 100): Promise<StorefrontProduct[]> => {
  const result = await getStorefrontProductsList({ limit });
  return result.items;
});

export const getStorefrontBrandsList = cache(
  async (options?: { page?: number; limit?: number; search?: string }): Promise<StorefrontPaginated<StorefrontBrand>> => {
    const locale = (await getLocale()) as StorefrontLocale;
    const companyId = getPublicStorefrontCompanyId();
    return storefrontBrandsRepository.list({ companyId, locale, ...options });
  },
);

export const getStorefrontCategoriesList = cache(
  async (options?: { page?: number; limit?: number; search?: string }): Promise<StorefrontPaginated<StorefrontCategory>> => {
    const locale = (await getLocale()) as StorefrontLocale;
    const companyId = getPublicStorefrontCompanyId();
    return storefrontCategoriesRepository.list({ companyId, locale, ...options });
  },
);

export const getStorefrontCategoryById = cache(async (id: string): Promise<StorefrontCategory | null> => {
  const locale = (await getLocale()) as StorefrontLocale;
  const companyId = getPublicStorefrontCompanyId();
  return storefrontCategoriesRepository.getById(companyId, id, locale);
});
