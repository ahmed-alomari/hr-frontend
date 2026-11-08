'use client';

import * as React from 'react';
import { Check, Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';
import { cn } from '@/shared/utils';

/** A column the user may hide — `key` matches the table's `ColumnDef.key`. */
export type ListColumnOption = { key: string; label: string };

/**
 * Which of a list's optional columns are hidden, kept per user and screen
 * (with the list's filters, so saved views carry it). The screen and its
 * export drop the same columns.
 */
export function useColumnVisibility(
  storageKey: string | null,
  options: readonly ListColumnOption[],
  /** Hidden until the user picks them. Omitted means every optional column starts visible. */
  defaultHidden: readonly string[] = [],
) {
  const [hiddenList, setHiddenList] = usePersistedFilterState<string[]>(storageKey, [...defaultHidden]);
  const hidden = React.useMemo(
    () => new Set((Array.isArray(hiddenList) ? hiddenList : []).filter((k) => options.some((o) => o.key === k))),
    [hiddenList, options],
  );

  const toggle = React.useCallback((key: string) => {
    setHiddenList((prev) => {
      const set = new Set(Array.isArray(prev) ? prev : []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return [...set];
    });
  }, [setHiddenList]);

  const reset = React.useCallback(() => setHiddenList([]), [setHiddenList]);
  const isVisible = React.useCallback((key: string) => !hidden.has(key), [hidden]);

  return {
    options,
    hidden,
    /** Stable string for memo / header-slot deps. */
    hiddenKey: [...hidden].sort().join(','),
    isVisible,
    toggle,
    reset,
  };
}

export type ColumnVisibilityModel = ReturnType<typeof useColumnVisibility>;

/** «الأعمدة» button for the page header: show or hide the list's optional columns. */
export function ListColumnsPicker({ model }: { model: ColumnVisibilityModel }) {
  const { options, hidden, toggle, reset } = model;
  if (options.length === 0) return null;
  const visibleCount = options.length - hidden.size;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('relative h-8 w-8 shrink-0', hidden.size > 0 && 'border-primary/40 text-primary')}
          aria-label="الأعمدة"
          title="الأعمدة"
        >
          <Columns3 className="h-4 w-4" />
          {hidden.size > 0 ? <span className="absolute -top-1 -end-1 h-2 w-2 rounded-full bg-primary" /> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-0" dir="rtl">
        <div className="border-b border-border/60 px-3 py-2.5">
          <p className="text-sm font-semibold">الأعمدة</p>
          <p className="mt-0.5 text-xs text-muted-foreground">تظهر في الجدول وفي التصدير</p>
        </div>
        <div className="max-h-72 space-y-0.5 overflow-y-auto p-2">
          {options.map((o) => {
            const isHidden = hidden.has(o.key);
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => toggle(o.key)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-start text-sm transition-colors',
                  isHidden ? 'text-muted-foreground hover:bg-muted/50' : 'bg-primary/5 text-foreground hover:bg-primary/10',
                )}
              >
                <span>{o.label}</span>
                {!isHidden ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
          <span className="text-xs text-muted-foreground">{visibleCount} من {options.length}</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={reset}>
            إظهار الكل
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
