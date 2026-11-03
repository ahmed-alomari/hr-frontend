'use client';

import * as React from 'react';
import { Archive, Check, Loader2, Plus, Star, Trash2, X } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { formatDateTime } from '@/shared/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { GroupedDataTable } from '@/components/ui/grouped-data-table';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { ListColumnsPicker, useColumnVisibility, type ListColumnOption } from '@/components/ui/list-columns-picker';
import {
  dateListGroupOptions,
  ListGroupMenu,
  listGroupQuery,
  useGroupedList,
  useListGroup,
  type ListGroupMeasure,
  type ListGroupOption,
  type ListTotals,
} from '@/components/ui/list-group';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import { ListSortMenu, listSortQuery, useListSort, type ListSortOption } from '@/components/ui/list-sort';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import {
  registerExportRows,
  visibleExportColumns,
  type RegisterExportColumn,
} from '@/components/pdf/lib/register-export-rows';
import { fetchAllPaginatedItems } from '@/shared/api/client';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';
import {
  useCreateProductReview,
  useDeleteProductReview,
  useProductReviews,
  useUpdateProductReview,
} from '@/features/ecommerce/admin/reviews/hooks/use-product-reviews';
import {
  productReviewsApi,
  type InventoryProductReview,
  type ProductReviewStatus,
} from '@/features/ecommerce/admin/reviews/lib/api/product-reviews-api';
import { ProductSinglePicker } from '@/features/catalog/products/components/product-single-picker';
import { useCan } from '@/features/auth/hooks/use-can';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';

const REVIEWS_READ = 'sta.product-reviews.read';
const REVIEWS_UPDATE = 'sta.product-reviews.update';
const REVIEWS_DELETE = 'sta.product-reviews.delete';

const STATUS_LABEL: Record<ProductReviewStatus, string> = {
  pending: 'بانتظار المراجعة',
  approved: 'معتمد',
  rejected: 'ملغى التفعيل',
};

type ArchiveScope = 'active' | 'archived' | 'all';

const ARCHIVE_LABEL: Record<ArchiveScope, string> = {
  active: 'النشطة',
  archived: 'المؤرشفة',
  all: 'الكل',
};

/** Server keys (`REVIEWS_SORT` / `REVIEWS_GROUP`), list-screens skill. */
const REVIEWS_SORT_OPTIONS: readonly ListSortOption[] = [
  { key: 'createdAt', label: 'التاريخ' },
  { key: 'rating', label: 'التقييم' },
  { key: 'status', label: 'الحالة' },
  { key: 'product', label: 'المنتج' },
];

const REVIEWS_GROUP_OPTIONS: readonly ListGroupOption[] = [
  { key: 'product', label: 'المنتج' },
  { key: 'status', label: 'الحالة', formatKey: (k) => STATUS_LABEL[k as ProductReviewStatus] ?? k },
  { key: 'rating', label: 'التقييم', orderByKey: true, formatKey: (k) => `${k} نجوم` },
  ...dateListGroupOptions(),
];

const REVIEWS_GROUP_MEASURES: readonly ListGroupMeasure[] = [{ key: 'rating', label: 'متوسط التقييم' }];

const REVIEWS_COLUMN_OPTIONS: readonly ListColumnOption[] = [
  { key: 'customer', label: 'العميل' },
  { key: 'comment', label: 'التعليق' },
  { key: 'date', label: 'التاريخ' },
];

/** The average of a set of reviews (the server sends the stars sum). */
function averageRating(totals: ListTotals): string {
  if (!totals.count) return '—';
  return `${(totals.sums.rating / totals.count).toFixed(1)} ★`;
}

function customerOf(review: InventoryProductReview): string {
  return review.guestName || (review.partnerId ? 'شريك مسجّل' : 'بدون اسم');
}

const REVIEWS_EXPORT_COLUMNS: RegisterExportColumn<InventoryProductReview>[] = [
  { label: 'المنتج', kind: 'name', value: (r) => r.productNameAr ?? '' },
  { label: 'التقييم', kind: 'number', value: (r) => String(r.rating), total: averageRating },
  { label: 'الحالة', kind: 'status', value: (r) => STATUS_LABEL[r.status] ?? r.status },
  { key: 'customer', label: 'العميل', kind: 'text', value: customerOf },
  { key: 'comment', label: 'التعليق', kind: 'text', value: (r) => [r.title, r.body].filter(Boolean).join(' — ') },
  { key: 'date', label: 'التاريخ', kind: 'date', value: (r) => formatDateTime(r.createdAt) },
];

