import * as React from 'react';
import dynamic from 'next/dynamic';
import { useOpenedOnce } from '@/shared/hooks/use-opened-once';

/**
 * A dialog whose code loads on its first open, not with the page.
 *
 * Use it for a form dialog a list page keeps mounted (`open` prop): its code
 * and its libraries (zod, react-hook-form, pickers) leave the page's first
 * load. Same props, same JSX at the call site:
 *
 *   const BrandFormDialog = lazyDialog(() =>
 *     import('…/brand-form-dialog').then((m) => m.BrandFormDialog),
 *   );
 *
 * Once opened it stays mounted, as before, so closing and reopening behave
 * exactly as with a static import.
 */
export function lazyDialog<P extends { open: boolean }>(
  load: () => Promise<React.ComponentType<P>>,
): React.ComponentType<P> {
  const Loaded = dynamic<P>(load, { ssr: false });
  function LazyDialog(props: P) {
    const opened = useOpenedOnce(props.open);
    return opened ? <Loaded {...props} /> : null;
  }
  return LazyDialog;
}
