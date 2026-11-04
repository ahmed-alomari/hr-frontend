import type { ListColumnOption } from '@/components/ui/list-columns-picker';
import type { ListGroupOption } from '@/components/ui/list-group';
import type { ListSortOption } from '@/components/ui/list-sort';
import type { RegisterExportColumn } from '@/components/pdf/lib/register-export-rows';
import { PRODUCT_STATUS_LABELS_AR } from '@/features/ecommerce/domain/constants/product-status';
import { STOCK_STATUS_LABELS_AR } from '@/features/ecommerce/domain/constants/stock-status';
import type { Product } from '@/features/ecommerce/domain/types/product';
import { formatPrice } from '@/features/ecommerce/shared/utils/format-price';
import { APP, type AppRequirement } from '@/shared/modules/company-apps';

/**
 * The products list's sort, grouping and columns (list-screens skill). Sort
 * keys are the list's own (`sort` / `sortDirection`, shared with inventory
 * and POS); group keys are the server's (`PRODUCTS_GROUP`).
 */
export const PRODUCTS_SORT_OPTIONS: readonly (ListSortOption & AppRequirement)[] = [
  { key: 'name', label: 'الاسم' },
  { key: 'sku', label: 'رمز المنتج' },
  { key: 'price', label: 'السعر' },
  { key: 'ownQuantity', label: 'الكمية' },
  { key: 'stock', label: 'في المخازن', requiresApp: APP.inventory },
  { key: 'createdAt', label: 'تاريخ الإضافة' },
  { key: 'updatedAt', label: 'آخر تحديث' },
];

export const PRODUCTS_GROUP_OPTIONS: readonly ListGroupOption[] = [
  { key: 'category', label: 'التصنيف', emptyLabel: 'بدون تصنيف' },
  { key: 'brand', label: 'العلامة التجارية', emptyLabel: 'بدون علامة' },
  { key: 'status', label: 'الحالة', formatKey: (k) => PRODUCT_STATUS_LABELS_AR[k as Product['status']] ?? k },
];

/** Columns the user may hide (the product and the price always show). */
export const PRODUCTS_COLUMN_OPTIONS: readonly (ListColumnOption & AppRequirement)[] = [
  { key: 'costPrice', label: 'تكلفة الكاتالوج' },
  { key: 'ownQuantity', label: 'الكمية' },
  { key: 'quantity', label: 'في المخازن', requiresApp: APP.inventory },
  { key: 'stockStatus', label: 'التوفر', requiresApp: APP.storeAdmin },
  { key: 'status', label: 'الحالة' },
];

/** The printed / Excel register of products; `key` ties a column to the screen's. */
export function productsExportColumns(names: {
  category: (id: string | null | undefined) => string;
  brand: (id: string | null | undefined) => string;
}): (RegisterExportColumn<Product> & AppRequirement)[] {
  return [
    { label: 'رمز المنتج', kind: 'code', value: (p) => p.sku },
    { label: 'المنتج', kind: 'name', value: (p) => p.nameAr },
    { label: 'التصنيف', kind: 'text', value: (p) => names.category(p.categoryId) },
    { label: 'العلامة التجارية', kind: 'text', value: (p) => names.brand(p.brandId) },
    { label: 'السعر', kind: 'number', value: (p) => formatPrice(p.price) },
    {
      key: 'costPrice',
      label: 'التكلفة',
      kind: 'number',
      value: (p) => (p.costPrice ? formatPrice(p.costPrice) : ''),
    },
    {
      key: 'ownQuantity',
      label: 'الكمية',
      kind: 'number',
      value: (p) => (p.ownQuantity === null || p.ownQuantity === undefined ? '' : String(p.ownQuantity)),
    },
    {
      key: 'quantity',
      label: 'في المخازن',
      kind: 'number',
      requiresApp: APP.inventory,
      value: (p) => String(p.inventory.quantity ?? ''),
    },
    {
      key: 'stockStatus',
      label: 'التوفر',
      kind: 'status',
      requiresApp: APP.storeAdmin,
      value: (p) => STOCK_STATUS_LABELS_AR[p.stockStatus] ?? p.stockStatus,
    },
    { key: 'status', label: 'الحالة', kind: 'status', value: (p) => PRODUCT_STATUS_LABELS_AR[p.status] ?? p.status },
  ];
}
