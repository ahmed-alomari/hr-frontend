'use client';

import * as React from 'react';
import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { usePageHeaderFilterRegion } from '@/components/layouts/page-header-actions-context';
import { StickyPagination, DEFAULT_PAGE_SIZE } from '@/components/ui/sticky-pagination';
import { cn } from '@/shared/utils';

export { DEFAULT_PAGE_SIZE, DISCIPLINE_PAGE_SIZE_OPTIONS as PAGE_SIZE_OPTIONS } from '@/components/ui/sticky-pagination';

export interface PaginationBarState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export function useListPagination<T>(
  items: T[],
  resetDeps?: React.DependencyList,
  defaultPageSize = DEFAULT_PAGE_SIZE,
) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(defaultPageSize);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  React.useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- explicit filter reset keys from callers
  }, [total, pageSize, ...(resetDeps ?? [])]);

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = React.useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  const setPageClamped = React.useCallback(
    (next: number) => setPage(Math.min(Math.max(1, next), totalPages)),
    [totalPages],
  );

  const setPageSizeReset = React.useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  return {
    page,
    setPage: setPageClamped,
    pageSize,
    setPageSize: setPageSizeReset,
    pageItems,
    total,
    totalPages,
  };
}

/** Bottom edge of the nearest overflow container (app shell scroll area), else the window. */
function containmentBottom(el: HTMLElement): number {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden') {
      return node.getBoundingClientRect().bottom;
    }
    node = node.parentElement;
  }
  return window.innerHeight;
}

function useViewportFillHeight<T extends HTMLElement>(bottomGap = 0) {
  const ref = useRef<T>(null);
  const { filterPanelOpen } = usePageHeaderFilterRegion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sync = () => {
      const top = el.getBoundingClientRect().top;
      const bottom = containmentBottom(el);
      // Floor so we never overflow the shell and create a page scrollbar.
      const height = Math.max(160, Math.floor(bottom - top - bottomGap));
      el.style.height = `${height}px`;
      el.style.maxHeight = `${height}px`;
      el.style.minHeight = `${height}px`;
    };

    sync();
    const raf = requestAnimationFrame(sync);

    const ro = new ResizeObserver(sync);
    ro.observe(document.documentElement);

    let node: HTMLElement | null = el.parentElement;
    while (node) {
      ro.observe(node);
      node = node.parentElement;
    }

    window.addEventListener('resize', sync);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [bottomGap, filterPanelOpen]);

  return ref;
}

/** List region sized to the app content area; pagination stays at the bottom (no page scroll). */
export function PagedListViewport({
  children,
  className,
  bottomGap = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Gap (px) between list bottom and the content-shell bottom. */
  bottomGap?: number;
}) {
  const ref = useViewportFillHeight<HTMLDivElement>(bottomGap);

  return (
    <div ref={ref} className={cn('flex min-h-0 flex-col overflow-hidden', className)}>
      {children}
    </div>
  );
}

/** Shared sticky pagination bar (same UI on every directory / timeline page). */
export function paginationBar(
  pagination: PaginationBarState,
  pageSizeOptions?: readonly number[],
): ReactNode {
  if (pagination.total <= 0) return null;
  return (
    <StickyPagination
      page={pagination.page}
      pageSize={pagination.pageSize}
      total={pagination.total}
      totalPages={pagination.totalPages}
      onPageChange={pagination.setPage}
      onPageSizeChange={pagination.setPageSize}
      pageSizeOptions={pageSizeOptions}
    />
  );
}

interface PagedShellProps {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /**
   * When false, the content region does not scroll (child manages its own scroll),
   * e.g. daily one-day attendance view.
   */
  contentScroll?: boolean;
}

/**
 * Canonical list shell: scrollable body + fixed footer row at the bottom of a
 * height-bounded parent (`PagedListViewport` or `h-full` flex child).
 */
