import { companyCurrencyCode } from '@/features/auth/lib/company-currency';
import type {
  ProductAttribute,
  ProductAttributeValue,
  ProductVariant,
} from '@/features/ecommerce/domain/types/product';
import type { Money } from '@/features/ecommerce/domain/types/common';
import type { StockStatus } from '@/features/ecommerce/domain/constants/stock-status';
import { isPersistedId } from '@/features/catalog/products/lib/id-utils';

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [];
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap((prefix) => curr.map((item) => [...prefix, item])),
    [[]],
  );
}

/** Stable match key from value ids (sorted) — used by storefront selection. */
export function buildCombinationKey(valueIds: string[]): string {
  return [...valueIds].sort().join('|');
}

/**
 * Backend PATCH /full combinationKey: value names in attribute order, e.g. `اصفر|صغير`.
 * Do not sort — order follows the product attribute lines.
 */
export function buildLabelCombinationKey(valueNamesAr: string[]): string {
  return valueNamesAr.map((name) => name.trim()).filter(Boolean).join('|');
}

function normalizeValueName(nameAr: string): string {
  return nameAr.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Drop duplicate values inside one attribute (same id or same Arabic name).
 * Duplicate names → duplicate combinationKeys → backend 409 Conflict.
 */
export function dedupeAttributeValues<T extends Pick<ProductAttributeValue, 'id' | 'nameAr'>>(
  values: T[],
): T[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const out: T[] = [];
  for (const value of values) {
    const nameKey = normalizeValueName(value.nameAr);
    if (seenIds.has(value.id)) continue;
    if (nameKey && seenNames.has(nameKey)) continue;
    seenIds.add(value.id);
    if (nameKey) seenNames.add(nameKey);
    out.push(value);
  }
  return out;
}

/** Keep first row per combinationKey (prevents PATCH 409). */
export function dedupeVariantsByCombinationKey<T extends { combinationKey: string }>(
  variants: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const variant of variants) {
    const key = variant.combinationKey.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(variant);
  }
  return out;
}

function stockStatusFromQty(quantity: number, fallback: StockStatus = 'in_stock'): StockStatus {
  if (quantity > 0) return 'in_stock';
  if (fallback === 'preorder' || fallback === 'discontinued') return fallback;
  return 'out_of_stock';
}

type SyncArgs = {
  productNameAr: string;
  productSku: string;
  listPrice: number;
  costPrice: number;
  currency?: string;
  attributes: ProductAttribute[];
  existing?: ProductVariant[];
  /** Default stock status for newly created variants with qty 0 */
  defaultStockStatus?: StockStatus;
};

/**
 * Rebuild variants from attribute lines where `createVariant !== 'never'`.
 * Preserves sale/cost/qty/barcode/image for matching `combinationKey`.
 * Dedupes attribute values and output rows so color×size never repeats keys.
 */
