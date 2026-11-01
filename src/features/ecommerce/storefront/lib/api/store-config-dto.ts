import { DEFAULT_STORE_COUNTRY, type StoreCountry } from '@/features/ecommerce/domain/constants/store-country';
import type {
  CompanyConfigRecord,
  CompanySocialNetwork,
} from '@/features/ecommerce/storefront/domain/company-config';
import {
  COMPANY_SOCIAL_NETWORKS,
  DEFAULT_MOBILE_TABS,
  normalizeAnnouncementBar,
  normalizeSocialLinks,
  normalizeStorePagesVisibility,
} from '@/features/ecommerce/storefront/domain/company-config';
import {
  DEFAULT_STOREFRONT_TYPOGRAPHY,
  resolveStorefrontFontId,
  CUSTOM_STOREFRONT_FONT_ID,
} from '@/features/ecommerce/storefront/lib/storefront-fonts';

export type StoreSettingsDto = {
  companyId: string;
  storeNameAr: string;
  storeNameEn: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  themePrimary: string;
  themeSecondary: string;
  themeAccent: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactAddress?: string | null;
  seoHomeTitleAr: string;
  seoHomeTitleEn: string;
  seoHomeDescriptionAr: string;
  seoHomeDescriptionEn: string;
  seoProductsTitleAr: string;
  seoProductsTitleEn: string;
  seoProductsDescriptionAr: string;
  seoProductsDescriptionEn: string;
  seoKeywords: string[];
  seoDefaultOgImage?: string | null;
  footerCopyrightOwnerAr: string;
  footerCopyrightOwnerEn: string;
  footerCommercialRegistration?: string | null;
  footerTaglineAr?: string;
  footerTaglineEn?: string;
  bodyFont?: string;
  displayFont?: string;
  bodyFontUrl?: string | null;
  displayFontUrl?: string | null;
  announcementEnabled: boolean;
  announcementDismissible: boolean;
  announcementScrolling: boolean;
  announcementSpeedMs: number;
  storePageOffersEnabled: boolean;
  storePageWholesaleEnabled: boolean;
  /** Sign-in without the password from a trusted device (absent from an older backend). */
  trustedDeviceLoginEnabled?: boolean;
  defaultLocale: string;
  currencyCode: string;
  timezone: string;
  /** The company's base country (absent from an older backend). */
  country?: StoreCountry;
  createdAt?: string;
  updatedAt?: string;
};

export type StoreSocialLinkDto = {
  network: CompanySocialNetwork;
  url: string;
  enabled: boolean;
};
export type StoreNavItemDto = {
  id?: string;
  kind: 'primary' | 'secondary';
  labelAr: string;
  labelEn: string;
  href: string;
  highlight: boolean;
  sortOrder: number;
};
export type StoreAnnouncementItemDto = {
  id?: string;
  enabled: boolean;
  messageAr: string;
  messageEn: string;
  href?: string | null;
  sortOrder: number;
};
export type StoreFooterLinkDto = {
  id?: string;
  labelAr: string;
  labelEn: string;
  href: string;
  sortOrder: number;
};
export type StoreFooterLinkGroupDto = {
  id?: string;
  titleAr: string;
  titleEn: string;
  sortOrder: number;
  links: StoreFooterLinkDto[];
};

export type StorefrontConfigDto = {
  settings: StoreSettingsDto;
  socialLinks: StoreSocialLinkDto[];
  primaryNav: StoreNavItemDto[];
  secondaryNav: StoreNavItemDto[];
  footerLinkGroups: StoreFooterLinkGroupDto[];
  announcements: StoreAnnouncementItemDto[];
};

function asStoreHref(href: string): `/store${string}` | '/store' {
  if (href === '/store' || href.startsWith('/store/')) {
    return href as `/store${string}` | '/store';
  }
  return '/store';
}

