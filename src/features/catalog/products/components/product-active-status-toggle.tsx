'use client';

import { useWatch, type Control, type UseFormSetValue } from 'react-hook-form';
import type { ProductFormInput, ProductFormValues } from '@/features/catalog/products/schemas/product-schema';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/shared/utils';

type Props = {
  control: Control<ProductFormInput, unknown, ProductFormValues>;
  setValue: UseFormSetValue<ProductFormInput>;
  className?: string;
  /** When archived, toggle is hidden — caller shows archive badge instead. */
  hideWhenArchived?: boolean;
  /** A system item: its status is fixed (the server refuses a change). */
  locked?: boolean;
};

/** Active/draft switch beside product name — green tint when active. */
export function ProductActiveStatusToggle({
  control,
  setValue,
  className,
  hideWhenArchived = true,
  locked = false,
}: Props) {
  const status = useWatch({ control, name: 'status' });
  const isActive = status === 'active';

  if (hideWhenArchived && status === 'archived') {
    return null;
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 transition-colors',
        isActive
          ? 'border-emerald-500/35 bg-emerald-500/10'
          : 'border-border/80 bg-muted/50',
        className,
      )}
    >
      <span
        className={cn(
          'text-xs font-semibold',
          isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground',
        )}
      >
        {isActive ? 'مفعّل' : 'غير مفعّل'}
      </span>
      <Switch
        checked={isActive}
        disabled={locked}
        onCheckedChange={(checked) =>
          setValue('status', checked ? 'active' : 'draft', {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        aria-label="تفعيل المنتج للظهور في القوائم والمتجر"
        className={cn(isActive && 'data-[state=checked]:bg-emerald-600')}
      />
    </div>
  );
}
