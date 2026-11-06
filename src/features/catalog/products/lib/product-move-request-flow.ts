import type { ProductRelatedDocKey } from '@/features/catalog/products/components/product-related-docs-bar';
import type { WarehouseOperationKind } from '@/features/inventory/domain/types/warehouse';

export type ProductMovesListKind = Extract<WarehouseOperationKind, 'receipt' | 'issue' | 'internal'>;

/** Sidebar key for a stock-move request form opened from product related docs. */
export function productMoveRequestRelatedDoc(
  kind: WarehouseOperationKind,
): ProductRelatedDocKey | null {
  switch (kind) {
    case 'purchase_order':
    case 'replenishment':
      return 'replenish';
    case 'receipt':
      return 'receipts';
    case 'issue':
      return 'issues';
    case 'internal':
      return 'internals';
    default:
      return null;
  }
}

export function isProductMovesListKind(kind: WarehouseOperationKind): kind is ProductMovesListKind {
  return kind === 'receipt' || kind === 'issue' || kind === 'internal';
}

/** Re-open the parent list dialog after closing a move-request form (save or cancel). */
export function productMoveRequestListRestore(kind: WarehouseOperationKind): {
  relatedDoc: ProductRelatedDocKey | null;
  openReplenishmentList: boolean;
  movesListKind: ProductMovesListKind | null;
} {
  const relatedDoc = productMoveRequestRelatedDoc(kind);
  if (kind === 'purchase_order' || kind === 'replenishment') {
    return { relatedDoc, openReplenishmentList: true, movesListKind: null };
  }
  if (isProductMovesListKind(kind)) {
    return { relatedDoc, openReplenishmentList: false, movesListKind: kind };
  }
  return { relatedDoc: null, openReplenishmentList: false, movesListKind: null };
}
