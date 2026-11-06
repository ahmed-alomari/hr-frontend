import type { WarehouseOperationKind } from '@/features/inventory/domain/types/warehouse';

/**
 * أنواع مستندات المخزون.
 * receipt = استلام مخزون (وارد — يزيد الرصيد)
 * issue = صرف مخزون (صادر — ينقص الرصيد)
 *
 * uiPlacement:
 * - warehouse → تبويبات تفاصيل المستودع فقط
 * - header → قائمة التطبيق العامة فقط
 * - both → المستودع (خاص) + قائمة العمليات العامة
 *
 * العمليات اليومية (بين المستودعات / استلام / صرف / نقل المواقع) تظهر في المكانين:
 * عامة على مستوى التطبيق، وخاصة داخل المستودع.
 */
export const WAREHOUSE_OPERATION_KINDS: WarehouseOperationKind[] = [
  'transfer',
  'receipt',
  'issue',
  'internal',
  'adjustment',
  'physical_count',
  'scrap',
  'purchase',
  'purchase_order',
  'replenishment',
  'opening',
  'customer_return',
  'supplier_return',
];

export type WarehouseOperationUiPlacement = 'warehouse' | 'header' | 'both';

export type WarehouseOperationKindMeta = {
  labelAr: string;
  title: string;
  createLabel: string;
  empty: string;
  needsFrom: boolean;
  needsTo: boolean;
  needsDestWarehouse: boolean;
  refPrefix: string;
  stockEffect: 'inbound' | 'outbound' | 'move' | 'transfer' | 'adjust_set' | 'order';
  uiPlacement: WarehouseOperationUiPlacement;
  /** مفتاح ترجمة اختياري */
  navLabelKey: string;
  /** مسار الصفحة العامة تحت /inventory/… */
  pathSegment: string;
  /**
   * لم يعد يُنشأ (الخادم يرفضه): الشراء = أمر شراء ثم استلام، والإدخال
   * المباشر = استلام مخزون. مستنداته السابقة تبقى للعرض والتصديق والتراجع.
   */
  retired?: boolean;
};

