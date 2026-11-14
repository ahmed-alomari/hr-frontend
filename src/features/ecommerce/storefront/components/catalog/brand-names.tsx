import type { StorefrontBrand } from '@/features/ecommerce/storefront/domain/storefront-models';
import { cn } from '@/shared/utils';

type BrandNamesProps = {
  brand: Pick<StorefrontBrand, 'name' | 'nameAr' | 'nameEn'>;
  /** Classes of the main (Arabic) name. */
  className?: string;
  /** Classes of the English name under it. */
  secondaryClassName?: string;
  align?: 'center' | 'start';
};

/**
 * A brand's Arabic name with its English name under it (owner 2026-11-14),
 * whatever the page language. Only the main name when the brand has no
 * English name, or the same one.
 */
export function BrandNames({
  brand,
  className,
  secondaryClassName,
  align = 'center',
}: BrandNamesProps) {
  const primary = brand.nameAr?.trim() || brand.name;
  const english = brand.nameEn?.trim() || '';
  const showEnglish = english && english.toLowerCase() !== primary.toLowerCase();
  return (
    <span
      className={cn(
        'flex min-w-0 flex-col leading-tight',
        align === 'center' ? 'items-center' : 'items-start',
      )}
    >
      <span className={cn('line-clamp-2', className)}>{primary}</span>
      {showEnglish ? (
        <span
          dir="ltr"
          className={cn('line-clamp-1 text-xs font-normal text-muted-foreground', secondaryClassName)}
        >
          {english}
        </span>
      ) : null}
    </span>
  );
}
