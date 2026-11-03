'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import {
  PRODUCT_INVOICE_POLICY_OPTIONS,
  PRODUCT_TRACKING_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  type ProductFormInput,
  type ProductFormValues,
} from '@/features/catalog/products/schemas/product-schema';
import {
  ProductFormField,
  ProductFormSection,
} from '@/features/catalog/products/components/product-form-section';
import type { Brand } from '@/features/ecommerce/domain/types/brand';
import type { Category } from '@/features/ecommerce/domain/types/category';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableDropdown } from '@/components/ui/shared-dialogs';
import { cn } from '@/shared/utils';
import { useProductAppSections } from '@/features/catalog/products/hooks/use-product-app-sections';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { usePosMenuCategories } from '@/features/pos/hooks/use-pos-menu-categories';
import { useCompanyCurrency } from '@/features/auth/lib/company-currency';
import { currencySymbolAr } from '@/shared/currencies';
const NO_VALUE = '__none__';

type Props = {
  control: Control<ProductFormInput, unknown, ProductFormValues>;
  errors: FieldErrors<ProductFormInput>;
  register: UseFormRegister<ProductFormInput>;
  categories: Category[] | undefined;
  brands: Brand[] | undefined;
  /** The purchase price follows inventory (costing runs on its stock). */
  costManaged?: boolean;
  /** A system item: its type and code are fixed (the server refuses a change). */
  locked?: boolean;
};

