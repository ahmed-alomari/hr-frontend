'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink, Tag } from 'lucide-react';
import type { StorefrontBrand, StorefrontProduct } from '@/features/ecommerce/storefront/domain/storefront-models';
import { ProductCard } from '@/features/ecommerce/storefront/components/product-card';
import { ProductListingGrid } from '@/features/ecommerce/storefront/components/catalog/product-grid';
import { StoreBreadcrumbs } from '@/features/ecommerce/storefront/components/store-breadcrumbs';
import { StoreEmptyState } from '@/features/ecommerce/storefront/components/store-empty-state';
import { JsonLd } from '@/features/ecommerce/storefront/components/json-ld';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/features/ecommerce/storefront/lib/seo-jsonld';
import type { StorefrontLocale } from '@/i18n/routing';
import { BrandNames } from '@/features/ecommerce/storefront/components/catalog/brand-names';

export function BrandDetailPage({ brand, products }: { brand: StorefrontBrand; products: StorefrontProduct[] }) {
  const t = useTranslations('storefront');
  const locale = useLocale() as StorefrontLocale;

  const breadcrumbItems = [
    { name: t('breadcrumbs.home'), path: '/store' as const },
    { name: t('brands.title'), path: '/store/brands' as const },
    { name: brand.name, path: `/store/brands/${brand.slug}` as const },
  ];

  return (
    <div className="flex flex-col gap-8">
      <JsonLd data={collectionPageJsonLd(brand.name, `/store/brands/${brand.slug}`, locale)} />
      <JsonLd data={breadcrumbJsonLd(breadcrumbItems, locale)} />

      <StoreBreadcrumbs items={breadcrumbItems} />

      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Tag className="h-7 w-7" aria-hidden />
            </div>
            <div>
              <h1 className="font-arabic-display text-2xl font-bold text-foreground">
                <BrandNames brand={brand} align="start" secondaryClassName="mt-1 text-sm" />
              </h1>
              {brand.description ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{brand.description}</p>
              ) : null}
            </div>
          </div>
          {brand.websiteUrl ? (
            <a
              href={brand.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              {t('brands.website')}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">{t('brands.viewProducts')}</h2>
        {products.length === 0 ? (
          <StoreEmptyState icon={Tag} title={t('products.noResults')} />
        ) : (
          <ProductListingGrid>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ProductListingGrid>
        )}
      </section>
    </div>
  );
}
