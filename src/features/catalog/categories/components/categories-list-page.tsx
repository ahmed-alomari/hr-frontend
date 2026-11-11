'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  FolderTree,
  Package,
  Pencil,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { useAllCategories } from '@/features/catalog/categories/hooks/use-categories';
import { lazyDialog } from '@/shared/lib/lazy-dialog';
import { useProductsBasePath } from '@/features/catalog/products/lib/products-navigation';
import type { Category } from '@/features/ecommerce/domain/types/category';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { resolveUploadUrl } from '@/shared/resolve-upload-url';
import { cn } from '@/shared/utils';

// Loads on first open: keeps the form's code (and zod) out of the page's first load.
const CategoryFormDialog = lazyDialog(() =>
  import('@/features/catalog/categories/components/category-form-dialog').then((m) => m.CategoryFormDialog),
);

type StatusFilter = 'all' | 'active' | 'inactive';

function byOrder(a: Category, b: Category): number {
  return a.displayOrder - b.displayOrder || a.nameAr.localeCompare(b.nameAr, 'ar');
}

/**
 * Categories as a collapsible tree (2026-10-26), like warehouses and their
 * locations: each level folds; opening one shows what it holds. Every
 * category is loaded (all pages) and each count comes from the database, so
 * no level is cut short whatever the catalog size.
 */
