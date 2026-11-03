'use client';

import * as React from 'react';
import Image from 'next/image';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  StorefrontBrand,
  StorefrontCategory,
  StorefrontCompanyConfig,
} from '@/features/ecommerce/storefront/domain/storefront-models';
import {
  buildCategoryTree,
  buildMegaMenuColumns,
} from '@/features/ecommerce/storefront/utils/category-tree';
import { LinkPendingSpinner } from '@/features/ecommerce/storefront/components/link-pending-spinner';
import { Link } from '@/i18n/navigation';
import { cn } from '@/shared/utils';

type PromoNavLink = StorefrontCompanyConfig['secondaryNavigation'][number];

type StoreCategoryNavBarProps = {
  categories: StorefrontCategory[];
  brands: StorefrontBrand[];
  promoLinks?: PromoNavLink[];
};

/**
 * Desktop category strip — dedicated second header row so brand/actions stay uncrowded.
 * Hover/focus opens the mega-menu panel under the strip.
 * Promo destinations (offers / wholesale) trail after category roots.
 */
export function StoreCategoryNavBar({ categories, brands, promoLinks = [] }: StoreCategoryNavBarProps) {
  const t = useTranslations('storefront');
  const { roots, childrenByParent } = React.useMemo(() => buildCategoryTree(categories), [categories]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandsById = React.useMemo(() => new Map(brands.map((brand) => [brand.id, brand])), [brands]);

  const activeCategory = roots.find((category) => category.id === activeId) ?? null;
  const columns = activeCategory ? buildMegaMenuColumns(activeCategory.id, childrenByParent) : [];
  const featuredBrands = (activeCategory?.featuredBrandIds ?? [])
    .map((id) => brandsById.get(id))
    .filter((brand): brand is StorefrontBrand => Boolean(brand));
  const open = activeId !== null;

  const openMenu = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveId(id);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setActiveId(null), 180);
  };

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  React.useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  if (roots.length === 0 && promoLinks.length === 0) return null;

  return (
    <div
      className={cn(
        // Above content so the mega panel stays hoverable while switching roots
        'relative border-b border-border bg-muted/40',
        open ? 'z-50' : 'z-30',
      )}
      onMouseLeave={scheduleClose}
      onMouseEnter={cancelClose}
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <nav
          className="relative z-50 flex items-stretch gap-2"
          aria-label={t('nav.categories')}
        >
          {/* Categories scroll; promo links stay pinned outside the scrollport */}
          <div className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto scrollbar-none">
            {roots.length > 0 ? (
              <Link
                href="/store/categories"
                prefetch={false}
                className="relative z-50 shrink-0 whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:text-primary"
              >
                {t('nav.categories')}
              </Link>
            ) : null}

            {roots.map((category) => {
              const isActive = activeId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onMouseEnter={() => openMenu(category.id)}
                  onFocus={() => openMenu(category.id)}
                  onClick={() => openMenu(category.id)}
                  className={cn(
                    'relative z-50 shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'border-primary font-semibold text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                  aria-expanded={isActive}
                  aria-haspopup="true"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {category.name}
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 opacity-40 transition-transform',
                        isActive && 'rotate-180 opacity-70',
                      )}
                      aria-hidden
                    />
                  </span>
                </button>
              );
            })}
          </div>

          {promoLinks.length > 0 ? (
            <div className="flex shrink-0 items-center gap-2 border-s border-border bg-muted/40 ps-3">
              {promoLinks.map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    'relative z-50 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                    item.highlight
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted',
                  )}
                >
                  {item.label}
                  <LinkPendingSpinner />
                </Link>
              ))}
            </div>
          ) : null}
        </nav>
      </div>

      {open && activeCategory ? (
        <div
          className="absolute inset-x-0 top-full z-40 border-b border-border bg-background shadow-elevated"
          role="region"
          aria-label={activeCategory.name}
          onMouseEnter={cancelClose}
        >
          <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
            <Link
              href={`/store/categories/${activeCategory.slug}`}
              prefetch={false}
              className="group relative hidden min-h-[260px] overflow-hidden rounded-xl bg-muted lg:block"
              onClick={() => setActiveId(null)}
            >
              {activeCategory.imageUrl ? (
                <Image
                  src={activeCategory.imageUrl}
                  alt={activeCategory.imageAlt || activeCategory.name}
                  fill
                  unoptimized
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  sizes="220px"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-primary/10 p-4">
                  <span className="font-arabic-display text-lg font-semibold text-primary">{activeCategory.name}</span>
                </div>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground">
                {activeCategory.name}
              </span>
            </Link>

            <div className="flex min-w-0 flex-col gap-6">
              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="font-arabic-display text-base font-semibold text-foreground">{activeCategory.name}</h3>
                  <Link
                    href={`/store/categories/${activeCategory.slug}`}
                    prefetch={false}
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setActiveId(null)}
                  >
                    {t('home.browseProducts')}
                  </Link>
                </div>

                {columns.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {columns.map(({ group, links }) => (
                      <div key={group.id} className="min-w-0">
                        <Link
                          href={`/store/categories/${group.slug}`}
                          prefetch={false}
                          className="mb-2 block text-sm font-semibold text-foreground hover:text-primary"
                          onClick={() => setActiveId(null)}
                        >
                          {group.name}
                        </Link>
                        {links.length > 0 ? (
                          <ul className="flex flex-col gap-1.5">
                            {links.map((leaf) => (
                              <li key={leaf.id}>
                                <Link
                                  href={`/store/categories/${leaf.slug}`}
                                  prefetch={false}
                                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                  onClick={() => setActiveId(null)}
                                >
                                  {leaf.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <Link
                            href={`/store/categories/${group.slug}`}
                            prefetch={false}
                            className="text-sm text-muted-foreground hover:text-primary"
                            onClick={() => setActiveId(null)}
                          >
                            {t('home.browseProducts')}
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('megaMenu.emptySubcategories')}</p>
                )}
              </div>

              {featuredBrands.length > 0 ? (
                <div className="border-t border-border pt-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-foreground">{t('nav.topBrands')}</h4>
                    <Link
                      href="/store/brands"
                      prefetch={false}
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() => setActiveId(null)}
                    >
                      {t('home.viewAll')}
                    </Link>
                  </div>
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                    {featuredBrands.slice(0, 10).map((brand) => (
                      <li key={brand.id}>
                        <Link
                          href={`/store/brands/${brand.slug}`}
                          prefetch={false}
                          className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 text-center transition-colors hover:border-primary/40 hover:bg-muted/40"
                          onClick={() => setActiveId(null)}
                        >
                          {brand.logoUrl ? (
                            <Image
                              src={brand.logoUrl}
                              alt=""
                              width={40}
                              height={28}
                              unoptimized
                              className="h-7 w-auto object-contain"
                              aria-hidden
                            />
                          ) : (
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                              {brand.name.slice(0, 2)}
                            </span>
                          )}
                          <span className="line-clamp-1 text-[10px] font-medium text-muted-foreground">{brand.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StoreMobileCategoryNav({
  categories,
  brands,
  onNavigate,
}: {
  categories: StorefrontCategory[];
  brands: StorefrontBrand[];
  onNavigate: () => void;
}) {
  const t = useTranslations('storefront');
  const { roots, childrenByParent } = React.useMemo(() => buildCategoryTree(categories), [categories]);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const brandsById = React.useMemo(() => new Map(brands.map((brand) => [brand.id, brand])), [brands]);

  return (
    <div className="flex flex-col gap-1 border-t border-border pt-3">
      <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('nav.categories')}</p>
      {roots.map((category) => {
        const columns = buildMegaMenuColumns(category.id, childrenByParent);
        const expanded = expandedId === category.id;
        const featured = (category.featuredBrandIds ?? [])
          .map((id) => brandsById.get(id))
          .filter((brand): brand is StorefrontBrand => Boolean(brand));

        return (
          <div key={category.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-accent"
              onClick={() => setExpandedId(expanded ? null : category.id)}
              aria-expanded={expanded}
            >
              {category.name}
              <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} aria-hidden />
            </button>
            {expanded ? (
              <div className="flex flex-col gap-1 pb-2 ps-4">
                <Link
                  href={`/store/categories/${category.slug}`}
                  prefetch={false}
                  className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  onClick={onNavigate}
                >
                  {t('home.browseProducts')}
                </Link>
                {columns.map(({ group, links }) => (
                  <div key={group.id} className="mt-1">
                    <Link
                      href={`/store/categories/${group.slug}`}
                      prefetch={false}
                      className="rounded-md px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-accent"
                      onClick={onNavigate}
                    >
                      {group.name}
                    </Link>
                    {links.map((leaf) => (
                      <Link
                        key={leaf.id}
                        href={`/store/categories/${leaf.slug}`}
                        prefetch={false}
                        className="block rounded-md px-3 py-1.5 ps-5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={onNavigate}
                      >
                        {leaf.name}
                      </Link>
                    ))}
                  </div>
                ))}
                {featured.length > 0 ? (
                  <div className="mt-2 border-t border-border pt-2">
                    <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">{t('nav.topBrands')}</p>
                    {featured.map((brand) => (
                      <Link
                        key={brand.id}
                        href={`/store/brands/${brand.slug}`}
                        prefetch={false}
                        className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                        onClick={onNavigate}
                      >
                        {brand.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
