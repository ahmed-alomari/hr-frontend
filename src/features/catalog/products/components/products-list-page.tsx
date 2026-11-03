'use client';

import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FileSpreadsheet, Pencil, Plus, ScanBarcode, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { BarcodeScannerDialog } from '@/components/shared/barcode-scanner-dialog';
import { resolveScannedCode } from '@/features/catalog/products/lib/resolve-scanned-code';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { useProducts } from '@/features/catalog/products/hooks/use-products';
import { useProductMutations } from '@/features/catalog/products/hooks/use-product-mutations';
import { useCategories } from '@/features/catalog/categories/hooks/use-categories';
import { useBrands } from '@/features/catalog/brands/hooks/use-brands';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { ProductFormDialog } from '@/features/catalog/products/components/product-form-dialog';
import { DeleteProductDialog } from '@/features/catalog/products/components/delete-product-dialog';
import { type ProductFilters } from '@/features/catalog/products/components/product-filters-bar';
import {
  categoryFilterLabel,
  sortCategoriesAsTree,
} from '@/features/catalog/categories/lib/category-tree';
import { formatPrice } from '@/features/ecommerce/shared/utils/format-price';
import { PRODUCT_STATUS_LABELS_AR, PRODUCT_STATUS_OPTIONS } from '@/features/ecommerce/domain/constants/product-status';
import { STOCK_STATUS_LABELS_AR, STOCK_STATUS_OPTIONS } from '@/features/ecommerce/domain/constants/stock-status';
import {
  productDetailHref,
  useProductsBasePath,
} from '@/features/catalog/products/lib/products-navigation';
import type { Product, ProductListQuery } from '@/features/ecommerce/domain/types/product';
import type { ProductStatus } from '@/features/ecommerce/domain/constants/product-status';
import type { StockStatus } from '@/features/ecommerce/domain/constants/stock-status';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { resolveUploadUrl } from '@/shared/resolve-upload-url';
import { productAppSectionsFrom } from '@/features/catalog/products/hooks/use-product-app-sections';
import { APP, useCompanyApps, type AppRequirement } from '@/shared/modules/company-apps';
import { ecommerceAdminRoutes } from '@/features/ecommerce/admin/constants/routes';
import { useCan } from '@/features/auth/hooks/use-can';
import {
  PRODUCTS_COLUMN_OPTIONS,
  PRODUCTS_GROUP_OPTIONS,
  PRODUCTS_SORT_OPTIONS,
  productsExportColumns,
} from '@/features/catalog/products/lib/products-list-options';
import { fetchProductGroups, productsApi } from '@/features/catalog/products/lib/api/products';
import { GroupedDataTable } from '@/components/ui/grouped-data-table';
import { ListColumnsPicker, useColumnVisibility } from '@/components/ui/list-columns-picker';
import { ListGroupMenu, listGroupQuery, useGroupedList, useListGroup } from '@/components/ui/list-group';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import { ListSortMenu, useListSort } from '@/components/ui/list-sort';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import { registerExportRows, visibleExportColumns } from '@/components/pdf/lib/register-export-rows';
import { fetchAllPaginatedItems } from '@/shared/api/client';
import {
  hrFiltersKey,
  readPersistedJson,
  writePersistedJson,
} from '@/features/hr/lib/use-persisted-filter-state';
import { usePersistedStateRestore } from '@/shared/hooks/use-persisted-state-restore';

/** The filters kept in the URL and saved per user and company (the sort has its own menu). */
const SAVED_FILTER_KEYS = [
  'q',
  'categoryId',
  'brandId',
  'status',
  'stockStatus',
  'isNewProduct',
  'isTodayDeal',
  'isWholesale',
  'isDiscounted',
  'warehouseId',
  'posAvailable',
] as const;
type SavedFilters = Partial<Record<(typeof SAVED_FILTER_KEYS)[number], string>>;

const FILTER_KEYS = [
  'categoryId',
  'brandId',
  'status',
  'stockStatus',
  'sort',
  'sortDirection',
  'isNewProduct',
  'isTodayDeal',
  'isWholesale',
  'isDiscounted',
  'warehouseId',
  'posAvailable',
] as const;

