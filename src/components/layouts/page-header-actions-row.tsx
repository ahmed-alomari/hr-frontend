'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { HeaderToolsFoldContext, type HeaderToolsFold } from '@/components/layouts/phone-fold';
import { cn } from '@/shared/utils';

/** One secondary tool beside the filter is no crowd: an arrow would only hide it. */
const MIN_TOOLS_TO_FOLD = 2;

/**
 * Horizontal action strip for topbar row 2 — stays on one row on small screens.
 *
 * Secondary tools declare themselves with `FoldedHeaderTool`. With two or more
 * of them, phones show the filter and the main button with an arrow, and the
 * tools come out beside it in this same row.
 */
export function PageHeaderActionsRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = React.useState<string | null>(null);
  const [toolCount, setToolCount] = React.useState(0);
  const register = React.useCallback(() => {
    setToolCount((n) => n + 1);
    return () => setToolCount((n) => n - 1);
  }, []);
  const folds = toolCount >= MIN_TOOLS_TO_FOLD;
  // Remembered with its page, so the next page starts folded.
  const open = folds && openOn === pathname;
  const fold = React.useMemo<HeaderToolsFold>(() => ({ folds, open, register }), [folds, open, register]);
  const label = open ? 'إخفاء الأدوات' : 'إظهار الأدوات';

  return (
    <HeaderToolsFoldContext.Provider value={fold}>
      <div
        className={cn(
          'flex max-w-[52%] shrink-0 flex-row flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain sm:max-w-none sm:gap-2',
          '[&_button]:shrink-0 [&_a]:shrink-0',
          'max-sm:[&_button]:px-2 max-sm:[&_a]:px-2',
          'max-sm:[&_button]:gap-0 max-sm:[&_a]:gap-0',
          /* Hide button/link labels on mobile — icons stay sized via explicit svg dimensions */
          'max-sm:[&_button]:text-[0px] max-sm:[&_a]:text-[0px]',
          'max-sm:[&_button_span]:hidden max-sm:[&_a_span]:hidden',
          'scrollbar-none',
          /* The page's own wrapper gives way, so the arrow can stand between its buttons. */
          folds && 'max-md:[&>div:not([data-folded-tool])]:contents',
          /* Opened tools take the row; the title gives way until they fold. */
          open && 'max-w-[calc(100%-2rem)]',
          className,
        )}
      >
        {children}
        {folds ? (
          <button
            type="button"
            onClick={() => setOpenOn(open ? null : pathname)}
            aria-expanded={open}
            aria-label={label}
            title={label}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground max-md:order-3 md:hidden"
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')} />
          </button>
        ) : null}
      </div>
    </HeaderToolsFoldContext.Provider>
  );
}
