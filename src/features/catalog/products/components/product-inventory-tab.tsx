'use client';

import * as React from 'react';
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { useProductOnHand, useProductStockSummary } from '@/features/inventory/admin/hooks/use-product-on-hand';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { useWarehouseLocations } from '@/features/inventory/admin/locations/hooks/use-warehouse-locations';
import { STOCK_STATUS_OPTIONS, type ProductFormInput, type ProductFormValues } from '@/features/catalog/products/schemas/product-schema';
import {
  ProductFormField,
  ProductFormSection,
} from '@/features/catalog/products/components/product-form-section';
import { ProductStatTile } from '@/features/catalog/products/components/product-stat-tile';
import {
  useProductAppSections,
  useProductsSellLocally,
} from '@/features/catalog/products/hooks/use-product-app-sections';
import { ProductQuantitySection } from '@/features/catalog/products/components/product-quantity-section';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableDropdown } from '@/components/ui/shared-dialogs';

const NO_VALUE = '__none__';

type Props = {
  control: Control<ProductFormInput, unknown, ProductFormValues>;
  errors: FieldErrors<ProductFormInput>;
  register: UseFormRegister<ProductFormInput>;
  setValue: UseFormSetValue<ProductFormInput>;
  productId?: string | null;
};

export function ProductInventoryTab({ control, errors, register, setValue, productId }: Props) {
  const companyId = getStorefrontCompanyId();
  // Stock is inventory's and stockStatus the store's: each shows only when its app is enabled.
  const sections = useProductAppSections();
  // A channel without its inventory bridge sells from the product quantity (§21).
  const sellsLocally = useProductsSellLocally();
  const stockCompanyId = sections.inventory ? companyId : undefined;
  const variants = useWatch({ control, name: 'variants' }) ?? [];
  const warehouseId = useWatch({ control, name: 'warehouseId' });
  const hasVariants = variants.length > 0;
  const { data: onHand, isLoading } = useProductOnHand(stockCompanyId, productId ?? undefined);
  const { data: summary } = useProductStockSummary(stockCompanyId, productId ?? undefined);
  const { data: warehousesData } = useWarehouses(
    { companyId, limit: 200 },
    { enabled: sections.inventory },
  );
  const { data: locationsData } = useWarehouseLocations(
    {
      companyId,
      warehouseId: warehouseId || undefined,
      limit: 500,
    },
    { enabled: Boolean(sections.inventory && companyId && warehouseId) },
  );

  const warehouses = warehousesData?.items ?? [];
  const locations = (locationsData?.items ?? []).filter(
    (location) => location.isActive && location.locationType === 'internal',
  );

  const warehouseQty = onHand?.total ?? 0;
  const locationRows = summary?.locations ?? [];

  React.useEffect(() => {
    if (!productId || onHand == null) return;
    setValue('stockQuantity', onHand.total, { shouldDirty: false });
  }, [productId, onHand, setValue]);

  const variantIdsKey = variants.map((variant) => variant.id).join('|');

  React.useEffect(() => {
    if (!productId || onHand == null || !hasVariants) return;
    variants.forEach((variant, index) => {
      const qty = onHand.byVariant[variant.id] ?? 0;
      setValue(`variants.${index}.quantity`, qty, { shouldDirty: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when warehouse totals or variant ids change
  }, [productId, onHand, hasVariants, variantIdsKey, setValue]);

  return (
    <div className="space-y-4">
      {sections.inventory ? (
        <>
          <ProductFormSection
            title="رصيد المخزون"
            description={
              productId
                ? 'مصدر الحقيقة هو دفتر المخزون. الأرقام هنا للعرض بعد تصديق الحركات.'
                : 'احفظ المنتج أولًا ثم صدّق مستندات الاستلام لتظهر الكميات هنا.'
            }
          >
            {/* Three across on phones too: the numbers matter more than the long labels. */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <ProductStatTile
                size="lg"
                label="المتاح فعليًا (On Hand)"
                value={productId ? (isLoading ? '…' : warehouseQty) : 0}
              />
              {productId && summary ? (
                <>
                  <ProductStatTile size="lg" label="محجوز (Reserved)" value={summary.reserved} />
                  <ProductStatTile size="lg" accent label="قابل للبيع (Available)" value={summary.available} />
                </>
              ) : null}
            </div>

            {productId && locationRows.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">الموقع</th>
                      <th className="px-3 py-2 text-start font-medium">المستودع</th>
                      <th className="px-3 py-2 text-start font-medium">الكمية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationRows.map((row) => (
                      <tr key={row.locationId} className="border-t border-border/60">
                        <td className="px-3 py-2">
                          {row.locationNameAr || row.locationCode}
                        </td>
                        <td className="px-3 py-2">{row.warehouseCode}</td>
                        <td className="px-3 py-2 tabular-nums">{row.onHand}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </ProductFormSection>

          <ProductFormSection
            title="مستودع الخصم الافتراضي"
            description="منه يُخصم البيع إن لم يُرسل موقع أثناء العملية. المتجر ونقطة البيع يقرآن نفس الدفتر."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProductFormField label="المستودع" htmlFor="product-warehouse">
                <Controller
                  control={control}
                  name="warehouseId"
                  render={({ field }) => (
                    <SearchableDropdown
                      value={field.value ?? NO_VALUE}
                      onChange={(value) => {
                        const next = value === NO_VALUE ? undefined : value;
                        field.onChange(next);
                        setValue('locationId', undefined, { shouldDirty: true });
                      }}
                      placeholder="بدون مستودع افتراضي"
                      options={[
                        { value: NO_VALUE, label: 'بدون مستودع افتراضي' },
                        ...warehouses.map((warehouse) => ({
                          value: warehouse.id,
                          label: warehouse.nameAr,
                        })),
                      ]}
                      className="h-11"
                    />
                  )}
                />
              </ProductFormField>

              <ProductFormField
                label="موقع التخزين"
                htmlFor="product-location"
                hint="اختياري — موقع داخل المستودع المختار."
              >
                <Controller
                  control={control}
                  name="locationId"
                  render={({ field }) => (
                    <SearchableDropdown
                      value={field.value ?? NO_VALUE}
                      onChange={(value) => field.onChange(value === NO_VALUE ? undefined : value)}
                      placeholder={warehouseId ? 'موقع WH/Stock الافتراضي' : 'اختر مستودعاً أولاً'}
                      disabled={!warehouseId}
                      options={[
                        { value: NO_VALUE, label: 'بدون موقع محدد' },
                        ...locations.map((location) => ({
                          value: location.id,
                          label: `${location.nameAr} (${location.code})`,
                        })),
                      ]}
                      className="h-11"
                    />
                  )}
                />
              </ProductFormField>
            </div>
          </ProductFormSection>
        </>
      ) : null}

      {sellsLocally ? <ProductQuantitySection productId={productId} variants={variants} /> : null}

      {sections.store || sections.inventory ? (
      <ProductFormSection title="إعدادات التوفر" description="حالة العرض وتنبيهات النفاد.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sections.store ? (
            <ProductFormField label="حالة التوفر" htmlFor="product-availability">
              <Controller
                control={control}
                name="stockStatus"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="product-availability" aria-label="حالة التوفر" className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.labelAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </ProductFormField>
          ) : null}

          {sections.inventory ? (
            <ProductFormField
              label="حد المخزون المنخفض"
              htmlFor="product-low-stock"
              error={errors.lowStockThreshold?.message}
              hint="تنبيه عندما يصل الرصيد إلى هذا الحد أو دونه."
            >
              <Input
                id="product-low-stock"
                type="number"
                min={0}
                step={1}
                dir="rtl"
                className="h-11 max-w-[10rem]"
                {...register('lowStockThreshold', { valueAsNumber: true })}
              />
            </ProductFormField>
          ) : null}
        </div>
      </ProductFormSection>
      ) : null}
    </div>
  );
}
