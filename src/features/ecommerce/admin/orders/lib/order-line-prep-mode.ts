import type { OrderStockSource } from '@/features/ecommerce/domain/types/order';

/**
 * How a store order line is prepared, decided by the ORDER (its stock source
 * is fixed when it is placed), never by today's company settings: an order
 * placed while the store was not linked to inventory keeps selling from the
 * store's own quantity even if the link is switched on later, and the other
 * way round.
 *
 * - `inventory`: prepared from the store warehouse's locations (allocation).
 * - `local`: taken from the store's own quantity when placed; no allocation.
 * - `none`: no stock effect (staff decision); no allocation.
 * - `unresolved`: older order without a clear source; choose it first.
 */
export type OrderLinePrepMode = 'inventory' | 'local' | 'none' | 'unresolved';

export function resolveOrderLinePrepMode(
  stockSource: OrderStockSource | null | undefined,
): OrderLinePrepMode {
  switch (stockSource) {
    case 'inventory':
    case 'local':
    case 'none':
      return stockSource;
    default:
      return 'unresolved';
  }
}

/**
 * The note shown instead of the allocation form (null: allocate, or nothing
 * to say). A local order says where it took its quantity only where the
 * store can be linked to inventory (2026-11-04): without the link app it
 * is how every order works.
 */
export function orderLinePrepNote(
  mode: OrderLinePrepMode,
  productTracksInventory: boolean,
  storeCanLinkInventory = true,
): string | null {
  switch (mode) {
    case 'local':
      return storeCanLinkInventory
        ? 'يُصرف من كمية المنتج — الطلب أُنشئ والمتجر غير مربوط بالمخازن.'
        : null;
    case 'none':
      return 'بلا أثر مخزني — يُشحن الصنف دون حركة مخزون.';
    case 'unresolved':
      return 'مصدر مخزون هذا الطلب غير محدد. اختره أولاً من تبويب «المخزون» (المخازن، أو كمية المنتج، أو بلا أثر مخزني)، ثم جهّز الأصناف.';
    case 'inventory':
      return productTracksInventory
        ? null
        : 'تتبع المخزون معطّل لهذا المنتج — لا يُخصم من المستودع.';
  }
}
