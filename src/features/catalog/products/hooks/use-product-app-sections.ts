'use client';

import {
  APP,
  useCompanyApps,
  type AppRequirement,
  type CompanyApps,
} from '@/shared/modules/company-apps';
import { PUTAWAY_RULES_ENABLED } from '@/features/inventory/admin/putaway-rules/lib/putaway-feature';

/**
 * Which apps' sections the product screens show (phase 2.5). The product
 * itself is the catalog's; stock fields (warehouse, cost, tracking, quantity,
 * batches, stock moves) are inventory's and listing fields (compare-at price,
 * promos, stockStatus, reviews) are the store's. A section shows only when
 * its app is enabled for the company (`useCompanyApps`: the company's own
 * apps, whoever views, nothing until they are known) — its API refuses otherwise.
 *
 * Tabs and related documents declare their app on their definition
 * (`requiresApp` / `requiresAnyApp`) and are filtered with `apps.filter`.
 */
export type ProductAppSections = { inventory: boolean; store: boolean; pos: boolean };

export function productAppSectionsFrom(apps: CompanyApps): ProductAppSections {
  return {
    inventory: apps.isEnabled(APP.inventory),
    store: apps.isEnabled(APP.storeAdmin),
    pos: apps.isEnabled(APP.pos),
  };
}

export function useProductAppSections(): ProductAppSections {
  return productAppSectionsFrom(useCompanyApps());
}

/**
 * A channel sells from the product's own quantity (backend decisions.md §21):
 * the store without the store-stock-sync bridge, or the point of sale without
 * the pos-stock-sync bridge. Both take from the same quantity.
 */
export function productsSellLocallyFrom(apps: CompanyApps): boolean {
  return (
    (apps.isEnabled(APP.storeAdmin) && !apps.isEnabled(APP.storeStockSync)) ||
    (apps.isEnabled(APP.pos) && !apps.isEnabled(APP.posStockSync))
  );
}

export function useProductsSellLocally(): boolean {
  return productsSellLocallyFrom(useCompanyApps());
}

/** Product shortcuts that open inventory screens (after «متغيرات المنتج»). */
export const PRODUCT_INVENTORY_DOCS = [
  {
    key: 'replenish',
    label: 'تجديد المخزون',
    hint: 'أوامر شراء هذا المنتج وحالة استلامها — أنشئ أمر شراء ثم استلمه عند وصول البضاعة',
    requiresApp: APP.inventory,
  },
  {
    key: 'receipts',
    label: 'استلام مخزون',
    hint: 'طلبات الاستلام الخاصة بهذا المنتج',
    requiresApp: APP.inventory,
  },
  {
    key: 'issues',
    label: 'صرف مخزون',
    hint: 'طلبات الصرف الخاصة بهذا المنتج',
    requiresApp: APP.inventory,
  },
  {
    key: 'internals',
    label: 'نقل المواقع',
    hint: 'نقل بين مواقع داخل نفس المستودع (ليس بين مستودعات)',
    requiresApp: APP.inventory,
  },
  {
    key: 'moves',
    label: 'سجل الحركات',
    hint: 'كل حركات المخزون المرتبطة بهذا المنتج',
    requiresApp: APP.inventory,
  },
  {
    key: 'putaway',
    label: 'قواعد التخزين',
    hint: 'فتح قائمة قواعد التخزين لهذا المنتج',
    requiresApp: APP.inventory,
  },
] as const satisfies ReadonlyArray<{ key: string; label: string; hint: string } & AppRequirement>;

/** Related documents shown on a product, minus the ones switched off. */
export function visibleRelatedDocs<T extends { key: string }>(
  docs: readonly T[],
  apps: CompanyApps,
): T[] {
  return apps.filter(docs).filter((doc) => doc.key !== 'putaway' || PUTAWAY_RULES_ENABLED);
}
