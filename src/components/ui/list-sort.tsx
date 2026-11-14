'use client';

import { FoldedHeaderTool } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/shared/utils';
import { usePersistedStateRestore } from '@/shared/hooks/use-persisted-state-restore';

export type SortDir = 'asc' | 'desc';

/** The list's chosen order; `null` is the list's own default order. */
export type ListSortState = { key: string; dir: SortDir } | null;

/** A field the list can be sorted by — `key` is the server's `sortBy` value. */
export type ListSortOption = { key: string; label: string };

const DIR_LABEL: Record<SortDir, string> = { asc: 'تصاعدي', desc: 'تنازلي' };

function readSort(storageKey: string | null, options: readonly ListSortOption[]): ListSortState {
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { key?: unknown; dir?: unknown } | null;
    if (
      parsed
      && typeof parsed.key === 'string'
      && (parsed.dir === 'asc' || parsed.dir === 'desc')
      // A key the list no longer offers falls back to the default order.
      && options.some((o) => o.key === parsed.key)
    ) {
      return { key: parsed.key, dir: parsed.dir };
    }
  } catch {
    // ignore unreadable / blocked storage
  }
  return null;
}

function writeSort(storageKey: string | null, sort: ListSortState): void {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    if (sort) window.localStorage.setItem(storageKey, JSON.stringify(sort));
    else window.localStorage.removeItem(storageKey);
  } catch {
    // ignore quota / private mode errors
  }
}

/** `sortBy` / `sortDir` for the list API (nothing for the default order). */
export function listSortQuery(sort: ListSortState): { sortBy?: string; sortDir?: SortDir } {
  return sort ? { sortBy: sort.key, sortDir: sort.dir } : {};
}

/** «الترتيب: الموظف — تصاعدي», for printed registers; null for the default order. */
export function listSortLabel(sort: ListSortState, options: readonly ListSortOption[]): string | null {
  if (!sort) return null;
  const label = options.find((o) => o.key === sort.key)?.label ?? sort.key;
  return `الترتيب: ${label} — ${DIR_LABEL[sort.dir]}`;
}

/**
 * A list's sort order, kept per user and screen (like its filters). The
 * order is applied by the server, so it covers every page and the export.
 */
export function useListSort(storageKey: string | null, options: readonly ListSortOption[]) {
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  const [sort, setSortState] = React.useState<ListSortState>(() => readSort(storageKey, options));

  React.useEffect(() => {
    setSortState(readSort(storageKey, optionsRef.current));
  }, [storageKey]);

  usePersistedStateRestore(() => setSortState(readSort(storageKey, optionsRef.current)));

  const setSort = React.useCallback((next: ListSortState) => {
    setSortState(next);
    writeSort(storageKey, next);
  }, [storageKey]);

  /** Header click: ascending, then descending, then back to the default order. */
  const toggle = React.useCallback((key: string) => {
    setSortState((prev) => {
      const next: ListSortState = prev?.key !== key
        ? { key, dir: 'asc' }
        : prev.dir === 'asc'
          ? { key, dir: 'desc' }
          : null;
      writeSort(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const sortKey = sort ? `${sort.key}:${sort.dir}` : '';

  return {
    sort,
    setSort,
    toggle,
    /** Stable string for `resetDeps` / memo deps. */
    sortKey,
    options,
    label: listSortLabel(sort, options),
  };
}

export type ListSortModel = ReturnType<typeof useListSort>;

/** Arrow shown in a sortable column header. */
export function SortIndicator({ active, dir }: { active: boolean; dir?: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 shrink-0 opacity-40" aria-hidden />;
  return dir === 'asc'
    ? <ArrowUp className="h-3 w-3 shrink-0 text-primary" aria-hidden />
    : <ArrowDown className="h-3 w-3 shrink-0 text-primary" aria-hidden />;
}

/**
 * «ترتيب» button for the page header: every sortable field, both directions,
 * and a reset. It is the way to sort on phones (where there are no column
 * headers) and mirrors the header arrows on desktop.
 */
export function ListSortMenu({ model }: { model: ListSortModel }) {
  const { sort, setSort, options } = model;
  if (options.length === 0) return null;

  return (
    <FoldedHeaderTool>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('relative h-8 w-8 shrink-0', sort && 'border-primary/40 text-primary')}
            aria-label={model.label ?? 'ترتيب'}
            title={model.label ?? 'ترتيب'}
          >
            <ArrowUpDown className="h-4 w-4" />
            {sort ? <span className="absolute -top-1 -end-1 h-2 w-2 rounded-full bg-primary" /> : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] w-60 overflow-y-auto">
          <DropdownMenuLabel className="text-xs">ترتيب حسب</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((o) => (
            <div key={o.key} className="flex items-center justify-between gap-1 px-2 py-1">
              <span className={cn('truncate text-sm', sort?.key === o.key && 'font-semibold text-primary')}>
                {o.label}
              </span>
              <div className="flex shrink-0 gap-0.5">
                {(['asc', 'desc'] as const).map((dir) => {
                  const selected = sort?.key === o.key && sort.dir === dir;
                  return (
                    <DropdownMenuItem
                      key={dir}
                      onSelect={() => setSort({ key: o.key, dir })}
                      className={cn(
                        'h-7 gap-1 rounded-md px-1.5 text-[11px]',
                        selected && 'bg-primary/10 text-primary',
                      )}
                    >
                      {dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {DIR_LABEL[dir]}
                      {selected ? <Check className="h-3 w-3" /> : null}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            </div>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!sort} onSelect={() => setSort(null)} className="gap-2 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            الترتيب الافتراضي
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </FoldedHeaderTool>
  );
}
