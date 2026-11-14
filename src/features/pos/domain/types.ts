/**
 * Point of sale domain, as designed in pos-study v3. The web holds it in a
 * local store until the backend exists; these types are the contract the API
 * will follow.
 */

/**
 * Company-wide stock mode: sell without tracking (products, sale price and
 * cost only), or through inventory. `inventory` comes from enabling the
 * «ربط نقاط البيع بالمخازن» app (pos-stock-sync), never by hand.
 */
export type PosStockMode = 'none' | 'inventory';

/**
 * When a linked sale moves stock: reserved at commit and issued at
 * completion, or only checked at commit and issued at completion.
 */
export type PosStockTiming = 'reserve_on_commit' | 'issue_on_complete';

/**
 * `credit` (آجل): the part the customer owes, on his account in contacts
 * once the sale completes; needs a customer from contacts.
 */
export type PosPaymentMethod = 'cash' | 'card' | 'transfer' | 'credit';

/** Methods that take money now (a collection, a refund in hand). */
export type PosMoneyMethod = Exclude<PosPaymentMethod, 'credit'>;

/** How a point of sale prints a completed sale. */
export type PosInvoiceStyle = 'thermal' | 'standard';

export type PosSettings = {
  stockMode: PosStockMode;
  /**
   * A requested change of stock mode (drain): no new shifts until it ends;
   * open shifts finish in their stamped mode; then an admin confirms the new
   * mode explicitly. Null when none is under way.
   */
  stockModeChange: { to: PosStockMode; requestedAt: string; requestedBy: string } | null;
  /** Linked to inventory only: when the stock of a sale moves. */
  stockTiming: PosStockTiming;
  /** Only products marked "available in POS" in the catalog. */
  onlyPosAvailableProducts: boolean;
  tax: {
    enabled: boolean;
    /** Percent, e.g. 15. */
    rate: number;
    pricesIncludeTax: boolean;
  };
  discounts: {
    /** Highest discount a cashier may give alone, percent of the line/sale. */
    cashierMaxPercent: number;
    /** Above the limit: a supervisor confirms on the same device. */
    supervisorApprovalAbove: boolean;
    /** Who may confirm: chosen in the settings, each signs with his password. */
    supervisors: Array<{ id: string; name: string }>;
    allowPriceOverride: boolean;
  };
  returns: {
    windowDays: number;
    refundToOtherMethodNeedsApproval: boolean;
  };
  shifts: {
    blindCount: boolean;
    countByDenomination: boolean;
    /** Difference that needs no reason, in money. */
    differenceTolerance: number;
    denominations: number[];
  };
  paymentMethods: Record<PosPaymentMethod, boolean>;
  /**
   * Default document for every register that does not choose its own:
   * a thermal ticket, or the company's normal A4 invoice.
   */
  invoiceStyle: PosInvoiceStyle;
};

export type PosRegister = {
  id: string;
  name: string;
  /** Receipt number prefix, unique in the company (e.g. POS1). */
  code: string;
  branchId: string | null;
  branchName: string | null;
  /** The warehouse it sells from when linked (one of its branch, checked by the server). */
  warehouseId?: string | null;
  /** The warehouse's name, set by the server. */
  warehouseName: string | null;
  isActive: boolean;
  /** Null follows the company POS setting. */
  invoiceStyle?: PosInvoiceStyle | null;
  nextSequence: number;
  createdAt: string;
  /** Who may work this register. Nobody assigned: only the company's super admin. */
  assignedUsers?: Array<{ id: string; name: string }>;
};

/** A browser paired with a register. */
export type PosDevice = {
  id: string;
  registerId: string;
  label: string;
  pairedAt: string;
  revokedAt: string | null;
};

export type PosSessionStatus = 'open' | 'closed';

export type PosSession = {
  id: string;
  registerId: string;
  cashierId: string;
  cashierName: string;
  status: PosSessionStatus;
  stockMode: PosStockMode;
  /** The register's warehouse when the shift opened (inventory mode). */
  warehouseId?: string | null;
  openedAt: string;
  openingFloat: number;
  closedAt: string | null;
  countedCash: number | null;
  expectedCash: number | null;
  difference: number | null;
  differenceReason: string | null;
  denominationCounts: Record<string, number> | null;
};