export function ProductGeneralTab({
  control,
  errors,
  register,
  categories,
  brands,
  costManaged = false,
  locked = false,
}: Props) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  // Cost and tracking are inventory's; compare-at price is the store's.
  const sections = useProductAppSections();
  const currencySymbol = currencySymbolAr(useCompanyCurrency());
  const posEnabled = sections.pos;
  const posCategories = usePosMenuCategories(getStorefrontCompanyId(), posEnabled);

  return (
    <div className="space-y-4">
      <ProductFormSection
        title="الأساسيات"
        description="ما يحتاجه المنتج ليظهر ويُعرَّف في المخزون والمتجر."
      >
        <ProductFormField label="نوع المنتج">
          <Controller
            control={control}
            name="productType"
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="نوع المنتج">
                {PRODUCT_TYPE_OPTIONS.map((option) => {
                  const selected = field.value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={locked}
                      onClick={() => field.onChange(option.value)}
                      className={cn(
                        'rounded-xl border px-3 py-2.5 text-sm transition-all',
                        selected
                          ? 'border-primary bg-primary/10 font-semibold text-primary shadow-soft'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground',
                      )}
                    >
                      {option.labelAr}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </ProductFormField>

        {/* Active/draft now lives as a switch beside the name in ProductDetailHero. */}
        <ProductFormField
          label="رمز المنتج (SKU) — اختياري"
          htmlFor="product-sku"
          error={errors.sku?.message}
          hint="اتركه فارغًا ليُنشئ النظام رمزًا فريدًا تلقائيًا، أو أدخل رمزك الخاص."
        >
          <Input
            id="product-sku"
            dir="ltr"
            placeholder="تلقائي"
            className="h-11"
            readOnly={locked}
            {...register('sku')}
          />
        </ProductFormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ProductFormField label="الفئة" htmlFor="product-category">
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <SearchableDropdown
                  value={field.value ?? NO_VALUE}
                  onChange={(value) => field.onChange(value === NO_VALUE ? undefined : value)}
                  placeholder="اختر فئة"
                  options={[
                    { value: NO_VALUE, label: 'بدون فئة' },
                    ...(categories ?? []).map((category) => ({
                      value: category.id,
                      label: category.nameAr,
                    })),
                  ]}
                  className="h-11"
                />
              )}
            />
          </ProductFormField>

          <ProductFormField label="العلامة التجارية" htmlFor="product-brand">
            <Controller
              control={control}
              name="brandId"
              render={({ field }) => (
                <SearchableDropdown
                  value={field.value ?? NO_VALUE}
                  onChange={(value) => field.onChange(value === NO_VALUE ? undefined : value)}
                  placeholder="بدون علامة تجارية"
                  options={[
                    { value: NO_VALUE, label: 'بدون علامة تجارية' },
                    ...(brands ?? []).map((brand) => ({
                      value: brand.id,
                      label: brand.nameAr,
                    })),
                  ]}
                  className="h-11"
                />
              )}
            />
          </ProductFormField>
        </div>

        {posEnabled ? (
          <ProductFormField
            label="فئة نقطة البيع"
            htmlFor="product-pos-category"
            hint="تظهر في شاشة الكاشير. أنشئ الفئات من إعدادات نقاط البيع، ثم اخترها هنا كما تختار الفئة."
          >
            <Controller
              control={control}
              name="posMenuCategoryId"
              render={({ field }) => (
                <SearchableDropdown
                  value={field.value ?? NO_VALUE}
                  onChange={(value) => field.onChange(value === NO_VALUE ? undefined : value)}
                  placeholder="بدون فئة نقطة البيع"
                  options={[
                    { value: NO_VALUE, label: 'بدون فئة نقطة البيع' },
                    ...(posCategories.data ?? []).map((category) => ({
                      value: category.id,
                      label: category.name,
                    })),
                  ]}
                  className="h-11"
                />
              )}
            />
          </ProductFormField>
        ) : null}
      </ProductFormSection>

      <ProductFormSection title="التسعير" description="أسعار البيع والشراء بالريال اليمني.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ProductFormField
            label="سعر البيع"
            htmlFor="product-list-price"
            error={errors.listPrice?.message}
          >
            <div className="relative">
              <Input
                id="product-list-price"
                type="number"
                min={0}
                step="0.01"
                dir="rtl"
                className="h-11 pe-12"
                {...register('listPrice')}
              />
              <span className="pointer-events-none absolute inset-y-0 inset-e-3 flex items-center text-xs text-muted-foreground">
                {currencySymbol}
              </span>
            </div>
          </ProductFormField>

          {/* The card's purchase price: what the store and POS take as the cost
              of each sale (profit). Typed by hand unless inventory costs it. */}
          <ProductFormField
              label="سعر الشراء"
              htmlFor="product-cost-price"
              error={errors.costPrice?.message}
              hint={
                costManaged
                  ? 'يُحسب تلقائيًا من المخزون حسب طريقة التكلفة. لتصحيحه عدّل مستند الاستلام أو أدخل تسوية بالسعر الصحيح.'
                  : sections.inventory
                    ? undefined
                    : 'تكلفة الوحدة التي تُحسب منها أرباح المتجر ونقاط البيع.'
              }
            >
              <div className="relative">
                <Input
                  id="product-cost-price"
                  type="number"
                  min={0}
                  step="0.01"
                  dir="rtl"
                  className="h-11 pe-12"
                  readOnly={costManaged}
                  aria-readonly={costManaged}
                  {...register('costPrice')}
                />
                <span className="pointer-events-none absolute inset-y-0 inset-e-3 flex items-center text-xs text-muted-foreground">
                  {currencySymbol}
                </span>
              </div>
            </ProductFormField>

          {sections.store ? (
            <ProductFormField
              label="سعر المقارنة"
              htmlFor="product-compare-at"
              hint="يظهر كسعر قبل الخصم في المتجر."
            >
              <div className="relative">
                <Input
                  id="product-compare-at"
                  type="number"
                  min={0}
                  step="0.01"
                  dir="rtl"
                  placeholder="اختياري"
                  className="h-11 pe-12"
                  {...register('compareAtPrice')}
                />
                <span className="pointer-events-none absolute inset-y-0 inset-e-3 flex items-center text-xs text-muted-foreground">
                  {currencySymbol}
                </span>
              </div>
            </ProductFormField>
          ) : null}
        </div>
      </ProductFormSection>

      <ProductFormSection title="الوصف" description="نصوص العرض في بطاقة المنتج والصفحة.">
        <ProductFormField
          label="وصف مختصر"
          htmlFor="product-short-description"
          hint="يظهر في بطاقات القوائم."
        >
          <Textarea
            id="product-short-description"
            rows={2}
            className="resize-none"
            {...register('shortDescription')}
          />
        </ProductFormField>
        <ProductFormField label="الوصف الكامل" htmlFor="product-description">
          <Textarea
            id="product-description"
            rows={4}
            className="resize-none"
            {...register('description')}
          />
        </ProductFormField>
      </ProductFormSection>

      <div className="overflow-hidden rounded-2xl border border-border/80">
        <button
          type="button"
          onClick={() => setShowAdvanced((value) => !value)}
          className="flex w-full items-center justify-between gap-3 bg-muted/20 px-4 py-3 text-start transition-colors hover:bg-muted/35 sm:px-5"
          aria-expanded={showAdvanced}
        >
          <div>
            <p className="text-sm font-semibold text-foreground">تفاصيل إضافية</p>
            <p className="text-[11px] text-muted-foreground">
              فوترة، تتبع، باركود، علامات، وأبعاد الشحن — اختيارية.
            </p>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              showAdvanced && 'rotate-180',
            )}
          />
        </button>

        {showAdvanced ? (
          <div className="space-y-5 border-t border-border/70 p-4 sm:p-5">
            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground">الفوترة والتتبع</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ProductFormField label="سياسة الفوترة" htmlFor="product-invoice-policy">
                  <Controller
                    control={control}
                    name="invoicePolicy"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="product-invoice-policy" aria-label="سياسة الفوترة" className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_INVOICE_POLICY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.labelAr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </ProductFormField>

                {sections.inventory ? (
                  <ProductFormField label="التتبع" htmlFor="product-tracking">
                    <Controller
                      control={control}
                      name="tracking"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="product-tracking" aria-label="التتبع" className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_TRACKING_OPTIONS.map((option) => (
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
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground">الترميز والعلامات</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ProductFormField label="الباركود" htmlFor="product-barcode">
                  <Input
                    id="product-barcode"
                    dir="ltr"
                    placeholder="6281000000000"
                    className="h-11"
                    {...register('barcode')}
                  />
                </ProductFormField>

                <ProductFormField
                  label="علامات التصنيف"
                  htmlFor="product-tags"
                  hint="مفصولة بفواصل — مثال: best-seller، deals"
                >
                  <Input
                    id="product-tags"
                    className="h-11"
                    placeholder="best-seller, deals"
                    {...register('tagsInput')}
                  />
                </ProductFormField>
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground">أبعاد الشحن (اختياري)</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ProductFormField label="الوزن (كجم)" htmlFor="product-weight">
                  <Input
                    id="product-weight"
                    type="number"
                    min={0}
                    step="0.01"
                    dir="rtl"
                    className="h-11"
                    {...register('weightKg')}
                  />
                </ProductFormField>
                <ProductFormField label="الطول (سم)" htmlFor="product-length">
                  <Input
                    id="product-length"
                    type="number"
                    min={0}
                    step="0.1"
                    dir="rtl"
                    className="h-11"
                    {...register('lengthCm')}
                  />
                </ProductFormField>
                <ProductFormField label="العرض (سم)" htmlFor="product-width">
                  <Input
                    id="product-width"
                    type="number"
                    min={0}
                    step="0.1"
                    dir="rtl"
                    className="h-11"
                    {...register('widthCm')}
                  />
                </ProductFormField>
                <ProductFormField label="الارتفاع (سم)" htmlFor="product-height">
                  <Input
                    id="product-height"
                    type="number"
                    min={0}
                    step="0.1"
                    dir="rtl"
                    className="h-11"
                    {...register('heightCm')}
                  />
                </ProductFormField>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
