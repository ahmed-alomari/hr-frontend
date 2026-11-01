import {
  isStoreCatalogHref,
  normalizeAnnouncementBar,
  normalizeStorePagesVisibility,
  resolveEnabledSocialLinks,
  type CompanyConfigRecord,
  type CompanyStorePagesVisibility,
} from '@/features/ecommerce/storefront/domain/company-config';
import type { StorefrontCompanyConfig, StorefrontNavItem } from '@/features/ecommerce/storefront/domain/storefront-models';
import type { StorefrontLocale } from '@/i18n/routing';
import { resolveLocalizedText } from '@/features/ecommerce/storefront/domain/localizable';
import {
  DEFAULT_STOREFRONT_TYPOGRAPHY,
  resolveStorefrontFontId,
} from '@/features/ecommerce/storefront/lib/storefront-fonts';
import { resolveFooterLinkGroups } from '@/features/ecommerce/storefront/lib/store-footer-defaults';
import { resolveUploadUrl } from '@/shared/resolve-upload-url';

function resolveOptionalUploadUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const resolved = resolveUploadUrl(url);
  return resolved.trim() ? resolved : null;
}

function mapNavItem(
  item: CompanyConfigRecord['navigation'][number],
  locale: StorefrontLocale,
): StorefrontNavItem {
  return {
    label: resolveLocalizedText(item.label, locale),
    href: item.href,
  };
}

function isCatalogPageAllowed(href: string, storePages: CompanyStorePagesVisibility): boolean {
  if (isStoreCatalogHref(href, 'offers')) return storePages.offers;
  if (isStoreCatalogHref(href, 'wholesale')) return storePages.wholesale;
  return true;
}

export function mapStorefrontCompanyConfig(
  record: CompanyConfigRecord,
  locale: StorefrontLocale,
): StorefrontCompanyConfig {
  const storePages = normalizeStorePagesVisibility(record.storePages);

  return {
    id: record.id,
    name: resolveLocalizedText(record.name, locale),
    logoUrl: resolveOptionalUploadUrl(record.logoUrl),
    faviconUrl: resolveOptionalUploadUrl(record.faviconUrl),
    seo: {
      homeTitle: resolveLocalizedText(record.seo.homeTitle, locale),
      homeDescription: resolveLocalizedText(record.seo.homeDescription, locale),
      productsTitle: resolveLocalizedText(record.seo.productsTitle, locale),
      productsDescription: resolveLocalizedText(record.seo.productsDescription, locale),
      keywords: record.seo.keywords ?? [],
      defaultOgImage: resolveOptionalUploadUrl(record.seo.defaultOgImage),
    },
    contact: record.contact,
    social: resolveEnabledSocialLinks(record.social),
    theme: record.theme,
    typography: {
      bodyFontId: resolveStorefrontFontId(
        record.typography?.bodyFontId,
        DEFAULT_STOREFRONT_TYPOGRAPHY.bodyFontId,
      ),
      displayFontId: resolveStorefrontFontId(
        record.typography?.displayFontId,
        DEFAULT_STOREFRONT_TYPOGRAPHY.displayFontId,
      ),
      bodyFontUrl: record.typography?.bodyFontUrl ?? null,
      displayFontUrl: record.typography?.displayFontUrl ?? null,
    },
    navigation: record.navigation
      .filter((item) => isCatalogPageAllowed(item.href, storePages))
      .map((item) => mapNavItem(item, locale)),
    secondaryNavigation: record.secondaryNavigation
      .filter((item) => isCatalogPageAllowed(item.href, storePages))
      .map((item) => ({
        ...mapNavItem(item, locale),
        highlight: item.highlight,
      })),
    footer: {
      copyrightOwnerName: resolveLocalizedText(record.footer.copyrightOwnerName, locale),
      tagline: resolveLocalizedText(
        record.footer.tagline ?? { ar: '', en: '' },
        locale,
      ),
      commercialRegistration: record.footer.commercialRegistration ?? null,
      linkGroups: resolveFooterLinkGroups(record.footer.linkGroups).map((group) => ({
        id: group.id,
        title: resolveLocalizedText(group.title, locale),
        links: group.links
          .filter((link) => isCatalogPageAllowed(link.href, storePages))
          .map((link) => mapNavItem(link, locale)),
      })),
    },
    announcement: (() => {
      const bar = normalizeAnnouncementBar(record.announcement);
      return {
        enabled: bar.enabled,
        dismissible: bar.dismissible,
        scrolling: bar.scrolling,
        speedMs: bar.speedMs,
        items: bar.items
          .filter((item) => item.enabled && (item.message.ar.trim() || item.message.en.trim()))
          .map((item) => ({
            id: item.id,
            message: resolveLocalizedText(item.message, locale),
            href: item.href,
          }))
          .filter((item) => item.message.trim()),
      };
    })(),
    storePages,
    currency: record.currency,
    timezone: record.timezone,
    country: record.country,
    trustedDeviceLogin: record.trustedDeviceLogin === true,
  };
}
