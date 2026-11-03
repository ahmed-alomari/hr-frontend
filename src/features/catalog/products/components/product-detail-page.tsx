'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowRight, Boxes, ImageIcon, Layers, Package, Plus, Ruler, Save, Settings, Star, Trash2, Warehouse } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { inventoryStockService } from '@/features/inventory/services/inventory-stock.service';
import { useBrands } from '@/features/catalog/brands/hooks/use-brands';
import { useCategories } from '@/features/catalog/categories/hooks/use-categories';
import { useProduct } from '@/features/catalog/products/hooks/use-products';
import { useProductMutations } from '@/features/catalog/products/hooks/use-product-mutations';
import {
  productFormSchema,
  PRODUCT_FORM_DEFAULT_VALUES,
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
import { ProductDetailHero } from '@/features/catalog/products/components/product-detail-hero';
import { ProductRelatedDocsSidebar } from '@/features/catalog/products/components/product-related-docs-sidebar';
import { ProductImageTab } from '@/features/catalog/products/components/product-image-tab';
import { ProductGeneralTab } from '@/features/catalog/products/components/product-general-tab';
import { ProductAttributesTab } from '@/features/catalog/products/components/product-attributes-tab';
import { ProductInventoryTab } from '@/features/catalog/products/components/product-inventory-tab';
import { ProductBatchesTab } from '@/features/catalog/products/components/product-batches-tab';
import { ProductReviewsTab } from '@/features/catalog/products/components/product-reviews-tab';
import { ProductUnitsTab } from '@/features/catalog/products/components/product-units-tab';
import { ProductSettingsTab } from '@/features/catalog/products/components/product-settings-tab';
import { ProductStockMoveRequestDialog } from '@/features/catalog/products/components/product-stock-move-request-dialog';
import { ProductStockMovesListDialog } from '@/features/catalog/products/components/product-stock-moves-list-dialog';
import { ProductStockMovesHistoryDialog } from '@/features/catalog/products/components/product-stock-moves-history-dialog';
import { ProductReplenishmentListDialog } from '@/features/catalog/products/components/product-replenishment-list-dialog';
import { ProductPutawayRulesDialog } from '@/features/catalog/products/components/product-putaway-rules-dialog';
import { ProductVariantsDialog } from '@/features/catalog/products/components/product-variants-dialog';
import { ProductFormDialog } from '@/features/catalog/products/components/product-form-dialog';
import { DeleteProductDialog } from '@/features/catalog/products/components/delete-product-dialog';
import type { ProductRelatedDocKey } from '@/features/catalog/products/components/product-related-docs-bar';
import { productMoveRequestListRestore } from '@/features/catalog/products/lib/product-move-request-flow';
import { useProductsBasePath } from '@/features/catalog/products/lib/products-navigation';
import {
  PRODUCT_INVENTORY_DOCS,
  productAppSectionsFrom,
  visibleRelatedDocs,
} from '@/features/catalog/products/hooks/use-product-app-sections';
import { APP, useCompanyApps, type AppRequirement } from '@/shared/modules/company-apps';
import type { WarehouseOperationKind } from '@/features/inventory/domain/types/warehouse';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Props = { productId: string };
type MoveRequestKind = WarehouseOperationKind;

type DetailTab =
  | 'general'
  | 'image'
  | 'attributes'
  | 'availability'
  | 'batches'
  | 'units'
  | 'reviews'
  | 'settings';

const DETAIL_TABS: ReadonlyArray<
  { value: DetailTab; label: string; icon: typeof Package } & AppRequirement
> = [
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
  { value: 'batches', label: 'الدفعات', icon: Boxes, requiresApp: APP.inventory },
  { value: 'units', label: 'وحدات', icon: Ruler },
  { value: 'reviews', label: 'تقييمات', icon: Star, requiresApp: APP.storeAdmin },
  { value: 'settings', label: 'الإعدادات', icon: Settings },
];

/** Maps top-level form fields to the tab that renders them, so a validation error can jump the user there. */
const TAB_FIELDS: Record<DetailTab, string[]> = {
  general: [
    'media',
    'sku',
    'categoryId',
    'posMenuCategoryId',
    'brandId',
    'status',
    'listPrice',
    'costPrice',
    'compareAtPrice',
    'productType',
    'tracking',
    'invoicePolicy',
    'barcode',
    'weightKg',
    'lengthCm',
    'widthCm',
    'heightCm',
    'shortDescription',
    'description',
    'tagsInput',
  ],
  image: ['imageDisplayFit', 'imageDisplayAspectRatio'],
  attributes: ['attributes', 'variants'],
  availability: ['stockStatus', 'stockQuantity', 'lowStockThreshold'],
  batches: [],
  units: ['uomLines'],
  reviews: [],
  settings: [
    'isNewProduct',
    'newUntil',
    'isTodayDeal',
    'dealPriceAmount',
    'dealDays',
    'dealUntil',
    'isWholesale',
    'wholesalePriceAmount',
    'wholesaleUntil',
    'isDiscounted',
    'discountPercent',
    'discountAmount',
    'inTodayDeals',
    'discountUntil',
    'saleOk',
    'purchaseOk',
    'posAvailable',
    'trackInventory',
    'allowBackorder',
  ],
};

function ensureSlug(values: ProductFormValues): ProductFormValues {
  if (values.slug?.trim()) return values;
  const fromSku = (values.sku ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return { ...values, slug: fromSku || `product-${Date.now()}` };
}

export function ProductDetailPage({ productId }: Props) {
  const companyId = getStorefrontCompanyId();
  const router = useRouter();
  const productsBasePath = useProductsBasePath();
  const { data: categoriesData } = useCategories({ companyId, limit: 100 });
  const { data: brandsData } = useBrands({ companyId, limit: 100 });
  const {
    data: product,
    isLoading: isLoadingProduct,
    isError: isProductError,
  } = useProduct(companyId, productId);
  const { update, remove } = useProductMutations();
  const apps = useCompanyApps();
  const sections = productAppSectionsFrom(apps);
  const visibleTabs = apps.filter(DETAIL_TABS);

  const [selectedTab, setActiveTab] = React.useState<DetailTab>('general');
  // A tab of an app that is (or becomes) disabled falls back quietly.
  const activeTab = visibleTabs.some((tab) => tab.value === selectedTab) ? selectedTab : 'general';
  const [activeRelatedDoc, setActiveRelatedDoc] = React.useState<ProductRelatedDocKey | null>(null);
  const [moveRequestKind, setMoveRequestKind] = React.useState<MoveRequestKind | null>(null);
  const [movesListKind, setMovesListKind] = React.useState<MoveRequestKind | null>(null);
  const [movesHistoryOpen, setMovesHistoryOpen] = React.useState(false);
  const [replenishmentListOpen, setReplenishmentListOpen] = React.useState(false);
  const [putawayListOpen, setPutawayListOpen] = React.useState(false);
  const [variantsDialogOpen, setVariantsDialogOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [relatedRequestKeys, setRelatedRequestKeys] = React.useState<
    Partial<Record<ProductRelatedDocKey, number>>
  >({});

  function bumpRelatedRequest(key: ProductRelatedDocKey) {
    setRelatedRequestKeys((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  }

  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: PRODUCT_FORM_DEFAULT_VALUES,
  });

  const variants = useWatch({ control: form.control, name: 'variants' }) ?? [];
  const variantsCount = variants.length;
  const nameAr = useWatch({ control: form.control, name: 'nameAr' }) ?? '';
  const sku = useWatch({ control: form.control, name: 'sku' }) ?? '';

  const hydratedProductIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    hydratedProductIdRef.current = null;
  }, [productId]);
  React.useEffect(() => {
    if (!product) return;
    // Re-hydrate when opening a different product; avoid clobbering in-progress edits on refetch.
    if (hydratedProductIdRef.current === product.id) return;
    form.reset(productToFormValues(product));
    hydratedProductIdRef.current = product.id;
  }, [product, form]);

  const onSubmit = async (values: ProductFormValues) => {
    if (!companyId || !product) return;
    let nextValues = ensureSlug(values);
    // Quantities are inventory's: without it the form keeps its own values.
    const onHand = sections.inventory
      ? await inventoryStockService.getOnHandByVariant(companyId, product.id)
      : null;
    if (onHand) nextValues = {
      ...nextValues,
      stockQuantity: onHand.total,
      variants: nextValues.variants.map((variant) => ({
        ...variant,
        quantity: onHand.byVariant[variant.id] ?? 0,
        stockStatus: (onHand.byVariant[variant.id] ?? 0) > 0 ? 'in_stock' : variant.stockStatus,
      })),
    };
    const input = formValuesToCreateInput(nextValues, companyId, { existing: product });
    await update.mutateAsync({ companyId, id: product.id, patch: input });
  };

  /**
   * react-hook-form's handleSubmit silently no-ops on validation failure unless an
   * invalid-handler is given — that made the save button look "broken" whenever a
   * cross-field rule (e.g. deal price required when "تخفيضات اليوم" is on) failed on a
   * tab the user wasn't currently viewing. Surface it and jump to the offending tab.
   */
  const onInvalid = (formErrors: typeof form.formState.errors) => {
    const first = findFirstFormError(formErrors);
    if (!first) return;

    if (first.path === 'nameAr' || first.path.startsWith('nameAr.')) {
      toast.error(first.message || 'يرجى إدخال اسم المنتج أولًا.');
      return;
    }

    const topField = topLevelFieldFromErrorPath(first.path);
    const offendingTab = visibleTabs.find((tab) => TAB_FIELDS[tab.value].includes(topField));
    if (offendingTab) {
      setActiveTab(offendingTab.value);
      toast.error(first.message || `تحقق من الحقول في تبويب «${offendingTab.label}» قبل الحفظ.`);
      return;
    }

    toast.error(first.message || 'تحقق من الحقول المطلوبة قبل الحفظ.');
  };

  const submitForm = () => void form.handleSubmit(onSubmit, onInvalid)();

  usePageHeaderActions(
    () =>
      product ? (
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link href={productsBasePath}>
              <ArrowRight className="h-4 w-4" />
              <span className="hidden sm:inline">المنتجات</span>
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">إضافة منتج</span>
          </Button>
          {/* A system item (e.g. «رسوم التوصيل») is never archived: the server refuses it. */}
          {product?.systemCode ? (
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              صنف نظام ثابت
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">حذف</span>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={form.formState.isSubmitting || update.isPending}
            onClick={submitForm}
          >
            <Save className="h-4 w-4" />
            {update.isPending ? 'جاري الحفظ…' : 'حفظ التغييرات'}
          </Button>
        </div>
      ) : null,
    [product, productsBasePath, form.formState.isSubmitting, update.isPending, submitForm],
  );

  const handleDeleteConfirm = async () => {
    if (!product) return;
    await remove.mutateAsync({ companyId, id: product.id });
    setDeleteOpen(false);
    router.push(productsBasePath);
  };

  function onRelatedDoc(key: ProductRelatedDocKey) {
    if (!product) return;
    bumpRelatedRequest(key);
    if (key === 'variants') {
      setActiveRelatedDoc('variants');
      setVariantsDialogOpen(true);
      return;
    }
    if (key === 'replenish') {
      setActiveRelatedDoc('replenish');
      setReplenishmentListOpen(true);
      return;
    }
    if (key === 'receipts') {
      setActiveRelatedDoc('receipts');
      setMovesListKind('receipt');
      return;
    }
    if (key === 'issues') {
      setActiveRelatedDoc('issues');
      setMovesListKind('issue');
      return;
    }
    if (key === 'internals') {
      setActiveRelatedDoc('internals');
      setMovesListKind('internal');
      return;
    }
    if (key === 'moves') {
      setActiveRelatedDoc('moves');
      setMovesHistoryOpen(true);
      return;
    }
    if (key !== 'putaway') return;
    setActiveRelatedDoc('putaway');
    setPutawayListOpen(true);
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

  if (isLoadingProduct) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-56 animate-pulse rounded-3xl bg-muted/60" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <div className="h-11 animate-pulse rounded-2xl bg-muted/50" />
            <div className="h-64 animate-pulse rounded-2xl bg-muted/40" />
          </div>
          <div className="h-64 animate-pulse rounded-2xl bg-muted/40 lg:col-span-4" />
        </div>
      </div>
    );
  }

  if (isProductError || !product) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
        <Package className="h-10 w-10 text-muted-foreground/50" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">تعذر تحميل المنتج</p>
          <p className="text-sm text-muted-foreground">تحقق من الرابط أو عد للقائمة وحاول مجددًا.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={productsBasePath}>العودة للقائمة</Link>
        </Button>
      </div>
    );
  }

  const relatedDocsChips = visibleRelatedDocs([
    {
      key: 'variants' as const,
      label: 'متغيرات المنتج',
      count: variantsCount,
      hint: variantsCount > 0 ? 'عرض وتحرير أسعار وكميات المتغيرات' : 'أضف خصائص تُنشئ متغيرات لظهورها هنا',
    },
    ...PRODUCT_INVENTORY_DOCS,
  ], apps);

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle titleAr={product.nameAr} iconName="Package" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitForm();
        }}
        className="flex flex-col gap-5"
      >
        <ProductDetailHero
          control={form.control}
          register={form.register}
          setValue={form.setValue}
          nameError={form.formState.errors.nameAr?.message}
          currency={product.price.currency}
          locked={Boolean(product.systemCode)}
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                setActiveTab(value as DetailTab);
                if (value !== 'attributes') setActiveRelatedDoc(null);
              }}
              className="w-full space-y-4"
            >
              {/* Phones: every tab visible in a grid (no hidden tabs to swipe to). */}
              <div className="sto-tabs-scroll z-10 -mx-1 rounded-2xl px-1 pb-1 sm:sticky sm:top-0">
                <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl border border-border/60 bg-muted/70 p-1.5 backdrop-blur sm:overflow-x-auto sm:flex sm:min-w-full sm:w-max sm:justify-start">
                  {visibleTabs.map(({ value, label, icon: Icon }) => {
                    const hasError = formHasErrorForFields(form.formState.errors, TAB_FIELDS[value]);
                    return (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="h-9 gap-1.5 rounded-xl px-3 text-xs sm:text-sm data-[state=active]:shadow-soft"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
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
              </div>

              <TabsContent value="general" className="mt-0 focus-visible:outline-none">
                <ProductGeneralTab
                  control={form.control}
                  errors={form.formState.errors}
                  register={form.register}
                  categories={categoriesData?.items}
                  brands={brandsData?.items}
                  costManaged={product?.costManaged === true}
                  locked={Boolean(product?.systemCode)}
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
                  productId={product.id}
                />
              </TabsContent>
              <TabsContent value="availability" className="mt-0 focus-visible:outline-none">
                <ProductInventoryTab
                  control={form.control}
                  errors={form.formState.errors}
                  register={form.register}
                  setValue={form.setValue}
                  productId={product.id}
                />
              </TabsContent>
              <TabsContent value="batches" className="mt-0 focus-visible:outline-none">
                <ProductBatchesTab productId={product.id} />
              </TabsContent>
              <TabsContent value="units" className="mt-0 focus-visible:outline-none">
                <ProductUnitsTab control={form.control} errors={form.formState.errors} setValue={form.setValue} />
              </TabsContent>
              <TabsContent value="reviews" className="mt-0 focus-visible:outline-none">
                <ProductReviewsTab companyId={companyId} productId={product.id} />
              </TabsContent>
              <TabsContent value="settings" className="mt-0 focus-visible:outline-none">
                <ProductSettingsTab
                  control={form.control}
                  errors={form.formState.errors}
                  register={form.register}
                  setValue={form.setValue}
                  locked={Boolean(product?.systemCode)}
                />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="lg:col-span-4">
            <div className="flex flex-col gap-4 lg:sticky lg:top-4">
              <ProductRelatedDocsSidebar
                chips={relatedDocsChips}
                activeKey={activeRelatedDoc}
                onSelect={onRelatedDoc}
              />
            </div>
          </aside>
        </div>

        {/* Submit button moved to the sticky top header (usePageHeaderActions) so it stays
            visible while scrolling a long product form; this stays only as a fallback
            for the Enter-to-submit / native form submission path. */}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          حفظ التغييرات
        </button>
        <p className="text-center text-[11px] text-muted-foreground">
          التغييرات في كل التبويبات تُحفظ معًا عند الضغط على «حفظ التغييرات» أعلى الصفحة.
        </p>
      </form>

      <ProductStockMoveRequestDialog
        open={moveRequestKind !== null}
        onOpenChange={(next) => {
          if (next) return;
          const kind = moveRequestKind;
          setMoveRequestKind(null);
          if (kind) restoreMoveRequestList(kind);
        }}
        kind={moveRequestKind ?? 'receipt'}
        productId={product.id}
        productNameAr={nameAr || product.nameAr}
        productSku={sku || product.sku}
        variants={variants}
        onCreated={(_warehouseId, kind) => {
          setMoveRequestKind(null);
          restoreMoveRequestList(kind, true);
        }}
      />

      <ProductVariantsDialog
        open={variantsDialogOpen}
        onOpenChange={(next) => {
          setVariantsDialogOpen(next);
          if (!next && activeRelatedDoc === 'variants') setActiveRelatedDoc(null);
        }}
        control={form.control}
        errors={form.formState.errors}
        register={form.register}
        setValue={form.setValue}
        getValues={form.getValues}
        productId={product.id}
        productNameAr={nameAr || product.nameAr}
        onSave={submitForm}
        isSaving={update.isPending}
      />

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
          setMoveRequestKind('replenishment');
        }}
      />

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

      <DeleteProductDialog
        product={deleteOpen ? product : null}
        isDeleting={remove.isPending}
        onConfirm={() => void handleDeleteConfirm()}
        onClose={() => setDeleteOpen(false)}
      />

      <ProductFormDialog open={createOpen} product={null} onOpenChange={setCreateOpen} />
    </div>
  );
}
