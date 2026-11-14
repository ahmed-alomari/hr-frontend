'use client';

import * as React from 'react';
import { Minus, Plus, ShoppingCart, SlidersHorizontal } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { StockStatus } from '@/features/ecommerce/domain/constants/stock-status';
import { useStorefrontCartUi } from '@/features/ecommerce/storefront/hooks/use-storefront-cart-ui';
import { isRtlLocale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { cn } from '@/shared/utils';

/** The cart icon on a product card's image (homepage, lists): always visible. */
const QUICK_CART_CLASS =
  'inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50';

type AddToCartButtonProps = {
  productId: string;
  stockStatus: StockStatus;
  variantId?: string;
  /** Qty to add on first click (PDP). Defaults to 1. */
  quantity?: number;
  /** Warehouse / soft max when inventory is tracked. */
  maxQuantity?: number;
  variant?: 'icon' | 'button' | 'quick';
  className?: string;
  onAdded?: () => void;
  /**
   * The product has options (size, color…): the button opens this page to
   * choose one instead of adding the product without it.
   */
  optionsHref?: string;
};

function lineMatches(productId: string, variantId: string | undefined, line: { productId: string; variantId?: string }) {
  if (line.productId !== productId) return false;
  if (variantId) return line.variantId === variantId;
  return !line.variantId;
}

export function AddToCartButton({
  productId,
  stockStatus,
  variantId,
  quantity: addQuantity = 1,
  maxQuantity = 99,
  variant = 'icon',
  className,
  onAdded,
  optionsHref,
}: AddToCartButtonProps) {
  const t = useTranslations('storefront');
  const tA11y = useTranslations('storefront.a11y');
  const locale = useLocale();
  const isRtl = isRtlLocale(locale);
  const addItem = useStorefrontCartUi((state) => state.addItem);
  const setQuantity = useStorefrontCartUi((state) => state.setQuantity);
  const quantity = useStorefrontCartUi(
    (state) => state.lines.find((line) => lineMatches(productId, variantId, line))?.quantity ?? 0,
  );
  const [hydrated, setHydrated] = React.useState(false);
  const outOfStock = stockStatus === 'out_of_stock' || stockStatus === 'discontinued';
  const cappedMax = Math.max(1, maxQuantity);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  function notifyAdded() {
    toast.custom(
      (id) => (
        <div
          className="pointer-events-auto inline-flex w-fit max-w-[min(100vw-2rem,20rem)] items-center gap-2 text-sm text-foreground"
          role="status"
        >
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="whitespace-nowrap font-medium">{t('products.addedToCart')}</span>
          <button
            type="button"
            className="ms-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => toast.dismiss(id)}
            aria-label={tA11y('close')}
          >
            ×
          </button>
        </div>
      ),
      {
        duration: 1800,
        unstyled: true,
        className: '!w-auto !max-w-none !border-0 !bg-transparent !p-0 !shadow-none',
      },
    );
  }

  function handleAdd(event?: React.MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    if (outOfStock) return;
    const next = Math.min(cappedMax, Math.max(1, addQuantity));
    if (quantity > 0) {
      setQuantity(productId, Math.min(cappedMax, quantity + next), variantId);
    } else {
      addItem(productId, next, variantId);
    }
    notifyAdded();
    onAdded?.();
  }

  function handleDecrement(event?: React.MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    setQuantity(productId, quantity - 1, variantId);
  }

  function handleIncrement(event?: React.MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    if (quantity >= cappedMax) return;
    setQuantity(productId, quantity + 1, variantId);
  }

  if (optionsHref && !outOfStock) {
    const label = t('products.chooseOptions');
    if (variant === 'button') {
      return (
        <Link
          href={optionsHref}
          prefetch={false}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
            className,
          )}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {label}
        </Link>
      );
    }
    return (
      <Link
        href={optionsHref}
        prefetch={false}
        aria-label={label}
        title={label}
        className={cn(
          variant === 'quick'
            ? QUICK_CART_CLASS
            : 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90',
          className,
        )}
      >
        {/* The card's cart icon on every product (2026-11-14): one with
            options opens its page to choose them first. */}
        {variant === 'quick' ? (
          <ShoppingCart className="h-4 w-4" aria-hidden />
        ) : (
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
        )}
      </Link>
    );
  }

  const showStepper = hydrated && quantity > 0 && !outOfStock;

  if (showStepper) {
    const compact = variant === 'quick' || variant === 'icon';
    const btnSize = compact ? 'h-8 w-8' : 'h-10 w-10';
    const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

    const decreaseBtn = (
      <button
        type="button"
        onClick={handleDecrement}
        className={cn(
          'inline-flex items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          btnSize,
          isRtl ? (compact ? 'rounded-r-md' : 'rounded-r-lg') : compact ? 'rounded-l-md' : 'rounded-l-lg',
        )}
        aria-label={tA11y('decreaseQuantity')}
      >
        <Minus className={iconSize} aria-hidden />
      </button>
    );

    const increaseBtn = (
      <button
        type="button"
        onClick={handleIncrement}
        disabled={quantity >= cappedMax}
        className={cn(
          'inline-flex items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
          btnSize,
          isRtl ? (compact ? 'rounded-l-md' : 'rounded-l-lg') : compact ? 'rounded-r-md' : 'rounded-r-lg',
        )}
        aria-label={tA11y('increaseQuantity')}
      >
        <Plus className={iconSize} aria-hidden />
      </button>
    );

    return (
      <div
        dir="rtl"
        className={cn(
          'inline-flex items-center border border-border bg-card text-foreground shadow-soft',
          compact ? 'h-8 rounded-md' : 'h-10 w-full justify-between rounded-lg',
          className,
        )}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {isRtl ? increaseBtn : decreaseBtn}
        <span
          className={cn(
            'min-w-8 text-center font-semibold tabular-nums',
            compact ? 'px-1 text-xs' : 'px-3 text-sm',
          )}
          aria-live="polite"
        >
          {quantity}
        </span>
        {isRtl ? decreaseBtn : increaseBtn}
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleAdd}
        disabled={outOfStock}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <ShoppingCart className="h-4 w-4" aria-hidden />
        {t('products.addToCart')}
      </button>
    );
  }

  if (variant === 'quick') {
    return (
      <button
        type="button"
        onClick={handleAdd}
        disabled={outOfStock}
        className={cn(QUICK_CART_CLASS, className)}
        aria-label={t('products.addToCart')}
        title={t('products.addToCart')}
      >
        <ShoppingCart className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={outOfStock}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      aria-label={t('products.addToCart')}
    >
      <ShoppingCart className="h-4 w-4" aria-hidden />
    </button>
  );
}
