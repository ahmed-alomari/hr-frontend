import type {
  StorefrontBrand,
  StorefrontCategory,
  StorefrontPaginated,
  StorefrontProduct,
} from '@/features/ecommerce/storefront/domain/storefront-models';
import type { StorefrontLocale } from '@/i18n/routing';
import { emptyPaginated } from '@/features/ecommerce/storefront/lib/repositories/normalize';
import {
  fromDecimalString,
  isStoreHttpEnabled,
  publicStoreRequest,
} from '@/features/ecommerce/storefront/lib/api/store-http';
import { resolveStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { resolveUploadUrl } from '@/shared/resolve-upload-url';

export type StorefrontSearchResult = {
  products: StorefrontPaginated<StorefrontProduct>;
  categories: StorefrontPaginated<StorefrontCategory>;
  brands: StorefrontPaginated<StorefrontBrand>;
  query: string;
};

type StoreSearchProductDto = {
  id: string;
  companyId?: string;
  slug: string;
  sku?: string;
  nameAr: string;
  nameEn?: string | null;
  description?: string | null;
  brandId?: string | null;
  categoryId?: string | null;
  status?: StorefrontProduct['status'];
  stockStatus?: StorefrontProduct['stockStatus'];
  priceAmount?: string | number | null;
  priceCurrency?: string | null;
  compareAtPriceAmount?: string | number | null;
  compareAtPriceCurrency?: string | null;
  quantityCache?: string | number | null;
  primaryImageUrl?: string | null;
  primaryImageAlt?: string | null;
  tags?: string[] | null;
  seoMetaTitle?: string | null;
  seoMetaDescription?: string | null;
  ratingAvg?: string | number | null;
  reviewCount?: string | number | null;
  rating_avg?: string | number | null;
  review_count?: string | number | null;
  hasVariants?: boolean;
};

type StoreSearchCategoryDto = {
  id: string;
  companyId?: string;
  slug: string;
  nameAr: string;
  nameEn?: string | null;
  description?: string | null;
  parentId?: string | null;
  imageUrl?: string | null;
  displayOrder?: number;
  featuredBrandIds?: string[];
  seoMetaTitle?: string | null;
  seoMetaDescription?: string | null;
};

type StoreSearchBrandDto = {
  id: string;
  companyId?: string;
  slug: string;
  nameAr: string;
  nameEn?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  seoMetaTitle?: string | null;
  seoMetaDescription?: string | null;
};

type StoreSearchBucketDto<T> = {
  items?: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type StoreSearchResponseDto = {
  products?: StoreSearchBucketDto<StoreSearchProductDto>;
  categories?: StoreSearchBucketDto<StoreSearchCategoryDto>;
  brands?: StoreSearchBucketDto<StoreSearchBrandDto>;
};

function pickLocalized(locale: StorefrontLocale, ar: string, en?: string | null): string {
  return locale === 'en' && en ? en : ar;
}

function asBucket<T>(value: StoreSearchBucketDto<T> | undefined): {
  items: T[];
  pagination: StorefrontPaginated<T>['pagination'];
} {
  if (!value) {
    return { items: [], pagination: emptyPaginated<T>().pagination };
  }
  const items = value.items ?? [];
  return {
    items,
    pagination: value.pagination ?? {
      page: 1,
      limit: items.length,
      total: items.length,
      totalPages: 1,
    },
  };
}

function mapSearchProduct(
  dto: StoreSearchProductDto,
  companyId: string,
  locale: StorefrontLocale,
): StorefrontProduct {
  const name = pickLocalized(locale, dto.nameAr, dto.nameEn);
  const currency = dto.priceCurrency || 'YER';
  const amount = fromDecimalString(dto.priceAmount);
  const compareAmount =
    dto.compareAtPriceAmount == null || dto.compareAtPriceAmount === ''
      ? null
      : fromDecimalString(dto.compareAtPriceAmount);
  const imageUrl = dto.primaryImageUrl ? resolveUploadUrl(dto.primaryImageUrl) : null;

  return {
    id: dto.id,
    companyId: dto.companyId || companyId,
    slug: dto.slug,
    sku: dto.sku || '',
    name,
    description: dto.description ?? '',
    brandId: dto.brandId ?? null,
    categoryId: dto.categoryId ?? null,
    status: dto.status ?? 'active',
    stockStatus: dto.stockStatus ?? 'in_stock',
    inventory: {
      trackInventory: true,
      quantity: fromDecimalString(dto.quantityCache),
      lowStockThreshold: 0,
      allowBackorder: false,
    },
    price: { amount, currency },
    compareAtPrice:
      compareAmount == null
        ? null
        : { amount: compareAmount, currency: dto.compareAtPriceCurrency || currency },
    media: imageUrl
      ? [
          {
            id: `${dto.id}-primary`,
            url: imageUrl,
            alt: dto.primaryImageAlt || name,
            type: 'image' as const,
            position: 0,
            isPrimary: true,
          },
        ]
      : [],
    imageUrl,
    imageAlt: dto.primaryImageAlt || name,
    imageDisplayFit: 'contain',
    imageDisplayAspectRatio: 'square',
    tags: dto.tags ?? [],
    metaTitle: dto.seoMetaTitle || name,
    metaDescription: dto.seoMetaDescription || '',
    rating: (() => {
      const raw = dto.ratingAvg ?? dto.rating_avg ?? null;
      if (raw == null || raw === '') return null;
      const value = fromDecimalString(raw);
      return Number.isFinite(value) && value > 0 ? value : null;
    })(),
    reviewCount: Math.max(0, Math.floor(fromDecimalString(dto.reviewCount ?? dto.review_count ?? 0))),
    attributes: [],
    variants: [],
    hasVariants: Boolean(dto.hasVariants),
  };
}

function mapSearchCategory(
  dto: StoreSearchCategoryDto,
  companyId: string,
  locale: StorefrontLocale,
): StorefrontCategory {
  const name = pickLocalized(locale, dto.nameAr, dto.nameEn);
  return {
    id: dto.id,
    companyId: dto.companyId || companyId,
    slug: dto.slug,
    name,
    description: dto.description ?? '',
    parentId: dto.parentId ?? null,
    imageUrl: dto.imageUrl ?? null,
    imageAlt: name,
    displayOrder: dto.displayOrder ?? 0,
    featuredBrandIds: dto.featuredBrandIds ?? [],
    metaTitle: dto.seoMetaTitle || name,
    metaDescription: dto.seoMetaDescription || '',
  };
}

function mapSearchBrand(
  dto: StoreSearchBrandDto,
  companyId: string,
  locale: StorefrontLocale,
): StorefrontBrand {
  const name = pickLocalized(locale, dto.nameAr, dto.nameEn);
  return {
    id: dto.id,
    companyId: dto.companyId || companyId,
    slug: dto.slug,
    name,
    nameAr: dto.nameAr,
    nameEn: dto.nameEn ?? null,
    description: dto.description ?? '',
    websiteUrl: dto.websiteUrl ?? null,
    logoUrl: dto.logoUrl ?? null,
    metaTitle: dto.seoMetaTitle || name,
    metaDescription: dto.seoMetaDescription || '',
  };
}

async function searchViaHttp(
  companyId: string,
  locale: StorefrontLocale,
  query: string,
  limit: number,
): Promise<StorefrontSearchResult | null> {
  const dto = await publicStoreRequest<StoreSearchResponseDto>('/public/store/search', {
    query: {
      companyId: resolveStorefrontCompanyId(companyId),
      q: query,
      page: 1,
      limit,
    },
  });
  if (!dto) return null;

  const productsBucket = asBucket(dto.products);
  const categoriesBucket = asBucket(dto.categories);
  const brandsBucket = asBucket(dto.brands);
  const resolvedCompanyId = resolveStorefrontCompanyId(companyId);

  return {
    products: {
      items: productsBucket.items.map((item) =>
        mapSearchProduct(item, resolvedCompanyId, locale),
      ),
      pagination: productsBucket.pagination,
    },
    categories: {
      items: categoriesBucket.items.map((item) =>
        mapSearchCategory(item, resolvedCompanyId, locale),
      ),
      pagination: categoriesBucket.pagination,
    },
    brands: {
      items: brandsBucket.items.map((item) => mapSearchBrand(item, resolvedCompanyId, locale)),
      pagination: brandsBucket.pagination,
    },
    query,
  };
}

/** Unified storefront search — HTTP only (binding §3). */
export const storefrontSearchRepository = {
  async search(
    companyId: string,
    locale: StorefrontLocale,
    query: string,
    options?: { limit?: number },
  ): Promise<StorefrontSearchResult> {
    const trimmed = query.trim();
    const limit = options?.limit ?? 12;

    if (!trimmed) {
      return {
        products: emptyPaginated(),
        categories: emptyPaginated(),
        brands: emptyPaginated(),
        query: trimmed,
      };
    }

    if (!isStoreHttpEnabled()) {
      throw new Error('STORE_HTTP_DISABLED');
    }

    const httpResult = await searchViaHttp(companyId, locale, trimmed, limit);
    if (!httpResult) {
      throw new Error('STORE_SEARCH_FAILED');
    }
    return httpResult;
  },
};
