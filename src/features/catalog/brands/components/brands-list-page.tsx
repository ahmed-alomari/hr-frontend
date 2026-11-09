'use client';

import { useListTools } from '@/components/ui/list-tools';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Pencil, Plus, Trash2, Tag } from 'lucide-react';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { useBrands } from '@/features/catalog/brands/hooks/use-brands';
import { useBrandMutations } from '@/features/catalog/brands/hooks/use-brand-mutations';
import { BrandFormDialog } from '@/features/catalog/brands/components/brand-form-dialog';
import { DeleteBrandDialog } from '@/features/catalog/brands/components/delete-brand-dialog';
import type { Brand } from '@/features/ecommerce/domain/types/brand';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { isMultiLangEnabled } from '@/i18n/locale-flags';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import { ListSortMenu, listSortQuery, useListSort, type ListSortOption } from '@/components/ui/list-sort';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import type { RegisterExportColumn } from '@/components/pdf/lib/register-export-rows';
import { fetchAllPaginatedItems } from '@/shared/api/client';
import { brandsApi } from '@/features/catalog/brands/lib/api/brands';

/** Server keys (list-screens skill); default: the display order. */
const BRANDS_SORT_OPTIONS: readonly ListSortOption[] = [
  { key: 'name', label: 'الاسم' },
  { key: 'displayOrder', label: 'ترتيب العرض' },
  { key: 'createdAt', label: 'تاريخ الإضافة' },
];

const BRANDS_EXPORT_COLUMNS: RegisterExportColumn<Brand>[] = [
  { label: 'العلامة التجارية', kind: 'name', value: (b) => b.nameAr },
  { label: 'الوصف', kind: 'text', value: (b) => b.description ?? '' },
  { label: 'الحالة', kind: 'status', value: (b) => (b.isActive ? 'مفعّل' : 'معطّل') },
];

