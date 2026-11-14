'use client';

import * as React from 'react';
import { BarChart3, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/utils';

export type HeaderToolsFold = {
  /** Enough secondary tools to fold them behind the arrow. */
  folds: boolean;
  open: boolean;
  /** A tool announces itself while it is on the page; returns its removal. */
  register: () => () => void;
};

/** Given by the page header row. A tool rendered elsewhere has none and stays as it is. */
export const HeaderToolsFoldContext = React.createContext<HeaderToolsFold | null>(null);

/**
 * A secondary tool of the page header (columns, sort, grouping, views, import,
 * export). On phones it stays behind the arrow of the header row until that
 * opens. Wide screens show it in place, without an arrow.
 */
export function FoldedHeaderTool({ children }: { children: React.ReactNode }) {
  const fold = React.useContext(HeaderToolsFoldContext);
  const register = fold?.register;
  React.useLayoutEffect(() => register?.(), [register]);
  if (!fold) return <>{children}</>;
  return (
    <div
      data-folded-tool=""
      className={cn(
        'contents',
        fold.folds && 'items-center gap-1 max-md:order-4',
        fold.folds && (fold.open ? 'max-md:flex' : 'max-md:hidden'),
      )}
    >
      {children}
    </div>
  );
}

/**
 * Statistics cards folded on phones behind one line, which may carry the most
 * telling number so the page still answers at a glance. Always open on wide
 * screens.
 */
export function PhoneStatsFold({
  summary,
  label = 'الإحصائيات',
  children,
}: {
  /** The one number worth showing while folded. */
  summary?: React.ReactNode;
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-10 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm md:hidden"
      >
        <BarChart3 className="h-4 w-4 shrink-0 text-primary" />
        <span className="shrink-0 font-medium">{label}</span>
        <span className="min-w-0 flex-1 truncate text-end text-xs font-semibold tabular-nums">{summary}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <div className={cn(open ? 'max-md:mt-2' : 'max-md:hidden')}>{children}</div>
    </div>
  );
}
