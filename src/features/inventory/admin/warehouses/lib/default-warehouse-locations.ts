import type {
  CreateWarehouseLocationInput,
  Warehouse,
  WarehouseLocationType,
  WarehouseRemovalStrategy,
} from '@/features/inventory/domain/types/warehouse';

export type DefaultWarehouseLocationDraft = CreateWarehouseLocationInput & {
  /** Stable key within this seed batch (for parent linking before IDs exist). */
  tempKey: string;
  parentTempKey?: string;
};

type SeedSpec = {
  tempKey: string;
  /** Path segment after warehouse code, or empty for the warehouse view root. */
  pathSuffix: string;
  nameAr: string;
  nameEn: string;
  locationType: WarehouseLocationType;
  parentTempKey?: string;
  removalStrategy?: WarehouseRemovalStrategy;
};

/**
 * Fixed system locations created for every warehouse:
 * Customers, Inventory adjustment, Production, Vendors, {CODE}, {CODE}/Stock.
 */
const FIXED_LOCATION_SPECS: SeedSpec[] = [
  {
    tempKey: 'customers',
    pathSuffix: 'Customers',
    nameAr: 'العميل',
    nameEn: 'Customers',
    locationType: 'customer',
  },
  {
    tempKey: 'inventory',
    pathSuffix: 'Inventory adjustment',
    nameAr: 'خسارة المخزون',
    nameEn: 'Inventory adjustment',
    locationType: 'inventory',
  },
  {
    tempKey: 'production',
    pathSuffix: 'Production',
    nameAr: 'الإنتاج',
    nameEn: 'Production',
    locationType: 'production',
  },
  {
    tempKey: 'vendors',
    pathSuffix: 'Vendors',
    nameAr: 'المورد',
    nameEn: 'Vendors',
    locationType: 'supplier',
  },
  {
    tempKey: 'view',
    pathSuffix: '',
    nameAr: '', // filled with warehouse code
    nameEn: '',
    locationType: 'view',
  },
  {
    tempKey: 'stock',
    pathSuffix: 'Stock',
    nameAr: '', // filled as CODE/Stock
    nameEn: 'Stock',
    locationType: 'internal',
    parentTempKey: 'view',
  },
  {
    tempKey: 'transit',
    pathSuffix: 'Transit',
    nameAr: '',
    nameEn: 'Transit',
    locationType: 'transit',
    parentTempKey: 'view',
  },
];

function baseFields(
  warehouse: Warehouse,
  overrides: Partial<CreateWarehouseLocationInput> &
    Pick<CreateWarehouseLocationInput, 'code' | 'nameAr' | 'locationType'>,
): CreateWarehouseLocationInput {
  return {
    companyId: warehouse.companyId,
    warehouseId: warehouse.id,
    replenish: false,
    cycleCountFrequencyDays: 0,
    removalStrategy: 'fifo',
    isActive: true,
    isSystem: true,
    parentLocationId: null,
    ...overrides,
  };
}

/**
 * Builds the fixed system locations for a new warehouse.
 * `{CODE}/Stock` is nested under the warehouse view `{CODE}`.
 */
export function buildDefaultWarehouseLocations(warehouse: Warehouse): DefaultWarehouseLocationDraft[] {
  const prefix = warehouse.code.trim() || 'WH';

  return FIXED_LOCATION_SPECS.map((spec) => {
    const code = spec.pathSuffix ? `${prefix}/${spec.pathSuffix}` : prefix;
    const nameAr =
      spec.tempKey === 'view'
        ? prefix
        : spec.tempKey === 'stock'
          ? `${prefix}/Stock`
          : spec.tempKey === 'transit'
            ? `${prefix}/Transit`
            : spec.nameAr;
    const nameEn =
      spec.tempKey === 'view'
        ? prefix
        : spec.tempKey === 'stock'
          ? `${prefix}/Stock`
          : spec.tempKey === 'transit'
            ? `${prefix}/Transit`
            : spec.nameEn;

    return {
      ...baseFields(warehouse, {
        code,
        nameAr,
        nameEn,
        locationType: spec.locationType,
        removalStrategy: spec.removalStrategy ?? 'fifo',
      }),
      tempKey: spec.tempKey,
      parentTempKey: spec.parentTempKey,
    };
  });
}
