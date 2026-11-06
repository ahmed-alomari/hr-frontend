import { WAREHOUSE_OPERATION_KIND_META } from '@/features/inventory/domain/constants/warehouse-operation-kinds';
import type { WarehouseOperationKind, WarehouseOperationLine } from '@/features/inventory/domain/types/warehouse';

export type OperationLineDraft = {
  id: string;
  productId: string;
  productName: string;
  /** Parent product title — kept when a variant row changes display name. */
  catalogProductName?: string;
  sku?: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  productUomLineId?: string;
  uomLineName?: string;
  /** تكلفة الوحدة عند الإدخال — فقط للأنواع الواردة (انظر lineNeedsUnitCost). */
  unitCost?: string;
  expiryDate?: string;
  /** One serial per piece, separated by commas or new lines. */
  serialText?: string;
};

export function supportsMultiProductLines(kind: WarehouseOperationKind): boolean {
  return (
    kind === 'transfer' ||
    kind === 'receipt' ||
    kind === 'issue' ||
    kind === 'internal' ||
    kind === 'purchase' ||
    kind === 'purchase_order' ||
    kind === 'replenishment' ||
    kind === 'opening' ||
    kind === 'customer_return' ||
    kind === 'supplier_return'
  );
}

/**
 * تكلفة الوحدة تُطلب فقط للعمليات الواردة (شراء/استلام/تجديد) — الـbackend
 * يتجاهلها في التحويل والصادر (التكلفة تُشتق من الدفعة المصدر أو محرك
 * التكلفة، وليس من إدخال العميل). استخدم stockEffect بدل مطابقة kind مباشرة
 * كي يبقى هذا متسقًا مع WAREHOUSE_OPERATION_KIND_META.
 * مرتجع العميل وارد لكن تكلفته تكلفة البيع الأصلي (يحددها الخادم من المستند المصدر).
 */
/** Expiry and serials are stored on the batch the receipt creates. */
export function lineCapturesLot(kind: WarehouseOperationKind): boolean {
  return (
    kind === 'receipt' ||
    kind === 'purchase' ||
    kind === 'replenishment' ||
    kind === 'opening'
  );
}

/** A purchase order sets the price its receipts take, so it asks for it too. */
export function lineNeedsUnitCost(kind: WarehouseOperationKind): boolean {
  if (kind === 'purchase_order') return true;
  return WAREHOUSE_OPERATION_KIND_META[kind].stockEffect === 'inbound' && kind !== 'customer_return';
}

/** Outbound pickers: only products with on-hand at the source location. */
export function pickerUsesSourceLocationStock(kind: WarehouseOperationKind): boolean {
  return (
    kind === 'transfer' ||
    kind === 'internal' ||
    kind === 'issue' ||
    kind === 'scrap' ||
    kind === 'supplier_return'
  );
}

export function newOperationLineDraftId(): string {
  return `opl-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyOperationLineDraft(): OperationLineDraft {
  return {
    id: newOperationLineDraftId(),
    productId: '',
    productName: '',
    sku: '',
    quantity: 0,
    unitCost: '',
  };
}

export function operationLineDraftKey(
  line: Pick<OperationLineDraft, 'productId' | 'variantId'>,
): string {
  return `${line.productId.trim()}|${line.variantId?.trim() ?? ''}`;
}

export function hasDuplicateOperationLineProducts(lines: OperationLineDraft[]): boolean {
  const keys = lines
    .filter((line) => line.productId.trim())
    .map((line) => operationLineDraftKey(line));
  return new Set(keys).size !== keys.length;
}

export function operationLineDraftsToLines(
  drafts: OperationLineDraft[],
  locations: { fromLocationId?: string; toLocationId?: string },
  options?: { includeUnitCost?: boolean },
): WarehouseOperationLine[] {
  const includeUnitCost = options?.includeUnitCost ?? false;
  return drafts
    .filter((line) => line.productId.trim() && line.quantity > 0)
    .map((line) => ({
      id: line.id,
      productId: line.productId.trim(),
      variantId: line.variantId?.trim() || undefined,
      productName: line.productName.trim() || 'منتج',
      sku: line.sku?.trim() || undefined,
      demandQuantity: line.quantity,
      quantity: line.quantity,
      productUomLineId: line.productUomLineId?.trim() || undefined,
      fromLocationId: locations.fromLocationId,
      toLocationId: locations.toLocationId,
      // Never send unitCost for outbound/transfer/move kinds — the backend
      // ignores it there anyway, and this keeps the payload honest about
      // what the client actually controls (cost is derived, not client-set).
      unitCost: includeUnitCost ? line.unitCost?.trim() || undefined : undefined,
      expiryDate: line.expiryDate?.trim() || undefined,
      serialNumbers: line.serialText?.trim()
        ? JSON.stringify(
            line.serialText
              .split(/[\n,]+/)
              .map((item) => item.trim())
              .filter(Boolean),
          )
        : undefined,
    }));
}

export function serialsToText(raw?: string | null): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String).join('\n');
  } catch {
    /* already plain text */
  }
  return raw;
}

export function operationLinesToDrafts(lines: WarehouseOperationLine[]): OperationLineDraft[] {
  if (lines.length === 0) return [emptyOperationLineDraft()];
  return lines.map((line) => ({
    id: line.id,
    productId: line.productId,
    productName: line.productName,
    sku: line.sku,
    variantId: line.variantId ?? undefined,
    variantName: line.variantId ? line.productName : undefined,
    quantity: line.uomEnteredQuantity ?? line.quantity,
    productUomLineId: line.productUomLineId ?? undefined,
    unitCost: line.unitCost ?? '',
    expiryDate: line.expiryDate ? line.expiryDate.slice(0, 10) : '',
    serialText: serialsToText(line.serialNumbers),
  }));
}