export function PagedShell({
  children,
  footer,
  className,
  contentScroll = true,
}: PagedShellProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-1 flex-col overflow-hidden', className)}>
      <div
        className={cn(
          'min-h-0 flex-1',
          contentScroll ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden',
        )}
      >
        {children}
      </div>
      {footer ? (
        <div className="flex shrink-0 justify-center px-2 py-0">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

interface PaginatedListShellProps {
  pagination: PaginationBarState;
  children: ReactNode;
  contentScroll?: boolean;
  className?: string;
}

/** Standard paginated page body — always pair with `PagedListViewport` (or equivalent height). */
export function PaginatedListShell({
  pagination,
  children,
  contentScroll = true,
  className,
}: PaginatedListShellProps) {
  return (
    <div className={cn('flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden', className)}>
      <PagedShell footer={paginationBar(pagination)} contentScroll={contentScroll}>
        {children}
      </PagedShell>
    </div>
  );
}

interface DirectoryPagedViewsProps<T> {
  items: T[];
  resetDeps?: React.DependencyList;
  empty?: ReactNode;
  children: (pageItems: T[]) => ReactNode;
  /** When set, `items` are already a server page — no client slicing. */
  serverPagination?: PaginationBarState;
  loading?: boolean;
}

/**
 * Paginated directory list — same layout as daily attendance / discipline:
 * `PagedListViewport` + `PaginatedListShell` (footer pinned to bottom of viewport).
 */
export function DirectoryPagedViews<T>({
  items,
  resetDeps,
  empty,
  children,
  serverPagination,
  loading,
}: DirectoryPagedViewsProps<T>) {
  const clientPagination = useListPagination(items, resetDeps);

  if (serverPagination) {
    if (!loading && items.length === 0 && serverPagination.total === 0 && empty) {
      return <>{empty}</>;
    }

    if (loading && items.length === 0) {
      return (
        <div className="py-12 text-center text-sm text-muted-foreground">جاري التحميل…</div>
      );
    }

    return (
      <PagedListViewport className="w-full min-w-0 flex-1">
        <PaginatedListShell pagination={serverPagination}>
          {children(items)}
        </PaginatedListShell>
      </PagedListViewport>
    );
  }

  if (items.length === 0 && empty) return <>{empty}</>;

  const pagination: PaginationBarState = {
    page: clientPagination.page,
    pageSize: clientPagination.pageSize,
    total: clientPagination.total,
    totalPages: clientPagination.totalPages,
    setPage: clientPagination.setPage,
    setPageSize: clientPagination.setPageSize,
  };

  return (
    <PagedListViewport className="w-full min-w-0 flex-1">
      <PaginatedListShell pagination={pagination}>
        {children(clientPagination.pageItems)}
      </PaginatedListShell>
    </PagedListViewport>
  );
}

export interface UseServerDirectoryPaginationOptions<T> {
  enabled?: boolean;
  defaultPageSize?: number;
  resetDeps?: React.DependencyList;
  /** When true, loads full dataset (via `loadBulk` or paged loop) and paginates in memory. */
  bulkMode?: boolean;
  loadBulk?: () => Promise<{ items: T[]; total: number }>;
}

const LOAD_ALL_PAGE_SIZE = 200;

/** Server-paginated list state; refetches when `page` / `pageSize` change (unless `bulkMode`). */
export function useServerDirectoryPagination<T>(
  loadPage: (page: number, pageSize: number) => Promise<{ items: T[]; total: number }>,
  options?: UseServerDirectoryPaginationOptions<T>,
) {
  const enabled = options?.enabled ?? true;
  const defaultPageSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const bulkMode = options?.bulkMode ?? false;

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(defaultPageSize);
  const [items, setItems] = React.useState<T[]>([]);
  const [bulkItems, setBulkItems] = React.useState<T[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const resetKey = JSON.stringify(options?.resetDeps ?? []);

  const loadPageRef = useRef(loadPage);
  const loadBulkRef = useRef(options?.loadBulk);
  const fetchGenRef = useRef(0);
  loadPageRef.current = loadPage;
  loadBulkRef.current = options?.loadBulk;

  const reloadBulk = React.useCallback(async () => {
    const loadBulkFn = loadBulkRef.current;
    if (!enabled || !bulkMode || !loadBulkFn) return;
    const gen = ++fetchGenRef.current;
    setLoading(true);
    try {
      const res = await loadBulkFn();
      if (gen !== fetchGenRef.current) return;
      setBulkItems(res.items);
      setTotal(res.total);
    } catch {
      if (gen !== fetchGenRef.current) return;
      setBulkItems([]);
      setTotal(0);
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [bulkMode, enabled]);

  const reloadPage = React.useCallback(async () => {
    if (!enabled || bulkMode) return;
    const gen = ++fetchGenRef.current;
    setLoading(true);
    try {
      const res = await loadPageRef.current(page, pageSize);
      if (gen !== fetchGenRef.current) return;
      setItems(res.items);
      setTotal(res.total);
    } catch {
      if (gen !== fetchGenRef.current) return;
      setItems([]);
      setTotal(0);
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [bulkMode, enabled, page, pageSize]);

  React.useEffect(() => {
    if (bulkMode) void reloadBulk();
  }, [bulkMode, reloadBulk, resetKey]);

  React.useEffect(() => {
    if (!bulkMode) void reloadPage();
  }, [bulkMode, reloadPage, resetKey]);

  React.useEffect(() => {
    if (!enabled) {
      setItems([]);
      setBulkItems([]);
      setTotal(0);
      setLoading(false);
    }
  }, [enabled]);

  React.useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetKey encodes resetDeps
  }, [pageSize, resetKey, bulkMode]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const setPageClamped = React.useCallback(
    (next: number) => setPage(Math.min(Math.max(1, next), totalPages)),
    [totalPages],
  );

  const setPageSizeReset = React.useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const pageItems = React.useMemo(() => {
    if (bulkMode) {
      return bulkItems.slice((page - 1) * pageSize, page * pageSize);
    }
    return items;
  }, [bulkItems, bulkMode, items, page, pageSize]);

  /** Every row under the current filters, for a sort, a grouping or an export over the whole list. */
  const loadAll = React.useCallback(async (): Promise<T[]> => {
    if (bulkMode && loadBulkRef.current) return (await loadBulkRef.current()).items;
    const all: T[] = [];
    for (let next = 1; ; next += 1) {
      const res = await loadPageRef.current(next, LOAD_ALL_PAGE_SIZE);
      all.push(...res.items);
      if (res.items.length === 0 || all.length >= res.total) return all;
    }
  }, [bulkMode]);

  const pagination: PaginationBarState & { loadAll: () => Promise<T[]>; resetKey: string } = {
    page,
    pageSize,
    total,
    totalPages,
    setPage: setPageClamped,
    setPageSize: setPageSizeReset,
    loadAll,
    resetKey,
  };

  const reload = React.useCallback(async () => {
    if (bulkMode) await reloadBulk();
    else await reloadPage();
  }, [bulkMode, reloadBulk, reloadPage]);

  return {
    items: pageItems,
    total,
    loading,
    page,
    pageSize,
    setPage: setPageClamped,
    setPageSize: setPageSizeReset,
    pagination,
    reload,
  };
}

interface ServerPaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: readonly number[];
}

/** Sticky footer for server-paginated tables — same bar as `paginationBar`. */
export function ServerPaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
}: ServerPaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return paginationBar(
    { page, pageSize, total, totalPages, setPage: onPageChange, setPageSize: onPageSizeChange },
    pageSizeOptions,
  );
}
