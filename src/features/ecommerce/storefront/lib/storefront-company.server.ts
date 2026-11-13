import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { publicConfig } from '@/shared/config';
import { STOREFRONT_FALLBACK_COMPANY_ID } from '@/features/ecommerce/storefront/lib/storefront-company';
import { resolveStorefrontHost } from '@/features/ecommerce/storefront/lib/storefront-host-resolver';

export type RequestStorefront = {
  companyId: string;
  /** Absolute base URL of the store (canonical links, sitemap); '' when unknown. */
  siteUrl: string;
};

/**
 * The store of this request, from its hostname (company domains). Server
 * components, route handlers and server actions only.
 *
 * - A company store domain opens that company's store.
 * - A store domain whose company has not enabled the storefront is not
 *   found: it never falls back to another company's store.
 * - Any other hostname (the deployment's own domain, localhost, a console
 *   domain) keeps the deployment's store (`NEXT_PUBLIC_STOREFRONT_COMPANY_ID`),
 *   as before company domains.
 */
export const getRequestStorefront = cache(async (): Promise<RequestStorefront> => {
  const requestHeaders = await headers();
  const resolved = await resolveStorefrontHost(requestHeaders.get('host'));
  if (resolved?.kind === 'store') {
    if (!resolved.companyId) notFound();
    return {
      companyId: resolved.companyId,
      siteUrl: `https://${resolved.primaryHostname ?? resolved.hostname}`,
    };
  }
  return {
    companyId: STOREFRONT_FALLBACK_COMPANY_ID,
    siteUrl: publicConfig.siteUrl.replace(/\/$/, ''),
  };
});

export async function getRequestStorefrontCompanyId(): Promise<string> {
  return (await getRequestStorefront()).companyId;
}
