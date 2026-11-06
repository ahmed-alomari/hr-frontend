import type { ListColumnOption } from '@/components/ui/list-columns-picker';
import { dateListGroupOptions, type ListGroupOption } from '@/components/ui/list-group';
import type { ListSortOption } from '@/components/ui/list-sort';
import type { RegisterExportColumn } from '@/components/pdf/lib/register-export-rows';
import {
  PURCHASE_ORDER_RECEIPT_STATE_LABELS_AR,
  WAREHOUSE_OPERATION_STATUS_LABELS_AR,
} from '@/features/inventory/domain/constants/warehouse-operation-status';
import type { WarehouseOperation, WarehouseOperationStatus } from '@/features/inventory/domain/types/warehouse';
import { formatDateTime } from '@/shared/utils';

/**
 * The warehouse operations lists' sort, grouping and columns (list-screens
 * skill) — one definition for every kind (receipts, deliveries, transfers…).
 * Keys are the server's (`OPERATIONS_SORT` / `OPERATIONS_GROUP`).
 */
export function operationsSortOptions(partnerLabel: string): readonly ListSortOption[] {
  return [
    { key: 'occurredAt', label: 'التاريخ' },
    { key: 'reference', label: 'المرجع' },
    { key: 'partner', label: partnerLabel },
    { key: 'warehouse', label: 'المستودع' },
    { key: 'status', label: 'الحالة' },
  ];
}

export function operationsGroupOptions(opts: {
  partnerLabel: string;
  hasDestination: boolean;
}): readonly ListGroupOption[] {
  return [
    {
      key: 'status',
      label: 'الحالة',
      formatKey: (k) => WAREHOUSE_OPERATION_STATUS_LABELS_AR[k as WarehouseOperationStatus] ?? k,
    },
    { key: 'warehouse', label: 'المستودع' },
    ...(opts.hasDestination ? [{ key: 'destinationWarehouse', label: 'المستودع الوجهة', emptyLabel: 'بدون وجهة' }] : []),
    { key: 'partner', label: opts.partnerLabel, emptyLabel: 'غير محدد' },
    ...dateListGroupOptions(),
  ];
}

/** Columns the user may hide (the reference, the quantity and the status always show). */
export const OPERATIONS_COLUMN_OPTIONS: readonly ListColumnOption[] = [
  { key: 'warehouse', label: 'المستودع' },
  { key: 'partner', label: 'الجهة' },
  { key: 'lines', label: 'البنود' },
  { key: 'locations', label: 'المواقع' },
];

/** The printed / Excel register of operations; `key` ties a column to the screen's. */
export function operationsExportColumns(opts: {
  partnerLabel: string;
  warehouseName: (id: string | undefined) => string;
  /** Purchase orders: their receiving progress. */
  receiptState?: boolean;
}): RegisterExportColumn<WarehouseOperation>[] {
  return [
    { label: 'المرجع', kind: 'code', value: (o) => o.reference || '' },
    { label: 'التاريخ', kind: 'date', value: (o) => formatDateTime(o.occurredAt) },
    {
      key: 'warehouse',
      label: 'المستودع',
      kind: 'text',
      value: (o) =>
        o.destinationWarehouseId && o.destinationWarehouseId !== o.warehouseId
          ? `${opts.warehouseName(o.warehouseId)} ← ${opts.warehouseName(o.destinationWarehouseId)}`
          : opts.warehouseName(o.warehouseId),
    },
    { key: 'partner', label: opts.partnerLabel, kind: 'name', value: (o) => o.partnerName ?? '' },
    { key: 'partner', label: 'المستند', kind: 'code', value: (o) => o.sourceDocument ?? '' },
    {
      key: 'lines',
      label: 'البنود',
      kind: 'text',
      value: (o) => o.lines.map((line) => `${line.productName} × ${line.quantity}`).join('، '),
    },
    {
      label: 'الكمية',
      kind: 'number',
      value: (o) => String(o.totalQuantity ?? o.lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0)),
    },
    {
      label: 'الحالة',
      kind: 'status',
      value: (o) => WAREHOUSE_OPERATION_STATUS_LABELS_AR[o.status] ?? o.status,
    },
    ...(opts.receiptState
      ? [
          {
            label: 'الاستلام',
            kind: 'status' as const,
            value: (o: WarehouseOperation) =>
              o.receiptState ? PURCHASE_ORDER_RECEIPT_STATE_LABELS_AR[o.receiptState] : '',
          },
        ]
      : []),
  ];
}
