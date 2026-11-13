'use client';

import * as React from 'react';
import {
  getPublicStorefrontCompanyId,
  setClientStorefrontCompanyId,
} from '@/features/ecommerce/storefront/lib/storefront-company';

const StorefrontCompanyContext = React.createContext<string | null>(null);

/**
 * The store's company for this page, decided on the server from the
 * hostname (company domains). Client code reads it with
 * {@link useStorefrontCompanyId}; event handlers and API helpers outside
 * React keep calling `getPublicStorefrontCompanyId()`, which returns it in
 * the browser.
 */
export function StorefrontCompanyProvider({
  companyId,
  children,
}: {
  companyId: string;
  children: React.ReactNode;
}) {
  // Browser only: on the server one module is shared by every request.
  if (typeof window !== 'undefined') setClientStorefrontCompanyId(companyId);
  return (
    <StorefrontCompanyContext.Provider value={companyId}>{children}</StorefrontCompanyContext.Provider>
  );
}

/** The store's company during render (server and browser). */
export function useStorefrontCompanyId(): string {
  return React.useContext(StorefrontCompanyContext) ?? getPublicStorefrontCompanyId();
}
