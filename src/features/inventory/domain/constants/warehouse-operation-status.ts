import type {
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