export function ProductReviewsAdminPage() {
  const can = useCan();
  const companyId = getStorefrontCompanyId();
  const canRead = can(REVIEWS_READ);
  const canUpdate = can(REVIEWS_UPDATE);
  const canDelete = can(REVIEWS_DELETE);

  // Filters, sort, grouping and columns: kept per user and company.
  const filterKey = (field: string) => hrFiltersKey('store', 'reviews', companyId, field);
  const [status, setStatus] = usePersistedFilterState<ProductReviewStatus | 'all'>(filterKey('status'), 'all');
  const [archiveScope, setArchiveScope] = usePersistedFilterState<ArchiveScope>(filterKey('archiveScope'), 'active');
  const [productFilter, setProductFilter] = usePersistedFilterState(filterKey('productId'), '');
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  React.useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);
  const stateKeys = listStateKeys('store', 'reviews', companyId);
  const sort = useListSort(stateKeys.sort, REVIEWS_SORT_OPTIONS);
  const group = useListGroup(stateKeys.group, REVIEWS_GROUP_OPTIONS, REVIEWS_GROUP_MEASURES);
  const groupBy = group.groupBy;
  const columnVisibility = useColumnVisibility(filterKey('hiddenColumns'), REVIEWS_COLUMN_OPTIONS);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const filters = {
    companyId: companyId || undefined,
    status,
    productId: productFilter || undefined,
    archiveScope,
    search: search || undefined,
  };
  const filtersJson = JSON.stringify(filters);
  React.useEffect(() => setPage(1), [filtersJson, sort.sortKey]);
  const sortQuery = listSortQuery(sort.sort);

  const { data, isLoading, isError, refetch } = useProductReviews(
    { ...filters, ...sortQuery, page, limit: pageSize },
    canRead && !groupBy,
  );
  const grouped = useGroupedList<InventoryProductReview>({
    enabled: canRead && Boolean(companyId),
    groupBy,
    resetKey: JSON.stringify({ ...filters, ...sortQuery }),
    fetchGroups: () => productReviewsApi.groups({ ...filters, ...listGroupQuery(groupBy) }),
    fetchGroupRows: (groupValue, p, l) =>
      productReviewsApi.list({ ...filters, ...sortQuery, ...listGroupQuery(groupBy), groupValue, page: p, limit: l }),
  });

  const createReview = useCreateProductReview();
  const updateReview = useUpdateProductReview();
  const deleteReview = useDeleteProductReview();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    productId: '',
    rating: '5',
    title: '',
    body: '',
    guestName: '',
    status: 'approved' as ProductReviewStatus,
  });

  function resetForm() {
    setForm({ productId: '', rating: '5', title: '', body: '', guestName: '', status: 'approved' });
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    const rating = Number(form.rating);
    if (!form.productId || !Number.isFinite(rating) || rating < 1 || rating > 5) return;
    await createReview.mutateAsync({
      productId: form.productId,
      rating,
      title: form.title || null,
      body: form.body || null,
      guestName: form.guestName || null,
      status: form.status,
    });
    setCreateOpen(false);
    resetForm();
  }

  const exportColumns = visibleExportColumns(REVIEWS_EXPORT_COLUMNS, columnVisibility.isVisible);
  const filterSummary = [
    search ? `بحث: ${search}` : null,
    status !== 'all' ? `الحالة: ${STATUS_LABEL[status]}` : null,
    archiveScope !== 'active' ? `الأرشفة: ${ARCHIVE_LABEL[archiveScope]}` : null,
    productFilter ? 'منتج محدد' : null,
    sort.label,
    group.label,
  ].filter((line): line is string => Boolean(line));
  const activeFilterCount = (status !== 'all' ? 1 : 0) + (archiveScope !== 'active' ? 1 : 0) + (productFilter ? 1 : 0);

  /** Every filtered review (all pages) in the screen's order, grouped like the screen. */
  const getExportRows = async () => {
    const query = { ...filters, ...sortQuery, ...listGroupQuery(groupBy) };
    const [{ items }, summary] = await Promise.all([
      fetchAllPaginatedItems((p, l) => productReviewsApi.list({ ...query, page: p, limit: l })),
      productReviewsApi.groups(query),
    ]);
    return registerExportRows({
      columns: exportColumns,
      rows: items,
      total: summary.total,
      grouping:
        groupBy && group.option
          ? {
              fieldLabel: group.option.label,
              groups: group.sortGroups(summary.groups),
              labelOf: group.labelOf,
              groupKeyOf: (review) => review.groupKey,
            }
          : undefined,
    });
  };

  usePageHeaderActions(
    () =>
      canRead ? (
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
          <FilterToggleButton activeFilterCount={activeFilterCount} />
          <ListColumnsPicker model={columnVisibility} />
          <ListSortMenu model={sort} />
          <ListGroupMenu model={group} />
          <ListSavedViews storageKey={stateKeys.views} prefixes={stateKeys.prefixes} />
          {canUpdate ? (
            <PageHeaderPrimaryButton
              icon={Plus}
              label="إضافة تقييم"
              onClick={() => {
                resetForm();
                setCreateOpen(true);
              }}
            />
          ) : null}
          <RegisterExportMenu
            title="سجل التقييمات"
            fileName="product-reviews"
            columns={exportColumns}
            getRows={getExportRows}
            subtitleLines={filterSummary}
            landscape
            emptyMessage="لا توجد تقييمات للتصدير ضمن الفلاتر الحالية."
          />
        </div>
      ) : null,
    [
      canRead,
      canUpdate,
      activeFilterCount,
      sort.sortKey,
      sort.label,
      group.groupKey,
      group.label,
      columnVisibility.hiddenKey,
      filtersJson,
      stateKeys.views,
    ],
  );

  useEntityFilterSlot(
    () =>
      canRead ? (
        <ListFilterBar
          showDateSection={false}
          showStatusSection={false}
          showEmployeePicker={false}
          onClearAll={() => {
            setSearchInput('');
            setStatus('all');
            setArchiveScope('active');
            setProductFilter('');
          }}
          leadingFilters={
            <>
              <EntityFilterSearchField
                value={searchInput}
                onChange={setSearchInput}
                placeholder="بحث في العنوان أو التعليق أو اسم العميل…"
              />
              <div className="min-w-[12rem]">
                <ProductSinglePicker
                  companyId={companyId}
                  value={productFilter}
                  allowClear
                  placeholder="كل المنتجات"
                  onChange={setProductFilter}
                />
              </div>
            </>
          }
          inlineSelects={[
            {
              id: 'status',
              value: status,
              onChange: (value) => setStatus(value as ProductReviewStatus | 'all'),
              placeholder: 'كل الحالات',
              options: [
                { value: 'all', label: 'كل الحالات' },
                ...(Object.keys(STATUS_LABEL) as ProductReviewStatus[]).map((value) => ({
                  value,
                  label: STATUS_LABEL[value],
                })),
              ],
            },
            {
              id: 'archiveScope',
              value: archiveScope,
              onChange: (value) => setArchiveScope(value as ArchiveScope),
              placeholder: 'النشطة',
              options: (Object.keys(ARCHIVE_LABEL) as ArchiveScope[]).map((value) => ({
                value,
                label: ARCHIVE_LABEL[value],
              })),
            },
          ]}
        />
      ) : null,
    [canRead, searchInput, status, archiveScope, productFilter, companyId],
  );

  function rowActions(review: InventoryProductReview) {
    const isArchived = review.isArchived || archiveScope === 'archived';
    if (isArchived) {
      return (
        <Badge variant="outline" className="gap-1">
          <Archive className="h-3 w-3" />
          مؤرشف
        </Badge>
      );
    }
    return (
      <div className="flex flex-wrap justify-end gap-1">
        {canUpdate && review.status !== 'approved' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={updateReview.isPending}
            onClick={() => updateReview.mutate({ id: review.id, patch: { status: 'approved' } })}
          >
            <Check className="me-1 h-3.5 w-3.5" />
            اعتماد
          </Button>
        ) : null}
        {canUpdate && review.status !== 'rejected' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={updateReview.isPending}
            title="إلغاء التفعيل — يبقى ظاهرًا في اللوحة بحالة rejected"
            onClick={() => updateReview.mutate({ id: review.id, patch: { status: 'rejected' } })}
          >
            <X className="me-1 h-3.5 w-3.5" />
            إلغاء التفعيل
          </Button>
        ) : null}
        {canDelete ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={deleteReview.isPending}
            title="أرشفة ناعمة — إخفاء من القائمة النشطة"
            onClick={() => {
              if (window.confirm('أرشفة هذا التقييم؟ سيُخفى من القائمة النشطة ويمكن عرضه عبر فلتر المؤرشفة.')) {
                deleteReview.mutate(review.id);
              }
            }}
          >
            <Trash2 className="me-1 h-3.5 w-3.5" />
            أرشفة
          </Button>
        ) : null}
      </div>
    );
  }

  const allColumns: ColumnDef<InventoryProductReview>[] = [
    {
      key: 'product',
      title: 'المنتج',
      sortKey: 'product',
      render: (review) => <span className="font-medium text-foreground">{review.productNameAr ?? '—'}</span>,
    },
    {
      key: 'rating',
      title: 'التقييم',
      sortKey: 'rating',
      total: (totals) => <span className="font-semibold tabular-nums">{averageRating(totals)}</span>,
      render: (review) => (
        <span className="inline-flex items-center gap-0.5 text-sm text-secondary">
          <Star className="h-3.5 w-3.5 fill-current" />
          {review.rating}
        </span>
      ),
    },
    {
      key: 'status',
      title: 'الحالة',
      sortKey: 'status',
      render: (review) => <Badge variant="subtle">{STATUS_LABEL[review.status] ?? review.status}</Badge>,
    },
    {
      key: 'customer',
      title: 'العميل',
      hideOnMobile: true,
      render: (review) => <span className="text-sm">{customerOf(review)}</span>,
    },
    {
      key: 'comment',
      title: 'التعليق',
      render: (review) => (
        <div className="max-w-md space-y-0.5">
          {review.title ? <p className="text-sm font-medium text-foreground">{review.title}</p> : null}
          {review.body ? <p className="line-clamp-2 text-sm text-muted-foreground">{review.body}</p> : null}
          {!review.title && !review.body ? <span className="text-xs text-muted-foreground">—</span> : null}
        </div>
      ),
    },
    {
      key: 'date',
      title: 'التاريخ',
      sortKey: 'createdAt',
      hideOnMobile: true,
      render: (review) => (
        <span className="text-sm text-muted-foreground" dir="ltr">
          {formatDateTime(review.createdAt)}
        </span>
      ),
    },
    { key: 'actions', title: '', isActions: true, isInteractive: true, render: rowActions },
  ];
  const columns = allColumns.filter((column) => columnVisibility.isVisible(column.key));

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr="مراجعة التقييمات"
        descriptionAr="اعتماد أو إلغاء تفعيل التقييمات، أو أرشفتها. المعتمدة فقط تدخل في متوسط التقييم وعدد المراجعات على المنتج."
        iconName="Star"
      />

      {!canRead ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          لا تملك صلاحية عرض التقييمات ({REVIEWS_READ}).
        </div>
      ) : isError && !groupBy ? (
        <div className="rounded-xl border border-destructive/30 bg-card p-4 text-sm">
          <p className="text-destructive">تعذر تحميل التقييمات.</p>
          <button type="button" className="mt-2 text-primary underline" onClick={() => void refetch()}>
            إعادة المحاولة
          </button>
        </div>
      ) : groupBy ? (
        <GroupedDataTable
          columns={columns}
          group={group}
          list={grouped}
          keyExtractor={(review) => review.id}
          sort={sort.sort}
          onSort={sort.toggle}
          emptyText="لا توجد تقييمات ضمن هذا الفلتر."
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
                  setPage,
                  setPageSize: (size) => {
                    setPageSize(size);
                    setPage(1);
                  },
                }
              : undefined
          }
        >
          {(pageItems) => (
            <DataTable
              variant="directory"
              columns={columns}
              data={pageItems}
              keyExtractor={(review) => review.id}
              loading={isLoading}
              emptyText="لا توجد تقييمات ضمن هذا الفلتر."
              sort={sort.sort}
              onSort={sort.toggle}
              totals={grouped.summary?.total}
            />
          )}
        </DirectoryPagedViews>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة تقييم منتج</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void onCreate(e)}>
            <div className="space-y-1.5">
              <Label>المنتج</Label>
              <ProductSinglePicker
                companyId={companyId}
                value={form.productId}
                placeholder="ابحث عن منتج…"
                onChange={(value) => setForm((prev) => ({ ...prev, productId: value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>التقييم (1–5)</Label>
                <Select value={form.rating} onValueChange={(value) => setForm((prev) => ({ ...prev, rating: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['5', '4', '3', '2', '1'].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as ProductReviewStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">معتمد</SelectItem>
                    <SelectItem value="pending">بانتظار المراجعة</SelectItem>
                    <SelectItem value="rejected">ملغى التفعيل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>اسم الضيف</Label>
              <Input
                value={form.guestName}
                onChange={(e) => setForm((prev) => ({ ...prev, guestName: e.target.value }))}
                placeholder="مثال: سارة"
              />
            </div>
            <div className="space-y-1.5">
              <Label>العنوان</Label>
              <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>التعليق</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={createReview.isPending || !form.productId}>
                {createReview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