export function CategoriesListPage() {
  const companyId = getStorefrontCompanyId();
  const router = useRouter();
  const productsBasePath = useProductsBasePath();
  const t = useTranslations('ecommerceAdmin');
  const tCommon = useTranslations('common');
  const [search, setSearch] = React.useState('');
  const [rootFilter, setRootFilter] = React.useState('');
  const [status, setStatus] = React.useState<StatusFilter>('all');
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | null>(null);

  const { data, isLoading, isError, refetch } = useAllCategories(companyId);
  const items = React.useMemo(() => data?.items ?? [], [data?.items]);
  const byId = React.useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const childrenOf = React.useMemo(() => {
    const map = new Map<string | null, Category[]>();
    for (const item of items) {
      // A parent outside the list (archived) puts the child at the top.
      const parent = item.parentId && byId.has(item.parentId) ? item.parentId : null;
      map.set(parent, [...(map.get(parent) ?? []), item]);
    }
    for (const list of map.values()) list.sort(byOrder);
    return map;
  }, [items, byId]);

  /** Products in a category and everything under it. */
  const totalProducts = React.useMemo(() => {
    const totals = new Map<string, number>();
    const visit = (id: string): number => {
      const cached = totals.get(id);
      if (cached !== undefined) return cached;
      const own = byId.get(id)?.productCount ?? 0;
      const sum = own + (childrenOf.get(id) ?? []).reduce((acc, child) => acc + visit(child.id), 0);
      totals.set(id, sum);
      return sum;
    };
    for (const item of items) visit(item.id);
    return totals;
  }, [items, byId, childrenOf]);

  const roots = childrenOf.get(null) ?? [];
  const term = search.trim().toLowerCase();
  const filtering = Boolean(term) || status !== 'all';

  /** With a search or status filter: the matches and the path down to them. */
  const visible = React.useMemo(() => {
    if (!filtering) return null;
    const keep = new Set<string>();
    for (const item of items) {
      const matchesTerm =
        !term ||
        item.nameAr.toLowerCase().includes(term) ||
        (item.nameEn ?? '').toLowerCase().includes(term) ||
        item.slug.toLowerCase().includes(term);
      const matchesStatus = status === 'all' || (status === 'active') === item.isActive;
      if (!matchesTerm || !matchesStatus) continue;
      let current: Category | undefined = item;
      while (current && !keep.has(current.id)) {
        keep.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
    }
    return keep;
  }, [filtering, items, term, status, byId]);

  const shownRoots = roots
    .filter((root) => !rootFilter || root.id === rootFilter)
    .filter((root) => !visible || visible.has(root.id));
  const isOpen = (id: string) => Boolean(visible) || expanded.has(id);
  const parentIds = items.filter((item) => (childrenOf.get(item.id) ?? []).length > 0).map((item) => item.id);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setDialogOpen(true);
  }

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label={tCommon('actions.retry')}
          onClick={() => void refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <PageHeaderPrimaryButton icon={Plus} label="إضافة تصنيف" onClick={openCreate} />
      </div>
    ),
    [tCommon, refetch],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        leadingFilters={
          <EntityFilterSearchField value={search} onChange={setSearch} placeholder="ابحث بالاسم أو الرابط…" />
        }
        inlineSelects={[
          {
            id: 'root',
            value: rootFilter || 'all',
            onChange: (value) => setRootFilter(value === 'all' ? '' : value),
            placeholder: 'كل الأقسام',
            options: [
              { value: 'all', label: 'كل الأقسام' },
              ...roots.map((root) => ({ value: root.id, label: root.nameAr })),
            ],
          },
          {
            id: 'status',
            value: status,
            onChange: (value) => setStatus(value as StatusFilter),
            placeholder: 'كل الحالات',
            options: [
              { value: 'all', label: 'كل الحالات' },
              { value: 'active', label: 'مفعّل' },
              { value: 'inactive', label: 'معطّل' },
            ],
          },
        ]}
      />
    ),
    [search, rootFilter, status, roots],
  );

  function renderActions(category: Category) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1 tabular-nums"
          title="منتجات هذا التصنيف"
          onClick={() => router.push(`${productsBasePath}?categoryId=${category.id}`)}
        >
          <Package className="h-3.5 w-3.5" />
          {category.productCount ?? 0}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label="تعديل"
          onClick={() => openEdit(category)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  function renderSummary(category: Category) {
    const children = childrenOf.get(category.id) ?? [];
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        {children.length > 0 ? (
          <Badge variant="secondary" className="text-[10px]">
            {children.length} تصنيف فرعي
          </Badge>
        ) : null}
        <Badge variant="outline" className="text-[10px] tabular-nums">
          {totalProducts.get(category.id) ?? 0} منتج
        </Badge>
        {!category.isActive ? (
          <Badge variant="subtle" className="text-[10px]">
            معطّل
          </Badge>
        ) : null}
      </span>
    );
  }

  /** A category under a department, and (when open) its own children. */
  function renderNode(category: Category, depth: number): React.ReactNode {
    if (visible && !visible.has(category.id)) return null;
    const children = childrenOf.get(category.id) ?? [];
    const open = isOpen(category.id);
    return (
      <div key={category.id}>
        <div
          className="flex flex-wrap items-center gap-2 border-b border-border/60 px-2 py-2 last:border-b-0"
          style={{ paddingInlineStart: `${depth * 20 + 8}px` }}
        >
          <button
            type="button"
            disabled={children.length === 0}
            onClick={() => toggle(category.id)}
            aria-expanded={children.length > 0 ? open : undefined}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-start enabled:hover:bg-muted/40"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                children.length === 0 && 'invisible',
                !open && '-rotate-90',
              )}
            />
            <span className="font-medium text-foreground">{category.nameAr}</span>
            <span className="text-xs text-muted-foreground" dir="ltr">
              {category.slug}
            </span>
            {renderSummary(category)}
          </button>
          {renderActions(category)}
        </div>
        {open && children.length > 0 ? children.map((child) => renderNode(child, depth + 1)) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SetPageTitle
        titleAr={t('nav.categories')}
        descriptionAr="تصنيفات المتجر الهرمية — اضغط على القسم لعرض ما تحته."
        iconName="FolderTree"
      />

      {isError ? <p className="text-sm text-destructive">{t('catalog.loadError')}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {items.length} تصنيف في {roots.length} قسم
          {filtering ? ' — النتائج مفتوحة حتى مكانها' : ''}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            disabled={filtering}
            onClick={() => setExpanded(new Set(parentIds))}
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            فتح الكل
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            disabled={filtering}
            onClick={() => setExpanded(new Set())}
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
            طي الكل
          </Button>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">جاري تحميل التصنيفات…</p> : null}
      {!isLoading && shownRoots.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {items.length === 0 ? t('catalog.empty') : 'لا تصنيفات مطابقة للتصفية.'}
        </p>
      ) : null}

      {shownRoots.map((root) => {
        const children = childrenOf.get(root.id) ?? [];
        const open = isOpen(root.id);
        return (
          <div key={root.id} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 px-2 py-2 sm:px-3">
              <button
                type="button"
                onClick={() => toggle(root.id)}
                aria-expanded={open}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-lg px-2 py-2 text-start transition-colors hover:bg-muted/40"
              >
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    children.length === 0 && 'invisible',
                    !open && '-rotate-90',
                  )}
                />
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
                  {root.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveUploadUrl(root.image.url)} alt={root.image.alt} className="h-full w-full object-cover" />
                  ) : (
                    <FolderTree className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{root.nameAr}</span>
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {root.slug}
                    </span>
                    {renderSummary(root)}
                  </span>
                </span>
              </button>
              {renderActions(root)}
            </div>
            {open && children.length > 0 ? (
              <div className="border-t border-border bg-muted/10">
                {children.map((child) => renderNode(child, 1))}
              </div>
            ) : null}
          </div>
        );
      })}

      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
        categories={items}
      />
    </div>
  );
}
