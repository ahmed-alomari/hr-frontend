'use client';

import * as React from 'react';
import { ShoppingBag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatPrice } from '@/features/ecommerce/shared/utils/format-price';
import { useRouter } from '@/i18n/navigation';
import type { StorefrontProduct } from '@/features/ecommerce/storefront/domain/storefront-models';
import type { MediaItem } from '@/features/ecommerce/domain/types/common';
import {
  buildCombinationKey,
  buildLabelCombinationKey,
} from '@/features/catalog/products/lib/product-variants';
import { AddToCartButton } from '@/features/ecommerce/storefront/components/catalog/add-to-cart-button';
import { QuantitySelector } from '@/features/ecommerce/storefront/components/catalog/quantity-selector';
import { ProductPrice } from '@/features/ecommerce/storefront/components/catalog/product-price';
import { useStorefrontCartUi } from '@/features/ecommerce/storefront/hooks/use-storefront-cart-ui';
import {
  canOrderQuantity,
  getOrderBlockReason,
  getOrderQuantityMax,
  getWarehouseOnHand,
  resolveDiscountPercent,
  resolveLineCompareAtPrice,
  resolveLineUnitPrice,
  resolvePurchaseStockStatus,
  shouldShowWarehouseStock,
} from '@/features/ecommerce/storefront/lib/product-display';
import { cn } from '@/shared/utils';

export type ActiveAttributeMedia = {
  images: MediaItem[];
  description?: string;
};

type Props = {
  product: StorefrontProduct;
  /** Called when the customer picks a value that carries its own gallery/description. */
  onActiveMediaChange?: (media: ActiveAttributeMedia) => void;
};

type OrderMode = 'direct' | 'variants';

function resolveActiveVariant(
  product: StorefrontProduct,
  selected: Record<string, string>,
): StorefrontProduct['variants'][number] | undefined {
  if (product.variants.length === 0) return undefined;

  const selectedValueIds = product.attributes
    .map((attribute) => selected[attribute.id])
    .filter(Boolean) as string[];
  if (selectedValueIds.length === 0) return undefined;

  const idsKey = buildCombinationKey(selectedValueIds);
  const labelKey = buildLabelCombinationKey(
    product.attributes.map((attribute) => {
      const valueId = selected[attribute.id];
      return attribute.values.find((value) => value.id === valueId)?.nameAr ?? '';
    }),
  );

  return product.variants.find((variant) => {
    if (!variant.isActive) return false;
    if (variant.combinationKey === labelKey) return true;
    if (variant.combinationKey === idsKey) return true;
    if (buildCombinationKey(variant.attributeValueIds) === idsKey) return true;
    const variantLabelKey = buildLabelCombinationKey(
      variant.attributeLabels.map((label) => label.valueNameAr),
    );
    return variantLabelKey === labelKey;
  });
}

