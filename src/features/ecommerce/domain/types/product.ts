import type { Inventory, MediaItem, Money, SeoFields, Slugged, TenantScoped } from '@/features/ecommerce/domain/types/common';
import type { ProductStatus } from '@/features/ecommerce/domain/constants/product-status';
import type { StockStatus } from '@/features/ecommerce/domain/constants/stock-status';

export type { ProductStatus, StockStatus };

/** Odoo-style product type. */
export type ProductType = 'goods' | 'service' | 'combo';

/** Inventory tracking mode. */
export type ProductTracking = 'none' | 'lot' | 'serial';

/**
 * When to invoice the customer (Odoo invoice_policy):
 * - ordered: invoice based on ordered quantities
 * - delivered: invoice based on delivered quantities
 */
export type ProductInvoicePolicy = 'ordered' | 'delivered';

export type {
  AttributeDisplayType,
  VariantCreationMode,
} from '@/features/ecommerce/domain/types/catalog-attribute';

import type {
  AttributeDisplayType,
  VariantCreationMode,
} from '@/features/ecommerce/domain/types/catalog-attribute';

export type ProductAttributeValue = {
  id: string;
  nameAr: string;
  freeText?: string;
  defaultExtraPrice?: number;
  colorHex?: string;
  /** @deprecated Prefer `images` — kept for variant swatches / legacy single-image callers. */
  imageUrl?: string;
  /** Gallery shown on the storefront PDP when this value is selected (e.g. per-size or per-color shots). */
  images?: MediaItem[];
  /** Blurb shown alongside the gallery when this value is selected (e.g. "Best for oily skin"). */
  description?: string;
  /** When applying from catalog before first save — not a product_attribute_values id. */
  catalogAttributeValueId?: string;
  /** @deprecated Prefer colorHex / imageUrl */
  extra?: string;
};

/** Attribute line on a product — usually copied from a catalog Attribute master. */
export type ProductAttribute = {
  id: string;
  /** Reference to master catalog attribute when applied from التهيئة. */
  attributeId?: string;
  nameAr: string;
  displayType: AttributeDisplayType;
  createVariant: VariantCreationMode;
  values: ProductAttributeValue[];
};

export type PackagingType = 'unit' | 'pack' | 'box' | 'pallet' | 'other';

/** Flexible unit / packaging line relative to a reference unit on the product. */
export type ProductUomLine = {
  id: string;
  catalogUomId?: string | null;
  nameAr: string;
  uneceCode?: string;
  /** How many reference units this packaging contains (e.g. Box = 12). */
  relativeQuantity: number;
  isReference: boolean;
  packagingType: PackagingType;
};

/**
 * Sellable / stockable unit generated from attribute combinations.
 * When a product has variants, price and quantity live here (warehouse + storefront).
 */
export type ProductVariant = {
  id: string;
  /** Stable key from sorted attribute value ids (e.g. `val-red|val-m`). */
  combinationKey: string;
  sku: string;
  nameAr: string;
  /** One value id per attribute that creates variants. */
  attributeValueIds: string[];
  /** Display labels parallel to attributeValueIds for admin/storefront pills. */
  attributeLabels: Array<{ attributeNameAr: string; valueNameAr: string; colorHex?: string }>;
  salePrice: Money;
  costPrice: Money;
  /** Costing runs on its stock: the purchase price follows inventory (read-only). */
  costManaged?: boolean;
  quantity: number;
  stockStatus: StockStatus;
  barcode?: string;
  /** Variant description (storefront). */
  description?: string;
  /** Variant primary image (URL) — equals `images[0]` when a gallery is set. */
  imageUrl?: string;
  /** Variant image gallery (ordered). */
  images?: MediaItem[];
  isActive: boolean;
  /** When true, `uomLines` override the product-level packaging for this SKU. */
  hasCustomUom?: boolean;
  uomLines?: ProductUomLine[];
};

/** Physical dimensions in centimeters (shipping / logistics). */
export type ProductDimensions = {
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
};

/** How this product's images fit their storefront display box (card/gallery/thumbnails). */
export type ProductImageFit = 'contain' | 'cover';
/** Display box aspect ratio for this product's images. */
export type ProductImageAspectRatio = 'square' | '4/3' | '3/4';