export type PosCustomer =
  | { kind: 'walk_in' }
  | { kind: 'named'; name: string; phone?: string; taxNumber?: string }
  /** A contact: its name and phone are set by the server from contacts. */
  | { kind: 'partner'; partnerId: string; name: string; phone?: string; taxNumber?: string };

/** The customer's name as receipts and reports show it. */
export function customerLabel(customer: PosCustomer): string {
  return customer.kind === 'walk_in' ? 'عميل عابر' : customer.name;
}

export type PosDiscount = { type: 'percent' | 'amount'; value: number };

export type PosSaleLine = {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string;
  quantity: number;
  /** Catalog price when added. */
  sourcePrice: number;
  /** Price applied (differs only by an override). */
  unitPrice: number;
  discount: PosDiscount | null;
  /** Computed snapshot. */
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  /** Line total the customer pays. */
  total: number;
  returnedQuantity: number;
  /**
   * Cost of one unit when sold, fixed by the server at the sale (a later
   * purchase price never changes it). Null: no cost then; absent: older sale.
   */
  unitCost?: number | null;
  costSource?: 'purchase_price' | 'inventory' | null;
  /** What inventory charged for this line: the unit cost is its rounding. */
  costTotal?: number | null;
  /** The product's selling group in the register, fixed at the sale. */
  menuCategoryId?: string | null;
  menuCategoryName?: string | null;
  /** The item's category when sold. */
  categoryId?: string | null;
  categoryName?: string | null;
};

export type PosSaleStatus = 'awaiting_payment' | 'completed' | 'cancelled' | 'payment_exception';

export type PosPaymentStatus = 'pending' | 'succeeded' | 'declined' | 'cancelled' | 'unknown';

export type PosPayment = {
  id: string;
  kind: 'payment' | 'refund';
  method: PosPaymentMethod;
  amount: number;
  status: PosPaymentStatus;
  /** Approval code, transfer reference… */
  reference: string | null;
  tendered: number | null;
  change: number | null;
  sessionId: string;
  createdAt: string;
  /** Recorded after the fact (late entry), with the reason. */
  lateEntryReason?: string | null;
};

export type PosSaleTotals = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

export type PosSaleRevision = {
  at: string;
  by: string;
  reason: string;
  lines: PosSaleLine[];
  totals: PosSaleTotals;
};

export type PosSale = {
  /** The only reference integrations use (`pos:<id>`). */
  id: string;
  /** Visible receipt number, given on completion. */
  number: string | null;
  registerId: string;
  sessionId: string;
  cashierName: string;
  status: PosSaleStatus;
  /** The shift's stock mode, stamped by the server. */
  stockSource: PosStockMode;
  /** The warehouse it sells from (inventory only). */
  warehouseId?: string | null;
  /** Its quantities are reserved until it completes or is cancelled. */
  stockReserved?: boolean;
  customer: PosCustomer;
  lines: PosSaleLine[];
  orderDiscount: PosDiscount | null;
  totals: PosSaleTotals;
  payments: PosPayment[];
  /** More than one payment covered the invoice. */
  splitPayment?: boolean;
  revisions: PosSaleRevision[];
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  exceptionReason: string | null;
  /** The company currency when sold (server-set); absent on older sales. */
  currency?: string | null;
  /** The part sold on credit, set by the server at completion. */
  credit?: PosSaleCredit | null;
};

export type PosSaleCredit = {
  partnerId: string;
  partnerName: string;
  amount: number;
  collected: number;
  returned: number;
  /** amount − collected − returned, never below zero. */
  due: number;
};

/** A payment of a credit invoice, in a shift (into its drawer) or outside one. */
export type PosCollection = {
  id: string;
  saleId: string;
  saleNumber: string;
  partnerId: string;
  partnerName: string;
  method: PosMoneyMethod;
  amount: number;
  reference: string | null;
  sessionId: string | null;
  currency: string | null;
  createdAt: string;
  createdBy: string;
};

export type PosReturnCondition = 'resellable' | 'damaged' | 'not_received';

