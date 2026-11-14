'use client';

import { useListTools } from '@/components/ui/list-tools';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Pencil, Plus, Trash2, Warehouse } from 'lucide-react';
import { useInventoryBranchScope } from '@/features/inventory/lib/use-inventory-branch-scope';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { getBranchAccessLabel } from '@/features/auth/types/access-profile';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { useWarehouseMutations } from '@/features/inventory/admin/warehouses/hooks/use-warehouse-mutations';
import { lazyDialog } from '@/shared/lib/lazy-dialog';
import { inventoryAdminRoutes } from '@/features/inventory/admin/constants/routes';
import type { Warehouse as WarehouseEntity } from '@/features/inventory/domain/types/warehouse';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import { ListSortMenu, listSortQuery, useListSort, type ListSortOption } from '@/components/ui/list-sort';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import type { RegisterExportColumn } from '@/components/pdf/lib/register-export-rows';
import { fetchAllPaginatedItems } from '@/shared/api/client';
import { warehousesApi } from '@/features/inventory/admin/warehouses/lib/api/warehouses';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/features/hr/lib/api/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Loads on first open: keeps the form's code (and zod) out of the page's first load.
const WarehouseFormDialog = lazyDialog(() =>
  import('@/features/inventory/admin/warehouses/components/warehouse-form-dialog').then((m) => m.WarehouseFormDialog),
);

/** Server keys (list-screens skill); by default the code. */
const WAREHOUSES_SORT_OPTIONS: readonly ListSortOption[] = [
  { key: 'code', label: 'الرمز' },
  { key: 'name', label: 'الاسم' },
  { key: 'createdAt', label: 'تاريخ الإضافة' },
];

