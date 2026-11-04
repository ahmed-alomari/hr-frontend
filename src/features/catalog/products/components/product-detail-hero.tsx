'use client';

import Link from 'next/link';
import { ArrowRight, Camera, ImagePlus, Loader2 } from 'lucide-react';
import { useWatch, type Control, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import type { ProductFormInput, ProductFormValues } from '@/features/catalog/products/schemas/product-schema';
import { useProductImageField } from '@/features/catalog/products/hooks/use-product-image-field';
import { ProductStatTile } from '@/features/catalog/products/components/product-stat-tile';
import { useProductsBasePath } from '@/features/catalog/products/lib/products-navigation';
import { PRODUCT_STATUS_LABELS_AR, type ProductStatus } from '@/features/ecommerce/domain/constants/product-status';
import { STOCK_STATUS_LABELS_AR, type StockStatus } from '@/features/ecommerce/domain/constants/stock-status';
import { formatPrice } from '@/features/ecommerce/shared/utils/format-price';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ProductActiveStatusToggle } from '@/features/catalog/products/components/product-active-status-toggle';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/shared/utils';
import { useProductAppSections } from '@/features/catalog/products/hooks/use-product-app-sections';

type Props = {
  control: Control<ProductFormInput, unknown, ProductFormValues>;
  register: UseFormRegister<ProductFormInput>;
  setValue: UseFormSetValue<ProductFormInput>;
  nameError?: string;
  currency: string;
  /** A system item: its status is fixed. */
  locked?: boolean;
  /** The product's own quantity (itself + all its variants); null: not tracked. */
  ownQuantity?: number | null;
};

const STATUS_BADGE_VARIANT: Record<ProductStatus, BadgeProps['variant']> = {
  active: 'success',
  draft: 'subtle',
  archived: 'outline',
};

const STOCK_BADGE_VARIANT: Record<StockStatus, BadgeProps['variant']> = {
  in_stock: 'success',
  out_of_stock: 'destructive',
  preorder: 'warning',
  discontinued: 'outline',
};

