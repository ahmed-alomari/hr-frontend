import type { Inventory, MediaItem, Money, StockStatus, ProductStatus } from '@/features/ecommerce/domain/types';
import type {
  CompanyThemeColors,
  CompanyContactInfo,
} from '@/features/ecommerce/storefront/domain/company-config';
import type { LegalPageSlug } from '@/features/ecommerce/storefront/domain/content';
import type { StoreCountry } from '@/features/ecommerce/domain/constants/store-country';
import type { StorefrontTypography } from '@/features/ecommerce/storefront/lib/storefront-fonts';
import type {
  HeroSlideFit,
  HeroSlidePosition,
} from '@/features/ecommerce/storefront/page-builder/domain/layout-types';

export type StorefrontHomepageFeature = {
  id: string;
  title: string;
  description: string;
  icon: 'truck' | 'shield' | 'sparkles' | 'headphones';
};

/** Locale-resolved product — UI consumes this only. */
export type StorefrontProduct = {
  id: string;
  companyId: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  brandId: string | null;
  categoryId: string | null;
  status: ProductStatus;
  stockStatus: StockStatus;
  inventory: Inventory;
  price: Money;
  compareAtPrice: Money | null;
  media: MediaItem[];
  imageUrl: string | null;
  imageAlt: string;
  /** How this product's photos fit their storefront display box. Default: 'contain'. */
  imageDisplayFit: 'contain' | 'cover';
  /** Display box aspect ratio for this product's photos. Default: 'square'. */
  imageDisplayAspectRatio: 'square' | '4/3' | '3/4';
  tags: string[];
  /** Active promo flags from inventory (computed server-side). */
  isNewProductActive?: boolean;
  isTodayDealActive?: boolean;
  /** Has options (size, color…): the card opens the product page to choose one. */
  hasVariants?: boolean;
  isWholesaleActive?: boolean;
  isDiscountActive?: boolean;
  discountPercent?: number | null;
  wholesalePrice?: Money | null;
  metaTitle: string;
  metaDescription: string;
  rating: number | null;
  reviewCount: number;
  /** Attribute lines for variant pickers (when product has variants). */
  attributes: Array<{
    id: string;
    nameAr: string;
    displayType: string;
    values: Array<{
      id: string;
      nameAr: string;
      colorHex?: string;
      imageUrl?: string;
      images?: MediaItem[];
      description?: string;
    }>;
  }>;
  variants: Array<{
    id: string;
    combinationKey: string;
    sku: string;
    nameAr: string;
    /** Variant description shown when this variant is selected. */
    description?: string;
    /** Variant primary image. */
    imageUrl?: string;
    /** Variant image gallery (swaps the PDP gallery on selection). */
    images?: MediaItem[];
    attributeValueIds: string[];
    attributeLabels: Array<{ attributeNameAr: string; valueNameAr: string; colorHex?: string }>;
    price: Money;
    /** What the store can sell of this variant now (its own, never the product's). */
    quantity: number;
    /** false: not counted (sells without a limit); absent: follows the product. */
    stockTracked?: boolean;
    stockStatus: StockStatus;
    isActive: boolean;
  }>;
};

export type StorefrontCategory = {
  id: string;
  companyId: string;
  slug: string;
  name: string;
  description: string;
  parentId: string | null;
  imageUrl: string | null;
  imageAlt: string;
  displayOrder: number;
  featuredBrandIds: string[];
  metaTitle: string;
  metaDescription: string;
};

export type StorefrontBrand = {
  id: string;
  companyId: string;
  slug: string;
  name: string;
  /** Both names, shown one above the other (2026-11-14). */
  nameAr?: string;
  nameEn?: string | null;
  description: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  metaTitle: string;
  metaDescription: string;
};

export type StorefrontNavItem = {
  label: string;
  href: `/store${string}` | '/store';
};

export type StorefrontPromoLink = StorefrontNavItem & { highlight?: boolean };

export const REGULAR_PRODUCTS_HREF = '/store/products?regular=1' as const;

/** Ordinary products stay reachable even when the CMS nav only lists specials. */
export function withRegularProductsTab(
  links: StorefrontPromoLink[],
  label: string,
): StorefrontPromoLink[] {
  if (links.some((item) => item.href.includes('regular=1'))) return links;
  return [{ label, href: REGULAR_PRODUCTS_HREF }, ...links];
}

export type StorefrontCompanyConfig = {
  id: string;
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  seo: {
    homeTitle: string;
    homeDescription: string;
    productsTitle: string;
    productsDescription: string;
    keywords: string[];
    defaultOgImage: string | null;
  };
  contact: CompanyContactInfo;
  social: Partial<Record<import('@/features/ecommerce/storefront/domain/company-config').CompanySocialNetwork, string>>;
  theme: CompanyThemeColors;
  /** Runtime CSS variable overrides for the store shell (HSL channels). */
  themeCssVars?: Record<string, string>;
  /** Curated Google Font preset ids — applied only under /store. */
  typography: StorefrontTypography;
  navigation: StorefrontNavItem[];
  secondaryNavigation: (StorefrontNavItem & { highlight?: boolean })[];
  footer: {
    copyrightOwnerName: string;
    tagline: string;
    commercialRegistration: string | null;
    linkGroups: {
      id: string;
      title: string;
      links: StorefrontNavItem[];
    }[];
  };
  announcement: {
    enabled: boolean;
    items: Array<{
      id: string;
      message: string;
      href: `/store${string}` | '/store' | null;
    }>;
    dismissible: boolean;
    /** When false, messages stay static (no marquee). */
    scrolling: boolean;
    /** Duration of one full marquee loop in milliseconds. */
    speedMs: number;
  };
  storePages: {
    offers: boolean;
    wholesale: boolean;
  };
  currency: string;
  timezone: string;
  /** The company's base country (company settings). */
  country: StoreCountry;
  /** Customers sign in without the password from a trusted device (store setting). */
  trustedDeviceLogin?: boolean;
};

export type StorefrontHeroSlide = {
  id: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  fit?: HeroSlideFit;
  position?: HeroSlidePosition;
  title: string;
  alt: string;
  href: `/store${string}` | null;
};

export type StorefrontFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type StorefrontAboutContent = {
  headline: string;
  intro: string;
  sections: { id: string; title: string; body: string }[];
  stats: { id: string; label: string; value: string }[];
};

export type StorefrontContactContent = {
  headline: string;
  intro: string;
  hours: string;
  mapEmbedUrl: string | null;
};

export type StorefrontLegalPage = {
  slug: LegalPageSlug;
  title: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  updatedAt: string;
};

export type StorefrontPaginated<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
