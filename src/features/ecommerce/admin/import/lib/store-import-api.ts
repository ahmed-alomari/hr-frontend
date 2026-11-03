import { ApiError, apiDownloadToDevice, apiFormRequest } from '@/shared/api/client';
import { resolveStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';

/**
 * Store products import (`/store-admin/companies/:companyId/import`): the
 * template, a preview that saves nothing, and a commit that saves the whole
 * file or nothing. Types mirror `store-import.service.ts` in the backend.
 */
export type StoreImportSheetKey = 'products' | 'variants';

export type StoreImportIssue = {
  sheet: StoreImportSheetKey;
  row: number | null;
  field: string | null;
  level: 'error' | 'warning';
  code: string;
  message: string;
  fix: string | null;
  suggestions?: string[];
};

export type StoreImportColumn = {
  index: number;
  header: string;
  field: string | null;
  confidence: number;
  samples: string[];
};

export type StoreImportField = { key: string; labelAr: string; required: boolean; helpAr: string };

export type StoreImportSheet = {
  key: StoreImportSheetKey;
  sheetName: string;
  headerRow: number;
  rows: number;
  columns: StoreImportColumn[];
  fields: StoreImportField[];
};

export type StoreImportPreview = {
  fileType: 'xlsx' | 'csv';
  linkedToInventory: boolean;
  sheets: StoreImportSheet[];
  counts: {
    productsCreated: number;
    productsUpdated: number;
    variantsCreated: number;
    variantsUpdated: number;
    categoriesCreated: string[];
    /** Older servers omit it. */
    brandsCreated?: string[];
    quantitiesSet: number;
    /** Pictures inside the Excel file (not links); older servers omit it. */
    imagesInFile?: number;
  };
  errors: number;
  warnings: number;
  issues: StoreImportIssue[];
  canCommit: boolean;
};

export type StoreImportOptions = {
  sheet?: StoreImportSheetKey;
  /** Per sheet: file header → field key ('' = do not import). */
  mapping?: Partial<Record<StoreImportSheetKey, Record<string, string>>>;
  publish?: boolean;
  /** Create and link missing categories and brands (default), or refuse them. */
  createMissing?: boolean;
};

const base = (companyId: string) => `/store-admin/companies/${resolveStorefrontCompanyId(companyId)}/import`;

function form(file: File, options: StoreImportOptions): FormData {
  const data = new FormData();
  data.append('file', file);
  data.append('options', JSON.stringify(options));
  return data;
}

/** The preview a refused commit carries (the file changed or the catalog did). */
export function previewFromError(error: unknown): StoreImportPreview | null {
  if (!(error instanceof ApiError)) return null;
  const payload = error.payload as { error?: { preview?: StoreImportPreview } } | null;
  return payload?.error?.preview ?? null;
}

export const storeImportApi = {
  downloadTemplate(companyId: string, format: 'xlsx' | 'csv', sheet: StoreImportSheetKey = 'products') {
    return apiDownloadToDevice(`${base(companyId)}/template`, {
      query: { format, sheet },
      defaultFileName: format === 'csv' ? `store-${sheet}-template.csv` : 'store-products-template.xlsx',
    });
  },

  preview(companyId: string, file: File, options: StoreImportOptions) {
    return apiFormRequest<StoreImportPreview>(`${base(companyId)}/preview`, form(file, options));
  },

  commit(companyId: string, file: File, options: StoreImportOptions) {
    return apiFormRequest<StoreImportPreview>(`${base(companyId)}/commit`, form(file, options));
  },
};
