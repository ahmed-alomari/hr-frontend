import { round2 } from '@/features/pos/lib/calc';
import type { PosSale } from '@/features/pos/domain/types';

export type MenuCategoryReportRow = {
  /** Null: lines of no group (or sold before groups were kept on the sale). */
  id: string | null;
  name: string;
  createdAt: string | null;
  productCount: number;
  soldQuantity: number;
  returnedQuantity: number;
  /** What was sold net of returns, with its discount and tax. */
  netSales: number;
  invoices: number;
};

type Category = { id: string; name: string; productCount?: number; createdAt?: string };

/**
 * The register's selling groups: each one added, how many products it holds,
 * and what was sold of them in the period (completed sales). A group nothing
 * sold from stays listed with zeros: the report is of the groups, not of sales.
 */
export function menuCategoryReport(
  categories: Category[],
  sales: PosSale[],
  fromIso: string | null,
): MenuCategoryReportRow[] {
  const rows = new Map<string | null, MenuCategoryReportRow & { saleIds: Set<string> }>();
  const row = (id: string | null, name: string) => {
    const known = rows.get(id);
    if (known) return known;
    const created = { id, name, createdAt: null, productCount: 0, soldQuantity: 0, returnedQuantity: 0, netSales: 0, invoices: 0, saleIds: new Set<string>() };
    rows.set(id, created);
    return created;
  };
  for (const c of categories) {
    const r = row(c.id, c.name);
    r.createdAt = c.createdAt ?? null;
    r.productCount = c.productCount ?? 0;
  }
  for (const sale of sales) {
    if (sale.status !== 'completed') continue;
    if (fromIso && (sale.completedAt ?? sale.createdAt) < fromIso) continue;
    for (const line of sale.lines) {
      const r = row(line.menuCategoryId ?? null, line.menuCategoryName ?? 'بلا فئة');
      const returned = Math.min(line.returnedQuantity ?? 0, line.quantity);
      r.soldQuantity += line.quantity;
      r.returnedQuantity += returned;
      if (line.quantity > 0) r.netSales = round2(r.netSales + (line.total * (line.quantity - returned)) / line.quantity);
      r.saleIds.add(sale.id);
    }
  }
  return [...rows.values()]
    .map(({ saleIds, ...r }) => ({ ...r, invoices: saleIds.size }))
    .sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : b.netSales - a.netSales || a.name.localeCompare(b.name)));
}
