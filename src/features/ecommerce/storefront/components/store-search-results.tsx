'use client';

import * as React from 'react';
import { AlertCircle, Loader2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useStorefrontSearch } from '@/features/ecommerce/storefront/hooks/use-storefront-search';
import { ProductCardClient } from '@/features/ecommerce/storefront/components/product-card-client';
import { StoreEmptyState } from '@/features/ecommerce/storefront/components/store-empty-state';
import { Link, useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';

export function StoreSearchResults() {
  const t = useTranslations('storefront');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [input, setInput] = React.useState(initialQuery);
  const query = (searchParams.get('q') ?? '').trim();

  const { data, isLoading, isFetching, isError, refetch } = useStorefrontSearch(query, query.length > 0);

  const [isNavigating, startTransition] = React.useTransition();
  const searching = isNavigating || (query.length > 0 && isFetching);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    startTransition(() => {
      router.replace(trimmed ? `/store/search?q=${encodeURIComponent(trimmed)}` : '/store/search');
    });
  }

  const totalResults =
    (data?.products.items.length ?? 0) +
    (data?.categories.items.length ?? 0) +
    (data?.brands.items.length ?? 0);

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row" role="search">
        <label htmlFor="store-search-input" className="sr-only">
          {t('search.placeholder')}
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="store-search-input"
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t('search.placeholder')}
            className="h-11 w-full rounded-lg border border-border bg-background ps-10 pe-4 text-sm text-foreground outline-none ring-primary/20 transition-shadow focus:ring-2"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          aria-busy={searching}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t('search.submit')}
        </button>
      </form>

      {!query ? (
        <StoreEmptyState icon={Search} title={t('search.title')} description={t('search.noQuery')} />
      ) : null}

      {query && isError ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
          <p className="text-sm font-medium text-foreground">{t('common.errorTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('common.errorDescription')}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {tCommon('actions.retry')}
          </button>
        </div>
      ) : null}

      {query && !isError && (isLoading || isFetching) ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('common.loading')}
        </div>
      ) : null}

      {query && data && !isLoading && !isError ? (
        totalResults === 0 ? (
          <StoreEmptyState icon={Search} title={t('search.noResults')} description={query} />
        ) : (
          <div className="flex flex-col gap-10">
            <p className="text-sm text-muted-foreground">
              {totalResults} {t('search.resultsCount')} {t('search.resultsFor')} &quot;{query}&quot;
            </p>

            {data.products.items.length > 0 ? (
              <section className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground">{t('search.products')}</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {data.products.items.map((product) => (
                    <ProductCardClient key={product.id} product={product} />
                  ))}
                </div>
              </section>
            ) : null}

            {data.categories.items.length > 0 ? (
              <section className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground">{t('search.categories')}</h2>
                <div className="flex flex-wrap gap-2">
                  {data.categories.items.map((category) => (
                    <Link
                      key={category.id}
                      href={`/store/categories/${category.slug}`}
                      className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {data.brands.items.length > 0 ? (
              <section className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground">{t('search.brands')}</h2>
                <div className="flex flex-wrap gap-2">
                  {data.brands.items.map((brand) => (
                    <Link
                      key={brand.id}
                      href={`/store/brands/${brand.slug}`}
                      className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                    >
                      {brand.name}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}
