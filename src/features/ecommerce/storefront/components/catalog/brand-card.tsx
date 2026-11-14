import Image from 'next/image';
import { Tag } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { StorefrontBrand } from '@/features/ecommerce/storefront/domain/storefront-models';
import { cn } from '@/shared/utils';
import { BrandNames } from '@/features/ecommerce/storefront/components/catalog/brand-names';

type BrandCardProps = {
  brand: StorefrontBrand;
  variant?: 'tile' | 'slider';
  showLogo?: boolean;
  className?: string;
};

export function BrandCard({ brand, variant = 'slider', showLogo = true, className }: BrandCardProps) {
  return (
    <Link
      href={`/store/brands/${brand.slug}`}
      prefetch={false}
      className={cn(
        'group flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card text-center shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        variant === 'slider' && 'w-40 shrink-0 p-4 sm:w-44',
        variant === 'tile' && 'p-5',
        className,
      )}
    >
      {showLogo ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
          <Tag className="h-5 w-5" aria-hidden />
        </div>
      ) : null}
      <BrandNames brand={brand} className="text-sm font-medium text-foreground" />
    </Link>
  );
}
