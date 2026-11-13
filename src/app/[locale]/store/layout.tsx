import { StorefrontCompanyProvider } from '@/features/ecommerce/storefront/components/storefront-company-provider';
import { StorefrontShell } from '@/features/ecommerce/storefront/components/storefront-shell';
import { StorefrontShellCsr } from '@/features/ecommerce/storefront/components/storefront-shell-csr';
import { getStorefrontCompanyConfig } from '@/features/ecommerce/storefront/lib/get-storefront-company-config';
import { isStorefrontCsrEnabled } from '@/features/ecommerce/storefront/lib/is-storefront-csr';
import { getRequestStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company.server';
import type { Metadata } from 'next';

/** Store pages depend on live backend data; skip static generation at build time. */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  if (isStorefrontCsrEnabled()) {
    return {};
  }
  const config = await getStorefrontCompanyConfig();
  return {
    icons: config.faviconUrl ? { icon: config.faviconUrl } : undefined,
  };
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // The company of this hostname (company domains), for every client component.
  const companyId = await getRequestStorefrontCompanyId();
  return (
    <StorefrontCompanyProvider companyId={companyId}>
      {isStorefrontCsrEnabled() ? (
        <StorefrontShellCsr>{children}</StorefrontShellCsr>
      ) : (
        <StorefrontShell>{children}</StorefrontShell>
      )}
    </StorefrontCompanyProvider>
  );
}
