'use client';

import { SetPageTitle } from '@/components/layouts/set-page-title';
import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeftRight,
  ArrowRight,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  MapPin,
  Redo2,
  Undo2,
  PackageMinus,
  PackagePlus,
  RefreshCw,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { useWarehouse } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { WarehouseOperationsPanel } from '@/features/inventory/admin/operations/components/warehouse-operations-panel';
import { LocationsListPage } from '@/features/inventory/admin/locations/components/locations-list-page';
import { inventoryAdminRoutes } from '@/features/inventory/admin/constants/routes';
import {
  isWarehouseOperationKind,
  WAREHOUSE_DETAIL_TAB_KINDS,
  WAREHOUSE_OPERATION_KIND_META,
} from '@/features/inventory/domain/constants/warehouse-operation-kinds';
import type { WarehouseOperationKind } from '@/features/inventory/domain/types/warehouse';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/utils';

type WarehouseDetailTab = WarehouseOperationKind | 'locations';

function isWarehouseDetailTab(value: string | null): value is WarehouseDetailTab {
  if (value === 'locations') return true;
  return isWarehouseOperationKind(value) && WAREHOUSE_DETAIL_TAB_KINDS.includes(value);
}

const TAB_ICONS: Record<WarehouseOperationKind, React.ComponentType<{ className?: string }>> = {
  transfer: Truck,
  receipt: PackagePlus,
  issue: PackageMinus,
  internal: ArrowLeftRight,
  adjustment: SlidersHorizontal,
  physical_count: ClipboardList,
  scrap: Factory,
  purchase: ShoppingCart,
  purchase_order: ClipboardList,
  replenishment: RefreshCw,
  opening: FileSpreadsheet,
  customer_return: Undo2,
  supplier_return: Redo2,
};

export function WarehouseDetailPage() {
  const companyId = getInventoryCompanyId();
  const router = useRouter();
  const params = useParams<{ warehouseId: string }>();
  const searchParams = useSearchParams();
  const warehouseId = params.warehouseId;

  const tabParam = searchParams.get('tab');
  const activeTab: WarehouseDetailTab = isWarehouseDetailTab(tabParam) ? tabParam : 'receipt';

  const { data: warehouse, isLoading, isError } = useWarehouse(companyId, warehouseId);

  const setTab = (tab: WarehouseDetailTab) => {
    router.replace(`${inventoryAdminRoutes.warehouseDetail(warehouseId)}?tab=${tab}`, { scroll: false });
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">جاري تحميل المستودع…</p>;
  }

  if (isError || !warehouse) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">تعذر العثور على المستودع.</p>
        <Button variant="outline" onClick={() => router.push(inventoryAdminRoutes.warehouses)}>
          العودة للمخازن
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle titleAr={warehouse.nameAr} iconName="Warehouse" />

      <div className="flex flex-col gap-4 rounded-2xl bg-linear-to-br from-primary to-primary-700 p-4 text-primary-foreground shadow-elevated sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <WarehouseIcon className="h-6 w-6" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-display text-base font-bold leading-tight">{warehouse.nameAr}</span>
              <span
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                  warehouse.status === 'active'
                    ? 'border-emerald-300/30 bg-emerald-400/20 text-emerald-50'
                    : 'border-white/15 bg-white/10 text-white/75',
                )}
              >
                {warehouse.status === 'active' ? 'نشط' : 'غير نشط'}
              </span>
            </div>
            <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-white/80">
              <span dir="ltr" className="font-semibold">{warehouse.code}</span>
              {warehouse.address ? <span className="truncate">· {warehouse.address}</span> : null}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="bg-white/15 text-white hover:bg-white/25"
            onClick={() => router.push(inventoryAdminRoutes.warehouses)}
          >
            <ArrowRight className="h-4 w-4" />
            كل المستودعات
          </Button>
        </div>
      </div>

      <div className="inv-tabs-scroll">
        <button
          type="button"
          onClick={() => setTab('locations')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-t-lg px-2.5 py-2 text-xs sm:text-sm transition-colors',
            activeTab === 'locations'
              ? 'border-b-2 border-primary font-semibold text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          المواقع
        </button>
        {WAREHOUSE_DETAIL_TAB_KINDS.map((kind) => {
          const Icon = TAB_ICONS[kind];
          const selected = activeTab === kind;
          const both = WAREHOUSE_OPERATION_KIND_META[kind].uiPlacement === 'both';
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setTab(kind)}
              title={both ? 'متاح أيضًا من قائمة عمليات المخزون' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-t-lg px-2.5 py-2 text-xs sm:text-sm transition-colors',
                selected
                  ? 'border-b-2 border-primary font-semibold text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {WAREHOUSE_OPERATION_KIND_META[kind].labelAr}
            </button>
          );
        })}
      </div>

      {activeTab === 'locations' ? (
        <LocationsListPage embeddedWarehouseId={warehouseId} />
      ) : (
        <WarehouseOperationsPanel warehouseId={warehouseId} kind={activeTab} />
      )}
    </div>
  );
}