const STATUS_BADGE_VARIANT: Record<ProductStatus, 'success' | 'subtle' | 'outline'> = {
  active: 'success',
  draft: 'subtle',
  archived: 'outline',
};

const STOCK_BADGE_VARIANT: Record<StockStatus, 'success' | 'destructive' | 'warning' | 'outline'> = {
  in_stock: 'success',
  out_of_stock: 'destructive',
  preorder: 'warning',
  discontinued: 'outline',
};

export function ProductsListPage() {
  const companyId = getStorefrontCompanyId();
  const router = useRouter();
  const pathname = usePathname();
  const productsBasePath = useProductsBasePath();
  const searchParams = useSearchParams();

  const search = searchParams.get('q') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE;
  const filters: ProductFilters = {
    categoryId: searchParams.get('categoryId') ?? undefined,
    brandId: searchParams.get('brandId') ?? undefined,
    status: (searchParams.get('status') as ProductFilters['status']) ?? undefined,
    stockStatus: (searchParams.get('stockStatus') as ProductFilters['stockStatus']) ?? undefined,
    sort: (searchParams.get('sort') as ProductFilters['sort']) ?? undefined,
    sortDirection: (searchParams.get('sortDirection') as ProductFilters['sortDirection']) ?? undefined,
    isNewProduct: searchParams.get('isNewProduct') === 'true' ? true : undefined,
    isTodayDeal: searchParams.get('isTodayDeal') === 'true' ? true : undefined,
    isWholesale: searchParams.get('isWholesale') === 'true' ? true : undefined,
    isDiscounted: searchParams.get('isDiscounted') === 'true' ? true : undefined,
    warehouseId: searchParams.get('warehouseId') ?? undefined,
    posAvailable: searchParams.get('posAvailable') === 'true' ? true : undefined,
  };

  const [searchInput, setSearchInput] = React.useState(search);

  function updateParams(next: { q?: string; page?: number; pageSize?: number } & Partial<ProductFilters>) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q);
      else params.delete('q');
    }
    if (next.page !== undefined) {
      if (next.page > 1) params.set('page', String(next.page));
      else params.delete('page');
    }
    if (next.pageSize !== undefined) {
      if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(next.pageSize));
      else params.delete('pageSize');
    }
    for (const key of FILTER_KEYS) {
      if (key in next) {
        const value = next[key];
        if (value === true) params.set(key, 'true');
        else if (typeof value === 'string' && value) params.set(key, value);
        else params.delete(key);
      }
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const searchRef = React.useRef(search);
  const updateParamsRef = React.useRef(updateParams);
  searchRef.current = search;
  updateParamsRef.current = updateParams;

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput.trim() !== searchRef.current) {
        updateParamsRef.current({ q: searchInput.trim(), page: 1 });
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  // Stock columns/filters are inventory's; stockStatus and the promo offers
  // («منتج حديث», «تخفيضات اليوم», …) are the store's.
  const apps = useCompanyApps();
  const sections = productAppSectionsFrom(apps);

  // Sort, grouping and columns: kept per user and company (list-screens
  // skill). The state keeps every option; the menus show the enabled apps'.
  const stateKeys = listStateKeys('catalog', 'products', companyId);
  const sortModel = useListSort(stateKeys.sort, PRODUCTS_SORT_OPTIONS);
  const sortMenuModel = { ...sortModel, options: apps.filter(PRODUCTS_SORT_OPTIONS) };
  const group = useListGroup(stateKeys.group, PRODUCTS_GROUP_OPTIONS);
  const groupBy = group.groupBy;
  const columnVisibility = useColumnVisibility(
    hrFiltersKey('catalog', 'products', companyId, 'hiddenColumns'),
    apps.filter(PRODUCTS_COLUMN_OPTIONS),
  );
  // «الكمية» is inventory's: without it the list keeps its default order.
  const activeSort =
    sortModel.sort && (sortModel.sort.key !== 'stock' || sections.inventory) ? sortModel.sort : null;
  const sortQuery: Pick<ProductListQuery, 'sort' | 'sortDirection'> = activeSort
    ? { sort: activeSort.key as ProductListQuery['sort'], sortDirection: activeSort.dir }
    : {};

  // The URL's filters are saved for this user and company: opening the
  // screen without any brings the last ones back, and a saved view restores
  // them (it writes the saved copy, then asks every list to re-read).
  const filtersKey = hrFiltersKey('catalog', 'products', companyId, 'filters');
  const currentFiltersJson = JSON.stringify(
    Object.fromEntries(SAVED_FILTER_KEYS.map((key) => [key, searchParams.get(key) ?? ''])),
  );
  const applySavedFilters = (saved: SavedFilters | null) => {
    setSearchInput(saved?.q ?? '');
    updateParams({
      q: saved?.q ?? '',
      page: 1,
      categoryId: saved?.categoryId || undefined,
      brandId: saved?.brandId || undefined,
      status: (saved?.status || undefined) as ProductFilters['status'],
      stockStatus: (saved?.stockStatus || undefined) as ProductFilters['stockStatus'],
      isNewProduct: saved?.isNewProduct === 'true' ? true : undefined,
      isTodayDeal: saved?.isTodayDeal === 'true' ? true : undefined,
      isWholesale: saved?.isWholesale === 'true' ? true : undefined,
      isDiscounted: saved?.isDiscounted === 'true' ? true : undefined,
      warehouseId: saved?.warehouseId || undefined,
      posAvailable: saved?.posAvailable === 'true' ? true : undefined,
    });
  };
  const applySavedFiltersRef = React.useRef(applySavedFilters);
  applySavedFiltersRef.current = applySavedFilters;
  const filtersRestored = React.useRef(false);
  React.useEffect(() => {
    if (!filtersKey) return;
    const current = JSON.parse(currentFiltersJson) as SavedFilters;
    if (!filtersRestored.current) {
      filtersRestored.current = true;
      const saved = readPersistedJson<SavedFilters>(filtersKey);
      if (!Object.values(current).some(Boolean) && saved && Object.values(saved).some(Boolean)) {
        applySavedFiltersRef.current(saved);
        return;
      }
    }
    writePersistedJson(filtersKey, current);
  }, [filtersKey, currentFiltersJson]);
  usePersistedStateRestore(() => {
    if (filtersKey) applySavedFiltersRef.current(readPersistedJson<SavedFilters>(filtersKey));
  });

  const query: ProductListQuery = {
    companyId,
    search: search || undefined,
    page,
    limit: pageSize,
    ...filters,
    // A link to a hidden store filter falls back to the full list.
    ...(sections.store
      ? {}
      : {
          stockStatus: undefined,
          isNewProduct: undefined,
          isTodayDeal: undefined,
          isWholesale: undefined,
          isDiscounted: undefined,
        }),
    // Same for the inventory and point-of-sale filters.
    ...(sections.inventory ? {} : { warehouseId: undefined }),
    ...(sections.pos ? {} : { posAvailable: undefined }),
    // The order is the «ترتيب» menu's (an old `?sort=` link is ignored).
    sort: undefined,
    sortDirection: undefined,
    ...sortQuery,
  };
  const { data, isLoading, isError } = useProducts(query, { enabled: !groupBy });

  // Grouped: the groups (counts) and the products of the open ones.
  const { page: _page, limit: _limit, ...listFilters } = query;
  const grouped = useGroupedList<Product>({
    enabled: Boolean(companyId) && Boolean(groupBy),
    groupBy,
    resetKey: JSON.stringify(listFilters),
    fetchGroups: () => fetchProductGroups({ ...listFilters, ...listGroupQuery(groupBy) }),
    fetchGroupRows: (groupValue, p, l) =>
      productsApi.getAll({ ...listFilters, ...listGroupQuery(groupBy), groupValue, page: p, limit: l }),
  });
  const { data: categoriesData } = useCategories({ companyId, limit: 100 });
  const { data: brandsData } = useBrands({ companyId, limit: 100 });
  const { data: warehousesData } = useWarehouses(
    { companyId, limit: 200 },
    { enabled: sections.inventory },
  );
  const { remove } = useProductMutations();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [productToDelete, setProductToDelete] = React.useState<Product | null>(null);

  const openCreateDialog = () => setCreateOpen(true);
  const goToProductDetail = (product: Product) =>
    router.push(productDetailHref(productsBasePath, product.id));

  const handleDeleteConfirm = async (product: Product) => {
    await remove.mutateAsync({ companyId, id: product.id });
    setProductToDelete(null);
  };

  const categoryByIdMap = React.useMemo(
    () => new Map((categoriesData?.items ?? []).map((category) => [category.id, category])),
    [categoriesData],
  );
  const categoryOptions = React.useMemo(() => {
    const ordered = sortCategoriesAsTree(categoriesData?.items ?? []);
    return ordered.map((category) => ({
      value: category.id,
      label: categoryFilterLabel(category, categoryByIdMap),
    }));
  }, [categoriesData, categoryByIdMap]);

  const [scanOpen, setScanOpen] = React.useState(false);
  const can = useCan();
  // The import is the store's (store admin); the other apps' product lists do not offer it.
  const canImport =
    productsBasePath === ecommerceAdminRoutes.products &&
    can('catalog.products.create') &&
    can('catalog.products.update');

  /** Scan a product's barcode / SKU and open it (its stock per location is there). */
  async function openScannedProduct(code: string) {
    try {
      const item = await resolveScannedCode(companyId, code);
      if (!item) {
        toast.error(`لا يوجد منتج بالرمز ${code}`);
        return;
      }
      router.push(productDetailHref(productsBasePath, item.productId));
    } catch {
      // The API client already showed why.
    }
  }

  const brandNameById = new Map((brandsData?.items ?? []).map((brand) => [brand.id, brand.nameAr]));
  const exportColumns = visibleExportColumns(
    apps.filter(
      productsExportColumns({
        category: (id) => (id ? (categoryByIdMap.get(id)?.nameAr ?? '') : ''),
        brand: (id) => (id ? (brandNameById.get(id) ?? '') : ''),
      }),
    ),
    columnVisibility.isVisible,
  );
  const filterSummary = [
    search ? `بحث: ${search}` : null,
    filters.categoryId ? `التصنيف: ${categoryByIdMap.get(filters.categoryId)?.nameAr ?? ''}` : null,
    filters.brandId ? `العلامة: ${brandNameById.get(filters.brandId) ?? ''}` : null,
    filters.status ? `الحالة: ${PRODUCT_STATUS_LABELS_AR[filters.status]}` : null,
    sections.store && filters.stockStatus ? `التوفر: ${STOCK_STATUS_LABELS_AR[filters.stockStatus]}` : null,
    sortModel.label,
    group.label,
  ].filter((line): line is string => Boolean(line));
  const activeFilterCount = SAVED_FILTER_KEYS.filter((key) => key !== 'q' && searchParams.get(key)).length;

  /** Every filtered product (all pages) in the screen's order, grouped like the screen. */
  const getExportRows = async () => {
    const { page: _p, limit: _l, ...exportQuery } = { ...query, ...listGroupQuery(groupBy) };
    const [{ items: all }, summary] = await Promise.all([
      fetchAllPaginatedItems((p, l) => productsApi.getAll({ ...exportQuery, page: p, limit: l })),
      groupBy ? fetchProductGroups(exportQuery) : Promise.resolve(null),
    ]);
    return registerExportRows({
      columns: exportColumns,
      rows: all,
      grouping:
        groupBy && group.option && summary
          ? {
              fieldLabel: group.option.label,
              groups: group.sortGroups(summary.groups),
              labelOf: group.labelOf,
              groupKeyOf: (product) => product.groupKey,
            }
          : undefined,
    });
  };

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          disabled={!companyId}
          aria-label="مسح باركود منتج"
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground sm:px-3"
        >
          <ScanBarcode className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">مسح</span>
        </button>
        {canImport ? (
          <Link
            href={ecommerceAdminRoutes.productsImport}
            aria-label="استيراد المنتجات"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground sm:px-3"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">استيراد</span>
          </Link>
        ) : null}
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <ListColumnsPicker model={columnVisibility} />
        <ListSortMenu model={sortMenuModel} />
        <ListGroupMenu model={group} />
        <ListSavedViews storageKey={stateKeys.views} prefixes={stateKeys.prefixes} />
        <PageHeaderPrimaryButton icon={Plus} label="إضافة منتج" disabled={!companyId} onClick={openCreateDialog} />
        <RegisterExportMenu
          title="سجل المنتجات"
          fileName="products"
          columns={exportColumns}
          getRows={getExportRows}
          subtitleLines={filterSummary}
          landscape
          pinnedColumnCount={2}
          emptyMessage="لا توجد منتجات للتصدير ضمن الفلاتر الحالية."
        />
      </div>
    ),
    [
      companyId,
      canImport,
      activeFilterCount,
      sortModel.sortKey,
      sortMenuModel.options.length,
      group.groupKey,
      group.label,
      columnVisibility.hiddenKey,
      currentFiltersJson,
      exportColumns.length,
      stateKeys.views,
    ],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        leadingFilters={
          <EntityFilterSearchField
            value={searchInput}
            onChange={setSearchInput}
            placeholder="ابحث بالاسم أو رمز المنتج…"
          />
        }
        inlineSelects={[
          {
            id: 'categoryId',
            value: filters.categoryId ?? 'all',
            onChange: (value) => updateParams({ categoryId: value === 'all' ? undefined : value, page: 1 }),
            placeholder: 'كل التصنيفات',
            options: [{ value: 'all', label: 'كل التصنيفات' }, ...categoryOptions],
          },
          {
            id: 'brandId',
            value: filters.brandId ?? 'all',
            onChange: (value) => updateParams({ brandId: value === 'all' ? undefined : value, page: 1 }),
            placeholder: 'كل العلامات التجارية',
            options: [
              { value: 'all', label: 'كل العلامات التجارية' },
              ...(brandsData?.items ?? []).map((brand) => ({ value: brand.id, label: brand.nameAr })),
            ],
          },
          {
            id: 'status',
            value: filters.status ?? 'all',
            onChange: (value) =>
              updateParams({ status: value === 'all' ? undefined : (value as ProductFilters['status']), page: 1 }),
            placeholder: 'كل الحالات',
            options: [
              { value: 'all', label: 'كل الحالات' },
              ...PRODUCT_STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.labelAr })),
            ],
          },
          ...(sections.store ? [{
            id: 'stockStatus',
            value: filters.stockStatus ?? 'all',
            onChange: (value: string) =>
              updateParams({ stockStatus: value === 'all' ? undefined : (value as ProductFilters['stockStatus']), page: 1 }),
            placeholder: 'كل حالات التوفر',
            options: [
              { value: 'all', label: 'كل حالات التوفر' },
              ...STOCK_STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.labelAr })),
            ],
          }] : []),
        ]}
        moreFilters={[
          ...(sections.inventory ? [{
            id: 'warehouseId',
            value: filters.warehouseId ?? 'all',
            onChange: (value: string) =>
              updateParams({ warehouseId: value === 'all' ? undefined : value, page: 1 }),
            placeholder: 'كل المستودعات',
            options: [
              { value: 'all', label: 'كل المستودعات' },
              ...(warehousesData?.items ?? []).map((warehouse) => ({
                value: warehouse.id,
                label: warehouse.nameAr,
              })),
            ],
          }] : []),
          ...(sections.pos ? [{
            id: 'posAvailable',
            value: filters.posAvailable ? 'true' : 'all',
            onChange: (value: string) =>
              updateParams({ posAvailable: value === 'true' ? true : undefined, page: 1 }),
            placeholder: 'كل قنوات البيع',
            options: [
              { value: 'all', label: 'كل قنوات البيع' },
              { value: 'true', label: 'متاح لنقطة البيع' },
            ],
          }] : []),
          ...(sections.store ? [{
            id: 'offer',
            value:
              filters.isNewProduct
                ? 'isNewProduct'
                : filters.isTodayDeal
                  ? 'isTodayDeal'
                  : filters.isWholesale
                    ? 'isWholesale'
                    : filters.isDiscounted
                      ? 'isDiscounted'
                      : 'all',
            onChange: (value: string) =>
              updateParams({
                isNewProduct: value === 'isNewProduct' ? true : undefined,
                isTodayDeal: value === 'isTodayDeal' ? true : undefined,
                isWholesale: value === 'isWholesale' ? true : undefined,
                isDiscounted: value === 'isDiscounted' ? true : undefined,
                page: 1,
              }),
            placeholder: 'كل العروض',
            options: [
              { value: 'all', label: 'كل العروض' },
              { value: 'isNewProduct', label: 'منتج حديث' },
              { value: 'isTodayDeal', label: 'تخفيضات اليوم' },
              { value: 'isWholesale', label: 'أسعار جملة' },
              { value: 'isDiscounted', label: 'خصومات' },
            ],
          }] : []),
        ]}
      />
    ),
    [searchInput, filters, categoryOptions, brandsData, warehousesData, sections.inventory, sections.store],
  );

  const allColumns: ColumnDef<Product>[] = [
    {
      key: 'product',
      title: 'المنتج',
      sortKey: 'name',
      render: (product) => {
        const primaryImage = product.media.find((m) => m.isPrimary) ?? product.media[0];
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              {primaryImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveUploadUrl(primaryImage.url)} alt={primaryImage.alt} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground">{product.nameAr}</span>
              <span className="text-xs text-muted-foreground">SKU: {product.sku}</span>
              {sections.store ? <div className="flex flex-wrap gap-1">
                {product.isNewProductActive ? (
                  <Badge variant="subtle">حديث</Badge>
                ) : null}
                {product.isTodayDealActive ? (
                  <Badge variant="warning">تخفيض اليوم</Badge>
                ) : null}
                {product.isWholesaleActive ? (
                  <Badge variant="outline">جملة</Badge>
                ) : null}
                {product.isDiscountActive ? (
                  <Badge variant="destructive">
                    خصم{product.discountPercent != null ? ` ${product.discountPercent}%` : ''}
                  </Badge>
                ) : null}
              </div> : null}
            </div>
          </div>
        );
      },
    },
    {
      key: 'price',
      title: 'السعر',
      sortKey: 'price',
      render: (product) => (
        <div className="flex flex-col gap-0.5">
          {sections.store && product.isTodayDealActive && product.dealPrice ? (
            <>
              <span className="font-medium tabular-nums text-primary">
                {formatPrice(product.dealPrice)}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums line-through">
                {formatPrice(product.price)}
              </span>
            </>
          ) : (
            <span className="font-medium tabular-nums">{formatPrice(product.price)}</span>
          )}
          {sections.store && product.isWholesaleActive && product.wholesalePrice ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              جملة: {formatPrice(product.wholesalePrice)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'costPrice',
      title: 'تكلفة الكاتالوج',
      hideOnMobile: true,
      render: (product) =>
        product.costPrice ? (
          <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatPrice(product.costPrice)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">غير محددة</span>
        ),
    },
    {
      key: 'quantity',
      title: 'الكمية',
      sortKey: 'stock',
      hideOnMobile: true,
      render: (product) => <span className="tabular-nums">{product.inventory.quantity}</span>,
    },
    {
      key: 'stockStatus',
      title: 'التوفر',
      render: (product) => (
        <Badge variant={STOCK_BADGE_VARIANT[product.stockStatus]}>{STOCK_STATUS_LABELS_AR[product.stockStatus]}</Badge>
      ),
    },
    {
      key: 'status',
      title: 'الحالة',
      render: (product) => <Badge variant={STATUS_BADGE_VARIANT[product.status]}>{PRODUCT_STATUS_LABELS_AR[product.status]}</Badge>,
    },
    {
      key: 'actions',
      title: '',
      isActions: true,
      render: (product) => (
        <>
          <Button variant="ghost" size="icon" aria-label="تعديل المنتج" onClick={() => goToProductDetail(product)}>
            <Pencil className="h-4 w-4" />
          </Button>
          {product.systemCode ? null : (
            <Button variant="ghost" size="icon" aria-label="حذف المنتج" onClick={() => setProductToDelete(product)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </>
      ),
    },
  ];

  const columns = allColumns.filter(
    (column) =>
      (sections.inventory || column.key !== 'quantity') &&
      (sections.store || column.key !== 'stockStatus') &&
      columnVisibility.isVisible(column.key),
  );

  function renderMobileCard(product: Product) {
    const primaryImage = product.media.find((m) => m.isPrimary) ?? product.media[0];
    // Promo badges are the store's: none while it is not enabled.
    const offerBadges = (sections.store ? [
      product.isNewProductActive ? { key: 'new', variant: 'subtle' as const, label: 'حديث' } : null,
      product.isTodayDealActive ? { key: 'deal', variant: 'warning' as const, label: 'تخفيض اليوم' } : null,
      product.isWholesaleActive ? { key: 'wholesale', variant: 'outline' as const, label: 'جملة' } : null,
      product.isDiscountActive
        ? {
            key: 'discount',
            variant: 'destructive' as const,
            label: `خصم${product.discountPercent != null ? ` ${product.discountPercent}%` : ''}`,
          }
        : null,
    ] : []).filter(Boolean) as Array<{ key: string; variant: BadgeProps['variant']; label: string }>;

    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {primaryImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveUploadUrl(primaryImage.url)} alt={primaryImage.alt} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{product.nameAr}</p>
            <p className="text-xs text-muted-foreground" dir="ltr">
              SKU: {product.sku}
            </p>
          </div>
        </div>

        {offerBadges.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {offerBadges.map((badge) => (
              <Badge key={badge.key} variant={badge.variant}>
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-3 items-center gap-3 rounded-lg bg-muted/40 px-2.5 py-1.5">
          <div>
            <p className="text-[11px] text-muted-foreground">السعر</p>
            <p className="font-medium tabular-nums text-foreground">{formatPrice(product.price)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">تكلفة الكاتالوج</p>
            <p className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
              {product.costPrice ? formatPrice(product.costPrice) : '—'}
            </p>
          </div>
          {sections.inventory ? (
            <div className="text-end">
              <p className="text-[11px] text-muted-foreground">الكمية</p>
              <p className="font-medium tabular-nums text-foreground">{product.inventory.quantity}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {sections.store ? (
            <Badge variant={STOCK_BADGE_VARIANT[product.stockStatus]}>
              {STOCK_STATUS_LABELS_AR[product.stockStatus]}
            </Badge>
          ) : null}
          <Badge variant={STATUS_BADGE_VARIANT[product.status]}>{PRODUCT_STATUS_LABELS_AR[product.status]}</Badge>
        </div>

        <div
          className="flex items-center justify-end gap-1 border-t border-border/60 pt-2"
          onClick={(event) => event.stopPropagation()}
        >
          <Button variant="ghost" size="icon" aria-label="تعديل المنتج" onClick={() => goToProductDetail(product)}>
            <Pencil className="h-4 w-4" />
          </Button>
          {product.systemCode ? null : (
            <Button variant="ghost" size="icon" aria-label="حذف المنتج" onClick={() => setProductToDelete(product)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BarcodeScannerDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        title="البحث عن منتج بالمسح"
        onCode={(code) => void openScannedProduct(code)}
      />
      <SetPageTitle
        titleAr="المنتجات"
        descriptionAr="كتالوج منتجات المتجر — الأسعار والمخزون وحالة كل منتج."
        iconName="Package"
      />

      {isError ? <p className="text-sm text-destructive">تعذر تحميل المنتجات.</p> : null}

      {groupBy ? (
        <GroupedDataTable
          columns={columns}
          group={group}
          list={grouped}
          keyExtractor={(product) => product.id}
          onRowClick={goToProductDetail}
          sort={activeSort}
          onSort={sortModel.toggle}
          emptyText="لا توجد منتجات مطابقة — جرّب تعديل الفلاتر"
        />
      ) : (
      <DirectoryPagedViews
        items={data?.items ?? []}
        loading={isLoading}
        serverPagination={
          data
            ? {
                page,
                pageSize,
                total: data.pagination.total,
                totalPages: Math.max(1, Math.ceil(data.pagination.total / pageSize)),
                setPage: (nextPage) => updateParams({ page: nextPage }),
                setPageSize: (size) => updateParams({ pageSize: size, page: 1 }),
              }
            : undefined
        }
      >
        {(pageItems) => (
          <DataTable
            variant="directory"
            className="sto-table-host"
            columns={columns}
            data={pageItems}
            keyExtractor={(product) => product.id}
            loading={isLoading}
            emptyText="لا توجد منتجات بعد."
            onRowClick={goToProductDetail}
            mobileCard={renderMobileCard}
            sort={activeSort}
            onSort={sortModel.toggle}
          />
        )}
      </DirectoryPagedViews>
      )}

      <ProductFormDialog open={createOpen} product={null} onOpenChange={setCreateOpen} />
      <DeleteProductDialog
        product={productToDelete}
        isDeleting={remove.isPending}
        onConfirm={(product) => void handleDeleteConfirm(product)}
        onClose={() => setProductToDelete(null)}
      />
    </div>
  );
}
