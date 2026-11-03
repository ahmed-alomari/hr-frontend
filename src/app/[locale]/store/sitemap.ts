import type { MetadataRoute } from 'next';
import { publicConfig } from '@/shared/config';
import { storefrontProductsRepository } from '@/features/ecommerce/storefront/lib/repositories/products-repository';
import { storefrontCategoriesRepository } from '@/features/ecommerce/storefront/lib/repositories/categories-repository';
import { storefrontBrandsRepository } from '@/features/ecommerce/storefront/lib/repositories/brands-repository';
import { getPublicStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { localizedStorePath } from '@/features/ecommerce/storefront/lib/store-paths';
import { routing, type StorefrontLocale } from '@/i18n/routing';

function absoluteStoreUrl(path: string): string {
  const base = publicConfig.siteUrl.replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}

function localizedEntries(
  href: `/store${string}`,
  meta: Omit<MetadataRoute.Sitemap[number], 'url'>,
): MetadataRoute.Sitemap {
  return routing.locales.map((locale) => ({
    url: absoluteStoreUrl(localizedStorePath(locale, href)),
    ...meta,
  }));
}

/** Storefront sitemap — static CMS routes plus repository-backed dynamic URLs for all locales. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const companyId = getPublicStorefrontCompanyId();
  const locale = routing.defaultLocale as StorefrontLocale;
  const now = new Date();

  const staticPaths = [
    '/store',
    '/store/products',
    '/store/categories',
    '/store/brands',
    '/store/about',
    '/store/contact',
    '/store/faq',
    '/store/legal/privacy',
    '/store/legal/terms',
    '/store/legal/returns',
  ] as const;

  const staticRoutes: MetadataRoute.Sitemap = staticPaths.flatMap((path) =>
    localizedEntries(path, {
      lastModified: now,
      changeFrequency: 'weekly',
      priority: path === '/store' ? 1 : 0.8,
    }),
  );

  const [products, categories, brands] = await Promise.all([
    storefrontProductsRepository.list({ companyId, locale, limit: 500 }),
    storefrontCategoriesRepository.list({ companyId, locale, limit: 500 }),
    storefrontBrandsRepository.list({ companyId, locale, limit: 500 }),
  ]);

  const dynamicRoutes: MetadataRoute.Sitemap = [
    ...products.items.flatMap((item) =>
      localizedEntries(`/store/products/${item.slug}`, {
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      }),
    ),
    ...categories.items.flatMap((item) =>
      localizedEntries(`/store/categories/${item.slug}`, {
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.6,
      }),
    ),
    ...brands.items.flatMap((item) =>
      localizedEntries(`/store/brands/${item.slug}`, {
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.5,
      }),
    ),
  ];

  return [...staticRoutes, ...dynamicRoutes];
}
