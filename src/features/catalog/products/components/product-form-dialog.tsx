'use client';

import * as React from 'react';
import { useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { inventoryStockService } from '@/features/inventory/services/inventory-stock.service';
import { useBrands } from '@/features/catalog/brands/hooks/use-brands';
import { useCategories } from '@/features/catalog/categories/hooks/use-categories';
import { useProduct } from '@/features/catalog/products/hooks/use-products';
import { useProductMutations } from '@/features/catalog/products/hooks/use-product-mutations';
import {
  PRODUCT_FORM_DEFAULT_VALUES,
  productFormSchema,
  type ProductFormInput,
  type ProductFormValues,
} from '@/features/catalog/products/schemas/product-schema';
import {
  formValuesToCreateInput,
  productToFormValues,
} from '@/features/catalog/products/lib/product-form-mapping';
import {
  findFirstFormError,
  formHasErrorForFields,
  topLevelFieldFromErrorPath,
} from '@/features/catalog/products/lib/product-form-errors';
import { ProductFormHeader } from '@/features/catalog/products/components/product-form-header';
import { ProductGeneralTab } from '@/features/catalog/products/components/product-general-tab';
import { ProductAttributesTab } from '@/features/catalog/products/components/product-attributes-tab';
import { ProductInventoryTab } from '@/features/catalog/products/components/product-inventory-tab';
import {
  PRODUCT_INVENTORY_DOCS,
  productAppSectionsFrom,
  visibleRelatedDocs,
} from '@/features/catalog/products/hooks/use-product-app-sections';
import { APP, useCompanyApps, type AppRequirement } from '@/shared/modules/company-apps';
import { ProductImageTab } from '@/features/catalog/products/components/product-image-tab';
import { ProductUnitsTab } from '@/features/catalog/products/components/product-units-tab';
import { ProductSettingsTab } from '@/features/catalog/products/components/product-settings-tab';
import { ProductStockMoveRequestDialog } from '@/features/catalog/products/components/product-stock-move-request-dialog';
import { ProductStockMovesListDialog } from '@/features/catalog/products/components/product-stock-moves-list-dialog';
import { ProductStockMovesHistoryDialog } from '@/features/catalog/products/components/product-stock-moves-history-dialog';
import { ProductReplenishmentListDialog } from '@/features/catalog/products/components/product-replenishment-list-dialog';
import { ProductPutawayRulesDialog } from '@/features/catalog/products/components/product-putaway-rules-dialog';
import type { ProductRelatedDocKey } from '@/features/catalog/products/components/product-related-docs-bar';
import { productMoveRequestListRestore } from '@/features/catalog/products/lib/product-move-request-flow';
import type { Product } from '@/features/ecommerce/domain/types/product';
import type { WarehouseOperationKind } from '@/features/inventory/domain/types/warehouse';
import { ImageIcon, Layers, Package, Ruler, Settings, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  dialogShellBodyClass,
  dialogShellContentClass,
  dialogShellHeaderClass,
} from '@/components/ui/dialog';
import { cn } from '@/shared/utils';

type Props = {
  product?: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function ensureSlug(values: ProductFormValues): ProductFormValues {
  if (values.slug?.trim()) return values;
  const fromSku = (values.sku ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return { ...values, slug: fromSku || `product-${Date.now()}` };
}

const FORM_TABS = [
  { value: 'general', label: 'عام', icon: Package },
  { value: 'image', label: 'عرض الصورة', icon: ImageIcon, requiresApp: APP.storeAdmin },
  { value: 'attributes', label: 'خصائص', icon: Layers },
  {
    value: 'availability',
    label: 'توفر',
    icon: Warehouse,
    // The point of sale: the product quantity it sells from (§21).
    requiresAnyApp: [APP.inventory, APP.storeAdmin, APP.pos],
  },
  { value: 'units', label: 'وحدات', icon: Ruler },
  { value: 'settings', label: 'الإعدادات', icon: Settings },
] as const satisfies ReadonlyArray<{ value: string; label: string; icon: unknown } & AppRequirement>;

const TAB_TRIGGER_CLASS =
  'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground shadow-none transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-soft sm:text-sm';

type FormTab = (typeof FORM_TABS)[number]['value'];
type MoveRequestKind = WarehouseOperationKind;

const FORM_TAB_FIELDS: Record<FormTab, string[]> = {
  general: [
    'media',
    'sku',
    'status',
    'productType',
    'categoryId',
    'posMenuCategoryId',
    'brandId',
    'listPrice',
    'costPrice',
  ],
  image: ['imageDisplayFit', 'imageDisplayAspectRatio'],
  attributes: ['attributes', 'variants'],
  availability: ['stockStatus', 'stockQuantity', 'lowStockThreshold'],
  units: ['uomLines'],
  settings: [
    'isTodayDeal',
    'dealPriceAmount',
    'isWholesale',
    'wholesalePriceAmount',
    'isDiscounted',
    'discountPercent',
    'discountAmount',
    'inTodayDeals',
  ],
};

export function ProductFormDialog({ product, open, onOpenChange }: Props) {
  const companyId = getStorefrontCompanyId();
  const { data: categoriesData } = useCategories({ companyId, limit: 100 });
  const { data: brandsData } = useBrands({ companyId, limit: 100 });
  const { create, update } = useProductMutations();
  const isEditing = Boolean(product?.id);
  const {
    data: fullProduct,
    isLoading: isLoadingFullProduct,
    isError: isFullProductError,
  } = useProduct(companyId, product?.id, { enabled: open && Boolean(product?.id) });
  /** List rows omit attributes/variants; edit must wait for GET …/full. */
  const resolvedProduct = isEditing ? (fullProduct ?? null) : null;
  const isSaving = create.isPending || update.isPending;
  const [selectedTab, setActiveTab] = React.useState<FormTab>('general');
  const [activeRelatedDoc, setActiveRelatedDoc] = React.useState<ProductRelatedDocKey | null>(null);
  const [moveRequestKind, setMoveRequestKind] = React.useState<MoveRequestKind | null>(null);
  const [movesListKind, setMovesListKind] = React.useState<MoveRequestKind | null>(null);
  const [movesHistoryOpen, setMovesHistoryOpen] = React.useState(false);
  const [replenishmentListOpen, setReplenishmentListOpen] = React.useState(false);
  const [putawayListOpen, setPutawayListOpen] = React.useState(false);
  const [relatedRequestKeys, setRelatedRequestKeys] = React.useState<
    Partial<Record<ProductRelatedDocKey, number>>
  >({});

  function bumpRelatedRequest(key: ProductRelatedDocKey) {
    setRelatedRequestKeys((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  }

  function restoreMoveRequestList(kind: WarehouseOperationKind, bump = false) {
    const restore = productMoveRequestListRestore(kind);
    if (restore.relatedDoc) {
      if (bump) bumpRelatedRequest(restore.relatedDoc);
      setActiveRelatedDoc(restore.relatedDoc);
    }
    if (restore.openReplenishmentList) setReplenishmentListOpen(true);
    if (restore.movesListKind) setMovesListKind(restore.movesListKind);
  }

  const apps = useCompanyApps();
  const sections = productAppSectionsFrom(apps);
  const visibleTabs = apps.filter(FORM_TABS);
  // A tab of an app that is (or becomes) disabled falls back quietly.
  const activeTab = visibleTabs.some((tab) => tab.value === selectedTab) ? selectedTab : 'general';

  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: PRODUCT_FORM_DEFAULT_VALUES,
  });
  /** Hydrate from GET …/full once per open — avoid reset on refetch wiping unsaved attributes. */
  const hydratedProductIdRef = React.useRef<string | null>(null);

  const variants = useWatch({ control: form.control, name: 'variants' }) ?? [];
  const variantsCount = variants.length;
  const nameAr = useWatch({ control: form.control, name: 'nameAr' }) ?? '';
  const sku = useWatch({ control: form.control, name: 'sku' }) ?? '';

  React.useEffect(() => {
    if (!open) {
      hydratedProductIdRef.current = null;
      return;
    }
    setActiveTab('general');
    setActiveRelatedDoc(null);
    setMoveRequestKind(null);
    setMovesListKind(null);
    setMovesHistoryOpen(false);
    setReplenishmentListOpen(false);
    setPutawayListOpen(false);

    if (!isEditing) {
      form.reset(PRODUCT_FORM_DEFAULT_VALUES);
      hydratedProductIdRef.current = null;
      return;
    }
    if (fullProduct && hydratedProductIdRef.current !== fullProduct.id) {
      form.reset(productToFormValues(fullProduct));
      hydratedProductIdRef.current = fullProduct.id;
    }
  }, [open, isEditing, fullProduct, form]);

  const onSubmit = async (values: ProductFormValues) => {
    if (!companyId) return;
    let nextValues = ensureSlug(values);
    const productId = product?.id;
    // Quantities are inventory's: without it the form keeps its own values.
    if (productId && sections.inventory) {
      const onHand = await inventoryStockService.getOnHandByVariant(companyId, productId);
      nextValues = {
        ...nextValues,
        stockQuantity: onHand.total,
        variants: nextValues.variants.map((variant) => ({
          ...variant,
          quantity: onHand.byVariant[variant.id] ?? 0,
          stockStatus: (onHand.byVariant[variant.id] ?? 0) > 0 ? 'in_stock' : variant.stockStatus,
        })),
      };
    }
    const input = formValuesToCreateInput(nextValues, companyId, {
      existing: resolvedProduct ?? product,
    });

    if (productId) {
      await update.mutateAsync({ companyId, id: productId, patch: input });
    } else {
      await create.mutateAsync(input);
    }
    onOpenChange(false);
  };

  const onInvalid = (formErrors: FieldErrors<ProductFormInput>) => {
    const first = findFirstFormError(formErrors);
    if (!first) return;

    if (first.path === 'nameAr' || first.path.startsWith('nameAr.')) {
      toast.error(first.message || 'يرجى إدخال اسم المنتج أولًا.');
      requestAnimationFrame(() => {
        document.getElementById('product-name-ar')?.focus();
      });
      return;
    }

    const topField = topLevelFieldFromErrorPath(first.path);
    const offendingTab = visibleTabs.find((tab) => FORM_TAB_FIELDS[tab.value].includes(topField));
    if (offendingTab) {
      setActiveTab(offendingTab.value);
      toast.error(first.message || `تحقق من الحقول الموضحة في تبويب «${offendingTab.label}».`);
      return;
    }

    toast.error(first.message || 'تحقق من الحقول المطلوبة والموضحة باللون الأحمر.');
  };

  function requireSavedProduct(actionLabel: string): boolean {
    if (product?.id) return true;
    toast.message(`احفظ المنتج أولًا ثم ${actionLabel}.`);
    return false;
  }

  function onRelatedDoc(key: ProductRelatedDocKey) {
    if (key === 'variants') {
      bumpRelatedRequest(key);
      setActiveTab('attributes');
      setActiveRelatedDoc('variants');
      requestAnimationFrame(() => {
        document.getElementById('product-variants-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    if (key === 'replenish') {
      if (!requireSavedProduct('تعرض طلبات تجديد المخزون')) return;
      bumpRelatedRequest(key);
      setActiveRelatedDoc('replenish');
      setReplenishmentListOpen(true);
      return;
    }
    if (key === 'receipts') {
      if (!requireSavedProduct('تعرض طلبات استلام المخزون')) return;
      bumpRelatedRequest(key);
      setActiveRelatedDoc('receipts');
      setMovesListKind('receipt');
      return;
    }
    if (key === 'issues') {
      if (!requireSavedProduct('تعرض طلبات صرف المخزون')) return;
      bumpRelatedRequest(key);
      setActiveRelatedDoc('issues');
      setMovesListKind('issue');
      return;
    }
    if (key === 'internals') {
      if (!requireSavedProduct('تعرض نقل المواقع')) return;
      bumpRelatedRequest(key);
      setActiveRelatedDoc('internals');
      setMovesListKind('internal');
      return;
    }
    if (key === 'moves') {
      if (!requireSavedProduct('تعرض سجل الحركات')) return;
      bumpRelatedRequest(key);
      setActiveRelatedDoc('moves');
      setMovesHistoryOpen(true);
      return;
    }
    if (key !== 'putaway') return;
    if (!requireSavedProduct('تفتح قواعد التخزين')) return;
    bumpRelatedRequest(key);
    setActiveRelatedDoc('putaway');
    setPutawayListOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(dialogShellContentClass, 'max-w-5xl sm:max-w-5xl')}>
          <div className={cn(dialogShellHeaderClass, 'space-y-1')}>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {isEditing ? 'تعديل المنتج' : 'منتج جديد'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
              {isEditing
                ? 'حدّث بيانات المنتج، الخصائص، والتوفر من التبويبات.'
                : 'أدخل اسم المنتج؛ سيُنشئ النظام رمز SKU فريدًا تلقائيًا.'}
            </DialogDescription>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit(onSubmit, onInvalid)(e);
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className={cn(dialogShellBodyClass, 'space-y-5 bg-muted/15')}>
              {isEditing && isLoadingFullProduct ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                  <p className="text-sm text-muted-foreground">جاري تحميل المنتج والمتغيرات…</p>
                </div>
              ) : isEditing && isFullProductError ? (
                <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-10 text-center text-sm text-destructive">
                  تعذر تحميل تفاصيل المنتج. أعد فتح النافذة أو حدّث الصفحة.
                </p>
              ) : (
                <>
                  <ProductFormHeader
                    control={form.control}
                    register={form.register}
                    setValue={form.setValue}
                    nameError={form.formState.errors.nameAr?.message}
                    isEditing={isEditing}
                    onRelatedDocSelect={onRelatedDoc}
                    relatedDocsActiveKey={activeRelatedDoc}
                    relatedDocs={visibleRelatedDocs([
                      {
                        key: 'variants',
                        label: 'متغيرات المنتج',
                        count: variantsCount,
                        hint:
                          variantsCount > 0
                            ? 'عرض وتحرير أسعار وكميات المتغيرات'
                            : 'أضف خصائص تُنشئ متغيرات لظهورها هنا',
                      },
                      ...PRODUCT_INVENTORY_DOCS.map((doc) =>
                        doc.key === 'putaway' && !product?.id
                          ? { ...doc, hint: 'احفظ المنتج أولًا لإضافة قواعد التخزين' }
                          : doc,
                      ),
                    ], apps)}
                  />

                  <Tabs
                    value={activeTab}
                    onValueChange={(value) => {
                      setActiveTab(value as FormTab);
                      if (value !== 'attributes') setActiveRelatedDoc(null);
                    }}
                    className="w-full space-y-4"
                  >
                    <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl border border-border/80 bg-muted/40 p-1 sm:overflow-x-auto sm:flex sm:justify-start">
                      {visibleTabs.map((tab) => {
                        const Icon = tab.icon;
                        const hasError = formHasErrorForFields(form.formState.errors, FORM_TAB_FIELDS[tab.value]);
                        return (
                          <TabsTrigger key={tab.value} value={tab.value} className={TAB_TRIGGER_CLASS}>
                            <Icon className="hidden h-3.5 w-3.5 sm:block" />
                            <span>{tab.label}</span>
                            {hasError ? (
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-destructive"
                                aria-label="يحتوي حقولًا غير مكتملة"
                              />
                            ) : null}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>

                    <TabsContent value="general" className="mt-0 focus-visible:outline-none">
                      <ProductGeneralTab
                        control={form.control}
                        errors={form.formState.errors}
                        register={form.register}
                        categories={categoriesData?.items}
                        brands={brandsData?.items}
                        costManaged={resolvedProduct?.costManaged === true}
                      />
                    </TabsContent>
                    <TabsContent value="image" className="mt-0 focus-visible:outline-none">
                      <ProductImageTab control={form.control} />
                    </TabsContent>
                    <TabsContent value="attributes" className="mt-0 focus-visible:outline-none">
                      <ProductAttributesTab
                        control={form.control}
                        errors={form.formState.errors}
                        register={form.register}
                        setValue={form.setValue}
                        getValues={form.getValues}
                        productId={product?.id}
                      />
                    </TabsContent>
                    <TabsContent value="availability" className="mt-0 focus-visible:outline-none">
                      <ProductInventoryTab
                        control={form.control}
                        errors={form.formState.errors}
                        register={form.register}
                        setValue={form.setValue}
                        productId={product?.id}
                      />
                    </TabsContent>
                    <TabsContent value="units" className="mt-0 focus-visible:outline-none">
                      <ProductUnitsTab
                        control={form.control}
                        errors={form.formState.errors}
                        setValue={form.setValue}
                      />
                    </TabsContent>
                    <TabsContent value="settings" className="mt-0 focus-visible:outline-none">
                      <ProductSettingsTab
                        control={form.control}
                        errors={form.formState.errors}
                        register={form.register}
                        setValue={form.setValue}
                      />
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t border-border bg-background px-4 py-4 sm:justify-between sm:px-6">
              <div className="flex w-full gap-2 sm:w-auto">
                <Button
                  type="submit"
                  className="min-w-28 flex-1 sm:flex-none"
                  disabled={
                    isSaving ||
                    !companyId ||
                    (isEditing && (isLoadingFullProduct || isFullProductError || !fullProduct))
                  }
                >
                  {isSaving ? 'جاري الحفظ…' : isEditing ? 'حفظ التغييرات' : 'إنشاء المنتج'}
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                  إلغاء
                </Button>
              </div>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                الحقول بـ * مطلوبة، والنقطة الحمراء تحدد التبويب الذي يحتاج مراجعة.
              </p>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ProductStockMoveRequestDialog
        open={moveRequestKind !== null}
        onOpenChange={(next) => {
          if (next) return;
          const kind = moveRequestKind;
          setMoveRequestKind(null);
          if (kind) restoreMoveRequestList(kind);
        }}
        kind={moveRequestKind ?? 'receipt'}
        productId={product?.id}
        productNameAr={nameAr}
        productSku={sku}
        variants={variants}
        onCreated={(_warehouseId, kind) => {
          setMoveRequestKind(null);
          restoreMoveRequestList(kind, true);
        }}
      />

      {product?.id ? (
        <ProductReplenishmentListDialog
          open={replenishmentListOpen}
          onOpenChange={(next) => {
            setReplenishmentListOpen(next);
            if (!next && activeRelatedDoc === 'replenish') setActiveRelatedDoc(null);
          }}
          productId={product.id}
          productNameAr={nameAr || product.nameAr}
          requestKey={relatedRequestKeys.replenish ?? 0}
          onCreateRequest={() => {
            setReplenishmentListOpen(false);
            setActiveRelatedDoc('replenish');
            setMoveRequestKind('purchase_order');
          }}
        />
      ) : null}

      {product?.id ? (
        <ProductStockMovesListDialog
          open={movesListKind !== null}
          onOpenChange={(next) => {
            if (!next) {
              setMovesListKind(null);
              if (
                activeRelatedDoc === 'receipts' ||
                activeRelatedDoc === 'issues' ||
                activeRelatedDoc === 'internals'
              ) {
                setActiveRelatedDoc(null);
              }
            }
          }}
          kind={movesListKind ?? 'receipt'}
          productId={product.id}
          productNameAr={nameAr || product.nameAr}
          requestKey={
            movesListKind === 'issue'
              ? (relatedRequestKeys.issues ?? 0)
              : movesListKind === 'internal'
                ? (relatedRequestKeys.internals ?? 0)
                : (relatedRequestKeys.receipts ?? 0)
          }
          onCreateRequest={() => {
            const kind = movesListKind ?? 'receipt';
            setMovesListKind(null);
            setActiveRelatedDoc(
              kind === 'receipt' ? 'receipts' : kind === 'issue' ? 'issues' : 'internals',
            );
            setMoveRequestKind(kind);
          }}
        />
      ) : null}

      {product?.id ? (
        <ProductStockMovesHistoryDialog
          open={movesHistoryOpen}
          onOpenChange={(next) => {
            setMovesHistoryOpen(next);
            if (!next && activeRelatedDoc === 'moves') setActiveRelatedDoc(null);
          }}
          productId={product.id}
          productNameAr={nameAr || product.nameAr}
          requestKey={relatedRequestKeys.moves ?? 0}
        />
      ) : null}

      {product?.id ? (
        <ProductPutawayRulesDialog
          open={putawayListOpen}
          onOpenChange={(next) => {
            setPutawayListOpen(next);
            if (!next && activeRelatedDoc === 'putaway') setActiveRelatedDoc(null);
          }}
          productId={product.id}
          productNameAr={nameAr || product.nameAr}
          requestKey={relatedRequestKeys.putaway ?? 0}
        />
      ) : null}
    </>
  );
}
