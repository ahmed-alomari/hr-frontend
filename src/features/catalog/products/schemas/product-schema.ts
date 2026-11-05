import { z } from 'zod';
import { PRODUCT_VARIANT_CUSTOM_UOM_ENABLED } from '@/features/catalog/products/constants/product-feature-flags';
import { isValidSlug, SLUG_MESSAGE } from '@/features/catalog/constants/slug';

export { STOCK_STATUS_OPTIONS } from '@/features/ecommerce/domain/constants/stock-status';
export { PRODUCT_STATUS_OPTIONS } from '@/features/ecommerce/domain/constants/product-status';

/**
 * Uploaded product photos are stored as `/uploads/...`, not as absolute URLs.
 * Zod's `.url()` also rejects localhost, so a UOM-only save was blocked by the
 * existing image even when the user never touched it.
 */
export function isAcceptableProductImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('uploads/') ||
    trimmed.startsWith('/api-backend/uploads/')
  ) {
    return true;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const productImageUrlSchema = z
  .string()
  .trim()
  .min(1, 'رابط الصورة غير صالح')
  .refine(isAcceptableProductImageUrl, { error: 'رابط الصورة غير صالح' });

export const PRODUCT_TYPE_OPTIONS = [
  { value: 'goods', labelAr: 'البضائع' },
  { value: 'service', labelAr: 'الخدمة' },
  { value: 'combo', labelAr: 'مجموعة' },
] as const;

export const PRODUCT_TRACKING_OPTIONS = [
  { value: 'none', labelAr: 'حسب الكمية' },
  { value: 'lot', labelAr: 'أرقام المجموعات' },
  { value: 'serial', labelAr: 'الأرقام التسلسلية' },
] as const;

export const PRODUCT_INVOICE_POLICY_OPTIONS = [
  { value: 'ordered', labelAr: 'الكميات المطلوبة' },
  { value: 'delivered', labelAr: 'الكميات التي تم توصيلها' },
] as const;

export {
  ATTRIBUTE_DISPLAY_OPTIONS,
  VARIANT_CREATION_OPTIONS,
} from '@/features/catalog/attributes/schemas/catalog-attribute-schema';

export const PACKAGING_TYPE_OPTIONS = [
  { value: 'unit', labelAr: 'وحدة' },
  { value: 'pack', labelAr: 'علبة' },
  { value: 'box', labelAr: 'صندوق' },
  { value: 'pallet', labelAr: 'منصة' },
  { value: 'other', labelAr: 'أخرى' },
] as const;

const attributeValueSchema = z.object({
  id: z.string(),
  nameAr: z.string().trim().min(1, 'قيمة الخاصية مطلوبة'),
  freeText: z.string().trim().optional(),
  defaultExtraPrice: z.coerce.number().min(0).optional(),
  colorHex: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  catalogAttributeValueId: z.string().optional(),
  extra: z.string().trim().optional(),
});

const attributeSchema = z.object({
  id: z.string(),
  attributeId: z.string().optional(),
  nameAr: z.string().trim().min(1, 'اسم الخاصية مطلوب'),
  displayType: z.enum(['radio', 'pills', 'select', 'color', 'image', 'multi']),
  createVariant: z.enum(['always', 'dynamic', 'never']),
  values: z.array(attributeValueSchema).min(1, 'أضف قيمة واحدة على الأقل'),
});

const uomLineSchema = z.object({
  id: z.string(),
  catalogUomId: z.string().optional().nullable(),
  nameAr: z.string().trim().min(1, 'اسم الوحدة مطلوب'),
  uneceCode: z.string().trim().optional(),
  relativeQuantity: z.coerce.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  isReference: z.boolean(),
  packagingType: z.enum(['unit', 'pack', 'box', 'pallet', 'other']),
});

const variantSchema = z.object({
  id: z.string(),
  combinationKey: z.string(),
  sku: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  attributeValueIds: z.array(z.string()),
  attributeLabels: z.array(
    z.object({
      attributeNameAr: z.string(),
      valueNameAr: z.string(),
      colorHex: z.string().optional(),
    }),
  ),
  salePrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(0),
  stockStatus: z.enum(['in_stock', 'out_of_stock', 'preorder', 'discontinued']),
  barcode: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  images: z.array(z.string().trim()).optional(),
  isActive: z.boolean(),
  hasCustomUom: z.boolean().optional(),
  uomLines: z.array(uomLineSchema).optional(),
});

export const productFormSchema = z
  .object({
    sku: z.string().trim().max(120, 'رمز المنتج يجب ألا يتجاوز 120 حرفًا').optional(),
    nameAr: z.string().trim().min(1, 'اسم المنتج مطلوب'),
    nameEn: z.string().trim().optional(),
    slug: z
      .string()
      .trim()
      .refine((value) => value === '' || isValidSlug(value), SLUG_MESSAGE),
    shortDescription: z.string().trim().optional(),
    description: z.string().trim().optional(),
    categoryId: z.string().optional(),
    posMenuCategoryId: z.string().optional(),
    brandId: z.string().optional(),
    status: z.enum(['draft', 'active', 'archived']),
    stockStatus: z.enum(['in_stock', 'out_of_stock', 'preorder', 'discontinued']),
    stockQuantity: z.coerce.number().int('يجب أن تكون الكمية عددًا صحيحًا').min(0, 'الكمية لا يمكن أن تكون سالبة'),
    trackInventory: z.boolean(),
    allowBackorder: z.boolean(),
    lowStockThreshold: z.coerce.number().int().min(0, 'حد المخزون المنخفض لا يمكن أن يكون سالبًا'),
    tagsInput: z.string().trim().optional(),
    media: z.array(
      z.object({
        url: productImageUrlSchema,
        alt: z.string().trim().optional(),
        isPrimary: z.boolean(),
      }),
    ),
    imageDisplayFit: z.enum(['contain', 'cover']),
    imageDisplayAspectRatio: z.enum(['square', '4/3', '3/4']),
    productType: z.enum(['goods', 'service', 'combo']),
    tracking: z.enum(['none', 'lot', 'serial']),
    invoicePolicy: z.enum(['ordered', 'delivered']),
    listPrice: z.coerce.number().min(0, 'سعر البيع لا يمكن أن يكون سالبًا'),
    costPrice: z.coerce.number().min(0, 'سعر الشراء لا يمكن أن يكون سالبًا'),
    compareAtPrice: z.coerce.number().min(0, 'سعر المقارنة لا يمكن أن يكون سالبًا').optional(),
    barcode: z.string().trim().optional(),
    weightKg: z.coerce.number().min(0).optional(),
    lengthCm: z.coerce.number().min(0).optional(),
    widthCm: z.coerce.number().min(0).optional(),
    heightCm: z.coerce.number().min(0).optional(),
    posAvailable: z.boolean(),
    warehouseId: z.string().optional(),
    locationId: z.string().optional(),
    saleOk: z.boolean(),
    purchaseOk: z.boolean(),
    isNewProduct: z.boolean(),
    newUntil: z.string().optional(),
    isTodayDeal: z.boolean(),
    dealPriceAmount: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
      },
      z.number().min(0).optional(),
    ),
    dealDays: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
      },
      z.number().int().min(1).optional(),
    ),
    dealUntil: z.string().optional(),
    isWholesale: z.boolean(),
    wholesalePriceAmount: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
      },
      z.number().min(0).optional(),
    ),
    wholesaleUntil: z.string().optional(),
    isDiscounted: z.boolean(),
    discountPercent: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
      },
      z.number().min(0).max(100).optional(),
    ),
    /** An amount off the selling price (instead of a percent). */
    discountAmount: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
      },
      z.number().min(0).optional(),
    ),
    /** A percent or amount offer also shown in «تخفيضات اليوم». */
    inTodayDeals: z.boolean(),
    discountUntil: z.string().optional(),
    attributes: z.array(attributeSchema),
    variants: z.array(variantSchema),
    uomLines: z.array(uomLineSchema),
  })
  .superRefine((values, ctx) => {
    const productUomLines = values.uomLines.filter((line) => line.catalogUomId?.trim());
    if (productUomLines.length > 0) {
      productUomLines.forEach((line) => {
        const index = values.uomLines.indexOf(line);
        if (!line.nameAr?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'اسم الوحدة مطلوب.',
            path: ['uomLines', index, 'nameAr'],
          });
        }
      });
      const refs = productUomLines.filter((line) => line.isReference);
      if (refs.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'يجب اختيار وحدة مرجعية واحدة فقط (⭐).',
          path: ['uomLines'],
        });
      }
    }
    if (PRODUCT_VARIANT_CUSTOM_UOM_ENABLED) {
      values.variants.forEach((variant, variantIndex) => {
      if (!variant.hasCustomUom) return;
      const lines = variant.uomLines ?? [];
      if (lines.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'أضف وحدة واحدة على الأقل للمتغير.',
          path: ['variants', variantIndex, 'uomLines'],
        });
        return;
      }
      lines.forEach((line, lineIndex) => {
        if (!line.catalogUomId?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'اختر وحدة من الكتالوج لهذا السطر.',
            path: ['variants', variantIndex, 'uomLines', lineIndex, 'catalogUomId'],
          });
        }
      });
      const variantRefs = lines.filter((line) => line.isReference);
      if (variantRefs.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'يجب اختيار وحدة مرجعية واحدة فقط (⭐) لهذا المتغير.',
          path: ['variants', variantIndex, 'uomLines'],
        });
      }
      });
    }
    if (values.isTodayDeal) {
      const dealPrice =
        values.dealPriceAmount === undefined ? Number.NaN : Number(values.dealPriceAmount);
      if (!Number.isFinite(dealPrice) || dealPrice <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'أدخل سعر التخفيض (أكبر من صفر) عند تفعيل تخفيضات اليوم.',
          path: ['dealPriceAmount'],
        });
      } else if (dealPrice >= values.listPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'سعر التخفيض يجب أن يكون أقل من سعر البيع الأساسي.',
          path: ['dealPriceAmount'],
        });
      }
    }
    if (values.isWholesale) {
      const wholesale = Number(values.wholesalePriceAmount);
      if (!Number.isFinite(wholesale) || wholesale < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'أدخل سعر الجملة عند تفعيل أسعار الجملة.',
          path: ['wholesalePriceAmount'],
        });
      }
    }
    if (values.isDiscounted) {
      // A percent of the selling price, or an amount off it — one of them.
      const percent = Number(values.discountPercent ?? 0);
      const amount = Number(values.discountAmount ?? 0);
      if (amount > 0) {
        const price = Number(values.listPrice);
        if (Number.isFinite(price) && price > 0 && amount >= price) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'مبلغ الخصم يجب أن يكون أقل من سعر البيع.',
            path: ['discountAmount'],
          });
        }
      } else if (!(percent > 0 && percent < 100)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'أدخل نسبة الخصم (أكبر من 0 وأقل من 100).',
          path: ['discountPercent'],
        });
      }
    }
  });

