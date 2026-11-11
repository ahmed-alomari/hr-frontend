'use client';

import * as React from 'react';
import { ChevronDown, Pencil, Plus, Ruler, Trash2 } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { useCatalogUoms } from '@/features/catalog/catalog-uoms/hooks/use-catalog-uoms';
import { useCatalogUomMutations } from '@/features/catalog/catalog-uoms/hooks/use-catalog-uom-mutations';
import { lazyDialog } from '@/shared/lib/lazy-dialog';
import { DeleteCatalogUomDialog } from '@/features/catalog/catalog-uoms/components/delete-catalog-uom-dialog';
import type {
  CatalogUom,
  CatalogUomCategory,
  CatalogUomMeasure,
} from '@/features/catalog/catalog-uoms/lib/api/catalog-uoms';
import {
  UOM_MEASURES,
  UOM_MEASURE_LABELS_AR,
  groupUomsByMeasure,
} from '@/features/catalog/catalog-uoms/lib/uom-measures';
import { cn } from '@/shared/utils';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { PACKAGING_TYPE_OPTIONS } from '@/features/catalog/products/constants/packaging-types';

// Loads on first open: keeps the form's code (and zod) out of the page's first load.
const CatalogUomFormDialog = lazyDialog(() =>
  import('@/features/catalog/catalog-uoms/components/catalog-uom-form-dialog').then((m) => m.CatalogUomFormDialog),
);

const CATEGORY_LABELS_AR: Record<CatalogUomCategory, string> = {
  countable: 'معدود',
  bulk: 'غير معدود',
};

