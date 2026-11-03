'use client';

import { usePathname } from 'next/navigation';
import {
  withRegularProductsTab,
  type StorefrontCategory,
  type StorefrontCompanyConfig,
} from '@/features/ecommerce/storefront/domain/storefront-models';
import { buildCategoryTree } from '@/features/ecommerce/storefront/utils/category-tree';
import { useTranslations } from 'next-intl';
import { LinkPendingSpinner } from '@/features/ecommerce/storefront/components/link-pending-spinner';
import { Link } from '@/i18n/navigation';
import { cn } from '@/shared/utils';

export function StorePlpSidebar({
  categories,
  secondaryNavigation,
  storePages,
  activeCategorySlug,
  activeTag,
}: {
  categories: StorefrontCategory[];
  secondaryNavigation?: StorefrontCompanyConfig['secondaryNavigation'];
  storePages?: StorefrontCompanyConfig['storePages'];
  activeCategorySlug?: string;
  activeTag?: string;
}) {
  const t = useTranslations('storefront');
  const pathname = usePathname();
  const { roots, childrenByParent } = buildCategoryTree(categories);
  const showOffers = storePages?.offers !== false;
  const showWholesale = storePages?.wholesale !== false;
  const promoLinks = [
    { label: t('nav.newArrivals'), href: '/store/products?isNewProduct=1' as const },
    ...(showOffers ? [{ label: t('offers.title'), href: '/store/offers' as const }] : []),
    ...(showWholesale ? [{ label: t('wholesale.title'), href: '/store/wholesale' as const }] : []),
    { label: t('discounts.title'), href: '/store/products?isDiscounted=1' as const },
  ];
  const shortcuts = withRegularProductsTab(
    secondaryNavigation && secondaryNavigation.length > 0 ? secondaryNavigation : promoLinks,
    t('nav.regularProducts'),
  );

  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <div className="sticky top-36 flex flex-col gap-6">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{t('products.filters')}</h2>
          <nav className="flex flex-col gap-1" aria-label={t('nav.categories')}>
            <Link
              href="/store/products"
              prefetch={false}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                !activeCategorySlug && !activeTag
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {t('products.all')}
              <LinkPendingSpinner />
            </Link>
            {roots.map((root) => {
              const subs = childrenByParent[root.id] ?? [];
              const isActive =
                activeCategorySlug === root.slug ||
                subs.some((s) => s.slug === activeCategorySlug);
              return (
                <div key={root.id}>
                  <Link
                    href={`/store/products?category=${root.slug}`}
                    prefetch={false}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {root.name}
                    <LinkPendingSpinner />
                  </Link>
                  {subs.length > 0 && isActive ? (
                    <div className="ms-3 flex flex-col gap-0.5 border-s border-border ps-2">
                      {subs.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/store/products?category=${sub.slug}`}
                          prefetch={false}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                            activeCategorySlug === sub.slug
                              ? 'font-medium text-primary'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {sub.name}
                          <LinkPendingSpinner />
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>

        {shortcuts.length > 0 ? (
          <div className="flex flex-col gap-1">
            <h3 className="mb-1 text-sm font-semibold text-foreground">{t('nav.offersZone')}</h3>
            {shortcuts.map((item) => {
              const active =
                pathname.includes(item.href) ||
                (item.href.includes('offers') && pathname.includes('/store/offers')) ||
                (item.href.includes('wholesale') && pathname.includes('/store/wholesale'));
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  {item.label}
                  <LinkPendingSpinner />
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
