import type { StoreCountry } from '@/features/ecommerce/domain/constants/store-country';
import type { LocalizableString } from '@/features/ecommerce/storefront/domain/localizable';
import type { StorefrontTypography } from '@/features/ecommerce/storefront/lib/storefront-fonts';

export type CompanyThemeColors = {
  primary: string;
  secondary: string;
  accent: string;
};

export type CompanySeoDefaultsRecord = {
  homeTitle: LocalizableString;
  homeDescription: LocalizableString;
  productsTitle: LocalizableString;
  productsDescription: LocalizableString;
  /** Search keywords for meta tags (comma-separated concepts stored as list). */
  keywords?: string[];
  defaultOgImage?: string;
};

export type CompanyContactInfo = {
  phone?: string;
  email?: string;
  address?: string;
};

export const COMPANY_SOCIAL_NETWORKS = [
  'instagram',
  'twitter',
  'facebook',
  'whatsapp',
  'tiktok',
  'youtube',
  'snapchat',
  'linkedin',
] as const;

export type CompanySocialNetwork = (typeof COMPANY_SOCIAL_NETWORKS)[number];

export type CompanySocialLinkRecord = {
  url: string;
  enabled: boolean;
};

/** Social channels with URL + enable toggle. Legacy string URLs are normalized on read. */
export type CompanySocialLinks = Partial<Record<CompanySocialNetwork, CompanySocialLinkRecord>>;

type LegacySocialLinks = Partial<Record<CompanySocialNetwork, string | CompanySocialLinkRecord | null | undefined>>;

export function normalizeSocialLinks(raw: LegacySocialLinks | null | undefined): CompanySocialLinks {
  const next: CompanySocialLinks = {};
  if (!raw) return next;
  for (const network of COMPANY_SOCIAL_NETWORKS) {
    const value = raw[network];
    if (value == null) continue;
    if (typeof value === 'string') {
      const url = value.trim();
      if (!url) continue;
      next[network] = { url, enabled: true };
      continue;
    }
    next[network] = {
      url: value.url?.trim() ?? '',
      enabled: value.enabled !== false,
    };
  }
  return next;
}

/** Enabled channels with a URL — ready for storefront icons. */
export function resolveEnabledSocialLinks(
  social: CompanySocialLinks | LegacySocialLinks | null | undefined,
): Partial<Record<CompanySocialNetwork, string>> {
  const normalized = normalizeSocialLinks(social as LegacySocialLinks);
  const result: Partial<Record<CompanySocialNetwork, string>> = {};
  for (const network of COMPANY_SOCIAL_NETWORKS) {
    const entry = normalized[network];
    if (entry?.enabled && entry.url.trim()) {
      result[network] = entry.url.trim();
    }
  }
  return result;
}

export type CompanyNavItemRecord = {
  label: LocalizableString;
  href: `/store${string}` | '/store';
};

export type CompanyFooterLinkGroupRecord = {
  id: string;
  title: LocalizableString;
  links: CompanyNavItemRecord[];
};

export type CompanyFooterConfigRecord = {
  copyrightOwnerName: LocalizableString;
  /** Short blurb under the store name in the footer. */
  tagline: LocalizableString;
  linkGroups: CompanyFooterLinkGroupRecord[];
  /** Commercial registration (CR) — edited under Website Settings, shown in footer copyright line. */
  commercialRegistration?: string;
};

export const STOREFRONT_MOBILE_TAB_ICONS = [
  'home',
  'categories',
  'account',
  'cart',
  'search',
  'wishlist',
  'offers',
  'products',
] as const;

export type StorefrontMobileTabIcon = (typeof STOREFRONT_MOBILE_TAB_ICONS)[number];

export type CompanyMobileTabRecord = {
  id: string;
  enabled: boolean;
  label: LocalizableString;
  href: `/store${string}` | '/store';
  icon: StorefrontMobileTabIcon;
};

export const DEFAULT_MOBILE_TABS: CompanyMobileTabRecord[] = [
  {
    id: 'home',
    enabled: true,
    label: { ar: 'الرئيسية', en: 'Home' },
    href: '/store',
    icon: 'home',
  },
  {
    id: 'categories',
    enabled: true,
    label: { ar: 'التصنيفات', en: 'Categories' },
    href: '/store/categories',
    icon: 'categories',
  },
  {
    id: 'account',
    enabled: true,
    label: { ar: 'حسابي', en: 'Account' },
    href: '/store/login',
    icon: 'account',
  },
  {
    id: 'cart',
    enabled: true,
    label: { ar: 'السلة', en: 'Cart' },
    href: '/store/cart',
    icon: 'cart',
  },
];

export function normalizeMobileTabs(
  raw: CompanyMobileTabRecord[] | null | undefined,
): CompanyMobileTabRecord[] {
  if (!raw?.length) return DEFAULT_MOBILE_TABS.map((tab) => ({ ...tab, label: { ...tab.label } }));
  return raw.map((tab, index) => ({
    id: tab.id || `tab-${index + 1}`,
    enabled: tab.enabled !== false,
    label: { ar: tab.label?.ar ?? '', en: tab.label?.en ?? '' },
    href: (tab.href?.startsWith('/store') ? tab.href : '/store') as `/store${string}` | '/store',
    icon: STOREFRONT_MOBILE_TAB_ICONS.includes(tab.icon as StorefrontMobileTabIcon)
      ? (tab.icon as StorefrontMobileTabIcon)
      : 'home',
  }));
}

export type CompanySecondaryNavItemRecord = CompanyNavItemRecord & {
  highlight?: boolean;
};

export type CompanyAnnouncementHref = `/store${string}` | '/store' | null;

