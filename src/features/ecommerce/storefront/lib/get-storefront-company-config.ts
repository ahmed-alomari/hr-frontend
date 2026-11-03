import { cache } from 'react';
import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { companyConfigApi } from '@/features/ecommerce/storefront/lib/api/company-config-api';
import { getPublicStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { applyStorefrontTheme } from '@/features/ecommerce/storefront/lib/get-storefront-theme-colors';
import { DEFAULT_STOREFRONT_TYPOGRAPHY } from '@/features/ecommerce/storefront/lib/storefront-fonts';
import type { StorefrontCompanyConfig } from '@/features/ecommerce/storefront/domain/storefront-models';
import type { StorefrontLocale } from '@/i18n/routing';

function withBranding(config: StorefrontCompanyConfig): StorefrontCompanyConfig {
  const branding = applyStorefrontTheme(
    config.theme,
    config.typography ?? DEFAULT_STOREFRONT_TYPOGRAPHY,
  );
  return {
    ...config,
    theme: branding.theme,
    themeCssVars: branding.themeCssVars,
    typography: branding.typography,
  };
}

export const getStorefrontCompanyConfig = cache(async (): Promise<StorefrontCompanyConfig> => {
  const locale = (await getLocale()) as StorefrontLocale;
  const companyId = getPublicStorefrontCompanyId();
  const config = await companyConfigApi.getByCompanyId(companyId, locale);
  if (!config) notFound();
  return withBranding(config);
});

export const getStorefrontCompanyConfigForLocale = cache(
  async (locale: StorefrontLocale): Promise<StorefrontCompanyConfig> => {
    const companyId = getPublicStorefrontCompanyId();
    const config = await companyConfigApi.getByCompanyId(companyId, locale);
    if (!config) notFound();
    return withBranding(config);
  },
);