export function WarehousesListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    companyId,
    hasAllBranchAccess,
    allowedBranchIds,
    activeBranchId,
    defaultBranchId,
  } = useInventoryBranchScope();
  const accessProfile = useAuthStore((s) => s.accessProfile);
  const company = accessProfile?.companies.find((c) => c.companyId === companyId);
  const branchOptions = React.useMemo(() => {
    const branches = company?.branches ?? [];
    if (hasAllBranchAccess) return branches;
    return branches.filter((b) => allowedBranchIds.includes(b.branchId));
  }, [company?.branches, hasAllBranchAccess, allowedBranchIds]);

  const search = searchParams.get('q') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE;
  const branchFilter = searchParams.get('branchId') ?? '';

  const [searchInput, setSearchInput] = React.useState(search);
  const [formState, setFormState] = React.useState<{ open: boolean; warehouse: WarehouseEntity | null }>({
    open: false,
    warehouse: null,
  });
  const [toDelete, setToDelete] = React.useState<WarehouseEntity | null>(null);

  function updateParams(next: {
    q?: string;
    page?: number;
    pageSize?: number;
    branchId?: string | null;
  }) {
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
    if (next.branchId !== undefined) {
      if (next.branchId) params.set('branchId', next.branchId);
      else params.delete('branchId');
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  React.useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Clear a stale branch filter left in the URL (e.g. before access-profile loaded).
  React.useEffect(() => {
    if (hasAllBranchAccess && branchFilter) {
      updateParams({ branchId: null, page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to scope + URL filter
  }, [hasAllBranchAccess, branchFilter]);

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

  const branchNameById = React.useMemo(() => {
    const map = new Map((company?.branches ?? []).map((b) => [b.branchId, getBranchAccessLabel(b)]));
    return (id?: string | null) => {
      if (id == null) return 'مركزي';
      return map.get(id) ?? id.slice(0, 8);
    };
  }, [company?.branches]);

  // Sort kept per user and company (list-screens skill).
  const stateKeys = listStateKeys('inventory', 'warehouses', companyId);
  const sort = useListSort(stateKeys.sort, WAREHOUSES_SORT_OPTIONS);
  const sortQuery = listSortQuery(sort.sort);
  const listQuery = { companyId, branchId: branchFilter || undefined, search: search || undefined, ...sortQuery };
  const { data, isLoading, isError, error } = useWarehouses({ ...listQuery, page, limit: pageSize });

  const exportColumns: RegisterExportColumn<WarehouseEntity>[] = [
    { label: 'الرمز', kind: 'code', value: (w) => w.code },
    { label: 'المستودع', kind: 'name', value: (w) => w.nameAr },
    { label: 'الفرع', kind: 'text', value: (w) => branchNameById(w.branchId) },
    { label: 'العنوان', kind: 'text', value: (w) => w.address ?? '' },
    { label: 'الحالة', kind: 'status', value: (w) => (w.status === 'active' ? 'نشط' : 'غير نشط') },
  ];
  /** Every filtered warehouse (all pages) in the screen's order. */
  const getExportRows = async () => {
    const { items } = await fetchAllPaginatedItems((p, l) => warehousesApi.getAll({ ...listQuery, page: p, limit: l }));
    return items.map((warehouse) => exportColumns.map((column) => column.value(warehouse)));
  };
  const filterSummary = [
    search ? `بحث: ${search}` : null,
    branchFilter ? `الفرع: ${branchNameById(branchFilter)}` : null,
    sort.label,
  ].filter((line): line is string => Boolean(line));
  const { remove } = useWarehouseMutations();

  const canCreate = Boolean(companyId) && (hasAllBranchAccess || branchOptions.length > 0);


  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        leadingFilters={
          <div className="flex flex-wrap items-center gap-2">
            <EntityFilterSearchField
              value={searchInput}
              onChange={setSearchInput}
              placeholder="ابحث بالاسم أو الرمز…"
            />
            {branchOptions.length > 0 || hasAllBranchAccess ? (
              <Select
                value={branchFilter || '__all__'}
                onValueChange={(value) =>
                  updateParams({ branchId: value === '__all__' ? null : value, page: 1 })
                }
              >
                <SelectTrigger className="h-9 w-44" aria-label="تصفية الفرع">
                  <SelectValue placeholder="الفرع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">كل الفروع المسموحة</SelectItem>
                  {branchOptions.map((branch) => (
                    <SelectItem key={branch.branchId} value={branch.branchId}>
                      {getBranchAccessLabel(branch)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        }
      />
    ),
    [searchInput, branchFilter, branchOptions, hasAllBranchAccess],
  );

  const listErrorMessage =
    error instanceof ApiError && error.status === 403
      ? 'لا تملك صلاحية على هذا الفرع.'
      : error instanceof ApiError && error.status === 400
        ? 'تعذر تحميل المستودعات — تحقق من اختيار الشركة.'
        : 'تعذر تحميل المستودعات.';

  const columns: ColumnDef<WarehouseEntity>[] = [
    {
      key: 'warehouse',
      title: 'المستودع',
      sortKey: 'name',
      render: (row) => (
        <button
          type="button"
          className="flex items-center gap-3 text-start transition-colors hover:text-primary"
          onClick={() => router.push(inventoryAdminRoutes.warehouseDetail(row.id))}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </span>
          <span className="flex flex-col">
            <span className="font-medium text-foreground">{row.nameAr}</span>
            <span className="text-xs text-muted-foreground">
              مختصر: <span dir="ltr">{row.code}</span>
            </span>
          </span>
        </button>
      ),
    },
    {
      key: 'branch',
      title: 'الفرع',
      render: (row) => (
        <span className="text-sm text-muted-foreground">{branchNameById(row.branchId)}</span>
      ),
    },
    {
      key: 'address',
      title: 'العنوان',
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-muted-foreground">{row.address ?? '—'}</span>,
    },
    {
      key: 'status',
      title: 'الحالة',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'subtle'}>
          {row.status === 'active' ? 'نشط' : 'غير نشط'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      title: '',
      isActions: true,
      render: (row) => (
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label="مواقع المستودع"
            onClick={() => router.push(inventoryAdminRoutes.locationsForWarehouse(row.id))}
          >
            <MapPin className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="تعديل المستودع"
            onClick={() => setFormState({ open: true, warehouse: row })}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="حذف المستودع" onClick={() => setToDelete(row)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </>
      ),
    },
  ];

  const tools = useListTools<WarehouseEntity>({ section: 'inventory', page: 'warehouses', columns: columns, rows: [], fields: {}, savedViews: false });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={branchFilter ? 1 : 0} />
        {tools.buttons}
        <ListSortMenu model={sort} />
        <ListSavedViews storageKey={stateKeys.views} prefixes={stateKeys.prefixes} />
        <PageHeaderPrimaryButton
          icon={Plus}
          label="إضافة مستودع"
          disabled={!canCreate}
          onClick={() => setFormState({ open: true, warehouse: null })}
        >
          إضافة مستودع
        </PageHeaderPrimaryButton>
        <RegisterExportMenu
          title="سجل المستودعات"
          fileName="warehouses"
          columns={exportColumns}
          getRows={getExportRows}
          subtitleLines={filterSummary}
          emptyMessage="لا توجد مستودعات للتصدير."
        />
      </div>
    ),
    [canCreate, branchFilter, search, sort.sortKey, sort.label, stateKeys.views, tools.depsKey],
  );

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle titleAr="المخازن" iconName="Warehouse" />

      {isError ? <p className="text-sm text-destructive">{listErrorMessage}</p> : null}

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
            className="inv-table-host"
            columns={tools.columns}
            sort={sort.sort}
            onSort={sort.toggle}
            data={rowsPage}
            keyExtractor={(row) => row.id}
            loading={isLoading}
            emptyText={
              branchFilter
                ? 'لا توجد مستودعات لهذا الفرع. جرّب «كل الفروع المسموحة» — المستودعات المركزية (branchId فارغ) تظهر فقط بدون تصفية فرع.'
                : !hasAllBranchAccess && branchOptions.length === 0
                ? 'لا توجد فروع معيّنة لحسابك، لذا لا تظهر مستودعات. اطلب تعيين فرع أو صلاحية «كل الفروع».'
                : 'لا توجد مستودعات بعد. أضف مستودعًا للبدء.'
            }
            mobileCard={(row) => (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  className="flex items-start gap-3 text-start"
                  onClick={() => router.push(inventoryAdminRoutes.warehouseDetail(row.id))}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Warehouse className="h-5 w-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-display text-[14.5px] font-bold leading-snug">{row.nameAr}</span>
                    <span className="text-xs text-muted-foreground">
                      <span dir="ltr">{row.code}</span> · {branchNameById(row.branchId)}
                    </span>
                  </span>
                  <Badge variant={row.status === 'active' ? 'success' : 'subtle'} className="shrink-0">
                    {row.status === 'active' ? 'نشط' : 'غير نشط'}
                  </Badge>
                </button>

                {row.address ? (
                  <div className="flex items-center gap-1.5 ps-14 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{row.address}</span>
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-1 border-t border-border/60 pt-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="مواقع المستودع"
                    onClick={() => router.push(inventoryAdminRoutes.locationsForWarehouse(row.id))}
                  >
                    <MapPin className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="تعديل المستودع"
                    onClick={() => setFormState({ open: true, warehouse: row })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="حذف المستودع" onClick={() => setToDelete(row)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            )}
          />
        )}
      </DirectoryPagedViews>

      <WarehouseFormDialog
        open={formState.open}
        warehouse={formState.warehouse}
        onOpenChange={(open) => setFormState((s) => ({ ...s, open }))}
      />

      <Dialog open={Boolean(toDelete)} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>حذف المستودع؟</DialogTitle>
            <DialogDescription>
              سيتم حذف «{toDelete?.nameAr}» من القائمة. يمكنك إعادة إنشائه لاحقًا.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={remove.isPending}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={!toDelete || remove.isPending}
              onClick={() => {
                if (!toDelete || !companyId) return;
                void remove.mutateAsync({ companyId, id: toDelete.id }).then(() => setToDelete(null));
              }}
            >
              {remove.isPending ? 'جاري الحذف…' : 'حذف'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
