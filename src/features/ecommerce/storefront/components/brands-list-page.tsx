'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Tag } from 'lucide-react';
import type { StorefrontBrand } from '@/features/ecommerce/storefront/domain/storefront-models';
import { StoreBreadcrumbs } from '@/features/ecommerce/storefront/components/store-breadcrumbs';
import { StoreEmptyState } from '@/features/ecommerce/storefront/components/store-empty-state';
import { JsonLd } from '@/features/ecommerce/storefront/components/json-ld';
import { collectionPageJsonLd } from '@/features/ecommerce/storefront/lib/seo-jsonld';
import { Link } from '@/i18n/navigation';
import type { StorefrontLocale } from '@/i18n/routing';
import { BrandNames } from '@/features/ecommerce/storefront/components/catalog/brand-names';

export function BrandsListPage({ brands }: { brands: StorefrontBrand[] }) {
  const t = useTranslations('storefront');
  const locale = useLocale() as StorefrontLocale;

  return (
    <div className="flex flex-col gap-6">
      <JsonLd data={collectionPageJsonLd(t('brands.title'), '/store/brands', locale)} />
      <StoreBreadcrumbs
        items={[
          { name: t('breadcrumbs.home'), path: '/store' },
          { name: t('brands.title'), path: '/store/brands' },
        ]}
      />
      <h1 className="font-arabic-display text-2xl font-bold text-foreground">{t('brands.title')}</h1>

      {brands.length === 0 ? (
        <StoreEmptyState icon={Tag} title={t('brands.noResults')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/store/brands/${brand.slug}`}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-soft transition-shadow hover:shadow-elevated"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Tag className="h-5 w-5" aria-hidden />
                </div>
                <h2 className="text-base font-semibold text-foreground">
                  <BrandNames brand={brand} align="start" />
                </h2>
              </div>
              {brand.description ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{brand.description}</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
