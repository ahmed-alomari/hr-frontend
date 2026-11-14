'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * The open tab of a page, kept in the link (`?tab=`): it survives a reload,
 * can be shared, and the back button returns to it. The page that uses it
 * needs a `<Suspense>` around it in its `page.tsx`, for `useSearchParams`.
 */
export function useUrlTab<T extends string>(tabs: readonly T[], fallback: T, param = 'tab'): [T, (next: T) => void] {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const raw = params?.get(param);
  const tab = raw && (tabs as readonly string[]).includes(raw) ? (raw as T) : fallback;
  const query = params?.toString() ?? '';
  const setTab = React.useCallback(
    (next: T) => {
      const nextParams = new URLSearchParams(query);
      if (next === fallback) nextParams.delete(param);
      else nextParams.set(param, next);
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [query, fallback, param, pathname, router],
  );
  return [tab, setTab];
}
