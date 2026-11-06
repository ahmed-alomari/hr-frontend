import type {
  PurchaseOrderReceiptState,
  WarehouseOperationKind,
  WarehouseOperationStatus,
} from '@/features/inventory/domain/types/warehouse';
import { WAREHOUSE_OPERATION_KIND_META } from '@/features/inventory/domain/constants/warehouse-operation-kinds';

export const WAREHOUSE_OPERATION_STATUS_LABELS_AR: Record<WarehouseOperationStatus, string> = {
  draft: 'مسودة',
  ready: 'جاهز',
  done: 'منتهي',
  cancelled: 'ملغى',
};

/** A confirmed purchase order's receiving progress. */
export const PURCHASE_ORDER_RECEIPT_STATE_LABELS_AR: Record<PurchaseOrderReceiptState, string> = {
  pending: 'بانتظار الاستلام',
  partial: 'مستلم جزئياً',
  received: 'مستلم بالكامل',
  closed: 'أُغلق المتبقي',
};

export const PURCHASE_ORDER_RECEIPT_STATE_BADGE: Record<
  PurchaseOrderReceiptState,
  'subtle' | 'warning' | 'success' | 'outline'
> = {
  pending: 'subtle',
  partial: 'warning',
  received: 'success',
  closed: 'outline',
};

/** A replenishment request is decided by its purchase order: confirmed accepts it, cancelled rejects it. */
export type ReplenishmentRequestDecision = 'pending' | 'accepted' | 'rejected';

export function replenishmentRequestDecision(status: WarehouseOperationStatus): ReplenishmentRequestDecision {
  if (status === 'done') return 'accepted';
  if (status === 'cancelled') return 'rejected';
  return 'pending';
}

export const REPLENISHMENT_REQUEST_DECISION_LABELS_AR: Record<ReplenishmentRequestDecision, string> = {
  pending: 'بانتظار القرار',
  accepted: 'مقبول',
  rejected: 'مرفوض',
};

export const REPLENISHMENT_REQUEST_DECISION_BADGE: Record<
  ReplenishmentRequestDecision,
  'warning' | 'success' | 'destructive'
> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'destructive',
};

/** Status filter of the replenishment requests list (one server status each). */
export const REPLENISHMENT_REQUEST_STATUS_LABELS_AR: Record<WarehouseOperationStatus, string> = {
  draft: 'بانتظار القرار (مسودة)',
  ready: 'بانتظار القرار (جاهز)',
  done: 'مقبول',
  cancelled: 'مرفوض',
};

/** Workflow steps shown in the picking header (excludes cancelled). */
export const WAREHOUSE_OPERATION_FLOW_STEPS: WarehouseOperationStatus[] = ['draft', 'ready', 'done'];

export const WAREHOUSE_OPERATION_KIND_LABELS_AR: Record<WarehouseOperationKind, string> = {
  transfer: WAREHOUSE_OPERATION_KIND_META.transfer.labelAr,
  receipt: WAREHOUSE_OPERATION_KIND_META.receipt.labelAr,
  issue: WAREHOUSE_OPERATION_KIND_META.issue.labelAr,
  internal: WAREHOUSE_OPERATION_KIND_META.internal.labelAr,
  adjustment: WAREHOUSE_OPERATION_KIND_META.adjustment.labelAr,
  physical_count: WAREHOUSE_OPERATION_KIND_META.physical_count.labelAr,
  scrap: WAREHOUSE_OPERATION_KIND_META.scrap.labelAr,
  purchase: WAREHOUSE_OPERATION_KIND_META.purchase.labelAr,
  purchase_order: WAREHOUSE_OPERATION_KIND_META.purchase_order.labelAr,
  replenishment: WAREHOUSE_OPERATION_KIND_META.replenishment.labelAr,
  opening: WAREHOUSE_OPERATION_KIND_META.opening.labelAr,
  customer_return: WAREHOUSE_OPERATION_KIND_META.customer_return.labelAr,
  supplier_return: WAREHOUSE_OPERATION_KIND_META.supplier_return.labelAr,
};
