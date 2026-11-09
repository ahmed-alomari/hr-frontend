import { apiRequest } from '@/features/hr/lib/api/client';

/**
 * What the register sells, from POS's own read of the products (`pos.sell`):
 * a cashier holds no right on the products app, and no cost reaches him.
 */

export type PosCatalogProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  categoryId: string | null;
  /** Selling group chosen on the product. */
  posMenuCategoryId: string | null;
  imageUrl: string | null;
};

export type PosCatalogVariant = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  price: number | null;
};

export async function fetchPosProducts(
  companyId: string,
  options: { onlyPosAvailable: boolean },
): Promise<PosCatalogProduct[]> {
  const rows = await apiRequest<PosCatalogProduct[]>('/pos/catalog', {
    query: { companyId, onlyPosAvailable: options.onlyPosAvailable ? true : undefined },
    throwOnError: true,
  });
  return Array.isArray(rows) ? rows : [];
}

export async function fetchPosVariants(companyId: string, productId: string): Promise<PosCatalogVariant[]> {
  const rows = await apiRequest<PosCatalogVariant[]>(`/pos/catalog/${productId}/variants`, {
    query: { companyId },
    throwOnError: true,
  });
  return Array.isArray(rows) ? rows : [];
}

/** A scanned barcode or SKU, of a product or a variant. */
export async function resolvePosScan(
  companyId: string,
  code: string,
): Promise<{ productId: string; variantId: string | null } | null> {
  return apiRequest<{ productId: string; variantId: string | null } | null>('/pos/catalog/scan', {
    query: { companyId, code },
    throwOnError: true,
    silent: true,
  });
}

/** Sample items so the design can be reviewed without catalog data. */
export const DEMO_POS_PRODUCTS: PosCatalogProduct[] = [
  { id: 'demo-1', name: 'قهوة عربية 250 غ', sku: 'CF-250', barcode: '1000000000011', price: 35, categoryId: null, posMenuCategoryId: null, imageUrl: null },
  { id: 'demo-2', name: 'شاي أخضر', sku: 'TEA-GR', barcode: '1000000000028', price: 18, categoryId: null, posMenuCategoryId: null, imageUrl: null },
  { id: 'demo-3', name: 'تمر سكري 1 كغ', sku: 'DT-1K', barcode: '1000000000035', price: 42, categoryId: null, posMenuCategoryId: null, imageUrl: null },
  { id: 'demo-4', name: 'ماء معدني 330 مل', sku: 'WT-330', barcode: '1000000000042', price: 1.5, categoryId: null, posMenuCategoryId: null, imageUrl: null },
  { id: 'demo-5', name: 'عسل سدر 500 غ', sku: 'HN-500', barcode: '1000000000059', price: 120, categoryId: null, posMenuCategoryId: null, imageUrl: null },
  { id: 'demo-6', name: 'كوب حراري', sku: 'MUG-01', barcode: '1000000000066', price: 55, categoryId: null, posMenuCategoryId: null, imageUrl: null },
  { id: 'demo-7', name: 'بسكويت شوكولاتة', sku: 'BS-CH', barcode: '1000000000073', price: 6, categoryId: null, posMenuCategoryId: null, imageUrl: null },
  { id: 'demo-8', name: 'زيت زيتون 1 لتر', sku: 'OL-1L', barcode: '1000000000080', price: 48, categoryId: null, posMenuCategoryId: null, imageUrl: null },
];
