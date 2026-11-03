'use client';

import { Loader2 } from 'lucide-react';
import { useLinkStatus } from 'next/link';
import { cn } from '@/shared/utils';

/**
 * Spins inside a `<Link>` while the page it opens is loading. A link that only
 * changes the query (another filter or shortcut on the same list) keeps the old
 * page on screen until the new one arrives, so this is the only sign of it.
 */
export function LinkPendingSpinner({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Loader2 className={cn('h-3.5 w-3.5 shrink-0 animate-spin', className)} aria-hidden />;
}
