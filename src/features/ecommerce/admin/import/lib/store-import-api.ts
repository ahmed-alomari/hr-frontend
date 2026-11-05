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
  /** The fix as a click, when it has one meaning (older servers omit it). */
  action?: StoreImportIssueAction;
};

/** `skipRow` leaves the row out; `keepStored` reads the field as the system has it. */
export type StoreImportIssueAction = { type: 'skipRow' } | { type: 'keepStored'; field: string };

export type StoreImportRowRef = { sheet: StoreImportSheetKey; row: number };

/** A value the system lacks (category, brand, unit, attribute or its value). */
export type StoreImportValueField = 'category' | 'brand' | 'uom' | 'attribute' | 'attributeValue';

export type StoreImportUnknownValue = {
  field: StoreImportValueField;
  attribute: string | null;
  value: string;
  rows: number;
  suggestions: string[];
  /** needsChoice: close to a system value, waits for a choice; create: will be created; error: cannot be created. */
  status: 'needsChoice' | 'create' | 'error';
  canCreate: boolean;
};

/** The user's answer for an unknown value: `to` replaces it in every row, null creates it as written. */
export type StoreImportCorrection = {
  field: StoreImportValueField;
  attribute?: string | null;
  from: string;
  to: string | null;
};

export type StoreImportColumn = {
  index: number;
  header: string;
  field: string | null;
  confidence: number;
  samples: string[];
};

export type StoreImportField = {
  key: string;
  labelAr: string;
  required: boolean;
  helpAr: string;
};

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
    /** Rows that match a record and change nothing; older servers omit them. */
    productsUnchanged?: number;
    variantsUnchanged?: number;
    /** Rows left out by one-click fixes. */
    rowsSkipped?: number;
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
  /** Unknown values, each once (older servers omit it). */
  values?: StoreImportUnknownValue[];
  canCommit: boolean;
};

export type StoreImportOptions = {
  sheet?: StoreImportSheetKey;
  /** Per sheet: file header → field key ('' = do not import). */
  mapping?: Partial<Record<StoreImportSheetKey, Record<string, string>>>;
  publish?: boolean;
  /** Create and link missing categories and brands (default), or refuse them. */
  createMissing?: boolean;
  corrections?: StoreImportCorrection[];
  /** One-click fixes: rows left out, cells read as the system has them. */
  skipRows?: StoreImportRowRef[];
  keepCells?: Array<StoreImportRowRef & { field: string }>;
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
  const payload = error.payload as {
    error?: { preview?: StoreImportPreview };
  } | null;
  return payload?.error?.preview ?? null;
}

export const storeImportApi = {
  downloadTemplate(companyId: string, format: 'xlsx' | 'csv', sheet: StoreImportSheetKey = 'products') {
    return apiDownloadToDevice(`${base(companyId)}/template`, {
      query: { format, sheet },
      defaultFileName: format === 'csv' ? `store-${sheet}-template.csv` : 'store-products-template.xlsx',
    });
  },

  /** The store's products as an import file: edit it and upload it back. */
  downloadForEditing(companyId: string) {
    return apiDownloadToDevice(`${base(companyId)}/export`, {
      defaultFileName: `store-products-${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
  },

  preview(companyId: string, file: File, options: StoreImportOptions) {
    return apiFormRequest<StoreImportPreview>(`${base(companyId)}/preview`, form(file, options));
  },

  commit(companyId: string, file: File, options: StoreImportOptions) {
    return apiFormRequest<StoreImportPreview>(`${base(companyId)}/commit`, form(file, options));
  },
};
