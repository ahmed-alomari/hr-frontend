'use client';

import * as React from 'react';
import {
  ArrowLeftRight,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  PackageMinus,
  PackagePlus,
  Redo2,
  RefreshCw,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Undo2,
} from 'lucide-react';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { useWarehouseOperations } from '@/features/inventory/admin/operations/hooks/use-warehouse-operations';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { WarehouseOperationDetailDialog } from '@/features/inventory/admin/operations/components/warehouse-operation-detail-dialog';
import { REPLENISHMENT_SOURCE_DOCUMENT } from '@/features/catalog/products/constants/replenishment';
import { WAREHOUSE_OPERATION_KIND_META } from '@/features/inventory/domain/constants/warehouse-operation-kinds';
import { WAREHOUSE_OPERATION_STATUS_LABELS_AR } from '@/features/inventory/domain/constants/warehouse-operation-status';
import type { WarehouseOperation, WarehouseOperationKind } from '@/features/inventory/domain/types/warehouse';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  dialogShellBodyClass,
  dialogShellContentClass,
  dialogShellHeaderClass,
} from '@/components/ui/dialog';
import { cn, formatDateTime } from '@/shared/utils';
import {
  QuantityChip,
  WarehouseChip,
  WarehouseRouteChips,
} from '@/features/inventory/admin/operations/components/inventory-chips';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: WarehouseOperationKind;
  productId: string;
  productNameAr: string;
  onCreateRequest?: () => void;
  /** Bumped on each sidebar click so the list refetches. */
  requestKey?: number;
};

const LIST_ICONS: Record<WarehouseOperationKind, typeof PackagePlus> = {
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

function statusBadgeVariant(status: string): 'subtle' | 'warning' | 'success' | 'destructive' {
  if (status === 'ready') return 'warning';
  if (status === 'done') return 'success';
  if (status === 'cancelled') return 'destructive';
  return 'subtle';
}

export function ProductStockMovesListDialog({
  open,
  onOpenChange,
  kind,
  productId,
  productNameAr,
  onCreateRequest,
  requestKey = 0,
}: Props) {
  const companyId = getStorefrontCompanyId();
  const [selected, setSelected] = React.useState<WarehouseOperation | null>(null);

  // One dedicated list call per kind (receipt | issue | internal | …).
  const { data, isLoading, isFetching } = useWarehouseOperations(
    { companyId, productId, kind, limit: 100 },
    { enabled: open, refetchOnOpen: true, refreshKey: requestKey },
  );
  const { data: warehousesData } = useWarehouses({ companyId, limit: 100 }, { enabled: open });
  const warehouseName = React.useMemo(() => {
    const map = new Map((warehousesData?.items ?? []).map((item) => [item.id, item.nameAr]));
    return (id: string) => map.get(id) ?? id;
  }, [warehousesData?.items]);

  const items = React.useMemo(() => {
    const raw = data?.items ?? [];
    // Keep «الإدخالات» free of replenishment docs (those live under تجديد المخزون).
    if (kind === 'receipt') {
      return raw.filter(
        (op) =>
          op.kind === 'receipt' &&
          !(op.sourceDocument?.includes('تجديد') || op.sourceDocument === REPLENISHMENT_SOURCE_DOCUMENT),
      );
    }
    return raw;
  }, [data?.items, kind]);

  const itemsSorted = React.useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      ),
    [items],
  );

  React.useEffect(() => {
    if (!selected) return;
    const fresh = itemsSorted.find((item) => item.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [itemsSorted, selected?.id]);

  React.useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  const meta = WAREHOUSE_OPERATION_KIND_META[kind];
  const Icon = LIST_ICONS[kind] ?? PackagePlus;
  const busy = isLoading || (isFetching && itemsSorted.length === 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(dialogShellContentClass, 'max-w-2xl sm:max-w-2xl')}>
          <div className={dialogShellHeaderClass}>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Icon className="h-4 w-4 text-primary" />
              {meta.labelAr} · {productNameAr}
            </DialogTitle>
          </div>

          <div className={cn(dialogShellBodyClass, 'space-y-3')}>
            <p className="text-xs text-muted-foreground">
              طلبات «{meta.labelAr}» المرتبطة بهذا المنتج.
            </p>

            {busy ? (
              <p className="text-sm text-muted-foreground">جاري التحميل…</p>
            ) : itemsSorted.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                لا توجد طلبات بعد لهذا المنتج.
              </p>
            ) : (
              <ul className="space-y-2">
                {itemsSorted.map((op) => {
                  const qty = op.lines
                    .filter((line) => line.productId === productId)
                    .reduce((sum, line) => sum + line.quantity, 0);
                  return (
                    <li key={op.id}>
                      <button
                        type="button"
                        className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-start transition-colors hover:bg-muted/25"
                        onClick={() => setSelected(op)}
                      >
                        <div className="min-w-0 space-y-1.5">
                          <p className="font-medium text-foreground" dir="ltr">
                            {op.reference}
                          </p>
                          <div className="flex flex-wrap items-center gap-1">
                            {op.destinationWarehouseId &&
                            op.destinationWarehouseId !== op.warehouseId ? (
                              <WarehouseRouteChips
                                from={warehouseName(op.warehouseId)}
                                to={warehouseName(op.destinationWarehouseId)}
                              />
                            ) : (
                              <WarehouseChip name={warehouseName(op.warehouseId)} />
                            )}
                            <QuantityChip value={qty} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(op.occurredAt)}
                          </p>
                        </div>
                        <Badge variant={statusBadgeVariant(op.status)}>
                          {WAREHOUSE_OPERATION_STATUS_LABELS_AR[op.status] ?? op.status}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border px-6 py-4 sm:justify-start">
            {onCreateRequest ? (
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onCreateRequest();
                }}
              >
                {meta.createLabel}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WarehouseOperationDetailDialog
        open={Boolean(selected)}
        onOpenChange={(next) => {
          if (!next) setSelected(null);
        }}
        operation={selected}
      />
    </>
  );
}