/** One scrolling message inside the announcement bar. */
export type CompanyAnnouncementItemRecord = {
  id: string;
  enabled: boolean;
  message: LocalizableString;
  /** Optional storefront link when this message is clicked. */
  href: CompanyAnnouncementHref;
};

/**
 * Top-of-site announcement strip (above the header).
 * When `scrolling` is true, enabled messages run as a continuous marquee.
 */
export type CompanyAnnouncementBarRecord = {
  enabled: boolean;
  items: CompanyAnnouncementItemRecord[];
  dismissible: boolean;
  /** When false, messages stay static (no marquee). Defaults to true. */
  scrolling: boolean;
  /** Duration of one full marquee loop in milliseconds. */
  speedMs: number;
};

export const DEFAULT_ANNOUNCEMENT_SPEED_MS = 28_000;
export const MIN_ANNOUNCEMENT_SPEED_MS = 3_000;
export const MAX_ANNOUNCEMENT_SPEED_MS = 120_000;

export function clampAnnouncementSpeedMs(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_ANNOUNCEMENT_SPEED_MS;
  }
  return Math.min(
    MAX_ANNOUNCEMENT_SPEED_MS,
    Math.max(MIN_ANNOUNCEMENT_SPEED_MS, Math.round(value)),
  );
}

/** Legacy single-message shape — migrated via `normalizeAnnouncementBar`. */
type LegacyAnnouncementBarRecord = {
  enabled?: boolean;
  message?: LocalizableString;
  href?: CompanyAnnouncementHref;
  dismissible?: boolean;
  scrolling?: boolean;
  items?: CompanyAnnouncementItemRecord[];
  speedMs?: number;
};

export function normalizeAnnouncementBar(
  raw: LegacyAnnouncementBarRecord | CompanyAnnouncementBarRecord | null | undefined,
): CompanyAnnouncementBarRecord {
  const enabled = raw?.enabled ?? false;
  const dismissible = raw?.dismissible ?? true;
  const scrolling = raw?.scrolling !== false;
  const speedMs = clampAnnouncementSpeedMs(
    (raw as LegacyAnnouncementBarRecord | undefined)?.speedMs,
  );

  if (raw?.items && Array.isArray(raw.items)) {
    return {
      enabled,
      dismissible,
      scrolling,
      speedMs,
      items: raw.items.map((item, index) => ({
        id: item.id || `announcement-${index + 1}`,
        enabled: item.enabled !== false,
        message: {
          ar: item.message?.ar ?? '',
          en: item.message?.en ?? '',
        },
        href: item.href ?? null,
      })),
    };
  }

  const legacy = raw as LegacyAnnouncementBarRecord;
  const message = legacy.message ?? { ar: '', en: '' };
  const hasText = Boolean(message.ar?.trim() || message.en?.trim());

  return {
    enabled,
    dismissible,
    scrolling,
    speedMs,
    items: hasText
      ? [
          {
            id: 'legacy-announcement-1',
            enabled: true,
            message: { ar: message.ar ?? '', en: message.en ?? '' },
            href: legacy.href ?? null,
          },
        ]
      : [],
  };
}

export type CompanyCheckoutPaymentMethod =
  | 'cash_on_delivery'
  | 'cash'
  | 'bank'
  | 'network'
  | 'wallet'
  | 'card'
  | 'other';

export const ALL_CHECKOUT_PAYMENT_METHODS: CompanyCheckoutPaymentMethod[] = [
  'cash_on_delivery',
  'cash',
  'bank',
  'network',
  'wallet',
  'card',
  'other',
];

/** Catalog storefront pages that can be shown/hidden in navigation. */
export type CompanyStorePagesVisibility = {
  offers: boolean;
  wholesale: boolean;
};

export const DEFAULT_STORE_PAGES_VISIBILITY: CompanyStorePagesVisibility = {
  offers: true,
  wholesale: true,
};

export function normalizeStorePagesVisibility(
  raw: Partial<CompanyStorePagesVisibility> | null | undefined,
): CompanyStorePagesVisibility {
  return {
    offers: raw?.offers !== false,
    wholesale: raw?.wholesale !== false,
  };
}

export function isStoreCatalogHref(
  href: string,
  page: keyof CompanyStorePagesVisibility,
): boolean {
  if (page === 'offers') return href.includes('/store/offers');
  return href.includes('/store/wholesale');
}

/** Raw CMS company config — bilingual fields resolved at repository boundary. */
export type CompanyConfigRecord = {
  id: string;
  name: LocalizableString;
  logoUrl: string | null;
  faviconUrl: string | null;
  seo: CompanySeoDefaultsRecord;
  contact: CompanyContactInfo;
  social: CompanySocialLinks;
  theme: CompanyThemeColors;
  /** Storefront Google Font / custom upload selection. */
  typography: StorefrontTypography;
  navigation: CompanyNavItemRecord[];
  secondaryNavigation: CompanySecondaryNavItemRecord[];
  footer: CompanyFooterConfigRecord;
  announcement: CompanyAnnouncementBarRecord;
  /** Show/hide offers & wholesale storefront pages in nav. */
  storePages: CompanyStorePagesVisibility;
  /** Bottom mobile tab bar (enabled items only shown on storefront). */
  mobileTabs: CompanyMobileTabRecord[];
  defaultLocale: string;
  currency: string;
  timezone: string;
  /** The company's base country (company settings). */
  country: StoreCountry;
  /** Customers sign in without the password from a trusted device (store setting). */
  trustedDeviceLogin?: boolean;
};

/** @deprecated Use StorefrontCompanyConfig from domain/storefront-models.ts in UI. */
export type CompanyConfig = CompanyConfigRecord;