/** Modern, live-updating identity card for the product detail page — replaces the compact dialog header. */
export function ProductDetailHero({
  control,
  register,
  setValue,
  nameError,
  currency,
  locked = false,
  ownQuantity = null,
}: Props) {
  const { imageUrl, pickImage, uploading } = useProductImageField(control, setValue);
  const productsBasePath = useProductsBasePath();
  const sections = useProductAppSections();
  const sku = useWatch({ control, name: 'sku' }) ?? '';
  const status = useWatch({ control, name: 'status' });
  const stockStatus = useWatch({ control, name: 'stockStatus' });
  const stockQuantity = (useWatch({ control, name: 'stockQuantity' }) as number | undefined) ?? 0;
  const listPrice = (useWatch({ control, name: 'listPrice' }) as number | undefined) ?? 0;
  const costPrice = useWatch({ control, name: 'costPrice' }) as number | undefined;
  const isNewProduct = useWatch({ control, name: 'isNewProduct' });
  const isTodayDeal = useWatch({ control, name: 'isTodayDeal' });
  const dealPriceAmount = useWatch({ control, name: 'dealPriceAmount' }) as number | undefined;
  const isWholesale = useWatch({ control, name: 'isWholesale' });
  const isDiscounted = useWatch({ control, name: 'isDiscounted' });
  const discountPercent = useWatch({ control, name: 'discountPercent' }) as number | undefined;

  // Promo badges and the deal price are the store's.
  const offerBadges = (sections.store ? [
    isNewProduct ? { key: 'new', variant: 'subtle' as const, label: 'حديث' } : null,
    isTodayDeal ? { key: 'deal', variant: 'warning' as const, label: 'تخفيض اليوم' } : null,
    isWholesale ? { key: 'wholesale', variant: 'outline' as const, label: 'جملة' } : null,
    isDiscounted
      ? { key: 'discount', variant: 'destructive' as const, label: `خصم${discountPercent ? ` ${discountPercent}%` : ''}` }
      : null,
  ] : []).filter(Boolean) as Array<{ key: string; variant: BadgeProps['variant']; label: string }>;

  const hasDealPrice = sections.store && isTodayDeal && dealPriceAmount != null && dealPriceAmount > 0;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-l from-primary/10 via-primary/5 to-transparent"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 p-4 sm:p-6">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit gap-1.5 self-start text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href={productsBasePath}>
            <ArrowRight className="h-4 w-4" />
            المنتجات
          </Link>
        </Button>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <button
            type="button"
            onClick={() => void pickImage()}
            disabled={uploading}
            className="group relative mx-auto flex aspect-square w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-background/80 shadow-soft transition-all hover:border-primary/50 disabled:opacity-70 sm:mx-0 sm:w-32"
            aria-label="تغيير صورة المنتج"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1.5 px-3 text-center text-muted-foreground">
                <Camera className="h-6 w-6" />
                <span className="text-[11px] font-medium">أضف صورة</span>
              </span>
            )}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-foreground/70 py-1.5 text-[10px] font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
              <ImagePlus className="h-3 w-3" />
              تغيير
            </span>
          </button>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="product-detail-name-ar" className="text-xs font-medium text-muted-foreground">
                  اسم المنتج <span className="text-destructive">*</span>
                </label>
                <ProductActiveStatusToggle control={control} setValue={setValue} locked={locked} />
              </div>
              <Input
                id="product-detail-name-ar"
                placeholder="اسم المنتج بالعربية"
                aria-label="اسم المنتج"
                aria-invalid={Boolean(nameError)}
                className={cn(
                  'h-auto border-transparent bg-transparent px-0 text-2xl font-bold tracking-tight text-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0 sm:text-[1.65rem]',
                  nameError && 'text-destructive',
                )}
                {...register('nameAr')}
              />
              {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {sku ? (
                <span
                  className="inline-flex items-center rounded-full border border-border/80 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                  dir="ltr"
                >
                  SKU: {sku}
                </span>
              ) : null}
              {status === 'archived' ? (
                <Badge variant={STATUS_BADGE_VARIANT[status]}>{PRODUCT_STATUS_LABELS_AR[status]}</Badge>
              ) : null}
              {sections.store && stockStatus ? (
                <Badge variant={STOCK_BADGE_VARIANT[stockStatus]}>{STOCK_STATUS_LABELS_AR[stockStatus]}</Badge>
              ) : null}
              {offerBadges.map((badge) => (
                <Badge key={badge.key} variant={badge.variant}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          <ProductStatTile
            className="w-fit min-w-24 shrink-0"
            label="سعر البيع"
            accent={hasDealPrice}
            value={
              hasDealPrice ? (
                <span className="flex items-baseline gap-1.5">
                  <span>{formatPrice({ amount: dealPriceAmount as number, currency })}</span>
                  <span className="text-xs font-normal text-muted-foreground line-through">
                    {formatPrice({ amount: listPrice, currency })}
                  </span>
                </span>
              ) : (
                formatPrice({ amount: listPrice, currency })
              )
            }
          />
          {/* The purchase price is the card's; the quantity is inventory's. */}
          <ProductStatTile
            className="w-fit min-w-24 shrink-0"
            label="تكلفة الكاتالوج"
            value={costPrice ? formatPrice({ amount: costPrice, currency }) : '—'}
          />
          {/* The quantity the channels sell from: the product and all its variants. */}
          <ProductStatTile
            className="w-fit min-w-24 shrink-0"
            label="الكمية"
            value={ownQuantity === null ? 'غير متتبَّعة' : ownQuantity}
          />
          {sections.inventory ? (
            <ProductStatTile className="w-fit min-w-24 shrink-0" label="في المخازن" value={stockQuantity} />
          ) : null}
        </div>
      </div>
    </section>
  );
}