export function ProductPurchasePanel({ product, onActiveMediaChange }: Props) {
  const t = useTranslations('storefront');
  const router = useRouter();
  const setQuantity = useStorefrontCartUi((state) => state.setQuantity);

  const hasVariantCatalog = product.variants.length > 0 && product.attributes.length > 0;
  const [orderMode, setOrderMode] = React.useState<OrderMode>(
    hasVariantCatalog ? 'variants' : 'direct',
  );
  const [orderQty, setOrderQty] = React.useState(1);
  const [selected, setSelected] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const attribute of product.attributes) {
      const first = attribute.values[0];
      if (first) initial[attribute.id] = first.id;
    }
    return initial;
  });

  React.useEffect(() => {
    setOrderMode(hasVariantCatalog ? 'variants' : 'direct');
    setOrderQty(1);
  }, [hasVariantCatalog, product.id]);

  // «طلب مباشر» (the product as itself, no option) is offered only when the
  // product can be sold as itself now (owner 2026-11-14): never shown and
  // then found unavailable. Checked on the store's availability (the
  // product's own quantity, as orders are checked).
  const directAvailable = canOrderQuantity(product, null);
  React.useEffect(() => {
    if (hasVariantCatalog && orderMode === 'direct' && !directAvailable) {
      setOrderMode('variants');
    }
  }, [hasVariantCatalog, orderMode, directAvailable]);

  const useVariants = hasVariantCatalog && orderMode === 'variants';
  const activeVariant = useVariants ? resolveActiveVariant(product, selected) : undefined;
  const selectionIncomplete = useVariants && !activeVariant;

  const unitPrice = resolveLineUnitPrice(product, useVariants ? activeVariant : null);
  const compareAt = resolveLineCompareAtPrice(product, unitPrice);
  const discountPercent = resolveDiscountPercent(unitPrice, compareAt);
  const stockStatus = resolvePurchaseStockStatus(product, useVariants ? activeVariant : null);
  const warehouseOnHand = getWarehouseOnHand(product, useVariants ? activeVariant : null);
  const showWarehouseStock = shouldShowWarehouseStock(product);
  const maxQty = getOrderQuantityMax(product, useVariants ? activeVariant : null);
  const canOrder = !selectionIncomplete && canOrderQuantity(product, useVariants ? activeVariant : null);
  const blockReason = getOrderBlockReason(product, {
    variant: useVariants ? activeVariant : null,
    requireVariant: useVariants,
    hasActiveVariant: Boolean(activeVariant),
  });
  const sku = activeVariant?.sku ?? product.sku;
  const tracksInventory = product.inventory.trackInventory;
  const allowBackorder = product.inventory.allowBackorder;

  React.useEffect(() => {
    if (maxQty <= 0) {
      setOrderQty(1);
      return;
    }
    setOrderQty((prev) => Math.min(Math.max(1, prev), maxQty));
  }, [maxQty, activeVariant?.id, orderMode]);

  // Swap the gallery + blurb to the active variant's own image/description.
  React.useEffect(() => {
    if (!useVariants || !activeVariant) return;
    const variantMedia: MediaItem[] = activeVariant.images?.length
      ? activeVariant.images
      : activeVariant.imageUrl
        ? [
            {
              id: `${activeVariant.id}-img`,
              url: activeVariant.imageUrl,
              alt: activeVariant.nameAr,
              type: 'image',
              position: 0,
              isPrimary: true,
            },
          ]
        : [];
    if (variantMedia.length > 0 || activeVariant.description) {
      onActiveMediaChange?.({ images: variantMedia, description: activeVariant.description });
    }
    // onActiveMediaChange is a stable setter from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVariant?.id, useVariants]);

  function selectValue(attributeId: string, valueId: string) {
    setSelected((prev) => ({ ...prev, [attributeId]: valueId }));
    const attribute = product.attributes.find((item) => item.id === attributeId);
    const value = attribute?.values.find((item) => item.id === valueId);
    if (value?.images?.length) {
      onActiveMediaChange?.({ images: value.images, description: value.description });
    } else if (value?.imageUrl) {
      onActiveMediaChange?.({
        images: [
          {
            id: `${value.id}-img`,
            url: value.imageUrl,
            alt: value.nameAr,
            type: 'image',
            position: 0,
            isPrimary: true,
          },
        ],
        description: value.description,
      });
    }
  }

  function handleBuyNow(event: React.MouseEvent) {
    event.preventDefault();
    if (selectionIncomplete || !canOrder) return;
    const qty = Math.min(orderQty, Math.max(1, maxQty || 1));
    setQuantity(product.id, qty, useVariants ? activeVariant?.id : undefined);
    router.push('/store/checkout');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <ProductPrice
          price={formatPrice(unitPrice)}
          compareAtPrice={compareAt ? formatPrice(compareAt) : undefined}
          discountPercent={discountPercent}
          size="lg"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {t('products.sku')}: <span dir="ltr">{sku}</span>
      </p>

      <div className="space-y-1">
        <p
          className={
            canOrder ? 'text-sm font-medium text-success' : 'text-sm font-medium text-muted-foreground'
          }
        >
          {t(`stock.${stockStatus}`)}
        </p>
        {showWarehouseStock && warehouseOnHand != null ? (
          <p className="text-xs text-muted-foreground">
            {t('products.availableInWarehouse', { count: warehouseOnHand })}
          </p>
        ) : null}
        {!tracksInventory ? (
          <p className="text-xs text-muted-foreground">{t('products.soldWithoutStockLimit')}</p>
        ) : null}
        {blockReason === 'out_of_stock' ? (
          <p className="text-xs text-destructive">{t('products.cannotAddOutOfStock')}</p>
        ) : null}
        {blockReason === 'discontinued' ? (
          <p className="text-xs text-destructive">{t('products.cannotAddDiscontinued')}</p>
        ) : null}
        {blockReason === 'variant_required' ? (
          <p className="text-xs text-destructive">{t('products.variantUnavailable')}</p>
        ) : null}
      </div>

      {hasVariantCatalog && directAvailable ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOrderMode('variants')}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm transition-colors',
              orderMode === 'variants'
                ? 'border-primary bg-primary/10 font-medium text-primary'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {t('products.orderWithVariants')}
          </button>
          <button
            type="button"
            onClick={() => {
              setOrderMode('direct');
              onActiveMediaChange?.({ images: product.media });
            }}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm transition-colors',
              orderMode === 'direct'
                ? 'border-primary bg-primary/10 font-medium text-primary'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {t('products.orderDirect')}
          </button>
        </div>
      ) : null}

      {useVariants
        ? product.attributes.map((attribute) => (
            <div key={attribute.id} className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {attribute.nameAr}
                {selected[attribute.id] ? (
                  <span className="ms-2 font-normal text-muted-foreground">
                    ·{' '}
                    {attribute.values.find((value) => value.id === selected[attribute.id])?.nameAr}
                  </span>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-2">
                {attribute.values.map((value) => {
                  const isSelected = selected[attribute.id] === value.id;
                  const isColor = attribute.displayType === 'color' || Boolean(value.colorHex);
                  return (
                    <button
                      key={value.id}
                      type="button"
                      onClick={() => selectValue(attribute.id, value.id)}
                      title={value.nameAr}
                      className={cn(
                        'inline-flex items-center gap-1.5 border text-sm transition-colors',
                        isColor ? 'rounded-full p-1' : 'rounded-full px-3 py-1.5',
                        isSelected
                          ? 'border-primary bg-primary/10 font-medium text-primary ring-2 ring-primary/25'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {value.colorHex ? (
                        <span
                          className="h-6 w-6 rounded-full border border-border"
                          style={{ backgroundColor: value.colorHex }}
                        />
                      ) : null}
                      {!isColor || !value.colorHex ? value.nameAr : null}
                      {isColor && value.colorHex ? (
                        <span className="sr-only">{value.nameAr}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        : null}

      {useVariants && activeVariant ? (
        <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/20 p-3">
          <p className="text-sm font-semibold text-foreground">{activeVariant.nameAr}</p>
          {activeVariant.description ? (
            <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
              {activeVariant.description}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t('cart.quantity')}</p>
        <QuantitySelector
          value={orderQty}
          min={1}
          max={Math.max(1, maxQty)}
          onChange={setOrderQty}
          disabled={!canOrder || maxQty <= 0}
        />
      </div>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <AddToCartButton
          productId={product.id}
          stockStatus={canOrder ? stockStatus : 'out_of_stock'}
          variantId={useVariants ? activeVariant?.id : undefined}
          quantity={orderQty}
          maxQuantity={Math.max(1, maxQty)}
          variant="button"
          className="h-12 w-full sm:w-auto sm:min-w-48"
        />
        <button
          type="button"
          onClick={handleBuyNow}
          disabled={!canOrder}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-primary bg-transparent px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-48"
        >
          <ShoppingBag className="h-4 w-4" aria-hidden />
          {t('products.buyNow')}
        </button>
      </div>
    </div>
  );
}
