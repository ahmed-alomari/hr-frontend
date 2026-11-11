import { ApiError, apiRequest, type PaginatedResult } from '@/features/hr/lib/api/client';
import { toNumber, toOptionalNumber } from '@/features/inventory/lib/api/numbers';
import { resolveStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import {
  dedupeAttributeValues,
  dedupeVariantsByCombinationKey,
} from '@/features/catalog/products/lib/product-variants';
import type { MediaItem } from '@/features/ecommerce/domain/types/common';
import type {
  CreateProductInput,
  Product,
  ProductAttribute,
  ProductAttributeValue,
  ProductListQuery,
  ProductUomLine,
  ProductVariant,
  UpdateProductInput,
} from '@/features/ecommerce/domain/types/product';
import type { AdminProductsPort } from '@/features/ecommerce/domain/ports/catalog.ports';
import { storeCurrencyCode, isStoreCurrency } from '@/features/ecommerce/domain/constants/store-currency';
import { UUID_RE, isPersistedId } from '@/features/catalog/products/lib/id-utils';
import { PRODUCT_VARIANT_CUSTOM_UOM_ENABLED } from '@/features/catalog/products/constants/product-feature-flags';
import type { ListGroupsResult } from '@/components/ui/list-group';

export { isPersistedId };

/** The list's filters as query parameters (the list and its groups). */
function productFilterQuery(query: ProductListQuery, companyId: string) {
  return {
    companyId,
    search: query.search,
    categoryId: query.categoryId,
    brandId: query.brandId,
    status: query.status,
    stockStatus: query.stockStatus,
    warehouseId: query.warehouseId,
    locationId: query.locationId,
    posAvailable: query.posAvailable === true ? true : undefined,
    tags: query.tag,
    priceAmountMin: query.minPrice,
    priceAmountMax: query.maxPrice,
    isNewProduct: query.isNewProduct === true ? true : undefined,
    isTodayDeal: query.isTodayDeal === true ? true : undefined,
    isWholesale: query.isWholesale === true ? true : undefined,
    isDiscounted: query.isDiscounted === true ? true : undefined,
    archiveScope: query.status === 'archived' ? 'archived' : 'active',
    groupBy: query.groupBy,
  };
}

/** Product counts of the filtered list, per `groupBy` group and overall. */
export async function fetchProductGroups(query: ProductListQuery): Promise<ListGroupsResult> {
  const companyId = resolveStorefrontCompanyId(query.companyId);
  return apiRequest<ListGroupsResult>('/inventory/products/groups', {
    throwOnError: true,
    query: productFilterQuery(query, companyId),
  });
}

/**
 * Per-value variant usage counts for a persisted attribute line, keyed by
 * productAttributeValueId. Used to warn before a value is deselected on the
 * product attribute picker — deselecting only archives the value server-side,
 * it never touches existing variant links, but the user should still see the
 * impact before confirming.
 */
export async function fetchAttributeValueUsage(
  productAttributeLineId: string,
): Promise<Record<string, number>> {
  return apiRequest<Record<string, number>>('/inventory/product-attribute-values/usage', {
    query: { productAttributeLineId },
  });
}

/** Empty / placeholder → null; non-UUID strings are cleared so Nest validation does not 400. */
function normalizeOptionalUuid(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '__none__' || !UUID_RE.test(trimmed)) return null;
  return trimmed;
}