export const WAREHOUSE_OPERATION_KIND_META: Record<WarehouseOperationKind, WarehouseOperationKindMeta> =
  {
    transfer: {
      labelAr: 'بين المستودعات',
      title: 'تحويل بين المستودعات',
      createLabel: 'تحويل بين مستودعات',
      empty: 'لا توجد تحويلات بين المستودعات بعد.',
      needsFrom: true,
      needsTo: true,
      needsDestWarehouse: true,
      refPrefix: 'WH/TR',
      stockEffect: 'transfer',
      uiPlacement: 'both',
      navLabelKey: 'opTransfers',
      pathSegment: 'transfers',
    },
    receipt: {
      labelAr: 'استلام مخزون',
      title: 'استلام مخزون',
      createLabel: 'مستند استلام',
      empty: 'لا توجد عمليات استلام مخزون بعد.',
      needsFrom: false,
      needsTo: true,
      needsDestWarehouse: false,
      refPrefix: 'WH/IN',
      stockEffect: 'inbound',
      uiPlacement: 'both',
      navLabelKey: 'opReceipts',
      pathSegment: 'receipts',
    },
    issue: {
      labelAr: 'صرف مخزون',
      title: 'صرف مخزون',
      createLabel: 'مستند صرف',
      empty: 'لا توجد عمليات صرف مخزون بعد.',
      needsFrom: true,
      needsTo: true,
      needsDestWarehouse: false,
      refPrefix: 'WH/OUT',
      stockEffect: 'outbound',
      uiPlacement: 'both',
      navLabelKey: 'opDeliveries',
      pathSegment: 'deliveries',
    },
    internal: {
      labelAr: 'نقل المواقع',
      title: 'نقل بين مواقع المستودع',
      createLabel: 'نقل بين مواقع',
      empty: 'لا توجد عمليات نقل بين المواقع بعد.',
      needsFrom: true,
      needsTo: true,
      needsDestWarehouse: false,
      refPrefix: 'WH/INT',
      stockEffect: 'move',
      uiPlacement: 'both',
      navLabelKey: 'opInternal',
      pathSegment: 'internal',
    },
    adjustment: {
      labelAr: 'التعديلات',
      title: 'تعديلات المخزون',
      createLabel: 'مستند تعديل',
      empty: 'لا توجد تعديلات بعد.',
      needsFrom: false,
      needsTo: true,
      needsDestWarehouse: false,
      refPrefix: 'WH/ADJ',
      stockEffect: 'adjust_set',
      uiPlacement: 'both',
      navLabelKey: 'opAdjustments',
      pathSegment: 'adjustments',
    },
    physical_count: {
      labelAr: 'الجرد المادي',
      title: 'الجرد المادي',
      createLabel: 'مستند جرد',
      empty: 'لا توجد عمليات جرد بعد.',
      needsFrom: false,
      needsTo: true,
      needsDestWarehouse: false,
      refPrefix: 'WH/INV',
      stockEffect: 'adjust_set',
      uiPlacement: 'both',
      navLabelKey: 'opPhysicalCount',
      pathSegment: 'physical-counts',
    },
    scrap: {
      labelAr: 'مخلفات التصنيع',
      title: 'مخلفات التصنيع',
      createLabel: 'مستند مخلفات',
      empty: 'لا توجد مخلفات مسجّلة بعد.',
      needsFrom: true,
      needsTo: false,
      needsDestWarehouse: false,
      refPrefix: 'WH/SCR',
      stockEffect: 'outbound',
      uiPlacement: 'both',
      navLabelKey: 'opScrap',
      pathSegment: 'scrap',
    },
    purchase_order: {
      labelAr: 'أوامر الشراء',
      title: 'أوامر الشراء',
      createLabel: 'أمر شراء',
      empty: 'لا توجد أوامر شراء بعد. الأمر لا يحرّك المخزون حتى يُستلم.',
      needsFrom: false,
      needsTo: false,
      needsDestWarehouse: false,
      refPrefix: 'PO',
      stockEffect: 'order',
      uiPlacement: 'header',
      navLabelKey: 'opPurchaseOrder',
      pathSegment: 'purchase-orders',
    },
    purchase: {
      labelAr: 'الشراء (سابق)',
      title: 'مستندات الشراء السابقة',
      createLabel: 'مستند شراء',
      empty: 'لا توجد مستندات شراء سابقة.',
      needsFrom: false,
      needsTo: true,
      needsDestWarehouse: false,
      refPrefix: 'WH/PO',
      stockEffect: 'inbound',
      uiPlacement: 'header',
      navLabelKey: 'opPurchase',
      pathSegment: 'purchases',
      retired: true,
    },
    replenishment: {
      labelAr: 'تجديد المخزون (سابق)',
      title: 'مستندات التجديد السابقة',
      createLabel: 'طلب تجديد',
      empty: 'لا توجد مستندات تجديد سابقة.',
      needsFrom: false,
      needsTo: true,
      needsDestWarehouse: false,
      refPrefix: 'WH/RPL',
      stockEffect: 'inbound',
      uiPlacement: 'header',
      navLabelKey: 'opReplenishment',
      pathSegment: 'replenishment',
      retired: true,
    },
    opening: {
      labelAr: 'الرصيد الافتتاحي',
      title: 'الرصيد الافتتاحي',
      createLabel: 'مستند رصيد افتتاحي',
      empty: 'لا توجد أرصدة افتتاحية بعد. أدخلها يدويًا أو استوردها من ملف Excel.',
      needsFrom: false,
      needsTo: true,
      needsDestWarehouse: false,
      refPrefix: 'WH/OPN',
      stockEffect: 'inbound',
      uiPlacement: 'header',
      navLabelKey: 'opOpening',
      pathSegment: 'opening-balance',
    },
    customer_return: {
      labelAr: 'مرتجعات العملاء',
      title: 'مرتجعات العملاء',
      createLabel: 'مستند مرتجع عميل',
      empty: 'لا توجد مرتجعات من العملاء بعد.',
      needsFrom: false,
      needsTo: true,
      needsDestWarehouse: false,
      refPrefix: 'WH/CRT',
      stockEffect: 'inbound',
      uiPlacement: 'both',
      navLabelKey: 'opCustomerReturns',
      pathSegment: 'customer-returns',
    },
    supplier_return: {
      labelAr: 'مرتجعات للموردين',
      title: 'مرتجعات للموردين',
      createLabel: 'مستند مرتجع لمورد',
      empty: 'لا توجد مرتجعات للموردين بعد.',
      needsFrom: true,
      needsTo: true,
      needsDestWarehouse: false,
      refPrefix: 'WH/SRT',
      stockEffect: 'outbound',
      uiPlacement: 'both',
      navLabelKey: 'opSupplierReturns',
      pathSegment: 'supplier-returns',
    },
  };

export function isWarehouseOperationKind(value: string | null | undefined): value is WarehouseOperationKind {
  return Boolean(value && (WAREHOUSE_OPERATION_KINDS as string[]).includes(value));
}

/** تبويبات داخل صفحة المستودع — عمليات خاصة بهذا المستودع */
export const WAREHOUSE_DETAIL_TAB_KINDS: WarehouseOperationKind[] = WAREHOUSE_OPERATION_KINDS.filter(
  (kind) => {
    const placement = WAREHOUSE_OPERATION_KIND_META[kind].uiPlacement;
    return placement === 'warehouse' || placement === 'both';
  },
);

/** قائمة العمليات العامة في تطبيق المخزون */
export const INVENTORY_HEADER_OPERATION_KINDS: WarehouseOperationKind[] = WAREHOUSE_OPERATION_KINDS.filter(
  (kind) => {
    const placement = WAREHOUSE_OPERATION_KIND_META[kind].uiPlacement;
    return placement === 'header' || placement === 'both';
  },
);

export function warehouseOperationKindFromPathSegment(
  segment: string | null | undefined,
): WarehouseOperationKind | null {
  if (!segment) return null;
  for (const kind of WAREHOUSE_OPERATION_KINDS) {
    if (WAREHOUSE_OPERATION_KIND_META[kind].pathSegment === segment) return kind;
  }
  return null;
}
