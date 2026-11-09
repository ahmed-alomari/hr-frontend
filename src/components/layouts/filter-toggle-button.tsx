'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePageHeaderActionsState, usePageHeaderActionsSettersRef } from '@/components/layouts/page-header-actions-context';
import { cn } from '@/shared/utils';

/** Query keys that page or arrange a list rather than filter it. */
const NOT_FILTERS = new Set(['page', 'pageSize', 'limit', 'tab', 'view', 'sort', 'sortDirection']);

/**
 * Filters set in the URL — the badge when the page passes no count, so a
 * folded panel (phones) still shows that the list is filtered.
 */
function useUrlFilterCount(): number {
  const searchParams = useSearchParams();
  let count = 0;
  searchParams?.forEach((value, key) => {
    if (!NOT_FILTERS.has(key) && value.trim() !== '' && value !== 'all') count += 1;
  });
  return count;
}

export function FilterToggleButton({ activeFilterCount }: { activeFilterCount?: number }) {
  const { filterPanelOpen } = usePageHeaderActionsState();
  const settersRef = usePageHeaderActionsSettersRef();
  const urlFilterCount = useUrlFilterCount();
  const count = activeFilterCount ?? urlFilterCount;
  return (
    <button
      type="button"
      onClick={() => settersRef.current.setFilterPanelOpen((v) => !v)}
      aria-expanded={filterPanelOpen}
      aria-label={count > 0 ? `فلترة (${count} مفعّلة)` : 'فلترة'}
      className={cn(
        'flex h-9 shrink-0 md:h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors max-md:order-2 sm:gap-1.5 sm:px-3',
        filterPanelOpen
          ? 'border-primary/50 bg-primary/8 text-primary'
          : 'border-border bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground',
      )}
    >
      <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden sm:inline">فلترة</span>
      {count > 0 && (
        <Badge variant="secondary" className="ms-0.5 h-4 min-w-4 rounded-full px-1 py-0 text-[10px] leading-none">
          {count}
        </Badge>
      )}
    </button>
  );
}