type ProductDto = {
  id: string;
  companyId: string;
  brandId?: string | null;
  categoryId?: string | null;
  posMenuCategoryId?: string | null;
  sku: string;
  slug: string;
  barcode?: string | null;
  nameAr: string;
  nameEn?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  status: Product['status'];
  stockStatus: Product['stockStatus'];
  productType?: Product['productType'];
  tracking?: Product['tracking'];
  invoicePolicy?: Product['invoicePolicy'];
  priceAmount: string | number;
  priceCurrency: string;
  costPriceAmount?: string | number | null;
  costPriceCurrency?: string | null;
  costManaged?: boolean;
  compareAtPriceAmount?: string | number | null;
  compareAtPriceCurrency?: string | null;
  trackInventory: boolean;
  quantityCache: string | number;
  lowStockThreshold: string | number;
  allowBackorder: boolean;
  weightKg?: string | number | null;
  lengthCm?: string | number | null;
  widthCm?: string | number | null;
  heightCm?: string | number | null;
  posAvailable?: boolean;
  warehouseId?: string | null;
  locationId?: string | null;
  saleOk?: boolean;
  purchaseOk?: boolean;
  systemCode?: string | null;
  ownQuantity?: number | string | null;
  isNewProduct?: boolean;
  newUntil?: string | null;
  isTodayDeal?: boolean;
  dealPriceAmount?: string | number | null;
  dealDays?: string | number | null;
  dealUntil?: string | null;
  isWholesale?: boolean;
  wholesalePriceAmount?: string | number | null;
  wholesaleUntil?: string | null;
  isDiscounted?: boolean;
  discountPercent?: string | number | null;
  /** An amount off the selling price (instead of a percent). */
  discountAmount?: string | number | null;
  inTodayDeals?: boolean;
  discountUntil?: string | null;
  isNewProductActive?: boolean;
  isTodayDealActive?: boolean;
  isWholesaleActive?: boolean;
  isDiscountActive?: boolean;
  tags?: string[] | null;
  seoMetaTitle?: string | null;
  seoMetaDescription?: string | null;
  seoCanonicalPath?: string | null;
  seoOgImage?: string | null;
  seoKeywords?: string[] | null;
  imageDisplayFit?: Product['imageDisplayFit'];
  imageDisplayAspectRatio?: Product['imageDisplayAspectRatio'];
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type MediaDto = {
  id: string;
  productId: string;
  url: string;
  alt: string;
  type: MediaItem['type'];
  position: number;
  isPrimary: boolean;
  width?: number | null;
  height?: number | null;
};

type UomDto = {
  id: string;
  catalogUomId?: string | null;
  nameAr: string;
  uneceCode?: string | null;
  relativeQuantity: string | number;
  isReference: boolean;
  packagingType: ProductUomLine['packagingType'];
  sortOrder?: number;
};

type AttrValueDto = {
  id: string;
  catalogAttributeValueId?: string | null;
  nameAr: string;
  freeText?: string | null;
  defaultExtraPrice?: string | number | null;
  colorHex?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
};

type AttrLineDto = {
  id: string;
  catalogAttributeId?: string | null;
  nameAr: string;
  displayType: ProductAttribute['displayType'];
  createVariant: ProductAttribute['createVariant'];
  sortOrder?: number;
  values?: AttrValueDto[];
};

type VariantLinkDto = {
  id: string;
  productAttributeValueId: string;
  attributeNameAr: string;
  valueNameAr: string;
  colorHex?: string | null;
};

type VariantDto = {
  id: string;
  combinationKey: string;
  sku: string;
  nameAr: string;
  barcode?: string | null;
  imageUrl?: string | null;
  images?: string[] | null;
  salePriceAmount: string | number;
  salePriceCurrency: string;
  costPriceAmount: string | number;
  costPriceCurrency: string;
  costManaged?: boolean;
  quantityCache: string | number;
  stockStatus: ProductVariant['stockStatus'];
  isActive: boolean;
  attributeValueIds?: string[];
  attributeLinks?: VariantLinkDto[];
  hasCustomUom?: boolean;
  uomLines?: UomDto[];
};

type ProductFullDto = ProductDto & {
  media?: MediaDto[];
  uomLines?: UomDto[];
  attributes?: AttrLineDto[];
  variants?: VariantDto[];
  idMap?: Record<string, string>;
};

function mapMedia(items: MediaDto[] | undefined): MediaItem[] {
  return (items ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((dto) => ({
      id: dto.id,
      url: dto.url,
      alt: dto.alt ?? '',
      type: dto.type,
      position: dto.position,
      isPrimary: dto.isPrimary,
      width: dto.width ?? undefined,
      height: dto.height ?? undefined,
    }));
}

function mapUomLines(items: UomDto[] | undefined): ProductUomLine[] {
  return (items ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((dto) => ({
      id: dto.id,
      catalogUomId: dto.catalogUomId ?? undefined,
      nameAr: dto.nameAr,
      uneceCode: dto.uneceCode ?? undefined,
      relativeQuantity: toNumber(dto.relativeQuantity, 1),
      isReference: dto.isReference,
      packagingType: dto.packagingType,
    }));
}

function mapAttributes(items: AttrLineDto[] | undefined): ProductAttribute[] {
  return (items ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((line) => ({
      id: line.id,
      attributeId: line.catalogAttributeId ?? undefined,
      nameAr: line.nameAr,
      displayType: line.displayType,
      createVariant: line.createVariant,
      values: (line.values ?? [])
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(
          (value): ProductAttributeValue => ({
            id: value.id,
            nameAr: value.nameAr,
            freeText: value.freeText ?? undefined,
            defaultExtraPrice: toOptionalNumber(value.defaultExtraPrice),
            colorHex: value.colorHex ?? undefined,
            imageUrl: value.imageUrl ?? undefined,
            catalogAttributeValueId: value.catalogAttributeValueId ?? undefined,
          }),
        ),
    }));
}

function mapVariants(items: VariantDto[] | undefined): ProductVariant[] {
  return (items ?? []).map((dto) => {
    const links = dto.attributeLinks ?? [];
    const attributeValueIds =
      dto.attributeValueIds ?? links.map((link) => link.productAttributeValueId);
    return {
      id: dto.id,
      combinationKey: dto.combinationKey,
      sku: dto.sku,
      nameAr: dto.nameAr,
      attributeValueIds,
      attributeLabels: links.map((link) => ({
        attributeNameAr: link.attributeNameAr,
        valueNameAr: link.valueNameAr,
        colorHex: link.colorHex ?? undefined,
      })),
      salePrice: {
        amount: toNumber(dto.salePriceAmount),
        currency: dto.salePriceCurrency || storeCurrencyCode(),
      },
      costPrice: {
        amount: toNumber(dto.costPriceAmount),
        currency: dto.costPriceCurrency || storeCurrencyCode(),
      },
      costManaged: dto.costManaged === true,
      quantity: toNumber(dto.quantityCache),
      stockStatus: dto.stockStatus,
      barcode: dto.barcode ?? undefined,
      imageUrl: dto.imageUrl ?? undefined,
      images: (dto.images ?? []).filter(Boolean).map((url, index) => ({
        id: `variant-image-${dto.id}-${index}`,
        url,
        alt: '',
        type: 'image' as const,
        position: index,
        isPrimary: index === 0,
      })),
      isActive: dto.isActive,
      hasCustomUom: dto.hasCustomUom === true,
      uomLines: dto.hasCustomUom ? mapUomLines(dto.uomLines) : undefined,
    };
  });
}

function mapFullProduct(dto: ProductFullDto): Product {
  const currency = dto.priceCurrency || storeCurrencyCode();
  const costAmount = toOptionalNumber(dto.costPriceAmount);
  const compareAmount = toOptionalNumber(dto.compareAtPriceAmount);
  return {
    id: dto.id,
    companyId: dto.companyId,
    brandId: dto.brandId ?? null,
    categoryId: dto.categoryId ?? null,
    posMenuCategoryId: dto.posMenuCategoryId ?? null,
    sku: dto.sku,
    slug: dto.slug,
    barcode: dto.barcode ?? undefined,
    nameAr: dto.nameAr,
    nameEn: dto.nameEn ?? undefined,
    description: dto.description ?? undefined,
    shortDescription: dto.shortDescription ?? undefined,
    status: dto.status ?? 'active',
    stockStatus: dto.stockStatus ?? 'in_stock',
    productType: dto.productType,
    tracking: dto.tracking,
    invoicePolicy: dto.invoicePolicy,
    inventory: {
      trackInventory: dto.trackInventory,
      quantity: toNumber(dto.quantityCache),
      lowStockThreshold: toNumber(dto.lowStockThreshold, 5),
      allowBackorder: dto.allowBackorder,
    },
    price: { amount: toNumber(dto.priceAmount), currency },
    costPrice:
      costAmount !== undefined
        ? { amount: costAmount, currency: dto.costPriceCurrency || currency }
        : undefined,
    costManaged: dto.costManaged === true,
    compareAtPrice:
      compareAmount !== undefined
        ? { amount: compareAmount, currency: dto.compareAtPriceCurrency || currency }
        : undefined,
    media: mapMedia(dto.media),
    imageDisplayFit: dto.imageDisplayFit ?? 'contain',
    imageDisplayAspectRatio: dto.imageDisplayAspectRatio ?? 'square',
    seo: {
      metaTitle: dto.seoMetaTitle ?? undefined,
      metaDescription: dto.seoMetaDescription ?? undefined,
      canonicalPath: dto.seoCanonicalPath ?? undefined,
      ogImage: dto.seoOgImage ?? undefined,
      keywords: dto.seoKeywords ?? undefined,
    },
    tags: dto.tags ?? undefined,
    weightKg: toOptionalNumber(dto.weightKg),
    dimensions: {
      lengthCm: toOptionalNumber(dto.lengthCm),
      widthCm: toOptionalNumber(dto.widthCm),
      heightCm: toOptionalNumber(dto.heightCm),
    },
    posAvailable: dto.posAvailable,
    warehouseId: dto.warehouseId ?? null,
    locationId: dto.locationId ?? null,
    saleOk: dto.saleOk,
    purchaseOk: dto.purchaseOk,
    systemCode: dto.systemCode ?? null,
    ownQuantity: dto.ownQuantity === null || dto.ownQuantity === undefined ? null : Number(dto.ownQuantity),
    isNewProduct: Boolean(dto.isNewProduct),
    newUntil: dto.newUntil ?? null,
    isTodayDeal: Boolean(dto.isTodayDeal),
    dealPrice: (() => {
      const amount = toOptionalNumber(dto.dealPriceAmount);
      return amount !== undefined ? { amount, currency } : undefined;
    })(),
    dealDays: toOptionalNumber(dto.dealDays) ?? null,
    dealUntil: dto.dealUntil ?? null,
    isWholesale: Boolean(dto.isWholesale),
    wholesalePrice: (() => {
      const amount = toOptionalNumber(dto.wholesalePriceAmount);
      return amount !== undefined ? { amount, currency } : undefined;
    })(),
    wholesaleUntil: dto.wholesaleUntil ?? null,
    isDiscounted: Boolean(dto.isDiscounted),
    discountPercent: toOptionalNumber(dto.discountPercent) ?? null,
    discountAmount: toOptionalNumber(dto.discountAmount) ?? null,
    inTodayDeals: Boolean(dto.inTodayDeals),
    discountUntil: dto.discountUntil ?? null,
    isNewProductActive: Boolean(dto.isNewProductActive),
    isTodayDealActive: Boolean(dto.isTodayDealActive),
    isWholesaleActive: Boolean(dto.isWholesaleActive),
    isDiscountActive: Boolean(dto.isDiscountActive),
    attributes: mapAttributes(dto.attributes),
    variants: mapVariants(dto.variants),
    uomLines: mapUomLines(dto.uomLines),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    archivedAt: dto.archivedAt ?? null,
  };
}

function toHeaderBody(input: CreateProductInput | UpdateProductInput, mode: 'create' | 'update') {
  const body: Record<string, unknown> = {};
  if (mode === 'create' && 'companyId' in input) body.companyId = input.companyId;
  if (input.brandId !== undefined) body.brandId = normalizeOptionalUuid(input.brandId);
  if (input.categoryId !== undefined) body.categoryId = normalizeOptionalUuid(input.categoryId);
  if (input.posMenuCategoryId !== undefined) {
    body.posMenuCategoryId = normalizeOptionalUuid(input.posMenuCategoryId);
  }
  if (input.sku !== undefined) body.sku = input.sku;
  if (input.slug !== undefined && input.slug.trim() !== '') body.slug = input.slug;
  if (input.barcode !== undefined) body.barcode = input.barcode ?? null;
  if (input.nameAr !== undefined) body.nameAr = input.nameAr;
  if (input.nameEn !== undefined && input.nameEn.trim() !== '') body.nameEn = input.nameEn;
  if (input.description !== undefined) body.description = input.description ?? null;
  if (input.shortDescription !== undefined) body.shortDescription = input.shortDescription ?? null;
  if (input.status !== undefined) body.status = input.status;
  if (input.stockStatus !== undefined) body.stockStatus = input.stockStatus;
  if (input.productType !== undefined) body.productType = input.productType;
  if (input.tracking !== undefined) body.tracking = input.tracking;
  if (input.invoicePolicy !== undefined) body.invoicePolicy = input.invoicePolicy;
  if (input.price !== undefined) {
    body.priceAmount = input.price.amount;
  }
  // Prices are in the company base currency — always persist it so leftover codes cannot block checkout.
  body.priceCurrency = storeCurrencyCode();
  if (input.costPrice !== undefined) {
    body.costPriceAmount = input.costPrice?.amount ?? null;
    body.costPriceCurrency = input.costPrice ? storeCurrencyCode() : null;
  }
  if (input.compareAtPrice !== undefined) {
    body.compareAtPriceAmount = input.compareAtPrice?.amount ?? null;
    body.compareAtPriceCurrency = input.compareAtPrice ? storeCurrencyCode() : null;
  }
  if (input.inventory !== undefined) {
    body.trackInventory = input.inventory.trackInventory;
    body.lowStockThreshold = input.inventory.lowStockThreshold;
    body.allowBackorder = input.inventory.allowBackorder;
  }
  if (input.weightKg !== undefined) body.weightKg = input.weightKg ?? null;
  if (input.dimensions !== undefined) {
    body.lengthCm = input.dimensions.lengthCm ?? null;
    body.widthCm = input.dimensions.widthCm ?? null;
    body.heightCm = input.dimensions.heightCm ?? null;
  }
  if (input.posAvailable !== undefined) body.posAvailable = input.posAvailable;
  if (input.warehouseId !== undefined) body.warehouseId = normalizeOptionalUuid(input.warehouseId);
  if (input.locationId !== undefined) body.locationId = normalizeOptionalUuid(input.locationId);
  if (input.saleOk !== undefined) body.saleOk = input.saleOk;
  if (input.purchaseOk !== undefined) body.purchaseOk = input.purchaseOk;
  if (input.isNewProduct !== undefined) {
    body.isNewProduct = input.isNewProduct;
    body.newUntil = input.isNewProduct ? (input.newUntil ?? null) : null;
  } else if (input.newUntil !== undefined) {
    body.newUntil = input.newUntil ?? null;
  }
  if (input.isTodayDeal !== undefined) {
    body.isTodayDeal = input.isTodayDeal;
    body.dealPriceAmount = input.isTodayDeal ? (input.dealPrice?.amount ?? null) : null;
    body.dealDays = input.isTodayDeal ? (input.dealDays ?? null) : null;
    body.dealUntil = input.isTodayDeal ? (input.dealUntil ?? null) : null;
  } else {
    if (input.dealPrice !== undefined) body.dealPriceAmount = input.dealPrice?.amount ?? null;
    if (input.dealDays !== undefined) body.dealDays = input.dealDays ?? null;
    if (input.dealUntil !== undefined) body.dealUntil = input.dealUntil ?? null;
  }
  if (input.isWholesale !== undefined) {
    body.isWholesale = input.isWholesale;
    body.wholesalePriceAmount = input.isWholesale
      ? (input.wholesalePrice?.amount ?? null)
      : null;
    body.wholesaleUntil = input.isWholesale ? (input.wholesaleUntil ?? null) : null;
  } else {
    if (input.wholesalePrice !== undefined) {
      body.wholesalePriceAmount = input.wholesalePrice?.amount ?? null;
    }
    if (input.wholesaleUntil !== undefined) body.wholesaleUntil = input.wholesaleUntil ?? null;
  }
  if (input.isDiscounted !== undefined) {
    body.isDiscounted = input.isDiscounted;
    body.discountPercent = input.isDiscounted ? (input.discountPercent ?? null) : null;
    body.discountAmount = input.isDiscounted ? (input.discountAmount ?? null) : null;
    body.inTodayDeals = input.isDiscounted ? input.inTodayDeals === true : false;
    body.discountUntil = input.isDiscounted ? (input.discountUntil ?? null) : null;
  } else {
    if (input.discountPercent !== undefined) body.discountPercent = input.discountPercent ?? null;
    if (input.discountAmount !== undefined) body.discountAmount = input.discountAmount ?? null;
    if (input.inTodayDeals !== undefined) body.inTodayDeals = input.inTodayDeals;
    if (input.discountUntil !== undefined) body.discountUntil = input.discountUntil ?? null;
  }
  if (input.tags !== undefined) body.tags = input.tags ?? null;
  if (input.imageDisplayFit !== undefined) body.imageDisplayFit = input.imageDisplayFit;
  if (input.imageDisplayAspectRatio !== undefined) {
    body.imageDisplayAspectRatio = input.imageDisplayAspectRatio;
  }
  if (input.seo !== undefined) {
    if (input.seo.metaTitle !== undefined) body.seoMetaTitle = input.seo.metaTitle ?? null;
    if (input.seo.metaDescription !== undefined) body.seoMetaDescription = input.seo.metaDescription ?? null;
    if (input.seo.canonicalPath !== undefined) body.seoCanonicalPath = input.seo.canonicalPath ?? null;
    if (input.seo.ogImage !== undefined) body.seoOgImage = input.seo.ogImage ?? null;
    if (input.seo.keywords !== undefined) body.seoKeywords = input.seo.keywords ?? null;
  }
  return body;
}

function refKey(id: string, prefix: string, index: number) {
  return isPersistedId(id) ? id : id || `${prefix}-${index}`;
}

function toFullBody(input: CreateProductInput | UpdateProductInput, mode: 'create' | 'update') {
  const body = toHeaderBody(input, mode);

  if (input.media !== undefined) {
    body.media = input.media.map((item, index) => {
      const persisted = mode === 'update' && isPersistedId(item.id);
      return {
        ...(persisted ? { id: item.id } : { clientKey: refKey(item.id, 'm', index) }),
        url: item.url,
        alt: item.alt ?? '',
        type: item.type ?? 'image',
        position: item.position ?? index,
        isPrimary: item.isPrimary,
        width: item.width ?? null,
        height: item.height ?? null,
      };
    });
  }

  if (input.uomLines !== undefined) {
    body.uomLines = input.uomLines.map((line, index) => {
      const persisted = mode === 'update' && isPersistedId(line.id);
      return {
        ...(persisted ? { id: line.id } : { clientKey: refKey(line.id, 'u', index) }),
        catalogUomId: line.catalogUomId ?? null,
        nameAr: line.nameAr,
        uneceCode: line.uneceCode ?? null,
        relativeQuantity: line.relativeQuantity,
        isReference: line.isReference,
        packagingType: line.packagingType,
        sortOrder: index,
      };
    });
  }

  if (input.attributes !== undefined) {
    body.attributes = input.attributes.map((attr, attrIndex) => {
      const linePersisted = mode === 'update' && isPersistedId(attr.id);
      const uniqueValues = dedupeAttributeValues(attr.values);
      return {
        ...(linePersisted ? { id: attr.id } : { clientKey: refKey(attr.id, 'a', attrIndex) }),
        catalogAttributeId: attr.attributeId ?? null,
        nameAr: attr.nameAr,
        displayType: attr.displayType,
        createVariant: attr.createVariant,
        sortOrder: attrIndex,
        values: uniqueValues.map((value, valueIndex) => {
          const valuePersisted = mode === 'update' && isPersistedId(value.id);
          const catalogAttributeValueId =
            value.catalogAttributeValueId ??
            (!valuePersisted && isPersistedId(value.id) ? value.id : null);
          return {
            ...(valuePersisted
              ? { id: value.id }
              : { clientKey: refKey(value.id, `v${attrIndex}`, valueIndex) }),
            catalogAttributeValueId,
            nameAr: value.nameAr,
            freeText: value.freeText ?? null,
            defaultExtraPrice: value.defaultExtraPrice ?? null,
            colorHex: value.colorHex ?? null,
            imageUrl: value.imageUrl ?? null,
            sortOrder: valueIndex,
          };
        }),
      };
    });
  }

  if (input.variants !== undefined) {
    const valueKeyByFormId = new Map<string, string>();
    for (const [attrIndex, attr] of (input.attributes ?? []).entries()) {
      for (const [valueIndex, value] of dedupeAttributeValues(attr.values).entries()) {
        const valuePersisted = mode === 'update' && isPersistedId(value.id);
        const key = valuePersisted
          ? value.id
          : refKey(value.id, `v${attrIndex}`, valueIndex);
        valueKeyByFormId.set(value.id, key);
      }
    }

    const uniqueVariants = dedupeVariantsByCombinationKey(input.variants);

    body.variants = uniqueVariants.map((variant, index) => {
      const persisted = mode === 'update' && isPersistedId(variant.id);
      const attributeValueIds: string[] = [];
      const attributeValueClientKeys: string[] = [];

      for (const formValueId of variant.attributeValueIds) {
        const mapped = valueKeyByFormId.get(formValueId) ?? formValueId;
        // Only real product-attribute-value UUIDs go in attributeValueIds.
        // Everything else (pval-*, etc.) must be attributeValueClientKeys matching attributes[].values.
        if (mode === 'update' && isPersistedId(formValueId) && isPersistedId(mapped) && mapped === formValueId) {
          attributeValueIds.push(formValueId);
        } else {
          attributeValueClientKeys.push(mapped);
        }
      }

      return {
        ...(persisted ? { id: variant.id } : { clientKey: refKey(variant.id, 'var', index) }),
        combinationKey: variant.combinationKey,
        sku: variant.sku,
        nameAr: variant.nameAr,
        barcode: variant.barcode ?? null,
        imageUrl: variant.images?.[0]?.url ?? variant.imageUrl ?? null,
        images: variant.images && variant.images.length > 0 ? variant.images.map((item) => item.url) : [],
        salePriceAmount: variant.salePrice.amount,
        salePriceCurrency: storeCurrencyCode(),
        costPriceAmount: variant.costPrice.amount,
        costPriceCurrency: storeCurrencyCode(),
        isActive: variant.isActive,
        ...(attributeValueIds.length > 0 ? { attributeValueIds } : {}),
        ...(attributeValueClientKeys.length > 0 ? { attributeValueClientKeys } : {}),
        ...(PRODUCT_VARIANT_CUSTOM_UOM_ENABLED && variant.hasCustomUom && variant.uomLines
          ? {
              uomLines: variant.uomLines.map((line, uomIndex) => {
                const uomPersisted = mode === 'update' && isPersistedId(line.id);
                return {
                  ...(uomPersisted ? { id: line.id } : { clientKey: refKey(line.id, `vu${index}`, uomIndex) }),
                  catalogUomId: line.catalogUomId ?? null,
                  nameAr: line.nameAr,
                  uneceCode: line.uneceCode ?? null,
                  relativeQuantity: line.relativeQuantity,
                  isReference: line.isReference,
                  packagingType: line.packagingType,
                  sortOrder: uomIndex,
                };
              }),
            }
          : PRODUCT_VARIANT_CUSTOM_UOM_ENABLED && variant.hasCustomUom === false
            ? { uomLines: [] }
            : {}),
      };
    });
  }

  return body;
}

async function fetchProductFull(id: string): Promise<Product | null> {
  try {
    const dto = await apiRequest<ProductFullDto>(`/inventory/products/${id}/full`);
    if (!dto?.id) return null;
    return mapFullProduct(dto);
  } catch {
    return null;
  }
}

const MEDIA_IDS_PER_REQUEST = 200;

/**
 * The media of these products (the page on screen), not the company's: a
 * company's first 2,000 media left the later products without images. A
 * server without the `productIds` filter yet answers 400: the former reading.
 */
async function fetchMediaByCompany(companyId: string, productIds: readonly string[]): Promise<Map<string, MediaDto[]>> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return new Map();
  const readPage = (extra: Record<string, unknown>) =>
    apiRequest<PaginatedResult<MediaDto>>('/inventory/product-media', {
      query: { companyId, page: 1, limit: 2000, archiveScope: 'active', ...extra },
      throwOnError: true,
      silent: true,
    });
  try {
    let rows: MediaDto[] = [];
    try {
      for (let i = 0; i < ids.length; i += MEDIA_IDS_PER_REQUEST) {
        const chunk = ids.slice(i, i + MEDIA_IDS_PER_REQUEST);
        rows = rows.concat((await readPage({ productIds: chunk.join(',') })).items ?? []);
      }
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 400) throw err;
      rows = (await readPage({})).items ?? [];
    }
    const byProduct = new Map<string, MediaDto[]>();
    for (const dto of rows) {
      const list = byProduct.get(dto.productId);
      if (list) list.push(dto);
      else byProduct.set(dto.productId, [dto]);
    }
    return byProduct;
  } catch {
    // Catalog list must still load when media endpoint fails (e.g. POS cashier).
    return new Map();
  }
}

export const productsApi: AdminProductsPort = {
  async getAll(query: ProductListQuery) {
    const companyId = resolveStorefrontCompanyId(query.companyId);
    const result = await apiRequest<PaginatedResult<ProductDto & { groupKey?: string | null }>>(
      '/inventory/products',
      {
        query: {
          ...productFilterQuery(query, companyId),
          liveQuantity: query.liveQuantity === true ? true : undefined,
          sort: query.sort === 'stock' ? 'quantity' : query.sort,
          sortDirection: query.sortDirection,
          groupValue: query.groupValue,
          page: query.page ?? 1,
          limit: query.limit ?? 200,
        },
      },
    );

    const mediaByProduct = await fetchMediaByCompany(
      companyId,
      (result.items ?? []).map((dto) => dto.id),
    );
    const items = (result.items ?? []).map((dto) => {
      const media = mediaByProduct.get(dto.id) ?? [];
      const mapped: Product = {
        ...mapFullProduct({ ...dto, media, attributes: [], variants: [], uomLines: [] }),
        // With `groupBy`: the product's group (an export places it under it).
        ...(dto.groupKey !== undefined ? { groupKey: dto.groupKey } : {}),
      };
      if (isStoreCurrency(mapped.price.currency)) return mapped;
      return {
        ...mapped,
        price: { ...mapped.price, currency: storeCurrencyCode() },
        costPrice: mapped.costPrice
          ? { ...mapped.costPrice, currency: storeCurrencyCode() }
          : mapped.costPrice,
        compareAtPrice: mapped.compareAtPrice
          ? { ...mapped.compareAtPrice, currency: storeCurrencyCode() }
          : mapped.compareAtPrice,
      };
    });

    return { items, pagination: result.pagination };
  },

  async getById(_companyId, id) {
    return fetchProductFull(id);
  },

  async getBySlug(companyId, slug) {
    const result = await apiRequest<PaginatedResult<ProductDto>>('/inventory/products', {
      query: {
        companyId: resolveStorefrontCompanyId(companyId),
        slug,
        page: 1,
        limit: 1,
        archiveScope: 'all',
      },
    });
    const dto = result.items?.[0];
    return dto?.id ? fetchProductFull(dto.id) : null;
  },

  async create(input: CreateProductInput) {
    const dto = await apiRequest<ProductFullDto>('/inventory/products/full', {
      method: 'POST',
      body: toFullBody(
        { ...input, companyId: resolveStorefrontCompanyId(input.companyId) },
        'create',
      ),
    });
    return mapFullProduct(dto);
  },

  async update(_companyId, id, patch: UpdateProductInput) {
    const dto = await apiRequest<ProductFullDto>(`/inventory/products/${id}/full`, {
      method: 'PATCH',
      body: toFullBody(patch, 'update'),
    });
    return dto?.id ? mapFullProduct(dto) : null;
  },

  async remove(_companyId, id) {
    await apiRequest<void>(`/inventory/products/${id}`, { method: 'DELETE' });
    return true;
  },

  async duplicate(companyId, id) {
    const source = await this.getById(companyId, id);
    if (!source) return null;
    const suffix = Math.random().toString(36).slice(2, 6);
    return this.create({
      ...source,
      sku: `${source.sku}-copy-${suffix}`,
      slug: `${source.slug}-copy-${suffix}`,
      status: 'draft',
      media: source.media.map((item) => ({ ...item, id: `tmp-${item.id}` })),
      attributes: source.attributes?.map((attr) => ({
        ...attr,
        id: `tmp-${attr.id}`,
        values: attr.values.map((value) => ({
          ...value,
          id: `tmp-${value.id}`,
          catalogAttributeValueId: value.catalogAttributeValueId,
        })),
      })),
      variants: source.variants?.map((variant) => ({
        ...variant,
        id: `tmp-${variant.id}`,
        sku: `${variant.sku}-copy-${suffix}`,
        attributeValueIds: variant.attributeValueIds.map((valueId) => `tmp-${valueId}`),
      })),
      uomLines: source.uomLines?.map((line) => ({ ...line, id: `tmp-${line.id}` })),
    });
  },

  async archive(companyId, id) {
    return this.update(companyId, id, { status: 'archived' });
  },

  async unarchive(companyId, id) {
    return this.update(companyId, id, { status: 'active' });
  },

  async bulkUpdateStatus(companyId, ids, status) {
    const updated: Product[] = [];
    for (const id of ids) {
      const item = await this.update(companyId, id, { status });
      if (item) updated.push(item);
    }
    return updated;
  },

  async bulkRemove(companyId, ids) {
    let count = 0;
    for (const id of ids) {
      if (await this.remove(companyId, id)) count += 1;
    }
    return count;
  },
};