export function syncProductVariants(args: SyncArgs): ProductVariant[] {
  const currency = args.currency ?? companyCurrencyCode();
  const variantAttrs = args.attributes.filter(
    (attribute) => attribute.createVariant !== 'never' && attribute.values.length > 0,
  );

  if (variantAttrs.length === 0) return [];

  const valueSets = variantAttrs.map((attribute) =>
    dedupeAttributeValues(attribute.values).map((value) => ({
      attributeNameAr: attribute.nameAr,
      valueId: value.id,
      valueNameAr: value.nameAr.trim(),
      colorHex: value.colorHex,
      extraPrice: value.defaultExtraPrice ?? 0,
    })),
  );

  const combos = cartesian(valueSets);
  const existingByKey = new Map((args.existing ?? []).map((variant) => [variant.combinationKey, variant]));
  // Backend may store client keys (e.g. "v-yellow") while the UI rebuilds keys from value UUIDs.
  const existingByValueIds = new Map(
    (args.existing ?? []).map((variant) => [buildCombinationKey(variant.attributeValueIds), variant]),
  );

  /** Prevent assigning the same existing row id to two different combos. */
  const claimedExistingIds = new Set<string>();

  const built = combos.map((combo) => {
    const attributeValueIds = combo.map((item) => item.valueId);
    const labelKey = buildLabelCombinationKey(combo.map((item) => item.valueNameAr));
    const idsKey = buildCombinationKey(attributeValueIds);
    let existing =
      existingByKey.get(labelKey) ??
      existingByValueIds.get(idsKey) ??
      existingByKey.get(idsKey);

    if (existing && claimedExistingIds.has(existing.id)) {
      existing = undefined;
    }
    if (existing) claimedExistingIds.add(existing.id);

    const labels = combo.map((item) => ({
      attributeNameAr: item.attributeNameAr,
      valueNameAr: item.valueNameAr,
      colorHex: item.colorHex,
    }));
    const labelSuffix = combo.map((item) => item.valueNameAr).join(' / ');
    const extra = combo.reduce((sum, item) => sum + item.extraPrice, 0);
    const defaultSale = Math.max(0, args.listPrice + extra);
    const quantity = existing?.quantity ?? 0;
    const saleAmount = existing?.salePrice.amount ?? defaultSale;
    const costAmount = existing?.costPrice.amount ?? args.costPrice;
    const stockStatus =
      existing?.stockStatus ??
      stockStatusFromQty(quantity, args.defaultStockStatus ?? 'out_of_stock');

    return {
      id: existing?.id ?? newId('var'),
      // Prefer existing server key; otherwise Arabic labels in attribute order (API contract).
      combinationKey: existing?.combinationKey && existing.combinationKey === labelKey
        ? existing.combinationKey
        : labelKey,
      // The same rule as the store import (2026-11-04): «SKU-قيمة-قيمة»
      // without spaces, and «اسم المنتج / قيمة / قيمة».
      sku:
        existing?.sku ||
        [args.productSku || 'SKU', ...combo.map((c) => c.valueNameAr.replace(/\s+/g, ''))].join('-').slice(0, 64),
      nameAr: existing?.nameAr || `${args.productNameAr || 'منتج'} / ${labelSuffix}`,
      attributeValueIds,
      attributeLabels: labels,
      salePrice: { amount: saleAmount, currency } satisfies Money,
      costPrice: { amount: costAmount, currency } satisfies Money,
      quantity,
      stockStatus,
      barcode: existing?.barcode,
      imageUrl: existing?.imageUrl,
      images: existing?.images,
      isActive: existing?.isActive ?? true,
    };
  });

  // A persisted (already saved) variant must never be silently dropped just
  // because its attribute value combo no longer matches the currently active
  // attribute selection (e.g. a value was deselected or a whole attribute
  // line was removed) — it may carry real stock/order history. Only draft
  // (never-saved) rows are safe to recompute/drop this way.
  const orphanedPersisted = (args.existing ?? []).filter(
    (variant) => isPersistedId(variant.id) && !claimedExistingIds.has(variant.id),
  );

  return dedupeVariantsByCombinationKey([...built, ...orphanedPersisted]);
}

export function totalVariantQuantity(variants: ProductVariant[]): number {
  return variants.reduce((sum, variant) => sum + (variant.quantity || 0), 0);
}

export function resolveVariantBySelection(
  variants: ProductVariant[],
  selectedValueIds: string[],
): ProductVariant | undefined {
  if (variants.length === 0) return undefined;
  const key = buildCombinationKey(selectedValueIds);
  return variants.find(
    (variant) =>
      variant.isActive &&
      (variant.combinationKey === key || buildCombinationKey(variant.attributeValueIds) === key),
  );
}

export function cheapestActiveVariant(variants: ProductVariant[]): ProductVariant | undefined {
  const active = variants.filter((variant) => variant.isActive);
  if (active.length === 0) return undefined;
  return active.reduce((best, variant) =>
    variant.salePrice.amount < best.salePrice.amount ? variant : best,
  );
}
