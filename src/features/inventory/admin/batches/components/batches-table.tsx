'use client';

import type { ListToolsModel } from '@/components/ui/list-tools';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import {
  LocationChip,
  WarehouseChip,
} from '@/features/inventory/admin/operations/components/inventory-chips';
import {
  BATCH_EXPIRY_LABEL_AR,
  batchExpiryState,
  type BatchExpiryState,
} from '@/features/inventory/admin/batches/lib/batch-expiry';
import { WAREHOUSE_OPERATION_KIND_META } from '@/features/inventory/domain/constants/warehouse-operation-kinds';
import type { InventoryBatch } from '@/features/inventory/domain/types/inventory-batch';
import { formatDisplayDate, formatMoneyDigits } from '@/shared/utils';

const EXPIRY_BADGE_VARIANT: Record<BatchExpiryState, 'subtle' | 'destructive' | 'warning' | 'success'> = {
  none: 'subtle',
  expired: 'destructive',
  soon: 'warning',
  ok: 'success',
};

/** Quantities are decimals; trim the trailing zeros the backend pads them with. */
function qty(value: number): string {
  return formatMoneyDigits(value, Number.isInteger(value) ? 0 : 2);
}

function ExpiryCell({ batch }: { batch: InventoryBatch }) {
  const state = batchExpiryState(batch.expiryDate);
  if (state === 'none') {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm whitespace-nowrap" dir="ltr">
        {formatDisplayDate(batch.expiryDate)}
      </span>
      <Badge variant={EXPIRY_BADGE_VARIANT[state]} className="w-fit text-[11px]">
        {BATCH_EXPIRY_LABEL_AR[state]}
      </Badge>
    </div>
  );
}

/** Where the layer came from: an operation reference, a transfer, or opening stock. */
function OriginCell({ batch }: { batch: InventoryBatch }) {
  if (batch.isOpening) {
    return <Badge variant="subtle">رصيد افتتاحي</Badge>;
  }
  if (!batch.sourceOperationReference) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col">
      <span className="font-medium" dir="ltr">
        {batch.sourceOperationReference}
      </span>
      <span className="text-xs text-muted-foreground">
        {batch.sourceOperationKind
          ? WAREHOUSE_OPERATION_KIND_META[batch.sourceOperationKind].labelAr
          : batch.sourceBatchId
            ? 'دفعة محوّلة'
            : '—'}
      </span>
    </div>
  );
}

type Props = {
  rows: InventoryBatch[];
  loading?: boolean;
  emptyText?: string;
  /** Hide inside a single product's context, where the column is redundant. */
  hideProduct?: boolean;
  onRowClick?(batch: InventoryBatch): void;
  /** The screen's own columns and sort, from its list tools. */
  columns?: ColumnDef<InventoryBatch>[];
  tableSort?: ListToolsModel<InventoryBatch>['tableSort'];
};

export function batchColumns(hideProduct?: boolean): ColumnDef<InventoryBatch>[] {
    const all: (ColumnDef<InventoryBatch> | null)[] = [
      {
        key: 'occurredAt',
        title: 'تاريخ الدخول',
        render: (row) => (
          <span className="text-sm whitespace-nowrap" dir="ltr">
            {formatDisplayDate(row.occurredAt)}
          </span>
        ),
      },
      hideProduct
        ? null
        : {
            key: 'product',
            title: 'المنتج',
            render: (row) => (
              <div className="flex flex-col">
                <span className="font-medium">{row.productName}</span>
                <span className="text-xs text-muted-foreground" dir="ltr">
                  {row.variantSku || row.sku || '—'}
                </span>
              </div>
            ),
          },
      {
        key: 'variant',
        title: 'المتغير',
        hideOnMobile: true,
        render: (row) =>
          row.variantId ? (
            <span className="text-sm">{row.variantName || row.variantSku}</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        key: 'warehouse',
        title: 'المستودع',
        render: (row) => <WarehouseChip name={row.warehouseName} />,
      },
      {
        key: 'location',
        title: 'الموقع',
        hideOnMobile: true,
        render: (row) => <LocationChip name={row.locationName || row.locationCode} />,
      },
      {
        key: 'quantity',
        title: 'الكمية الأصلية',
        hideOnMobile: true,
        render: (row) => (
          <span className="text-sm tabular-nums" dir="ltr">
            {qty(row.quantity)}
          </span>
        ),
      },
      {
        key: 'consumed',
        title: 'المصروف',
        hideOnMobile: true,
        render: (row) => (
          <span className="text-sm tabular-nums text-muted-foreground" dir="ltr">
            {qty(row.consumedQuantity)}
          </span>
        ),
      },
      {
        key: 'remaining',
        title: 'المتبقي',
        render: (row) => (
          <span
            className={
              row.isAvailable
                ? 'font-semibold tabular-nums text-emerald-700 dark:text-emerald-400'
                : 'font-semibold tabular-nums text-muted-foreground'
            }
            dir="ltr"
          >
            {qty(row.remainingQuantity)}
          </span>
        ),
      },
      {
        key: 'expiry',
        title: 'الصلاحية',
        render: (row) => <ExpiryCell batch={row} />,
      },
      {
        key: 'origin',
        title: 'المصدر',
        hideOnMobile: true,
        render: (row) => <OriginCell batch={row} />,
      },
    ];
    return all.filter((column): column is ColumnDef<InventoryBatch> => column !== null);
}

export function BatchesTable({ rows, loading, emptyText, hideProduct, onRowClick, columns: givenColumns, tableSort }: Props) {
  const columns = React.useMemo(() => givenColumns ?? batchColumns(hideProduct), [givenColumns, hideProduct]);

  return (
    <DataTable
      variant="directory"
      className="inv-table-host"
      columns={columns}
      {...tableSort}
      data={rows}
      keyExtractor={(row) => row.id}
      loading={loading}
      emptyText={emptyText ?? 'لا توجد دفعات — تُنشأ الدفعات تلقائيًا عند ترحيل استلام أو تحويل.'}
      onRowClick={onRowClick}
      mobileCard={(row) => (
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              {hideProduct ? null : <span className="font-medium">{row.productName}</span>}
              <span className="text-xs text-muted-foreground" dir="ltr">
                {formatDisplayDate(row.occurredAt)}
              </span>
            </div>
            <span
              className={
                row.isAvailable
                  ? 'font-semibold tabular-nums text-emerald-700 dark:text-emerald-400'
                  : 'font-semibold tabular-nums text-muted-foreground'
              }
              dir="ltr"
            >
              {qty(row.remainingQuantity)} / {qty(row.quantity)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <WarehouseChip name={row.warehouseName} />
            <LocationChip name={row.locationName || row.locationCode} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <ExpiryCell batch={row} />
            <OriginCell batch={row} />
          </div>
        </div>
      )}
    />
  );
}