export type PosReturn = {
  id: string;
  number: string;
  saleId: string;
  saleNumber: string;
  sessionId: string | null;
  createdAt: string;
  createdBy: string;
  reason: string;
  lines: Array<{
    saleLineId: string;
    name: string;
    quantity: number;
    condition: PosReturnCondition;
    amount: number;
  }>;
  /** Money back is its own part: recorded when it actually happens. */
  refund: {
    method: PosPaymentMethod;
    amount: number;
    reference: string | null;
    status: 'pending' | 'done';
  };
  /** Damaged goods wait for a decision (scrap, supplier, repair). */
  damagedDecision: 'pending' | 'scrap' | 'supplier' | 'repair' | null;
  /**
   * Stock of the returned goods, following the sale's stamped source:
   * not_applicable (sold without tracking), posted (back to inventory), or
   * pending — sold from inventory but received while POS is not linked: kept
   * here and reviewed before posting, so it is never counted twice.
   */
  stockPosting?: 'not_applicable' | 'posted' | 'pending' | 'reviewed';
  /** Idempotency key: the same return sent twice has one effect. */
  operationKey?: string;
};

export type PosCashMovement = {
  id: string;
  sessionId: string;
  type: 'in' | 'out';
  amount: number;
  reason: string;
  createdAt: string;
  createdBy: string;
};

/**
 * A selling group on the register, independent of the product catalog
 * categories. The product stores which group it belongs to.
 */
export type PosMenuCategory = {
  id: string;
  name: string;
};

export type PosHeldCart = {
  id: string;
  registerId: string;
  label: string;
  lines: PosSaleLine[];
  customer: PosCustomer;
  orderDiscount: PosDiscount | null;
  createdAt: string;
};

export type PosAuditEvent = {
  id: string;
  at: string;
  by: string;
  type:
    | 'cart_voided'
    | 'price_override'
    | 'discount_over_limit'
    | 'sale_cancelled'
    | 'payment_late_entry'
    | 'payment_not_charged'
    | 'exception_resolved'
    | 'sale_revised'
    | 'return_created'
    | 'refund_recorded'
    | 'cash_movement'
    | 'shift_difference'
    | 'receipt_reprint'
    | 'device_paired'
    | 'device_revoked'
    | 'stock_mode_change_requested'
    | 'stock_mode_change_cancelled'
    | 'stock_mode_changed'
    | 'stock_posting_reviewed'
    | 'credit_collected';
  detail: string;
};

export const PAYMENT_METHOD_LABELS: Record<PosPaymentMethod, string> = {
  cash: 'نقد',
  card: 'بطاقة',
  transfer: 'تحويل / محفظة',
  credit: 'آجل',
};

export const MONEY_METHODS: readonly PosMoneyMethod[] = ['cash', 'card', 'transfer'];

export const SALE_STATUS_LABELS: Record<PosSaleStatus, string> = {
  awaiting_payment: 'بانتظار الدفع',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  payment_exception: 'استثناء دفع',
};

export const RETURN_CONDITION_LABELS: Record<PosReturnCondition, string> = {
  resellable: 'صالح للبيع',
  damaged: 'تالف',
  not_received: 'لم يُستلم',
};

export const DEFAULT_POS_SETTINGS: PosSettings = {
  stockMode: 'none',
  stockModeChange: null,
  stockTiming: 'reserve_on_commit',
  onlyPosAvailableProducts: false,
  tax: { enabled: false, rate: 0, pricesIncludeTax: true },
  discounts: { cashierMaxPercent: 10, supervisorApprovalAbove: true, supervisors: [], allowPriceOverride: false },
  returns: { windowDays: 7, refundToOtherMethodNeedsApproval: true },
  shifts: {
    blindCount: true,
    countByDenomination: false,
    differenceTolerance: 0,
    denominations: [1000, 500, 200, 100, 50, 20, 10, 5, 1],
  },
  paymentMethods: { cash: true, card: true, transfer: true, credit: false },
  invoiceStyle: 'thermal',
};

/** A register's own choice, otherwise the company POS setting. */
export function resolvePosInvoiceStyle(
  register: Pick<PosRegister, 'invoiceStyle'> | undefined,
  settings: Pick<PosSettings, 'invoiceStyle'> | undefined,
): PosInvoiceStyle {
  if (register?.invoiceStyle === 'thermal' || register?.invoiceStyle === 'standard') return register.invoiceStyle;
  return settings?.invoiceStyle === 'standard' ? 'standard' : 'thermal';
}
