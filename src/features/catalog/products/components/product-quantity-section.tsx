'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ProductFormField,
  ProductFormSection,
} from '@/features/catalog/products/components/product-form-section';
import {
  productStockApi,
  type ProductStockLevel,
} from '@/features/catalog/products/lib/api/product-stock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Item = { variantId: string | null; label: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The product's own quantity, or each variant's (backend decisions.md §21):
 * what the channels not linked to inventory (the store, the point of sale)
 * sell from — one number for all of them. Setting a quantity starts
 * tracking: it is deducted on sale, a sale is refused when short, and it
 * comes back on cancel. Without a quantity the item is not tracked.
 */
export function ProductQuantitySection({
  productId,
  variants,
}: {
  productId?: string | null;
  variants: Array<{ id: string; nameAr: string }>;
}) {
  const queryClient = useQueryClient();
  const queryKey = ['catalog', 'product-stock-levels', productId];
  const {
    data: levels = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => productStockApi.list(productId as string),
    enabled: Boolean(productId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const setLevel = useMutation({
    mutationFn: (input: { variantId: string | null; quantity: number }) =>
      productStockApi.set(productId as string, input),
    onSuccess: () => {
      toast.success('تم حفظ الكمية');
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message || 'تعذّر حفظ الكمية'),
  });
  const removeLevel = useMutation({
    mutationFn: (levelId: string) => productStockApi.remove(productId as string, levelId),
    onSuccess: () => {
      toast.success('أُوقف تتبّع الكمية');
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message || 'تعذّر إيقاف التتبّع'),
  });

  // Saved variants only (new ones have no id on the server yet).
  const savedVariants = variants.filter((variant) => UUID.test(variant.id));
  const items: Item[] =
    savedVariants.length > 0
      ? savedVariants.map((variant) => ({ variantId: variant.id, label: variant.nameAr }))
      : [{ variantId: null, label: 'المنتج' }];

  return (
    <ProductFormSection
      title="الكمية"
      description="كمية واحدة يبيع منها المتجر ونقاط البيع (بلا مخازن): تُخصم عند البيع ويُرفض البيع عند النقص، وتعود عند الإلغاء أو المرتجع. بدون كمية لا يُتتبّع المنتج."
    >
      {!productId ? (
        <p className="text-xs text-muted-foreground">احفظ المنتج أولاً لتعيين كميته.</p>
      ) : isLoading ? (
        <p className="text-xs text-muted-foreground">…</p>
      ) : isError ? (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <span>تعذّر تحميل الكمية.</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
            إعادة المحاولة
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <StockRow
              key={item.variantId ?? 'product'}
              item={item}
              level={levels.find((l) => l.variantId === item.variantId) ?? null}
              saving={setLevel.isPending || removeLevel.isPending}
              onSave={(quantity) => setLevel.mutate({ variantId: item.variantId, quantity })}
              onStop={(levelId) => removeLevel.mutate(levelId)}
            />
          ))}
        </div>
      )}
    </ProductFormSection>
  );
}

function StockRow({
  item,
  level,
  saving,
  onSave,
  onStop,
}: {
  item: Item;
  level: ProductStockLevel | null;
  saving: boolean;
  onSave: (quantity: number) => void;
  onStop: (levelId: string) => void;
}) {
  const [value, setValue] = React.useState(level ? String(level.quantity) : '');
  React.useEffect(() => {
    setValue(level ? String(level.quantity) : '');
  }, [level]);
  const quantity = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(quantity) && quantity >= 0;
  const id = `product-stock-${item.variantId ?? 'product'}`;

  return (
    <ProductFormField
      label={item.label}
      htmlFor={id}
      hint={level ? undefined : 'غير متتبَّع — يُباع بلا فحص كمية'}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          type="number"
          min={0}
          step={1}
          dir="rtl"
          className="h-10 max-w-[9rem]"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button
          type="button"
          size="sm"
          disabled={!valid || saving || (level != null && quantity === level.quantity)}
          onClick={() => onSave(quantity)}
        >
          {level ? 'حفظ' : 'بدء التتبّع'}
        </Button>
        {level ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => onStop(level.id)}
          >
            إيقاف التتبّع
          </Button>
        ) : null}
      </div>
    </ProductFormField>
  );
}
