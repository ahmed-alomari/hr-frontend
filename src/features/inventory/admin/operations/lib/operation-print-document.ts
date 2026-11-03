import { WAREHOUSE_OPERATION_KIND_META } from '@/features/inventory/domain/constants/warehouse-operation-kinds';
import {
  WAREHOUSE_OPERATION_KIND_LABELS_AR,
  WAREHOUSE_OPERATION_STATUS_LABELS_AR,
} from '@/features/inventory/domain/constants/warehouse-operation-status';
import type {
  WarehouseOperation,
  WarehouseOperationKind,
  WarehouseOperationLine,
} from '@/features/inventory/domain/types/warehouse';
import type {
  PrintableDocument,
  PrintDocumentType,
} from '@/features/print-templates/domain/types';

/**
 * Inventory documents printed with the company templates (approved
 * 2026-10-09): what goes in comes out as a receipt, what goes out as a
 * delivery, moves between places as a transfer. Adjustments and counts use
 * the receipt template under their own title.
 */
export function operationPrintDocumentType(kind: WarehouseOperationKind): PrintDocumentType {
  const effect = WAREHOUSE_OPERATION_KIND_META[kind].stockEffect;
  if (effect === 'outbound') return 'inventory_delivery';
  if (effect === 'transfer' || effect === 'move') return 'inventory_transfer';
  return 'inventory_receipt';
}

const TITLES: Partial<Record<WarehouseOperationKind, string>> = {
  receipt: 'سند استلام',
  purchase: 'سند استلام مشتريات',
  purchase_order: 'أمر شراء',
  replenishment: 'سند تجديد مخزون',
  issue: 'سند صرف',
  scrap: 'سند إتلاف',
  transfer: 'سند تحويل بين المستودعات',
  internal: 'سند نقل داخلي',
  adjustment: 'سند تسوية مخزون',
  physical_count: 'محضر جرد',
  opening: 'سند رصيد افتتاحي',
  customer_return: 'سند مرتجع عميل',
  supplier_return: 'سند مرتجع لمورد',
};

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function buildOperationPrintDocument(input: {
  operation: WarehouseOperation;
  lines: WarehouseOperationLine[];
  warehouseName: string | null;
  destinationWarehouseName: string | null;
  locationName: (id?: string) => string;
}): PrintableDocument {
  const { operation, lines } = input;
  const kind = operation.kind;
  const effect = WAREHOUSE_OPERATION_KIND_META[kind].stockEffect;
  const type = operationPrintDocumentType(kind);
  const done = operation.status === 'done';

  const meta: PrintableDocument['meta'] = [];
  if (effect === 'transfer') {
    meta.push({ label: 'من مستودع', value: input.warehouseName ?? '—' });
    meta.push({ label: 'إلى مستودع', value: input.destinationWarehouseName ?? '—' });
  } else {
    meta.push({ label: 'المستودع', value: input.warehouseName ?? '—' });
  }
  if (operation.partnerName?.trim()) {
    meta.push({
      label: effect === 'inbound' ? 'المورد / المسلِّم' : effect === 'outbound' ? 'المستلم' : 'جهة الاتصال',
      value: operation.partnerName.trim(),
    });
  }
  if (operation.sourceDocument?.trim()) {
    meta.push({ label: 'المستند المصدر', value: operation.sourceDocument.trim() });
  }
  meta.push({ label: 'نوع العملية', value: WAREHOUSE_OPERATION_KIND_LABELS_AR[kind] });
  meta.push({ label: 'الحالة', value: WAREHOUSE_OPERATION_STATUS_LABELS_AR[operation.status] });

  const where = (line: WarehouseOperationLine): string => {
    const from = line.fromLocationId ? input.locationName(line.fromLocationId) : '';
    const to = line.toLocationId ? input.locationName(line.toLocationId) : '';
    if (effect === 'inbound' || effect === 'adjust_set') return to || from;
    if (effect === 'outbound') return from || to;
    return [from, to].filter(Boolean).join(' ← ');
  };

  // Done: what was moved; before that: what is asked for.
  const quantityOf = (line: WarehouseOperationLine) =>
    done || line.quantity > 0 ? line.quantity : line.demandQuantity;
  const total = lines.reduce((sum, line) => sum + quantityOf(line), 0);

  const signatures =
    type === 'inventory_delivery'
      ? ['المستلم', 'أمين المخزن', 'المعتمد']
      : type === 'inventory_transfer'
        ? ['المسلِّم', 'المستلم', 'أمين المخزن']
        : kind === 'physical_count' || kind === 'adjustment'
          ? ['القائم بالجرد', 'أمين المخزن', 'المعتمد']
          : ['المورد / المسلِّم', 'أمين المخزن', 'المعتمد'];

  return {
    title: TITLES[kind] ?? `سند ${WAREHOUSE_OPERATION_KIND_LABELS_AR[kind]}`,
    number: operation.reference,
    issuedAt: formatDate(operation.occurredAt),
    columns: 'stock',
    meta,
    lines: lines.map((line) => ({
      name: line.productName,
      detail: line.sku || undefined,
      quantity: Number(formatQuantity(quantityOf(line))),
      location: where(line),
    })),
    totals: [
      { label: 'عدد الأصناف', value: String(lines.length) },
      { label: 'إجمالي الكميات', value: formatQuantity(total), emphasize: true },
    ],
    payments: [],
    note: operation.notes?.trim() || undefined,
    signatures,
    copyLabel: done ? undefined : `مسودة — الحالة: ${WAREHOUSE_OPERATION_STATUS_LABELS_AR[operation.status]}`,
  };
}