export function mapStorefrontConfigDtoToRecord(dto: StorefrontConfigDto): CompanyConfigRecord {
  const s = dto.settings;
  const social = normalizeSocialLinks(
    Object.fromEntries(
      dto.socialLinks.map((link) => [link.network, { url: link.url, enabled: link.enabled }]),
    ),
  );

  return {
    id: s.companyId,
    name: { ar: s.storeNameAr, en: s.storeNameEn },
    logoUrl: s.logoUrl ?? null,
    faviconUrl: s.faviconUrl ?? null,
    theme: {
      primary: s.themePrimary,
      secondary: s.themeSecondary,
      accent: s.themeAccent,
    },
    typography: {
      bodyFontId: resolveStorefrontFontId(s.bodyFont, DEFAULT_STOREFRONT_TYPOGRAPHY.bodyFontId),
      displayFontId: resolveStorefrontFontId(
        s.displayFont,
        DEFAULT_STOREFRONT_TYPOGRAPHY.displayFontId,
      ),
      bodyFontUrl: s.bodyFontUrl ?? null,
      displayFontUrl: s.displayFontUrl ?? null,
    },
    contact: {
      phone: s.contactPhone ?? undefined,
      email: s.contactEmail ?? undefined,
      address: s.contactAddress ?? undefined,
    },
    seo: {
      homeTitle: { ar: s.seoHomeTitleAr, en: s.seoHomeTitleEn },
      homeDescription: { ar: s.seoHomeDescriptionAr, en: s.seoHomeDescriptionEn },
      productsTitle: { ar: s.seoProductsTitleAr, en: s.seoProductsTitleEn },
      productsDescription: { ar: s.seoProductsDescriptionAr, en: s.seoProductsDescriptionEn },
      keywords: s.seoKeywords ?? [],
      defaultOgImage: s.seoDefaultOgImage ?? undefined,
    },
    social,
    navigation: [...dto.primaryNav]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        label: { ar: item.labelAr, en: item.labelEn },
        href: asStoreHref(item.href),
      })),
    secondaryNavigation: [...dto.secondaryNav]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        label: { ar: item.labelAr, en: item.labelEn },
        href: asStoreHref(item.href),
        highlight: item.highlight,
      })),
    footer: {
      copyrightOwnerName: {
        ar: s.footerCopyrightOwnerAr,
        en: s.footerCopyrightOwnerEn,
      },
      tagline: {
        ar: s.footerTaglineAr ?? '',
        en: s.footerTaglineEn ?? '',
      },
      commercialRegistration: s.footerCommercialRegistration ?? undefined,
      linkGroups: [...dto.footerLinkGroups]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((group) => ({
          id: group.id ?? crypto.randomUUID(),
          title: { ar: group.titleAr, en: group.titleEn },
          links: [...(group.links ?? [])]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((link) => ({
              label: { ar: link.labelAr, en: link.labelEn },
              href: asStoreHref(link.href),
            })),
        })),
    },
    mobileTabs: DEFAULT_MOBILE_TABS.map((tab) => ({
      ...tab,
      label: { ...tab.label },
    })),
    announcement: normalizeAnnouncementBar({
      enabled: s.announcementEnabled,
      dismissible: s.announcementDismissible,
      scrolling: s.announcementScrolling,
      speedMs: s.announcementSpeedMs,
      items: [...dto.announcements]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          id: item.id ?? crypto.randomUUID(),
          enabled: item.enabled,
          message: { ar: item.messageAr, en: item.messageEn },
          href: item.href ? asStoreHref(item.href) : null,
        })),
    }),
    storePages: normalizeStorePagesVisibility({
      offers: s.storePageOffersEnabled,
      wholesale: s.storePageWholesaleEnabled,
    }),
    defaultLocale: s.defaultLocale || 'ar',
    currency: s.currencyCode || 'YER',
    timezone: s.timezone || 'Asia/Aden',
    country: s.country ?? { ...DEFAULT_STORE_COUNTRY },
    trustedDeviceLogin: s.trustedDeviceLoginEnabled === true,
  };
}

