import { cache } from 'react';
import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { LegalPageSlug } from '@/features/ecommerce/storefront/domain/content';
import type {
  StorefrontAboutContent,
  StorefrontContactContent,
  StorefrontFaqItem,
  StorefrontLegalPage,
} from '@/features/ecommerce/storefront/domain/storefront-models';
import { storefrontContentRepository } from '@/features/ecommerce/storefront/lib/repositories/content-repository';
import { getRequestStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company.server';
import { isStorefrontBuildFallbackEnabled } from '@/features/ecommerce/storefront/lib/default-company-config';
import type { StorefrontLocale } from '@/i18n/routing';

const BUILD_PLACEHOLDER_ABOUT: StorefrontAboutContent = {
  headline: '',
  intro: '',
  sections: [],
  stats: [],
};

const BUILD_PLACEHOLDER_CONTACT: StorefrontContactContent = {
  headline: '',
  intro: '',
  hours: '',
  mapEmbedUrl: null,
};

function buildPlaceholderLegalPage(slug: LegalPageSlug): StorefrontLegalPage {
  return {
    slug,
    title: '',
    body: '',
    metaTitle: '',
    metaDescription: '',
    updatedAt: new Date(0).toISOString(),
  };
}

export const getStorefrontFaq = cache(async (): Promise<StorefrontFaqItem[]> => {
  const locale = (await getLocale()) as StorefrontLocale;
  const companyId = await getRequestStorefrontCompanyId();
  return storefrontContentRepository.getFaq(companyId, locale);
});

export const getStorefrontAboutContent = cache(async (): Promise<StorefrontAboutContent> => {
  const locale = (await getLocale()) as StorefrontLocale;
  const companyId = await getRequestStorefrontCompanyId();
  const content = await storefrontContentRepository.getAbout(companyId, locale);
  if (!content) {
    if (isStorefrontBuildFallbackEnabled()) return BUILD_PLACEHOLDER_ABOUT;
    notFound();
  }
  return content;
});

export const getStorefrontContactContent = cache(async (): Promise<StorefrontContactContent> => {
  const locale = (await getLocale()) as StorefrontLocale;
  const companyId = await getRequestStorefrontCompanyId();
  const content = await storefrontContentRepository.getContact(companyId, locale);
  if (!content) {
    if (isStorefrontBuildFallbackEnabled()) return BUILD_PLACEHOLDER_CONTACT;
    notFound();
  }
  return content;
});

export const getStorefrontLegalPage = cache(async (slug: LegalPageSlug): Promise<StorefrontLegalPage> => {
  const locale = (await getLocale()) as StorefrontLocale;
  const companyId = await getRequestStorefrontCompanyId();
  const page = await storefrontContentRepository.getLegalPage(companyId, slug, locale);
  if (!page) {
    if (isStorefrontBuildFallbackEnabled()) return buildPlaceholderLegalPage(slug);
    notFound();
  }
  return page;
});
