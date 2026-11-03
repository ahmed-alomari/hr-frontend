import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  PackagePlus,
  PackageMinus,
  ArrowLeftRight,
  Truck,
  SlidersHorizontal,
  ClipboardList,
  Factory,
  ShoppingCart,
  RefreshCw,
  Warehouse,
  MapPin,
  MapPinned,
  FolderTree,
  Layers,
  Tag,
  Tags,
  Ruler,
  BarChart3,
  FileText,
  Settings,
  Settings2,
  Store,
  Bell,
  FileSpreadsheet,
  Undo2,
  Redo2,
} from 'lucide-react';
import { inventoryAdminRoutes } from '@/features/inventory/admin/constants/routes';
import { WAREHOUSE_OPERATION_KIND_META } from '@/features/inventory/domain/constants/warehouse-operation-kinds';
import type { WarehouseOperationKind } from '@/features/inventory/domain/types/warehouse';
import { PUTAWAY_RULES_ENABLED } from '@/features/inventory/admin/putaway-rules/lib/putaway-feature';

export type InventoryAdminNavItem = {
  labelAr: string;
  href: string;
  icon: LucideIcon;
};

export type InventoryAdminNavSection = {
  /** عنوان مجموعة اختياري داخل القائمة المنسدلة */
  labelAr?: string;
  items: InventoryAdminNavItem[];
};

export type InventoryAdminNavGroup = {
  key: 'operations' | 'pos' | 'products' | 'reports' | 'configuration' | 'settings';
  labelAr: string;
  icon: LucideIcon;
  sections: InventoryAdminNavSection[];
};

const OP_ICONS: Record<WarehouseOperationKind, LucideIcon> = {
  transfer: Truck,
  receipt: PackagePlus,
  issue: PackageMinus,
  internal: ArrowLeftRight,
  adjustment: SlidersHorizontal,
  physical_count: ClipboardList,
  scrap: Factory,
  purchase: ShoppingCart,
  purchase_order: ClipboardList,
  replenishment: RefreshCw,
  opening: FileSpreadsheet,
  customer_return: Undo2,
  supplier_return: Redo2,
};

function opItem(kind: WarehouseOperationKind): InventoryAdminNavItem {
  const meta = WAREHOUSE_OPERATION_KIND_META[kind];
  return {
    labelAr: meta.labelAr,
    href: inventoryAdminRoutes.operationsForKind(meta.pathSegment!),
    icon: OP_ICONS[kind],
  };
}

export const inventoryAdminOverviewItem: InventoryAdminNavItem = {
  labelAr: 'نظرة عامة',
  href: inventoryAdminRoutes.overview,
  icon: LayoutDashboard,
};

/**
 * Top nav: نظرة عامة | العمليات | … | التهيئة | الإعدادات
 * عمليات عامة على مستوى التطبيق؛ نفس الأنواع تظهر أيضًا داخل المستودع (خاصة به).
 */
