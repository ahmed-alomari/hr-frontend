import { APP, type AppRequirement } from '@/shared/modules/company-apps';
import type { InventoryCompanySettings } from '@/features/inventory/admin/notifications/lib/api/inventory-settings';
import type {
  NotificationToggleGroup,
  NotificationToggleItem,
} from '@/features/system/organization/pages/_shared/constants/notification-groups';

export type InventoryNotificationKey = Exclude<
  keyof InventoryCompanySettings,
  | 'id'
  | 'companyId'
  | 'batchAllocationStrategy'
  | 'costingStatus'
  | 'costingMethod'
  | 'costingScope'
  | 'costingCurrency'
  | 'quantityDisplayDecimals'
  | 'costDisplayDecimals'
  | 'createdAt'
  | 'updatedAt'
  | 'createdBy'
  | 'updatedBy'
  | 'costingLocked'
  | 'periodLockDate'
  | 'periodLockSetAt'
  | 'periodLockSetBy'
  | 'periodLockSetByName'
>;

export const INVENTORY_NOTIFICATION_GROUPS: Array<NotificationToggleGroup & AppRequirement> = [
  {
    label: 'عام',
    items: [
      {
        key: 'notificationsEnabled',
        label: 'تفعيل إشعارات المخازن',
        description: 'عند الإيقاف تُعطّل كل إشعارات المخازن لهذه الشركة',
      },
    ] as NotificationToggleItem[],
  },
  {
    label: 'تنبيهات المخزون',
    items: [
      { key: 'notifyLowStock', label: 'مخزون منخفض', description: 'عند وصول الكمية للحد الأدنى' },
      { key: 'notifyOutOfStock', label: 'نفاد مخزون', description: 'عند انتهاء الكمية المتاحة' },
      {
        key: 'notifyNegativeStockBlocked',
        label: 'رفض صرف/بيع بدون رصيد',
        description: 'محاولة بيع أو صرف بدون مخزون كافٍ',
      },
    ] as NotificationToggleItem[],
  },
  {
    label: 'حركات المستودع',
    items: [
      { key: 'notifyReceiptCompleted', label: 'ترحيل استلام مخزون' },
      { key: 'notifyIssueCompleted', label: 'ترحيل صرف مخزون' },
      { key: 'notifyTransferCompleted', label: 'ترحيل تحويل بين مستودعات' },
      { key: 'notifyAdjustmentPosted', label: 'تسوية مخزون' },
      { key: 'notifyPhysicalCountCompleted', label: 'جرد فعلي' },
      { key: 'notifyScrapPosted', label: 'إتلاف' },
      { key: 'notifyOperationUndone', label: 'تراجع عن ترحيل', description: 'إلغاء حركة مُرحّلة سابقاً' },
    ] as NotificationToggleItem[],
  },
  {
    label: 'خصم البيع',
    // Deductions come from the shop-sales app.
    requiresApp: APP.shopSales,
    items: [
      {
        key: 'notifySaleStockDeducted',
        label: 'خصم مخزون البيع',
        description: 'إشعار بعد كل خصم من نقطة البيع — معطّل افتراضياً',
      },
    ] as NotificationToggleItem[],
  },
];