export function mapRecordToUpdateSettingsDto(record: CompanyConfigRecord) {
  return {
    storeNameAr: record.name.ar,
    storeNameEn: record.name.en,
    logoUrl: record.logoUrl,
    faviconUrl: record.faviconUrl,
    themePrimary: record.theme.primary,
    themeSecondary: record.theme.secondary,
    themeAccent: record.theme.accent,
    contactPhone: record.contact.phone ?? null,
    contactEmail: record.contact.email ?? null,
    contactAddress: record.contact.address ?? null,
    seoHomeTitleAr: record.seo.homeTitle.ar,
    seoHomeTitleEn: record.seo.homeTitle.en,
    seoHomeDescriptionAr: record.seo.homeDescription.ar,
    seoHomeDescriptionEn: record.seo.homeDescription.en,
    seoProductsTitleAr: record.seo.productsTitle.ar,
    seoProductsTitleEn: record.seo.productsTitle.en,
    seoProductsDescriptionAr: record.seo.productsDescription.ar,
    seoProductsDescriptionEn: record.seo.productsDescription.en,
    seoKeywords: record.seo.keywords ?? [],
    seoDefaultOgImage: record.seo.defaultOgImage ?? null,
    footerCopyrightOwnerAr: record.footer.copyrightOwnerName.ar,
    footerCopyrightOwnerEn: record.footer.copyrightOwnerName.en,
    footerCommercialRegistration: record.footer.commercialRegistration ?? null,
    footerTaglineAr: record.footer.tagline?.ar ?? '',
    footerTaglineEn: record.footer.tagline?.en ?? '',
    bodyFont: record.typography?.bodyFontId ?? DEFAULT_STOREFRONT_TYPOGRAPHY.bodyFontId,
    displayFont: record.typography?.displayFontId ?? DEFAULT_STOREFRONT_TYPOGRAPHY.displayFontId,
    bodyFontUrl:
      record.typography?.bodyFontId === CUSTOM_STOREFRONT_FONT_ID
        ? (record.typography.bodyFontUrl ?? null)
        : null,
    displayFontUrl:
      record.typography?.displayFontId === CUSTOM_STOREFRONT_FONT_ID
        ? (record.typography.displayFontUrl ?? null)
        : null,
    announcementEnabled: record.announcement.enabled,
    announcementDismissible: record.announcement.dismissible,
    announcementScrolling: record.announcement.scrolling !== false,
    announcementSpeedMs: record.announcement.speedMs,
    storePageOffersEnabled: record.storePages.offers,
    storePageWholesaleEnabled: record.storePages.wholesale,
    defaultLocale: record.defaultLocale,
    currencyCode: record.currency,
    timezone: record.timezone,
  };
}

export function mapRecordToSocialLinksPayload(record: CompanyConfigRecord) {
  const social = normalizeSocialLinks(record.social);
  return {
    // Persist every known network so clearing/disabling in CMS fully replaces DB rows.
    socialLinks: COMPANY_SOCIAL_NETWORKS.map((network) => {
      const entry = social[network];
      const url = entry?.url?.trim() ?? '';
      return {
        network,
        url,
        // Empty URL cannot appear on the storefront — keep disabled to match store behavior.
        enabled: Boolean(entry?.enabled !== false && url),
      };
    }),
  };
}

export function mapRecordToNavItemsPayload(record: CompanyConfigRecord) {
  const primary = record.navigation.map((item, index) => ({
    kind: 'primary' as const,
    labelAr: item.label.ar,
    labelEn: item.label.en,
    href: item.href,
    highlight: false,
    sortOrder: index,
  }));
  const secondary = record.secondaryNavigation.map((item, index) => ({
    kind: 'secondary' as const,
    labelAr: item.label.ar,
    labelEn: item.label.en,
    href: item.href,
    highlight: Boolean(item.highlight),
    sortOrder: index,
  }));
  return { navItems: [...primary, ...secondary] };
}

export function mapRecordToFooterPayload(record: CompanyConfigRecord) {
  return {
    groups: record.footer.linkGroups.map((group, groupIndex) => ({
      titleAr: group.title.ar,
      titleEn: group.title.en,
      sortOrder: groupIndex,
      links: group.links.map((link, linkIndex) => ({
        labelAr: link.label.ar,
        labelEn: link.label.en,
        href: link.href,
        sortOrder: linkIndex,
      })),
    })),
  };
}

export function mapRecordToAnnouncementsPayload(record: CompanyConfigRecord) {
  const announcement = normalizeAnnouncementBar(record.announcement);
  return {
    announcements: announcement.items.map((item, index) => ({
      enabled: item.enabled !== false,
      messageAr: item.message.ar,
      messageEn: item.message.en,
      href: item.href,
      sortOrder: index,
    })),
  };
}

/** Assemble a full config DTO from admin piece endpoints. */
export function assembleStorefrontConfigDto(input: {
  settings: StoreSettingsDto;
  socialLinks?: StoreSocialLinkDto[];
  navItems?: StoreNavItemDto[];
  footerLinkGroups?: StoreFooterLinkGroupDto[];
  announcements?: StoreAnnouncementItemDto[];
}): StorefrontConfigDto {
  const nav = input.navItems ?? [];
  return {
    settings: input.settings,
    socialLinks: input.socialLinks ?? [],
    primaryNav: nav.filter((item) => item.kind === 'primary'),
    secondaryNav: nav.filter((item) => item.kind === 'secondary'),
    footerLinkGroups: input.footerLinkGroups ?? [],
    announcements: input.announcements ?? [],
  };
}