export function CatalogUomsListPage() {
  const companyId = getStorefrontCompanyId();
  const { data, isLoading, isError } = useCatalogUoms({ companyId, ensureDefaults: true, limit: 200 });
  const { remove } = useCatalogUomMutations();
  const [measure, setMeasure] = React.useState<CatalogUomMeasure | 'all'>('all');
  const [status, setStatus] = React.useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = React.useState('');
  const allItems = data?.items ?? [];
  const countOf = (value: CatalogUomMeasure) => allItems.filter((u) => (u.measure ?? 'count') === value).length;
  const term = search.trim().toLowerCase();
  const rows = allItems
    .filter((u) => measure === 'all' || (u.measure ?? 'count') === measure)
    .filter((u) => status === 'all' || (status === 'active') === u.isActive)
    .filter(
      (u) =>
        !term ||
        u.nameAr.toLowerCase().includes(term) ||
        u.code.toLowerCase().includes(term) ||
        (u.nameEn ?? '').toLowerCase().includes(term),
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const groups = groupUomsByMeasure(rows);
  const filtering = Boolean(term) || status !== 'all' || measure !== 'all';
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const toggle = (value: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  // In the page header's filter slot, like the other lists: stays in view while scrolling.
  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        leadingFilters={
          <EntityFilterSearchField value={search} onChange={setSearch} placeholder="ابحث بالاسم أو الرمز…" />
        }
        inlineSelects={[
          {
            id: 'measure',
            value: measure,
            onChange: (value) => setMeasure(value as CatalogUomMeasure | 'all'),
            placeholder: 'كل أنواع القياس',
            options: [
              { value: 'all', label: `كل أنواع القياس (${allItems.length})` },
              ...UOM_MEASURES.map((m) => ({ value: m.value, label: `${m.labelAr} (${countOf(m.value)})` })),
            ],
          },
          {
            id: 'status',
            value: status,
            onChange: (value) => setStatus(value as 'all' | 'active' | 'inactive'),
            placeholder: 'كل الحالات',
            options: [
              { value: 'all', label: 'كل الحالات' },
              { value: 'active', label: 'نشطة' },
              { value: 'inactive', label: 'غير نشطة' },
            ],
          },
        ]}
      />
    ),
     
    [search, measure, status, allItems],
  );

  const [formState, setFormState] = React.useState<{ open: boolean; uom: CatalogUom | null }>({
    open: false,
    uom: null,
  });
  const [uomToDelete, setUomToDelete] = React.useState<CatalogUom | null>(null);

  const openCreate = () => setFormState({ open: true, uom: null });
  const openEdit = (uom: CatalogUom) => setFormState({ open: true, uom });

  usePageHeaderActions(
    () => (
      <PageHeaderPrimaryButton icon={Plus} label="إضافة وحدة" disabled={!companyId} onClick={openCreate} />
    ),
    [companyId],
  );

  const columns: ColumnDef<CatalogUom>[] = [
    {
      key: 'name',
      title: 'الاسم',
      render: (row) => (
        <div>
          <div className="font-medium">{row.nameAr}</div>
          {!row.isActive ? (
            <Badge variant="secondary" className="mt-1 text-[10px]">
              غير نشطة
            </Badge>
          ) : null}
        </div>
      ),
    },
    { key: 'code', title: 'الرمز', render: (row) => <span dir="ltr">{row.code}</span> },
    { key: 'measure', title: 'نوع القياس', render: (row) => UOM_MEASURE_LABELS_AR[row.measure ?? 'count'] },
    {
      key: 'packagingType',
      title: 'نوع الطرد',
      render: (row) =>
        PACKAGING_TYPE_OPTIONS.find((option) => option.value === row.packagingType)?.labelAr ?? row.packagingType,
    },
    { key: 'category', title: 'الفئة', render: (row) => CATEGORY_LABELS_AR[row.category] },
    { key: 'order', title: 'الترتيب', render: (row) => row.displayOrder },
    {
      key: 'actions',
      title: '',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label="تعديل" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="حذف"
            onClick={() => setUomToDelete(row)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr="وحدات القياس"
        descriptionAr="كتالوج مشترك بين المنتجات — عرّف الحبة والعلبة والكرتون هنا، ثم اربطها بالمنتج بالكمية النسبية."
        iconName="Ruler"
      />

      {isError ? <p className="text-sm text-destructive">تعذر تحميل وحدات القياس.</p> : null}

      {isLoading ? <p className="text-sm text-muted-foreground">جاري تحميل الوحدات…</p> : null}
      {!isLoading && groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {allItems.length === 0 ? 'لا توجد وحدات. اضغط «إضافة وحدة».' : 'لا وحدات مطابقة للتصفية.'}
        </p>
      ) : null}
      {/* One card per measure, folded like the warehouses: opening it shows its units. */}
      {groups.map((group) => {
        const open = filtering || expanded.has(group.value);
        const hint = UOM_MEASURES.find((m) => m.value === group.value)?.hintAr;
        return (
          <div key={group.value} className="overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => toggle(group.value)}
              aria-expanded={open}
              className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-start transition-colors hover:bg-muted/40"
            >
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')}
              />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Ruler className="h-4 w-4" />
              </span>
              <span className="font-semibold text-foreground">{group.labelAr}</span>
              <Badge variant="secondary" className="text-[10px]">
                {group.items.length} وحدة
              </Badge>
              {!open ? (
                <span className="truncate text-xs text-muted-foreground">
                  {group.items.map((u) => u.nameAr).join('، ') || hint}
                </span>
              ) : null}
            </button>
            {open ? (
              <div className="border-t border-border bg-muted/10 p-2 sm:p-3">
                <DataTable
                  variant="directory"
                  className="sto-table-host"
                  columns={columns}
                  data={group.items}
                  keyExtractor={(row) => row.id}
                  loading={false}
                  emptyText="لا وحدات."
                />
              </div>
            ) : null}
          </div>
        );
      })}

      <CatalogUomFormDialog
        open={formState.open}
        uom={formState.uom}
        onOpenChange={(open) => setFormState((prev) => ({ ...prev, open }))}
      />

      <DeleteCatalogUomDialog
        open={Boolean(uomToDelete)}
        uom={uomToDelete}
        onOpenChange={(open) => {
          if (!open) setUomToDelete(null);
        }}
        isDeleting={remove.isPending}
        onConfirm={async (uom) => {
          if (!companyId) return;
          await remove.mutateAsync({ id: uom.id, companyId });
          setUomToDelete(null);
        }}
      />
    </div>
  );
}