export type Product = TenantScoped &
  Slugged & {
    id: string;
    /** With `groupBy`: the product's group key. */
    groupKey?: string | null;
    sku: string;
    nameAr: string;
    nameEn?: string;
    /** Full product description (storefront / catalog). */
    description?: string;
    /** Short blurb for cards, lists, and search snippets. */
    shortDescription?: string;
    brandId?: string | null;
    categoryId?: string | null;
    /** Selling group on the register. Set on the product when point of sale is on. */
    posMenuCategoryId?: string | null;
    status: ProductStatus;
    stockStatus: StockStatus;
    inventory: Inventory;
    /**
     * Catalog list / sale price shown on the product form.
     * Advanced pricelist rules can still refine this later.
     */
    price: Money;
    /** Purchase / cost price (سعر الشراء). */
    costPrice?: Money;
    /** Costing runs on its stock: the purchase price follows inventory (read-only). */
    costManaged?: boolean;
    compareAtPrice?: Money;
    media: MediaItem[];
    /** How this product's photos fit their storefront display box. Default: 'contain'. */
    imageDisplayFit?: ProductImageFit;
    /** Display box aspect ratio for this product's photos. Default: 'square'. */
    imageDisplayAspectRatio?: ProductImageAspectRatio;
    seo: SeoFields;
    tags?: string[];
    productType?: ProductType;
    tracking?: ProductTracking;
    /** Invoice on ordered vs delivered quantities. */
    invoicePolicy?: ProductInvoicePolicy;
    barcode?: string;
    /** Weight in kilograms (shipping). */
    weightKg?: number;
    dimensions?: ProductDimensions;
    posAvailable?: boolean;
    /** Default warehouse — sale deduct uses this when no location is sent. */
    warehouseId?: string | null;
    /** Default storage location inside warehouseId. */
    locationId?: string | null;
    /** Can be sold on sales channels. */
    saleOk?: boolean;
    /** Can be purchased / replenished from vendors. */
    purchaseOk?: boolean;
    /** System item (`delivery`): never archived; code, type, status and sale flags fixed. */
    systemCode?: string | null;
    /** Offer flags — optional end dates mean “no expiry”. */
    isNewProduct?: boolean;
    newUntil?: string | null;
    isTodayDeal?: boolean;
    /** Sale price while today’s deal is active — `price` remains the pre-deal list price. */
    dealPrice?: Money;
    dealDays?: number | null;
    dealUntil?: string | null;
    isWholesale?: boolean;
    wholesalePrice?: Money;
    wholesaleUntil?: string | null;
    isDiscounted?: boolean;
    discountPercent?: number | null;
    /** An amount off the selling price (instead of a percent). */
    discountAmount?: number | null;
    /** A percent or amount offer also shown in «تخفيضات اليوم». */
    inTodayDeals?: boolean;
    discountUntil?: string | null;
    /** Computed by backend for display/filter “active now”. */
    isNewProductActive?: boolean;
    isTodayDealActive?: boolean;
    /** Has options (size, color…): chosen on the product page before adding. */
    hasVariants?: boolean;
    isWholesaleActive?: boolean;
    isDiscountActive?: boolean;
    attributes?: ProductAttribute[];
    /** Generated sellable variants — empty when product has no variant-creating attributes. */
    variants?: ProductVariant[];
    uomLines?: ProductUomLine[];
    /** Average customer rating (0–5). Absent/null until the product has reviews. */
    rating?: number | null;
    reviewCount?: number;
    createdAt: string;
    updatedAt: string;
    archivedAt?: string | null;
  };

export type ProductListQuery = {
  companyId: string;
  search?: string;
  categoryId?: string;
  brandId?: string;
  tag?: string;
  status?: ProductStatus;
  stockStatus?: StockStatus;
  warehouseId?: string;
  locationId?: string;
  posAvailable?: boolean;
  /** Overlay live ledger SUM. Default is quantityCache (fast). */
  liveQuantity?: boolean;
  minPrice?: number;
  maxPrice?: number;
  /** Active-now offer filters (`true` = flag on and not expired). */
  isNewProduct?: boolean;
  isTodayDeal?: boolean;
  isWholesale?: boolean;
  isDiscounted?: boolean;
  sort?: 'name' | 'price' | 'stock' | 'sku' | 'createdAt' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
  /** Server group field (category, brand, status); with `groupValue`, one group's products. */
  groupBy?: string;
  groupValue?: string;
  page?: number;
  limit?: number;
};

export type CreateProductInput = Omit<
  Product,
  'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'sku'
> & {
  /** Optional on create; the API generates a unique SKU when omitted. */
  sku?: string;
};
export type UpdateProductInput = Partial<CreateProductInput>;
