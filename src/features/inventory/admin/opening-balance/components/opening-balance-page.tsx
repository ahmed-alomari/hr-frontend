'use client';

import * as React from 'react';
import Link from 'next/link';
import { FileSpreadsheet, Info, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InventoryOperationKindPage } from '@/features/inventory/admin/operations/components/inventory-operation-kind-page';
import { OpeningBalanceImportDialog } from '@/features/inventory/admin/opening-balance/components/opening-balance-import-dialog';
import { OpeningFromProductsDialog } from '@/features/inventory/admin/opening-balance/components/opening-from-products-dialog';
import { useInventoryCompanySettings } from '@/features/inventory/admin/notifications/hooks/use-inventory-settings';

export function OpeningBalancePage() {
  const [importOpen, setImportOpen] = React.useState(false);
  const [fromProductsOpen, setFromProductsOpen] = React.useState(false);
  const settings = useInventoryCompanySettings();
  const importButton = React.useMemo(
    () => (
      <>
        {/* §21.2: the quantities the products app holds, at their purchase price. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="الرصيد الافتتاحي من كميات المنتجات"
          title="الرصيد الافتتاحي من كميات المنتجات"
          onClick={() => setFromProductsOpen(true)}
        >
          <Package className="size-4" />
          <span className="hidden sm:inline">من كميات المنتجات</span>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <FileSpreadsheet className="size-4" />
          <span className="hidden sm:inline">استيراد من Excel</span>
        </Button>
      </>
    ),
    [],
  );

  // The opening balance should enter with its cost: costing is decided first.
  const costingOff =
    settings.data?.costingStatus === 'disabled' && settings.data.costingLocked !== true;

  return (
    <>
      {costingOff ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            احتساب التكلفة غير مفعّل. إن كانت الشركة ستتابع قيمة المخزون وتكلفة المبيعات، فعّل التكلفة واختر الطريقة من{' '}
            <Link href="/inventory/settings" className="font-medium text-primary underline-offset-4 hover:underline">
              إعدادات المخازن
            </Link>{' '}
            <b>قبل</b> إدخال الرصيد الافتتاحي، حتى يدخل الرصيد بتكلفته.
          </p>
        </div>
      ) : null}
      <InventoryOperationKindPage kind="opening" headerExtra={importButton} />
      <OpeningBalanceImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <OpeningFromProductsDialog open={fromProductsOpen} onOpenChange={setFromProductsOpen} />
    </>
  );
}