export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormValues = z.output<typeof productFormSchema>;

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultUomLines() {
  return [
    {
      id: newId('uom'),
      catalogUomId: null,
      nameAr: 'وحدات',
      uneceCode: '',
      relativeQuantity: 1,
      isReference: true,
      packagingType: 'unit' as const,
    },
  ];
}

export const PRODUCT_FORM_DEFAULT_VALUES: ProductFormInput = {
  sku: '',
  nameAr: '',
  nameEn: '',
  slug: '',
  shortDescription: '',
  description: '',
  categoryId: undefined,
  posMenuCategoryId: undefined,
  brandId: undefined,
  status: 'active',
  stockStatus: 'in_stock',
  stockQuantity: 0,
  trackInventory: true,
  allowBackorder: false,
  lowStockThreshold: 5,
  tagsInput: '',
  media: [],
  imageDisplayFit: 'contain',
  imageDisplayAspectRatio: 'square',
  productType: 'goods',
  tracking: 'none',
  invoicePolicy: 'ordered',
  listPrice: 0,
  costPrice: 0,
  compareAtPrice: undefined,
  barcode: '',
  weightKg: undefined,
  lengthCm: undefined,
  widthCm: undefined,
  heightCm: undefined,
  posAvailable: false,
  warehouseId: undefined,
  locationId: undefined,
  saleOk: true,
  purchaseOk: true,
  isNewProduct: false,
  newUntil: '',
  isTodayDeal: false,
  dealPriceAmount: undefined,
  dealDays: undefined,
  dealUntil: '',
  isWholesale: false,
  wholesalePriceAmount: undefined,
  wholesaleUntil: '',
  isDiscounted: false,
  discountPercent: undefined,
  discountAmount: undefined,
  inTodayDeals: false,
  discountUntil: '',
  attributes: [],
  variants: [],
  uomLines: [],
};

/** Lines linked to catalog UOM — used for API payload and conditional validation. */
export function configuredProductUomLines<T extends { catalogUomId?: string | null }>(lines: T[]): T[] {
  return lines.filter((line) => line.catalogUomId?.trim());
}