export function BrandsListPage() {
  const companyId = getStorefrontCompanyId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get('q') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE;

  const [searchInput, setSearchInput] = React.useState(search);

  function updateParams(next: { q?: string; page?: number; pageSize?: number }) {
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

  // Sort kept per user and company; saved views keep it with the search-free list.
  const stateKeys = listStateKeys('catalog', 'brands', companyId);
  const sort = useListSort(stateKeys.sort, BRANDS_SORT_OPTIONS);
  const sortQuery = listSortQuery(sort.sort);
  const { data, isLoading, isError } = useBrands({
    companyId,
    search: search || undefined,
    page,
    limit: pageSize,
    ...sortQuery,
  });

  /** Every filtered brand (all pages) in the screen's order. */
  const getExportRows = async () => {
    const { items } = await fetchAllPaginatedItems((p, l) =>
      brandsApi.getAll({ companyId, search: search || undefined, ...sortQuery, page: p, limit: l }),
    );
    return items.map((brand) => BRANDS_EXPORT_COLUMNS.map((column) => column.value(brand)));
  };
  const filterSummary = [search ? `بحث: ${search}` : null, sort.label].filter(
    (line): line is string => Boolean(line),
  );
  const { remove } = useBrandMutations();

  const [formState, setFormState] = React.useState<{ open: boolean; brand: Brand | null }>({
    open: false,
    brand: null,
  });
  const [brandToDelete, setBrandToDelete] = React.useState<Brand | null>(null);

  const openCreateDialog = () => setFormState({ open: true, brand: null });
  const openEditDialog = (brand: Brand) => setFormState({ open: true, brand });

  const handleDeleteConfirm = async (brand: Brand) => {
    await remove.mutateAsync({ companyId, id: brand.id });
    setBrandToDelete(null);
  };


  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        leadingFilters={
          <EntityFilterSearchField value={searchInput} onChange={setSearchInput} placeholder="ابحث بالاسم…" />
        }
      />
    ),
    [searchInput],
  );

  const columns: ColumnDef<Brand>[] = [
    {
      key: 'brand',
      title: 'العلامة التجارية',
      sortKey: 'name',
      render: (brand) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {brand.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo.url} alt={brand.logo.alt} className="h-full w-full object-cover" />
            ) : (
              <Tag className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{brand.nameAr}</span>
            {isMultiLangEnabled && brand.nameEn ? (
              <span className="text-xs text-muted-foreground">{brand.nameEn}</span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      title: 'الوصف',
      hideOnMobile: true,
      render: (brand) => <span className="text-sm text-muted-foreground">{brand.description ?? '—'}</span>,
    },
    {
      key: 'status',
      title: 'الحالة',
      render: (brand) => <Badge variant={brand.isActive ? 'success' : 'subtle'}>{brand.isActive ? 'مفعّل' : 'معطّل'}</Badge>,
    },
    {
      key: 'actions',
      title: '',
      isActions: true,
      render: (brand) => (
        <>
          <Button variant="ghost" size="icon" aria-label="تعديل العلامة التجارية" onClick={() => openEditDialog(brand)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="حذف العلامة التجارية" onClick={() => setBrandToDelete(brand)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </>
      ),
    },
  ];

  const tools = useListTools<Brand>({ section: 'catalog', page: 'brands', columns: columns, rows: [], fields: {}, savedViews: false });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton />
        {tools.buttons}
        <ListSortMenu model={sort} />
        <ListSavedViews storageKey={stateKeys.views} prefixes={stateKeys.prefixes} />
        <PageHeaderPrimaryButton
          icon={Plus}
          label="إضافة علامة تجارية"
          disabled={!companyId}
          onClick={openCreateDialog}
        />
        <RegisterExportMenu
          title="سجل العلامات التجارية"
          fileName="brands"
          columns={BRANDS_EXPORT_COLUMNS}
          getRows={getExportRows}
          subtitleLines={filterSummary}
          emptyMessage="لا توجد علامات تجارية للتصدير."
        />
      </div>
    ),
    [companyId, sort.sortKey, sort.label, search, stateKeys.views, tools.depsKey],
  );

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr="العلامات التجارية"
        descriptionAr="العلامات التجارية المرتبطة بمنتجات المتجر."
        iconName="Tag"
      />

      {isError ? <p className="text-sm text-destructive">تعذر تحميل العلامات التجارية.</p> : null}

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
        {(rowsPage) => (
          <DataTable
            variant="directory"
            className="sto-table-host"
            columns={tools.columns}
            data={rowsPage}
            keyExtractor={(brand) => brand.id}
            loading={isLoading}
            emptyText="لا توجد علامات تجارية بعد."
            sort={sort.sort}
            onSort={sort.toggle}
            mobileCard={(brand) => (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {brand.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={brand.logo.url} alt={brand.logo.alt} className="h-full w-full object-cover" />
                    ) : (
                      <Tag className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{brand.nameAr}</p>
                    {brand.description ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{brand.description}</p>
                    ) : null}
                  </div>
                  <Badge variant={brand.isActive ? 'success' : 'subtle'} className="shrink-0">
                    {brand.isActive ? 'مفعّل' : 'معطّل'}
                  </Badge>
                </div>
                <div
                  className="flex items-center justify-end gap-1 border-t border-border/60 pt-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button variant="ghost" size="icon" aria-label="تعديل العلامة التجارية" onClick={() => openEditDialog(brand)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="حذف العلامة التجارية" onClick={() => setBrandToDelete(brand)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            )}
          />
        )}
      </DirectoryPagedViews>

      <BrandFormDialog
        open={formState.open}
        brand={formState.brand}
        onOpenChange={(open) => setFormState((s) => ({ ...s, open }))}
      />
      <DeleteBrandDialog
        brand={brandToDelete}
        isDeleting={remove.isPending}
        onConfirm={(brand) => void handleDeleteConfirm(brand)}
        onClose={() => setBrandToDelete(null)}
      />
    </div>
  );
}
