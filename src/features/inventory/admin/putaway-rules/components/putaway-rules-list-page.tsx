'use client';

import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { useCategories } from '@/features/catalog/categories/hooks/use-categories';
import { ProductSinglePicker } from '@/features/catalog/products/components/product-single-picker';
import { ProductLabel } from '@/features/catalog/products/components/product-label';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import {
  usePutawayLocationOptions,
  usePutawayRuleMutations,
  usePutawayRules,
} from '@/features/inventory/admin/putaway-rules/hooks/use-putaway-rules';
import { PACKAGING_TYPE_OPTIONS } from '@/features/catalog/products/constants/packaging-types';
import type { PackagingType } from '@/features/ecommerce/domain/types/product';
import type { PutawayAppliesTo } from '@/features/inventory/domain/types/putaway-rule';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  dialogShellBodyClass,
  dialogMobileFullScreenClass,
  dialogShellContentClass,
  dialogShellHeaderClass,
} from '@/components/ui/dialog';
import { cn } from '@/shared/utils';

const NONE = '__none__';

type Draft = {
  warehouseId: string;
  arriveLocationId: string;
  appliesTo: PutawayAppliesTo;
  productId: string;
  categoryId: string;
  packagingType: PackagingType | '';
  storeLocationId: string;
  subLocationId: string;
  sequence: number;
};

const EMPTY: Draft = {
  warehouseId: '',
  arriveLocationId: '',
  appliesTo: 'all',
  productId: '',
  categoryId: '',
  packagingType: '',
  storeLocationId: '',
  subLocationId: '',
  sequence: 10,
};

const APPLIES_LABEL: Record<PutawayAppliesTo, string> = {
  all: 'كافة المنتجات',
  product: 'منتج محدد',
  category: 'فئة منتجات',
};

/** Arrival: supplier counterpart or internal receiving/stock. */
function isArriveLocation(type: string) {
  return type === 'supplier' || type === 'internal';
}

/** Destination: physical stock only. */
function isStoreLocation(type: string) {
  return type === 'internal';
}

