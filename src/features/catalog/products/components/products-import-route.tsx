'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { StoreImportPage } from '@/features/ecommerce/admin/import/components/store-import-page';
import { useProductsBasePath } from '@/features/catalog/products/lib/products-navigation';
import { APP, useCompanyApps } from '@/shared/modules/company-apps';

/** Product import mounted inside catalog / inventory / POS; its API belongs to store-admin. */
export function ProductsImportRoute() {
  const apps = useCompanyApps();
  const router = useRouter();
  const basePath = useProductsBasePath();
  const enabled = apps.isEnabled(APP.storeAdmin);

  React.useEffect(() => {
    if (apps.ready && !enabled) router.replace(basePath);
  }, [apps.ready, enabled, basePath, router]);

  if (!enabled) return null;
  return <StoreImportPage />;
}