export const inventoryAdminNavGroups: InventoryAdminNavGroup[] = [
  {
    key: 'operations',
    labelAr: 'العمليات',
    icon: Package,
    sections: [
      {
        items: [opItem('transfer'), opItem('receipt'), opItem('issue'), opItem('internal')],
      },
      {
        items: [opItem('customer_return'), opItem('supplier_return')],
      },
      {
        items: [opItem('adjustment'), opItem('physical_count'), opItem('scrap')],
      },
      {
        items: [opItem('purchase_order'), opItem('purchase'), opItem('replenishment'), opItem('opening')],
      },
    ],
  },
  {
    key: 'pos',
    labelAr: 'مبيعات المحل',
    icon: Store,
    sections: [
      {
        items: [
          {
            labelAr: 'خصم من المستودع',
            href: inventoryAdminRoutes.pos,
            icon: Store,
          },
        ],
      },
    ],
  },
  {
    key: 'products',
    labelAr: 'المنتجات',
    icon: Package,
    sections: [
      {
        items: [
          { labelAr: 'المنتجات', href: inventoryAdminRoutes.products, icon: Package },
          { labelAr: 'الفئات', href: inventoryAdminRoutes.categories, icon: FolderTree },
          { labelAr: 'الخصائص', href: inventoryAdminRoutes.attributes, icon: Tags },
          { labelAr: 'العلامات', href: inventoryAdminRoutes.brands, icon: Tag },
          { labelAr: 'وحدات القياس', href: inventoryAdminRoutes.catalogUoms, icon: Ruler },
        ],
      },
    ],
  },
  {
    key: 'reports',
    labelAr: 'إعداد التقارير',
    icon: BarChart3,
    sections: [
      {
        labelAr: 'المخزون',
        items: [
          { labelAr: 'المخزون', href: inventoryAdminRoutes.reportStock, icon: Package },
          {
            labelAr: 'المخزون التفصيلي',
            href: inventoryAdminRoutes.reportDetailedStock,
            icon: ClipboardList,
          },
          { labelAr: 'سجل الحركات', href: inventoryAdminRoutes.reportMoves, icon: FileText },
          { labelAr: 'وارد الأصناف', href: inventoryAdminRoutes.reportInbound, icon: PackagePlus },
          { labelAr: 'الدفعات', href: inventoryAdminRoutes.reportBatches, icon: Layers },
          {
            labelAr: 'تحليل الحركات',
            href: inventoryAdminRoutes.reportMovesAnalysis,
            icon: BarChart3,
          },
        ],
      },
    ],
  },
  {
    key: 'configuration',
    labelAr: 'التهيئة',
    icon: Settings2,
    sections: [
      {
        labelAr: 'إدارة المخازن والمستودعات',
        items: [
          { labelAr: 'المستودعات', href: inventoryAdminRoutes.warehouses, icon: Warehouse },
          { labelAr: 'المواقع', href: inventoryAdminRoutes.locations, icon: MapPin },
          { labelAr: 'استيراد البيانات', href: inventoryAdminRoutes.setupImport, icon: FileSpreadsheet },
          // Not applied yet (see putaway-feature): hidden until it is.
          ...(PUTAWAY_RULES_ENABLED
            ? [{ labelAr: 'قواعد التخزين', href: inventoryAdminRoutes.putawayRules, icon: MapPinned }]
            : []),
        ],
      },
    ],
  },
  {
    key: 'settings',
    labelAr: 'الإعدادات',
    icon: Settings,
    sections: [
      {
        items: [
          {
            labelAr: 'إعدادات المخازن',
            href: inventoryAdminRoutes.settings,
            icon: Bell,
          },
        ],
      },
    ],
  },
];

function collectHrefs(group: InventoryAdminNavGroup): string[] {
  return group.sections.flatMap((section) => section.items.map((item) => item.href.split('?')[0]!));
}

const INVENTORY_ADMIN_PATHS: string[] = [
  inventoryAdminOverviewItem.href,
  ...inventoryAdminNavGroups.flatMap(collectHrefs),
  '/inventory/warehouses',
  '/inventory/reports',
  '/inventory/pos',
  '/pos',
  '/inventory/transfers',
  '/inventory/receipts',
  '/inventory/deliveries',
  '/inventory/internal',
  '/inventory/adjustments',
  '/inventory/physical-counts',
  '/inventory/scrap',
  '/inventory/purchases',
  '/inventory/purchase-orders',
  '/inventory/replenishment',
  '/inventory/opening-balance',
  '/inventory/customer-returns',
  '/inventory/supplier-returns',
  '/inventory/locations',
  '/inventory/putaway-rules',
  '/inventory/products',
  '/inventory/categories',
  '/inventory/attributes',
  '/inventory/catalog-uoms',
  '/inventory/settings',
];

/** True for standalone Inventory app routes. */
export function isInventoryAdminNavPath(pathname: string): boolean {
  if (pathname === '/inventory' || pathname.startsWith('/inventory/')) return true;
  return INVENTORY_ADMIN_PATHS.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export function flattenInventoryNavItems(group: InventoryAdminNavGroup): InventoryAdminNavItem[] {
  return group.sections.flatMap((section) => section.items);
}
