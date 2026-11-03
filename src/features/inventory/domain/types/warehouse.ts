import type { TenantScoped } from '@/features/ecommerce/domain/types/common';

export type WarehouseStatus = 'active' | 'inactive';

/** Incoming flow: 1 = receive+store, 2 = receive then store, 3 = receive + QC + store */
export type WarehouseIncomingSteps = 1 | 2 | 3;

/** Outgoing flow: 1 = deliver, 2 = pick+deliver, 3 = pick+pack+deliver */
export type WarehouseOutgoingSteps = 1 | 2 | 3;

export type WarehouseLocationType =
  | 'internal'
  | 'view'
  | 'supplier'
  | 'customer'
  | 'inventory'
  | 'production'
  | 'transit';

export type WarehouseRemovalStrategy = 'fifo' | 'lifo' | 'closest' | 'fewest_packages' | 'fefo';

export type Warehouse = TenantScoped & {
  id: string;
  /** Short code used for auto locations, e.g. فثسف or WH */
  code: string;
  nameAr: string;
  nameEn?: string;
  description?: string;
  address?: string;
  /** Null = central warehouse (visible only with isAllBranches). */
  branchId?: string | null;
  status: WarehouseStatus;
  incomingSteps: WarehouseIncomingSteps;
  outgoingSteps: WarehouseOutgoingSteps;
  buyToResupply: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WarehouseListQuery = {
  companyId: string;
  /** Optional UI filter inside the user's allowed branch set. */
  branchId?: string;
  search?: string;
  page?: number;
  limit?: number;
  /** Server sort key: code (default), name, createdAt. */
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
};

export type CreateWarehouseInput = Omit<Warehouse, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateWarehouseInput = Partial<CreateWarehouseInput>;

export type WarehouseLocation = TenantScoped & {
  id: string;
  warehouseId: string;
  /** Joined from warehouse on list/detail API responses */
  warehouseNameAr?: string;
  warehouseCode?: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  parentLocationId?: string | null;
  locationType: WarehouseLocationType;
  storageCategory?: string;
  barcode?: string;
  replenish: boolean;
  cycleCountFrequencyDays: number;
  lastCountAt?: string;
  nextCountAt?: string;
  removalStrategy: WarehouseRemovalStrategy;
  /** Legacy shelf fields — kept for display compatibility */
  aisle?: string;
  rack?: string;
  bin?: string;
  isActive: boolean;
  /** True when seeded automatically on warehouse create */
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WarehouseLocationListQuery = {
  companyId: string;
  /** When omitted, list locations across all warehouses. */
  warehouseId?: string;
  search?: string;
  /** Every page (reports that look up names across all locations). */
  all?: boolean;
  page?: number;
  limit?: number;
};

export type CreateWarehouseLocationInput = Omit<WarehouseLocation, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateWarehouseLocationInput = Partial<CreateWarehouseLocationInput>;

/** أنواع مستندات المخزون */
export type WarehouseOperationKind =
  | 'transfer'
  | 'receipt'
  | 'issue'
  | 'internal'
  | 'adjustment'
  | 'physical_count'
  | 'scrap'
  | 'purchase'
  | 'purchase_order'
  | 'replenishment'
  | 'opening'
  | 'customer_return'
  | 'supplier_return';

/** مسودة → جاهز → منتهي (+ ملغى) */
export type WarehouseOperationStatus = 'draft' | 'ready' | 'done' | 'cancelled';

export type WarehouseOperationLine = {
  id: string;
  productName: string;
  sku?: string;
  /** Required — every stock-affecting line must link to a catalog product. */
  productId: string;
  /** Links the line to a sellable variant when applicable. */
  variantId?: string;
  /** الكمية المطلوبة (الطلب) — وفي الجرد: الكمية النظرية */
  demandQuantity: number;
  /** الكمية المنفذة عند التصديق — وفي الجرد: الكمية المعدودة */
  quantity: number;
  /** UOM line used for entry (product or variant row id). */
  productUomLineId?: string | null;
  /** Quantity in selected UOM when saved from warehouse UI. */
  uomEnteredQuantity?: number | null;
  fromLocationId?: string;
  toLocationId?: string;
  notes?: string;
  /**
   * تكلفة الوحدة عند الإدخال (وارد فقط: شراء/استلام/تجديد). مطلوبة عندما
   * يكون Costing مفعّلًا للشركة؛ تُتجاهل من الـbackend في التحويل والصادر —
   * لا تُرسلها لتلك الأنواع.
   */
  unitCost?: string;
  costCurrency?: string;
  /** On a purchase order: quantity already received. */
  receivedQuantity?: number;
  purchaseOrderLineId?: string | null;
  expiryDate?: string | null;
  /** JSON array or omitted. */
  serialNumbers?: string | null;
};

export type WarehouseOperation = TenantScoped & {
  id: string;
  /** With `groupBy`: the document's group key. */
  groupKey?: string | null;
  warehouseId: string;
  kind: WarehouseOperationKind;
  transferMode?: 'direct' | 'two_step';
  transitState?: 'in_transit' | 'received' | null;
  reference: string;
  status: WarehouseOperationStatus;
  occurredAt: string;
  notes?: string;
  /** جهة اتصال حقيقية من "جهات الاتصال" (اختياري الآن) — عند تحديدها يُشتق منها partnerName. */
  partnerId?: string | null;
  /** شريك المصدر/الوجهة (اختياري) — نص حر إن لم تُختر جهة اتصال. */
  partnerName?: string;
  /** المستند المصدر — مثل أمر شراء أو تجديد مخزون */
  sourceDocument?: string;
  /** مستودع الوجهة — للتحويلات بين المستودعات */
  destinationWarehouseId?: string;
  lines: WarehouseOperationLine[];
  /** List API aggregates (when lines are preview/none). */
  lineCount?: number;
  totalDemandQuantity?: number;
  totalQuantity?: number;
  /** Fetch full document before editing when true. */
  linesPartial?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WarehouseOperationLinesMode = 'full' | 'preview' | 'none';

export type WarehouseOperationListQuery = {
  companyId: string;
  /** When omitted, returns operations across warehouses (product-scoped lists). */
  warehouseId?: string;
  kind?: WarehouseOperationKind;
  status?: WarehouseOperationStatus;
  productId?: string;
  /** The linked contact (supplier, customer, …). */
  partnerId?: string;
  occurredAtFrom?: string;
  occurredAtTo?: string;
  search?: string;
  /** Company-wide list for inventory reports: every page, no warehouse/product/kind required. */
  all?: boolean;
  page?: number;
  limit?: number;
  /** Default preview on list — use full for reports / product-scoped lists. */
  linesMode?: WarehouseOperationLinesMode;
  /** Server sort key (`OPERATIONS_SORT`): occurredAt, reference, partner, status, warehouse, createdAt. */
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  /** Server group field (`OPERATIONS_GROUP`); with `groupValue`, one group's documents. */
  groupBy?: string;
  groupValue?: string;
};

/** Server assigns `reference` (e.g. REC-12) — never send on create/update. */
export type CreateWarehouseOperationInput = Omit<
  WarehouseOperation,
  'id' | 'createdAt' | 'updatedAt' | 'reference'
>;
export type UpdateWarehouseOperationInput = Partial<CreateWarehouseOperationInput>;
