import type { Money, TenantScoped } from '@/features/ecommerce/domain/types/common';

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export type OrderLineShipStatus = 'unassigned' | 'assigned' | 'partial' | 'shipped';

/** Quantity reserved/taken from a specific stock location for one order line. */
export type OrderLineAllocation = {
  id: string;
  warehouseId: string;
  locationId: string;
  quantity: number;
};

export type OrderLineItem = {
  /** Backend store_order_lines.id — required for allocation/ship APIs. */
  lineId?: string;
  productId: string;
  variantId?: string | null;
  productNameAr: string;
  quantity: number;
  unitPrice: Money;
  allocations: OrderLineAllocation[];
  shipStatus: OrderLineShipStatus;
  imageUrl?: string | null;
};

/**
 * File attached to a store order — uploaded by the customer at checkout,
 * or added later by staff from the admin dashboard.
 */
export type StoreOrderAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  /** bigint serialized as string, e.g. "84213". */
  sizeBytes: string | null;
  label: string | null;
  /** false = internal (staff-only). Customer responses only ever return true. */
  visibleToCustomer: boolean;
  /** "storefront" for customer uploads, or the staff user id. */
  uploadedBy: string | null;
  createdAt: string;
};

/** Body for adding an attachment (customer place-order item, or admin POST). */
export type CreateStoreOrderAttachmentInput = {
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  label?: string | null;
  /** Admin only — default true. Set false for an internal, customer-hidden file. */
  visibleToCustomer?: boolean;
};

/** Body for PATCH — toggle customer visibility and/or edit the label (admin only). */
export type UpdateStoreOrderAttachmentInput = {
  label?: string | null;
  visibleToCustomer?: boolean;
};

/** Body for PATCH /store-admin/orders/:id/staff-note (all fields optional). */
export type UpdateOrderStaffNoteInput = {
  /** Text (≤ 4000). Send "" or null to clear (also resets visibility to false). */
  staffNote?: string | null;
  /** Toggle whether the customer can see the note. */
  visibleToCustomer?: boolean;
};

/** Server-side attachment filter for admin order detail. */
export type OrderAttachmentVisibilityFilter = 'all' | 'visible' | 'hidden';

/** Matches the backend `StoreOrderHistoryKind`: every action on the order leaves a row. */
export type OrderHistoryKind = 'status' | 'assignment' | 'line' | 'note' | 'payment' | 'attachment';

/** One status transition from `GET /store-admin/orders/:id` → `statusHistory`. */
export type OrderStatusHistoryEntry = {
  id?: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  /** status change, assignment, a line note, or a staff note (e.g. a delivery attempt). */
  kind?: OrderHistoryKind;
  /** Staff user UUID; null when changed from storefront / customer. */
  changedBy: string | null;
  changedByName?: string | null;
  /** Who the order was assigned to by this row. */
  assignedTo?: string | null;
  assignedToName?: string | null;
  note: string | null;
  createdAt: string;
};

export type OrderStockSource = 'local' | 'inventory' | 'none' | 'unresolved';

export type OrderStockReservation = 'awaiting' | 'short' | 'reserved' | 'released' | 'issued';

export type OrderReturnReceipt = {
  lines: Array<{ lineId: string; sellableQuantity: number; damagedQuantity: number }>;
  notes: string | null;
  receivedBy: string | null;
  receivedAt: string;
};