export function PutawayRulesListPage() {
  const companyId = getInventoryCompanyId();
  const searchParams = useSearchParams();
  const categoryIdFilter = searchParams.get('categoryId') ?? '';
  const productIdFilter = searchParams.get('productId') ?? '';
  const warehouseIdFilter = searchParams.get('warehouseId') ?? '';

  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [warehouseFilter, setWarehouseFilter] = React.useState(warehouseIdFilter);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(() => ({
    ...EMPTY,
    warehouseId: warehouseIdFilter,
    categoryId: categoryIdFilter,
    productId: productIdFilter,
    appliesTo: productIdFilter ? 'product' : categoryIdFilter ? 'category' : 'all',
  }));

  React.useEffect(() => {
    setWarehouseFilter(warehouseIdFilter);
    setPage(1);
  }, [warehouseIdFilter]);

  React.useEffect(() => {
    setPage(1);
  }, [search, warehouseFilter, categoryIdFilter, productIdFilter]);

  React.useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      warehouseId: warehouseIdFilter || prev.warehouseId,
      categoryId: categoryIdFilter || prev.categoryId,
      productId: productIdFilter || prev.productId,
      appliesTo: productIdFilter
        ? 'product'
        : categoryIdFilter
          ? 'category'
          : prev.appliesTo,
    }));
  }, [categoryIdFilter, productIdFilter, warehouseIdFilter]);

  const { data, isLoading } = usePutawayRules({
    companyId,
    categoryId: categoryIdFilter || undefined,
    productId: productIdFilter || undefined,
    warehouseId: warehouseFilter || undefined,
    page,
    limit: pageSize,
  });
  const { data: locations = [] } = usePutawayLocationOptions(companyId);
  const { data: categoriesData } = useCategories({ companyId, limit: 200 });
  const { data: warehousesData } = useWarehouses({ companyId, limit: 200 });
  const { create, remove } = usePutawayRuleMutations(companyId);

  const categories = categoriesData?.items ?? [];
  const warehouses = warehousesData?.items ?? [];

  const locationLabel = (id: string) => {
    const found = locations.find((item) => item.id === id);
    return found ? `${found.warehouseNameAr} / ${found.nameAr}` : '—';
  };

  const categoryLabel = (id?: string | null) =>
    id ? categories.find((c) => c.id === id)?.nameAr ?? id : '—';
  const packagingLabel = (value?: PackagingType | null) =>
    value ? PACKAGING_TYPE_OPTIONS.find((o) => o.value === value)?.labelAr ?? value : 'أي طرد';

  const draftWarehouseId =
    draft.warehouseId ||
    locations.find((item) => item.id === draft.arriveLocationId)?.warehouseId ||
    '';

  const arriveOptions = locations.filter(
    (loc) =>
      isArriveLocation(loc.locationType) &&
      (!draftWarehouseId || loc.warehouseId === draftWarehouseId),
  );
  const storeOptions = locations.filter(
    (loc) =>
      isStoreLocation(loc.locationType) &&
      (!draftWarehouseId || loc.warehouseId === draftWarehouseId),
  );
  const subOptions = locations.filter(
    (loc) =>
      isStoreLocation(loc.locationType) &&
      loc.parentLocationId === draft.storeLocationId &&
      loc.id !== draft.storeLocationId,
  );

  const filtered = (data?.items ?? []).filter((rule) => {
    if (!search.trim()) return true;
    const hay = [
      rule.productId ?? '',
      categoryLabel(rule.categoryId),
      locationLabel(rule.arriveLocationId),
      locationLabel(rule.storeLocationId),
      packagingLabel(rule.packagingType),
      APPLIES_LABEL[rule.appliesTo],
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(search.trim().toLowerCase());
  });

  const canSave =
    Boolean(draft.arriveLocationId) &&
    Boolean(draft.storeLocationId) &&
    (draft.appliesTo === 'all' ||
      (draft.appliesTo === 'product' && draft.productId) ||
      (draft.appliesTo === 'category' && draft.categoryId));

  async function onCreate() {
    if (!canSave) return;
    const arrive = locations.find((item) => item.id === draft.arriveLocationId);
    if (!arrive) return;

    await create.mutateAsync({
      companyId,
      warehouseId: arrive.warehouseId,
      arriveLocationId: draft.arriveLocationId,
      appliesTo: draft.appliesTo,
      productId: draft.appliesTo === 'product' ? draft.productId : null,
      categoryId: draft.appliesTo === 'category' ? draft.categoryId : null,
      packagingType: draft.packagingType || null,
      storeLocationId: draft.storeLocationId,
      subLocationId: draft.subLocationId || null,
      sequence: draft.sequence || 10,
      isActive: true,
    });

    setDraft({
      ...EMPTY,
      warehouseId: warehouseFilter,
      categoryId: categoryIdFilter,
      productId: productIdFilter,
      appliesTo: productIdFilter ? 'product' : categoryIdFilter ? 'category' : 'all',
    });
    setOpen(false);
  }

  function openCreate() {
    setDraft({
      ...EMPTY,
      warehouseId: warehouseFilter,
      categoryId: categoryIdFilter,
      productId: productIdFilter,
      appliesTo: productIdFilter ? 'product' : categoryIdFilter ? 'category' : 'all',
    });
    setOpen(true);
  }

  function appliesDisplay(rule: (typeof filtered)[number]) {
    if (rule.appliesTo === 'product' && rule.productId) {
      return <ProductLabel companyId={companyId} productId={rule.productId} />;
    }
    if (rule.appliesTo === 'category') return categoryLabel(rule.categoryId);
    return 'كافة المنتجات';
  }

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton />
        <PageHeaderPrimaryButton icon={Plus} label="جديد" onClick={openCreate}>
          جديد
        </PageHeaderPrimaryButton>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        leadingFilters={
          <EntityFilterSearchField value={search} onChange={setSearch} placeholder="بحث…" />
        }
        inlineSelects={[
          {
            id: 'warehouse',
            value: warehouseFilter || 'all',
            onChange: (value) => setWarehouseFilter(value === 'all' ? '' : value),
            placeholder: 'كل المستودعات',
            options: [
              { value: 'all', label: 'كل المستودعات' },
              ...warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.nameAr })),
            ],
          },
        ]}
        trailingActions={
          productIdFilter || categoryIdFilter ? (
            <span className="text-xs text-muted-foreground">
              {productIdFilter ? (
                <>
                  {'مصفّى حسب المنتج: '}
                  <ProductLabel companyId={companyId} productId={productIdFilter} />
                </>
              ) : (
                `مصفّى حسب الفئة: ${categoryLabel(categoryIdFilter)}`
              )}
            </span>
          ) : undefined
        }
      />
    ),
    [search, warehouseFilter, warehouses, productIdFilter, categoryIdFilter],
  );

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle titleAr="قواعد التخزين" iconName="MapPinned" />

      <DirectoryPagedViews
        items={filtered}
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
        {(rulesPage) => (
          <>
          {/* Phones: one card per rule (arrives at → stored in), instead of a 7-column table. */}
          <div className="space-y-2.5 md:hidden">
            {isLoading ? <p className="py-6 text-center text-sm text-muted-foreground">جاري التحميل…</p> : null}
            {rulesPage.map((rule) => (
              <div key={rule.id} className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <p className="text-xs text-muted-foreground">عندما يصل إلى</p>
                    <p className="font-medium">{locationLabel(rule.arriveLocationId)}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 shrink-0 text-destructive"
                    onClick={() => void remove.mutateAsync(rule.id)}
                  >
                    حذف
                  </Button>
                </div>
                <div className="text-sm">
                  <p className="text-xs text-muted-foreground">يُخزَّن في</p>
                  <p className="font-medium">
                    {locationLabel(rule.storeLocationId)}
                    {rule.subLocationId ? ` ← ${locationLabel(rule.subLocationId)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {APPLIES_LABEL[rule.appliesTo]}: <span className="text-foreground">{appliesDisplay(rule)}</span>
                  </span>
                  <span>الطرد: <span className="text-foreground">{packagingLabel(rule.packagingType)}</span></span>
                  <span>الأولوية: <span className="tabular-nums text-foreground">{rule.sequence ?? 10}</span></span>
                </div>
              </div>
            ))}
            {!isLoading && rulesPage.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                لا توجد قواعد. أضف قاعدة افتراضية (كافة المنتجات → WH/Stock) لكل مستودع.
              </p>
            ) : null}
          </div>
          <div className="inv-table-host hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
            <table className="inv-table-wide text-sm">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-start font-medium">عندما يصل المنتج</th>
                  <th className="px-3 py-2.5 text-start font-medium">ينطبق على</th>
                  <th className="px-3 py-2.5 text-start font-medium">نوع الطرد</th>
                  <th className="px-3 py-2.5 text-start font-medium">التخزين في</th>
                  <th className="px-3 py-2.5 text-start font-medium">الموقع الفرعي</th>
                  <th className="px-3 py-2.5 text-start font-medium">الأولوية</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-muted-foreground">
                      جاري التحميل…
                    </td>
                  </tr>
                ) : null}
                {rulesPage.map((rule) => (
                  <tr key={rule.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2.5">{locationLabel(rule.arriveLocationId)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">{APPLIES_LABEL[rule.appliesTo]}</span>
                        <span>{appliesDisplay(rule)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{packagingLabel(rule.packagingType)}</td>
                    <td className="px-3 py-2.5">{locationLabel(rule.storeLocationId)}</td>
                    <td className="px-3 py-2.5">
                      {rule.subLocationId ? locationLabel(rule.subLocationId) : '—'}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{rule.sequence ?? 10}</td>
                    <td className="px-3 py-2.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => void remove.mutateAsync(rule.id)}
                      >
                        حذف
                      </Button>
                    </td>
                  </tr>
                ))}
                {!isLoading && rulesPage.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                      لا توجد قواعد. أضف قاعدة افتراضية (كافة المنتجات → WH/Stock) لكل مستودع.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          </>
        )}
      </DirectoryPagedViews>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={cn(dialogShellContentClass, dialogMobileFullScreenClass, 'max-w-xl sm:max-w-xl')}>
          <div className={dialogShellHeaderClass}>
            <DialogTitle className="text-base font-semibold">قاعدة تخزين جديدة</DialogTitle>
          </div>
          <div className={cn(dialogShellBodyClass, 'space-y-4')}>
            <p className="text-xs text-muted-foreground">
              المنطق: وصول من المورد/المخزون → تخزين في موقع داخلي (وموقع فرعي اختياري تحتّه).
            </p>

            <div className="space-y-1.5">
              <Label>المستودع</Label>
              <Select
                value={draft.warehouseId || NONE}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    warehouseId: value === NONE ? '' : value,
                    arriveLocationId: '',
                    storeLocationId: '',
                    subLocationId: '',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المستودع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>عندما يصل المنتج</Label>
              <Select
                value={draft.arriveLocationId || undefined}
                onValueChange={(value) => {
                  const loc = locations.find((item) => item.id === value);
                  setDraft((prev) => ({
                    ...prev,
                    arriveLocationId: value,
                    warehouseId: loc?.warehouseId ?? prev.warehouseId,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="المورد أو موقع الاستلام" />
                </SelectTrigger>
                <SelectContent>
                  {arriveOptions.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.nameAr} ({loc.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-xl border border-border p-3">
              <p className="text-sm font-semibold">ينطبق على</p>
              <Select
                value={draft.appliesTo}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    appliesTo: value as PutawayAppliesTo,
                    productId: value === 'product' ? prev.productId : '',
                    categoryId: value === 'category' ? prev.categoryId : '',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كافة المنتجات (افتراضي المستودع)</SelectItem>
                  <SelectItem value="category">فئة منتجات</SelectItem>
                  <SelectItem value="product">منتج محدد</SelectItem>
                </SelectContent>
              </Select>

              {draft.appliesTo === 'product' ? (
                <ProductSinglePicker
                  companyId={companyId}
                  value={draft.productId}
                  placeholder="ابحث عن منتج…"
                  onChange={(value) => setDraft((prev) => ({ ...prev, productId: value }))}
                />
              ) : null}

              {draft.appliesTo === 'category' ? (
                <Select
                  value={draft.categoryId || undefined}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, categoryId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفئة" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>نوع الطرد (اختياري)</Label>
              <Select
                value={draft.packagingType || NONE}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    packagingType: value === NONE ? '' : (value as PackagingType),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="أي طرد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>أي طرد</SelectItem>
                  {PACKAGING_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.labelAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-xl border border-border p-3">
              <p className="text-sm font-semibold">الوجهة</p>
              <div className="space-y-1.5">
                <Label>التخزين في</Label>
                <Select
                  value={draft.storeLocationId || undefined}
                  onValueChange={(value) =>
                    setDraft((prev) => ({ ...prev, storeLocationId: value, subLocationId: '' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="موقع داخلي مثل WH/Stock" />
                  </SelectTrigger>
                  <SelectContent>
                    {storeOptions.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.nameAr} ({loc.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>الموقع الفرعي</Label>
                <Select
                  value={draft.subLocationId || NONE}
                  onValueChange={(value) =>
                    setDraft((prev) => ({ ...prev, subLocationId: value === NONE ? '' : value }))
                  }
                  disabled={!draft.storeLocationId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختياري — رف/ممر تحت الموقع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>بدون (التخزين في الموقع أعلاه)</SelectItem>
                    {subOptions.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {draft.storeLocationId && subOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    لا توجد مواقع فرعية تحت هذا الموقع. أضف رفّاً تحت WH/Stock من صفحة المواقع.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="putaway-seq">الأولوية (رقم أصغر = أعلى)</Label>
              <Input
                id="putaway-seq"
                type="number"
                min={1}
                dir="ltr"
                className="inv-qty-input"
                value={draft.sequence}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, sequence: Number(event.target.value) || 10 }))
                }
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-border px-6 py-4 sm:justify-start">
            <Button type="button" disabled={create.isPending || !canSave} onClick={() => void onCreate()}>
              حفظ
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
