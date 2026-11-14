import { useQuery } from '@tanstack/react-query';
import { ApiError, apiRequest, type PaginatedResult } from '@/features/hr/lib/api/client';

export type ReportProduct = {
  id: string;
  nameAr: string;
  sku: string;
  trackInventory: boolean;
  lowStockThreshold: number;
};

type ProductRow = {
  id: string;
  nameAr: string;
  sku: string;
  trackInventory?: boolean | null;
  lowStockThreshold?: string | number | null;
};

const toReportProduct = (row: ProductRow): ReportProduct => ({
  id: row.id,
  nameAr: row.nameAr,
  sku: row.sku,
  trackInventory: row.trackInventory ?? true,
  lowStockThreshold: Number(row.lowStockThreshold ?? 0),
});

/** Every active product of the company (no media, no page cap) for stock reports. */
export function useReportProducts(companyId: string) {
  return useQuery({
    queryKey: ['inventory', 'report-products', companyId],
    enabled: Boolean(companyId),
    staleTime: 60_000,
    queryFn: async (): Promise<ReportProduct[]> => {
      // One light answer (id, name, sku, two stock settings) instead of the
      // full product list read page by page.
      try {
        const rows = await apiRequest<ProductRow[]>('/inventory/products/lookup', {
          query: { companyId },
          silent: true,
          throwOnError: true,
        });
        return (rows ?? []).map(toReportProduct);
      } catch (err) {
        // A server without the lookup yet (deployed after this screen): the former reading.
        if (!(err instanceof ApiError) || (err.status !== 400 && err.status !== 404)) throw err;
      }
      const items: ReportProduct[] = [];
      for (let page = 1; ; page += 1) {
        const result = await apiRequest<PaginatedResult<ProductRow>>('/inventory/products', {
          query: { companyId, page, limit: 500, archiveScope: 'active' },
          throwOnError: true,
        });
        for (const row of result.items ?? []) items.push(toReportProduct(row));
        if (page >= (result.pagination?.totalPages ?? 1)) return items;
      }
    },
  });
}
