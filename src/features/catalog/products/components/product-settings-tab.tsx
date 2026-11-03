'use client';

import type { ChangeEvent } from 'react';
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import type { ProductFormInput, ProductFormValues } from '@/features/catalog/products/schemas/product-schema';
import {
  ProductFormField,
  ProductFormSection,
} from '@/features/catalog/products/components/product-form-section';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { cn } from '@/shared/utils';
import { useProductAppSections } from '@/features/catalog/products/hooks/use-product-app-sections';
import { useCompanyCurrency } from '@/features/auth/lib/company-currency';
import { currencySymbolAr } from '@/shared/currencies';
import { localYmd } from '@/features/catalog/products/lib/product-form-mapping';
import { ProductOfferCard } from '@/features/catalog/products/components/product-offer-card';

type Props = {
  control: Control<ProductFormInput, unknown, ProductFormValues>;
  errors: FieldErrors<ProductFormInput>;
  register: UseFormRegister<ProductFormInput>;
  setValue: UseFormSetValue<ProductFormInput>;
  /** A system item: its sale, purchase and register flags are fixed. */
  locked?: boolean;
};

/** Today + N days as a local day (YYYY-MM-DD): the deal's end date. */
function dayAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localYmd(date);
}

export function ProductSettingsTab({ control, errors, register, setValue, locked = false }: Props) {
  // Promos (new badge, deal, wholesale, discount) are the store's; stock
  // behaviour is inventory's. Image display lives on its own tab.
  const sections = useProductAppSections();
  const currencySymbol = currencySymbolAr(useCompanyCurrency());
  return (
    <div className="space-y-4">
      {sections.store ? (
        <ProductFormSection
          title="العروض والترويج"
          description="فعّل الخيارات حسب الحاجة. التواريخ اختيارية — اتركها فارغة ليستمر العرض بلا انتهاء."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Controller
              control={control}
              name="isNewProduct"
              render={({ field }) => (
                <div
                  className={cn(
                    'rounded-xl border p-3 transition-colors',
                    field.value ? 'border-primary/30 bg-primary/5' : 'border-border bg-background',
                  )}
                >
                  <label className="flex cursor-pointer items-start justify-between gap-3">
                    <span className="min-w-0 space-y-0.5">
                      <span className="block text-sm font-medium text-foreground">منتج حديث</span>
                      <span className="block text-[11px] text-muted-foreground">
                        يظهر ضمن فلتر المنتجات الحديثة
                      </span>
                    </span>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="منتج حديث"
                    />
                  </label>
                  {field.value ? (
                    <div className="mt-3">
                      <ProductFormField
                        label="يستمر كمنتج حديث حتى"
                        htmlFor="product-new-until"
                        hint="اختياري — فارغ = بدون انتهاء"
                      >
                        <Controller
                          control={control}
                          name="newUntil"
                          render={({ field: dateField }) => (
                            <DatePickerInput
                              id="product-new-until"
                              value={dateField.value ?? ''}
                              onChange={dateField.onChange}
                              placeholder="بدون تاريخ انتهاء"
                            />
                          )}
                        />
                      </ProductFormField>
                    </div>
                  ) : null}
                </div>
              )}
            />

            {sections.store ? (
              <ProductOfferCard
                control={control}
                errors={errors}
                register={register}
                setValue={setValue}
                currencySymbol={currencySymbol}
              />
            ) : null}

            {sections.store ? (
              <Controller
                control={control}
                name="isWholesale"
                render={({ field }) => (
                  <div
                    className={cn(
                      'rounded-xl border p-3 transition-colors',
                      field.value ? 'border-primary/30 bg-primary/5' : 'border-border bg-background',
                    )}
                  >
                    <label className="flex cursor-pointer items-start justify-between gap-3">
                      <span className="min-w-0 space-y-0.5">
                        <span className="block text-sm font-medium text-foreground">أسعار جملة</span>
                        <span className="block text-[11px] text-muted-foreground">
                          سعر الجملة بجانب السعر الأساسي — والتاريخ اختياري
                        </span>
                      </span>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="أسعار جملة"
                      />
                    </label>
                    {field.value ? (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <ProductFormField
                          label="سعر الجملة"
                          htmlFor="product-wholesale-price"
                          error={errors.wholesalePriceAmount?.message}
                          required
                        >
                          <div className="relative">
                            <Input
                              id="product-wholesale-price"
                              type="number"
                              min={0}
                              step="0.01"
                              dir="rtl"
                              className="h-11 pe-12"
                              {...register('wholesalePriceAmount')}
                            />
                            <span className="pointer-events-none absolute inset-y-0 inset-e-3 flex items-center text-xs text-muted-foreground">
                              {currencySymbol}
                            </span>
                          </div>
                        </ProductFormField>
                        <ProductFormField
                          label="ينتهي في"
                          htmlFor="product-wholesale-until"
                          hint="اختياري — فارغ = بدون انتهاء"
                        >
                          <Controller
                            control={control}
                            name="wholesaleUntil"
                            render={({ field: dateField }) => (
                              <DatePickerInput
                                id="product-wholesale-until"
                                value={dateField.value ?? ''}
                                onChange={dateField.onChange}
                                placeholder="بدون تاريخ انتهاء"
                              />
                            )}
                          />
                        </ProductFormField>
                      </div>
                    ) : null}
                  </div>
                )}
              />
            ) : null}

          </div>
        </ProductFormSection>
      ) : null}

      <ProductFormSection title="قنوات البيع" description="أين يظهر المنتج ويُباع.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              {
                name: 'saleOk' as const,
                title: 'متاح للبيع',
                hint: 'يظهر في المتجر وقنوات البيع',
              },
              {
                name: 'purchaseOk' as const,
                title: 'متاح للشراء',
                hint: 'يمكن تموينه من الموردين',
              },
              {
                name: 'posAvailable' as const,
                title: 'نقطة البيع',
                hint: 'متاح في شاشة الكاشير',
              },
            ] as const
          )
            // The register's switch shows only while POS is enabled.
            .filter((item) => item.name !== 'posAvailable' || sections.pos)
            .map((item) => (
            <Controller
              key={item.name}
              control={control}
              name={item.name}
              render={({ field }) => (
                <label
                  className={cn(
                    'flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 transition-colors',
                    field.value ? 'border-primary/30 bg-primary/5' : 'border-border bg-background',
                  )}
                >
                  <span className="min-w-0 space-y-0.5">
                    <span className="block text-sm font-medium text-foreground">{item.title}</span>
                    <span className="block text-[11px] text-muted-foreground">{item.hint}</span>
                  </span>
                  <Switch
                    checked={field.value}
                    disabled={locked}
                    onCheckedChange={field.onChange}
                    aria-label={item.title}
                  />
                </label>
              )}
            />
          ))}
        </div>
      </ProductFormSection>

      {sections.inventory ? (
        <ProductFormSection title="المخزون" description="كيف يتحرك مخزون هذا المنتج عند البيع.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                {
                  name: 'trackInventory' as const,
                  title: 'تتبع المخزون',
                  hint: 'خصم الكمية عند البيع من مخزون المستودع',
                },
              ] as const
            ).map((item) => (
              <Controller
                key={item.name}
                control={control}
                name={item.name}
                render={({ field }) => (
                  <label
                    className={cn(
                      'flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 transition-colors',
                      field.value ? 'border-primary/30 bg-primary/5' : 'border-border bg-background',
                    )}
                  >
                    <span className="min-w-0 space-y-0.5">
                      <span className="block text-sm font-medium text-foreground">{item.title}</span>
                      <span className="block text-[11px] text-muted-foreground">{item.hint}</span>
                    </span>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label={item.title}
                    />
                  </label>
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            البيع بلا رصيد (الطلب عند النفاد) غير مدعوم: لا يُصرف من المخزون أكثر من الرصيد المتاح.
          </p>
        </ProductFormSection>
      ) : null}
    </div>
  );
}