export type Order = TenantScoped & {
  id: string;
  /** With `groupBy`: the order's group key. */
  groupKey?: string | null;
  orderNumber: string;
  customerId: string;
  customerNameAr: string;
  city?: string;
  region?: string;
  status: OrderStatus;
  items: OrderLineItem[];
  totalAmount: Money;
  createdAt: string;
  updatedAt: string;
  /** Present for storefront checkouts synced into the admin dashboard. */
  phone?: string;
  shippingStreet?: string;
  shippingDistrict?: string;
  shippingNotes?: string;
  /** Free-text note from the customer at place-order (`customerNote`). */
  customerNote?: string | null;
  /** Single staff note on the order (admin sees always; customer only when visible). */
  staffNote?: string | null;
  /** Whether the staff note is shown to the customer (admin view only). */
  staffNoteVisibleToCustomer?: boolean;
  /**
   * Where the order's stock comes from (phase 4, admin only), fixed when it
   * was placed: local (store quantity), inventory (reserved, issued when
   * shipped), none, or unresolved (older order: choose before shipping).
   */
  stockSource?: OrderStockSource | null;
  stockSourceNote?: string | null;
  /** Inventory orders: the store warehouse the order is reserved in (prepared from it only). */
  stockWarehouseId?: string | null;
  /**
   * Inventory orders (admin only): reserved once paid (cash on delivery:
   * once confirmed). `short`: paid but the stock is short — the order does
   * not move on until stock is there or it is cancelled and refunded.
   */
  stockReservation?: OrderStockReservation | null;
  /** The confirmed receipt of the returned goods (once). */
  returnReceipt?: OrderReturnReceipt | null;
  paymentMethod?:
    | 'cash_on_delivery'
    | 'cash'
    | 'bank'
    | 'network'
    | 'wallet'
    | 'card'
    | 'other';
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  /** Linked company payment account (bank / network / wallet…). */
  paymentAccountId?: string | null;
  paymentAccountSnapshot?: {
    id: string;
    type: string;
    nameAr: string;
    nameEn?: string | null;
    providerName?: string | null;
    accountHolderName?: string | null;
    mobile?: string | null;
    accountNumber?: string | null;
    iban?: string | null;
    currencyCode?: string | null;
  } | null;
  /**
   * Transfer / card receipt image URLs (one or more).
   * Prefer this over the legacy single `paymentProofUrl`.
   */
  paymentProofUrls?: string[];
  /** @deprecated Use `paymentProofUrls` — kept for older seeds/API payloads. */
  paymentProofUrl?: string | null;
  subtotalAmount?: Money;
  shippingFeeAmount?: Money;
  /** The delivery line: the system item «رسوم التوصيل» with the fee the order kept. */
  deliveryCharge?: { productId: string; productName: string; amount: Money } | null;
  source?: 'seed' | 'storefront';
  /** Order stages: the staff member handling the order in its stage. */
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedAt?: string | null;
  /** Recipient (admin detail). */
  shipFullName?: string;
  shipPhone?: string;
  estimatedDeliveryAt?: string | null;
  /** Chronological status changes — present on full order detail only. */
  statusHistory?: OrderStatusHistoryEntry[];
  /** Files attached to the order (customer + staff). Present on detail responses. */
  attachments?: StoreOrderAttachment[];
  /**
   * A row of the orders list, not the full detail: `items` is empty and the
   * counts below stand for it (the detail is fetched when the order is opened).
   */
  isSummary?: boolean;
  /** List rows: number of lines / lines shipped / pieces ordered. */
  lineCount?: number;
  shippedLineCount?: number;
  itemQuantity?: number;
  /** List rows: a payment proof is attached (its image comes with the detail). */
  hasPaymentProof?: boolean;
};

export type OrderFulfilmentFilter = 'fulfilled' | 'partial' | 'unfulfilled';

export type OrderListQuery = {
  companyId: string;
  search?: string;
  status?: OrderStatus;
  customerId?: string;
  /** Filter by registered contacts partner (`store_orders.partner_id`). */
  partnerId?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod?:
    | 'cash_on_delivery'
    | 'cash'
    | 'bank'
    | 'network'
    | 'wallet'
    | 'card'
    | 'other';
  paymentAccountId?: string;
  fulfilment?: OrderFulfilmentFilter;
  source?: 'seed' | 'storefront';
  city?: string;
  /** Order stages: `me`, `unassigned`, or a user id. */
  assignedTo?: string;
  /** Inclusive YYYY-MM-DD on `createdAt` (local calendar day of the ISO timestamp). */
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  /** Server sort key (`STORE_ORDERS_SORT` in the backend). */
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  /** Server group field; with `groupValue`, one group's orders only. */
  groupBy?: string;
  groupValue?: string;
};

export type UpdateOrderStatusInput = {
  status: OrderStatus;
  note?: string | null;
  /** Who handles the order in the stage it enters; null: unassigned; omitted: the settings decide. */
  assigneeId?: string | null;
  /** Delivering a cash-on-delivery order: the amount was collected. */
  paymentCollected?: boolean;
};

export type UpdateOrderDeliveryInput = {
  shipFullName?: string;
  shipPhone?: string;
  shipDistrict?: string;
  shipStreet?: string;
  shipNotes?: string | null;
  estimatedDeliveryAt?: string | null;
};

export type UpdateOrderPaymentStatusInput = {
  paymentStatus: NonNullable<Order['paymentStatus']>;
  paymentProofUrl?: string | null;
};

export type SaveOrderLineAllocationsInput = {
  productId: string;
  /** Prefer when known — avoids ambiguous productId matches. */
  lineId?: string;
  allocations: Array<{
    warehouseId: string;
    locationId: string;
    quantity: number;
  }>;
};

export type ShipOrderLineInput = {
  productId: string;
  lineId?: string;
  /** Optional staff note — recorded in statusHistory. */
  note?: string | null;
  /** When provided, used for stock issue (avoids stale order refetch). */
  allocations?: Array<{
    warehouseId: string;
    locationId: string;
    quantity: number;
  }>;
};

export type UpdateOrderLineShipStatusInput = {
  productId: string;
  lineId?: string;
  shipStatus: OrderLineShipStatus;
  /** Optional staff note — recorded in statusHistory. */
  note?: string | null;
};
