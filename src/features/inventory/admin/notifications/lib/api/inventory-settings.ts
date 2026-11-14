import { apiRequest } from '@/features/hr/lib/api/client';

export type InventoryCostingStatus = 'disabled' | 'active';
export type InventoryCostingMethod =
  | 'moving_average'
  | 'fifo'
  | 'lifo'
  | 'standard'
  | 'specific'
  | 'periodic_weighted_average';
export type InventoryCostingScope = 'company' | 'warehouse';

export type InventoryCompanySettings = {
  id: string;
  companyId: string;
  batchAllocationStrategy: 'fifo' | 'lifo' | 'fefo';
  costingStatus: InventoryCostingStatus;
  costingMethod: InventoryCostingMethod;
  costingScope: InventoryCostingScope;
  /** Cost movements exist: method and scope can no longer change. */
  costingLocked?: boolean;
  costingCurrency: string | null;
  quantityDisplayDecimals: number;
  costDisplayDecimals: number;
  notificationsEnabled: boolean;
  notifyLowStock: boolean;
  notifyOutOfStock: boolean;
  notifyNegativeStockBlocked: boolean;
  notifyReceiptCompleted: boolean;
  notifyIssueCompleted: boolean;
  notifyTransferCompleted: boolean;
  notifyAdjustmentPosted: boolean;
  notifyPhysicalCountCompleted: boolean;
  notifyScrapPosted: boolean;
  notifyOperationUndone: boolean;
  notifySaleStockDeducted: boolean;
  /** YYYY-MM-DD: nothing is posted dated on or before it. */
  periodLockDate?: string | null;
  periodLockSetAt?: string | null;
  periodLockSetBy?: string | null;
  periodLockSetByName?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type UpdateInventoryCompanySettingsDto = Partial<
  Pick<
    InventoryCompanySettings,
    | 'batchAllocationStrategy'
    | 'costingStatus'
    | 'costingMethod'
    | 'costingScope'
    | 'costingCurrency'
    | 'quantityDisplayDecimals'
    | 'costDisplayDecimals'
    | 'notificationsEnabled'
    | 'notifyLowStock'
    | 'notifyOutOfStock'
    | 'notifyNegativeStockBlocked'
    | 'notifyReceiptCompleted'
    | 'notifyIssueCompleted'
    | 'notifyTransferCompleted'
    | 'notifyAdjustmentPosted'
    | 'notifyPhysicalCountCompleted'
    | 'notifyScrapPosted'
    | 'notifyOperationUndone'
    | 'notifySaleStockDeducted'
    | 'periodLockDate'
  >
> & {
  updatedBy?: string;
};

export const inventorySettingsApi = {
  getByCompanyId(companyId: string) {
    return apiRequest<InventoryCompanySettings>(`/inventory/settings/company/${companyId}`);
  },

  update(companyId: string, dto: UpdateInventoryCompanySettingsDto) {
    return apiRequest<InventoryCompanySettings>(`/inventory/settings/company/${companyId}`, {
      method: 'PATCH',
      body: dto,
    });
  },
};
