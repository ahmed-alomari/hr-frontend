import type { MetadataRoute } from 'next';
import { storefrontProductsRepository } from '@/features/ecommerce/storefront/lib/repositories/products-repository';
import { storefrontCategoriesRepository } from '@/features/ecommerce/storefront/lib/repositories/categories-repository';
import { storefrontBrandsRepository } from '@/features/ecommerce/storefront/lib/repositories/brands-repository';
import { getRequestStorefront } from '@/features/ecommerce/storefront/lib/storefront-company.server';
import { localizedStorePath } from '@/features/ecommerce/storefront/lib/store-paths';
import { routing, type StorefrontLocale } from '@/i18n/routing';

/** Storefront sitemap — static CMS routes plus repository-backed dynamic URLs for all locales. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The store of the hostname asked for (company domains), on its primary domain.
  const { companyId, siteUrl: base } = await getRequestStorefront();
  const localizedEntries = (
    href: `/store${string}`,
    meta: Omit<MetadataRoute.Sitemap[number], 'url'>,
  ): MetadataRoute.Sitemap =>
    routing.locales.map((locale) => {
      const path = localizedStorePath(locale, href);
      return { url: base ? `${base}${path}` : path, ...meta };
    });
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
