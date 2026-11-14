import { apiRequest } from '@/shared/api/client';

export type PosMenuCategoryRow = {
  id: string;
  name: string;
  sortOrder: number;
  /** Products in this group (not archived). */
  productCount?: number;
  createdAt?: string;
};

export async function fetchPosMenuCategories(companyId: string): Promise<PosMenuCategoryRow[]> {
  const rows = await apiRequest<PosMenuCategoryRow[]>('/pos/menu-categories', {
    query: { companyId },
    throwOnError: true,
  });
  return Array.isArray(rows) ? rows : [];
}

export async function savePosMenuCategories(
  companyId: string,
  categories: Array<{ id?: string; name: string }>,
): Promise<PosMenuCategoryRow[]> {
  const rows = await apiRequest<PosMenuCategoryRow[]>('/pos/menu-categories', {
    method: 'PUT',
    body: { companyId, categories },
    throwOnError: true,
  });
  return Array.isArray(rows) ? rows : [];
}
