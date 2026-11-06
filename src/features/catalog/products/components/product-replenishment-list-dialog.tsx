'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { useWarehouseOperations } from '@/features/inventory/admin/operations/hooks/use-warehouse-operations';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { WarehouseOperationDetailDialog } from '@/features/inventory/admin/operations/components/warehouse-operation-detail-dialog';
import {
  PURCHASE_ORDER_RECEIPT_STATE_BADGE,
  PURCHASE_ORDER_RECEIPT_STATE_LABELS_AR,
  WAREHOUSE_OPERATION_KIND_LABELS_AR,
  WAREHOUSE_OPERATION_STATUS_LABELS_AR,
} from '@/features/inventory/domain/constants/warehouse-operation-status';
import { REPLENISHMENT_SOURCE_DOCUMENT } from '@/features/catalog/products/constants/replenishment';
import type { WarehouseOperation } from '@/features/inventory/domain/types/warehouse';
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
} from '@/features/inventory/admin/operations/components/inventory-chips';

export { REPLENISHMENT_SOURCE_DOCUMENT };

export function isReplenishmentOperation(op: WarehouseOperation): boolean {
  if (op.kind === 'purchase_order' || op.kind === 'replenishment') return true;
  if (op.kind !== 'receipt') return false;
  const source = op.sourceDocument?.trim() ?? '';
  const notes = op.notes?.trim() ?? '';
  return source.includes('تجديد') || notes.includes('تجديد مخزون');
}

function useProductReplenishmentOperations(
  companyId: string,
  productId: string,
  enabled: boolean,
  refreshKey = 0,
) {
  // Replenishing is a purchase order now; older requests were kind=replenishment
  // or a receipt tagged via sourceDocument, and stay listed.
  const purchaseOrders = useWarehouseOperations(
    { companyId, productId, kind: 'purchase_order', limit: 100 },
    { enabled, refetchOnOpen: true, refreshKey },
  );
  const replenishment = useWarehouseOperations(
    { companyId, productId, kind: 'replenishment', limit: 100 },
    { enabled, refetchOnOpen: true, refreshKey },
  );
  const receipts = useWarehouseOperations(
    { companyId, productId, kind: 'receipt', limit: 100 },
    { enabled, refetchOnOpen: true, refreshKey },
  );

  const items = React.useMemo(() => {
    const byId = new Map<string, WarehouseOperation>();
    for (const op of [
      ...(purchaseOrders.data?.items ?? []),
      ...(replenishment.data?.items ?? []),
      ...(receipts.data?.items ?? []),
    ]) {
      byId.set(op.id, op);
    }
    return [...byId.values()].filter(isReplenishmentOperation);
  }, [purchaseOrders.data?.items, replenishment.data?.items, receipts.data?.items]);

  return {
    items,
    isLoading: purchaseOrders.isLoading || replenishment.isLoading || receipts.isLoading,
    isFetching: purchaseOrders.isFetching || replenishment.isFetching || receipts.isFetching,
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productNameAr: string;
  onCreateRequest?: () => void;
  /** Bumped on each sidebar click so the list refetches. */
  requestKey?: number;
};

function statusBadgeVariant(
  status: WarehouseOperation['status'],
): 'subtle' | 'warning' | 'success' | 'destructive' {
  if (status === 'ready') return 'warning';
  if (status === 'done') return 'success';
  if (status === 'cancelled') return 'destructive';
  return 'subtle';
}

export function ProductReplenishmentListDialog({
  open,
  onOpenChange,
  productId,
  productNameAr,
  onCreateRequest,
  requestKey = 0,
}: Props) {
  const companyId = getStorefrontCompanyId();
  const [selected, setSelected] = React.useState<WarehouseOperation | null>(null);

  // Replenishment + legacy receipt-tagged requests for this product.
  const { items, isLoading, isFetching } = useProductReplenishmentOperations(
    companyId,
    productId,
    open,
    requestKey,
  );
  const { data: warehousesData } = useWarehouses({ companyId, limit: 100 }, { enabled: open });
  const warehouseName = React.useMemo(() => {
    const map = new Map((warehousesData?.items ?? []).map((item) => [item.id, item.nameAr]));
    return (id: string) => map.get(id) ?? id;
  }, [warehousesData?.items]);

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

  const busy = isLoading || (isFetching && itemsSorted.length === 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(dialogShellContentClass, 'max-w-2xl sm:max-w-2xl')}>
          <div className={dialogShellHeaderClass}>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <RefreshCw className="h-4 w-4 text-primary" />
              تجديد المخزون
            </DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              أوامر الشراء الخاصة بـ «{productNameAr}» وحالة استلامها، مع طلبات التجديد السابقة. الكمية لا
              تدخل المخزون إلا بتصديق سند استلام من أمر الشراء.
            </p>
          </div>

          <div className={cn(dialogShellBodyClass, 'space-y-3')}>
            {busy ? (
              <p className="text-sm text-muted-foreground">جاري التحميل…</p>
            ) : itemsSorted.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                لا توجد أوامر شراء لهذا المنتج بعد. أنشئ أمر شراء ليظهر هنا مع حالة استلامه.
              </p>
            ) : (
              <ul className="space-y-2">
                {itemsSorted.map((op) => {
                  const qty = op.lines
                    .filter((line) => !line.productId || line.productId === productId)
                    .reduce((sum, line) => sum + (line.demandQuantity ?? line.quantity), 0);
                  return (
                    <li key={op.id}>
                      <button
                        type="button"
                        className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-start transition-colors hover:bg-muted/25"
                        onClick={() => setSelected(op)}
                      >
                        <div className="min-w-0 space-y-1.5">
                          <p className="font-medium text-foreground" dir="ltr">
                            {op.reference || 'بدون مرجع'}
                          </p>
                          <div className="flex flex-wrap items-center gap-1">
                            <WarehouseChip name={warehouseName(op.warehouseId)} />
                            <QuantityChip value={qty} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(op.occurredAt)}
                          </p>
                          {op.sourceDocument ? (
                            <p className="text-xs text-muted-foreground">{op.sourceDocument}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline">{WAREHOUSE_OPERATION_KIND_LABELS_AR[op.kind]}</Badge>
                          <Badge variant={statusBadgeVariant(op.status)}>
                            {WAREHOUSE_OPERATION_STATUS_LABELS_AR[op.status]}
                          </Badge>
                          {op.receiptState ? (
                            <Badge variant={PURCHASE_ORDER_RECEIPT_STATE_BADGE[op.receiptState]}>
                              {PURCHASE_ORDER_RECEIPT_STATE_LABELS_AR[op.receiptState]}
                            </Badge>
                          ) : null}
                        </div>
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
                أمر شراء جديد
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
