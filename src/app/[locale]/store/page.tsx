import type { Metadata } from 'next';
import { StoreHomePageView } from '@/features/ecommerce/storefront/components/store-home-page';
import { StoreHomePageCsr } from '@/features/ecommerce/storefront/components/store-csr-pages';
import { ProductsBrowsePage } from '@/features/ecommerce/storefront/components/products-browse-page';
import { storeHomeMetadata } from '@/features/ecommerce/storefront/lib/seo';
import { getStorefrontCompanyConfig } from '@/features/ecommerce/storefront/lib/get-storefront-company-config';
import { getRequestStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company.server';
import { isStorefrontCsrEnabled } from '@/features/ecommerce/storefront/lib/is-storefront-csr';
import { loadStorefrontHomepage } from '@/features/ecommerce/storefront/page-builder/services/page.service';
import {
  getStorefrontCategoriesList,
  getStorefrontProductsList,
} from '@/features/ecommerce/storefront/lib/loaders/catalog-loaders';
import type { StorefrontLocale } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (isStorefrontCsrEnabled()) return {};
  const { locale } = await params;
  const config = await getStorefrontCompanyConfig();
  return storeHomeMetadata(config, locale as StorefrontLocale);
}

export default async function Page({ params }: Props) {
  if (isStorefrontCsrEnabled()) return <StoreHomePageCsr />;

  const { locale } = await params;
  const companyId = await getRequestStorefrontCompanyId();
  const config = await getStorefrontCompanyConfig();
  const page = await loadStorefrontHomepage(
    companyId,
    locale as StorefrontLocale,
    config.seo.homeTitle,
  );
  if (page) {
    return <StoreHomePageView page={page} config={config} />;
  }

  const [categoriesResult, productsResult] = await Promise.all([
    getStorefrontCategoriesList({ limit: 50 }),
    getStorefrontProductsList({ page: 1, limit: 15 }),
  ]);

  return (
    <ProductsBrowsePage
      categories={categoriesResult.items}
      secondaryNavigation={config.secondaryNavigation}
      storePages={config.storePages}
      productsResult={productsResult}
    />
  );
}
