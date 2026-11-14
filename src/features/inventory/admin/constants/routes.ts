/**
 * Standalone Inventory app routes (URLs under /inventory/…).
 */
export const inventoryAdminRoutes = {
  overview: '/inventory',
  /** مبيعات المحل — خصم ما يُباع في المحل من المستودع (ليس نقطة بيع) */
  pos: '/pos',
  /** العمليات — عامة على كل المستودعات */
  transfers: '/inventory/transfers',
  receipts: '/inventory/receipts',
  deliveries: '/inventory/deliveries',
  internal: '/inventory/internal',
  adjustments: '/inventory/adjustments',
  physicalCounts: '/inventory/physical-counts',
  scrap: '/inventory/scrap',
  purchases: '/inventory/purchases',
  replenishment: '/inventory/replenishment',
  operationsForKind: (segment: string) => `/inventory/${segment}`,
  /** التقارير */
  reportStock: '/inventory/reports/stock',
  reportDetailedStock: '/inventory/reports/detailed-stock',
  reportMoves: '/inventory/reports/moves',
  reportInbound: '/inventory/reports/inbound',
  reportMovesAnalysis: '/inventory/reports/moves-analysis',
  reportBatches: '/inventory/reports/batches',
  reportStockMovement: '/inventory/reports/stock-movement',
  reportValuation: '/inventory/reports/valuation',
  reportItemCard: '/inventory/reports/item-card',
  reportCountVariances: '/inventory/reports/count-variances',
  reportSlowMoving: '/inventory/reports/slow-moving',
  /** التهيئة */
  warehouses: '/inventory/warehouses',
  warehouseDetail: (warehouseId: string) => `/inventory/warehouses/${warehouseId}`,
  locations: '/inventory/locations',
  locationsForWarehouse: (warehouseId: string) =>
    `/inventory/locations?warehouseId=${warehouseId}`,
  putawayRules: '/inventory/putaway-rules',
  /** المنتجات */
  products: '/inventory/products',
  productDetail: (id: string) => `/inventory/products/${id}`,
  categories: '/inventory/categories',
  attributes: '/inventory/attributes',
  brands: '/inventory/brands',
  catalogUoms: '/inventory/catalog-uoms',
  settings: '/inventory/settings',
  /** One file: warehouses, locations, units, categories, products, opening balance. */
  setupImport: '/inventory/import',
} as const;
