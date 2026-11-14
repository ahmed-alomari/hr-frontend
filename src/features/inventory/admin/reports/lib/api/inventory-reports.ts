import { apiRequest } from '@/shared/api/client';
import { toNumber } from '@/features/inventory/lib/api/numbers';
import type { WarehouseOperationKind } from '@/features/inventory/domain/types/warehouse';

/** Why values are not shown (quantities always are). */
export type ReportValueHiddenReason = 'no_permission' | 'costing_disabled' | 'company_average';

export type ReportHeader = {
  companyId: string;
  warehouseId: string | null;
  dateFrom: string | null;
  dateTo: string;
  valueVisible: boolean;
  valueHiddenReason: ReportValueHiddenReason | null;
  currency: string | null;
};

export type ReportPagination = { page: number; limit: number; total: number; totalPages: number };

export type ReportScopeQuery = {
  companyId: string;
  warehouseId?: string;
  /** YYYY-MM-DD, company calendar day, inclusive. */
  dateFrom?: string;
  dateTo?: string;
};

type PagedQuery = { page?: number; limit?: number; sortBy?: string; sortDir?: 'asc' | 'desc' };

type Raw = Record<string, unknown>;
type RawPaged = ReportHeader & { items?: Raw[]; totals?: Raw; pagination?: ReportPagination };

const n = (v: unknown) => toNumber(v as string | number | null | undefined);
const money = (v: unknown): number | null => (v == null || v === '' ? null : n(v));
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

function header(raw: Partial<ReportHeader>): ReportHeader {
  return {
    companyId: raw.companyId ?? '',
    warehouseId: raw.warehouseId ?? null,
    dateFrom: raw.dateFrom ?? null,
    dateTo: raw.dateTo ?? '',
    valueVisible: raw.valueVisible === true,
    valueHiddenReason: raw.valueHiddenReason ?? null,
    currency: raw.currency ?? null,
  };
}

function pagination(raw: ReportPagination | undefined, fallbackLimit: number): ReportPagination {
  return {
    page: raw?.page ?? 1,
    limit: raw?.limit ?? fallbackLimit,
    total: raw?.total ?? 0,
    totalPages: raw?.totalPages ?? 0,
  };
}

// ——— حركة المخزون الدورية / التقييم ———

export type StockMovementQuery = ReportScopeQuery &
  PagedQuery & {
    categoryId?: string;
    search?: string;
    /** `closing`: only items with a balance at `dateTo` (valuation). */
    rows?: 'moved' | 'closing';
  };

export type StockMovementFigures = {
  openingQty: number;
  inQty: number;
  outQty: number;
  closingQty: number;
  openingValue: number | null;
  inValue: number | null;
  outValue: number | null;
  closingValue: number | null;
};

export type StockMovementRow = StockMovementFigures & {
  key: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  categoryName: string | null;
};

export type StockMovementReport = ReportHeader & {
  items: StockMovementRow[];
  totals: StockMovementFigures;
  pagination: ReportPagination;
};

function figures(r: Raw): StockMovementFigures {
  return {
    openingQty: n(r.openingQty),
    inQty: n(r.inQty),
    outQty: n(r.outQty),
    closingQty: n(r.closingQty),
    openingValue: money(r.openingValue),
    inValue: money(r.inValue),
    outValue: money(r.outValue),
    closingValue: money(r.closingValue),
  };
}

// ——— كرت الصنف ———

export type ItemCardQuery = ReportScopeQuery & {
  productId: string;
  variantId?: string;
  page?: number;
  limit?: number;
};

export type ItemCardRow = {
  key: string;
  occurredAt: string;
  operationId: string | null;
  reference: string | null;
  kind: WarehouseOperationKind | null;
  isUndo: boolean;
  partnerName: string | null;
  sourceDocument: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  inQty: number;
  outQty: number;
  balanceQty: number;
  valueDelta: number | null;
  unitCost: number | null;
  balanceValue: number | null;
};

export type ItemCardReport = ReportHeader & {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  opening: { qty: number; value: number | null };
  totals: { inQty: number; outQty: number; inValue: number | null; outValue: number | null };
  closing: { qty: number; value: number | null };
  items: ItemCardRow[];
  pagination: ReportPagination;
};

// ——— تحليل الحركات ———

export type MovesAnalysisQuery = ReportScopeQuery & { kind?: WarehouseOperationKind };

export type MovesAnalysisFigures = {
  operationCount: number;
  lineCount: number;
  inQty: number;
  outQty: number;
  netQty: number;
  inValue: number | null;
  outValue: number | null;
};

export type MovesAnalysisRow = MovesAnalysisFigures & {
  key: string;
  kind: WarehouseOperationKind;
  warehouseId: string;
  warehouseName: string | null;
};

export type MovesAnalysisReport = ReportHeader & {
  items: MovesAnalysisRow[];
  totals: MovesAnalysisFigures;
};

function analysisFigures(r: Raw): MovesAnalysisFigures {
  return {
    operationCount: n(r.operationCount),
    lineCount: n(r.lineCount),
    inQty: n(r.inQty),
    outQty: n(r.outQty),
    netQty: n(r.netQty),
    inValue: money(r.inValue),
    outValue: money(r.outValue),
  };
}

// ——— فروقات الجرد ———

export type CountVarianceQuery = ReportScopeQuery &
  PagedQuery & { direction?: 'shortage' | 'surplus'; search?: string };

export type CountVarianceRow = {
  lineId: string;
  operationId: string;
  reference: string;
  kind: WarehouseOperationKind;
  occurredAt: string;
  warehouseId: string;
  warehouseName: string | null;
  locationName: string | null;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  systemQty: number;
  countedQty: number;
  difference: number;
  differenceValue: number | null;
};

export type CountVarianceReport = ReportHeader & {
  items: CountVarianceRow[];
  totals: {
    lines: number;
    documents: number;
    shortageQty: number;
    surplusQty: number;
    shortageValue: number | null;
    surplusValue: number | null;
    netValue: number | null;
  };
  pagination: ReportPagination;
};

// ——— الأصناف الراكدة ———

export type SlowMovingQuery = Omit<ReportScopeQuery, 'dateFrom' | 'dateTo'> &
  PagedQuery & { idleDays?: number; categoryId?: string; search?: string };

export type SlowMovingRow = {
  key: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  categoryName: string | null;
  onHand: number;
  value: number | null;
  lastOutAt: string | null;
  firstInAt: string | null;
  idleDays: number;
};

export type SlowMovingReport = ReportHeader & {
  idleDays: number;
  items: SlowMovingRow[];
  totals: { items: number; onHand: number; value: number | null };
  pagination: ReportPagination;
};

const itemKey = (productId: unknown, variantId: unknown) => `${String(productId)}:${String(variantId ?? '')}`;

export const inventoryReportsApi = {
  async stockMovement(query: StockMovementQuery): Promise<StockMovementReport> {
    const raw = await apiRequest<RawPaged>('/inventory/reports/stock-movement', {
      throwOnError: true,
      query: { ...query, page: query.page ?? 1, limit: query.limit ?? 50 },
    });
    return {
      ...header(raw),
      items: (raw.items ?? []).map((r) => ({
        ...figures(r),
        key: itemKey(r.productId, r.variantId),
        productId: String(r.productId),
        variantId: str(r.variantId),
        productName: String(r.productName ?? ''),
        variantName: str(r.variantName),
        sku: str(r.sku),
        categoryName: str(r.categoryName),
      })),
      totals: figures(raw.totals ?? {}),
      pagination: pagination(raw.pagination, query.limit ?? 50),
    };
  },

  async itemCard(query: ItemCardQuery): Promise<ItemCardReport> {
    const raw = await apiRequest<
      RawPaged & {
        productId: string;
        variantId: string | null;
        productName: string;
        variantName: string | null;
        sku: string | null;
        opening?: Raw;
        closing?: Raw;
      }
    >('/inventory/reports/item-card', {
      throwOnError: true,
      query: { ...query, page: query.page ?? 1, limit: query.limit ?? 100 },
    });
    const totals = raw.totals ?? {};
    return {
      ...header(raw),
      productId: raw.productId,
      variantId: raw.variantId ?? null,
      productName: raw.productName ?? '',
      variantName: raw.variantName ?? null,
      sku: raw.sku ?? null,
      opening: { qty: n(raw.opening?.qty), value: money(raw.opening?.value) },
      totals: {
        inQty: n(totals.inQty),
        outQty: n(totals.outQty),
        inValue: money(totals.inValue),
        outValue: money(totals.outValue),
      },
      closing: { qty: n(raw.closing?.qty), value: money(raw.closing?.value) },
      items: (raw.items ?? []).map((r) => ({
        key: String(r.key),
        occurredAt: String(r.occurredAt),
        operationId: str(r.operationId),
        reference: str(r.reference),
        kind: (str(r.kind) as WarehouseOperationKind | null) ?? null,
        isUndo: r.isUndo === true,
        partnerName: str(r.partnerName),
        sourceDocument: str(r.sourceDocument),
        warehouseId: str(r.warehouseId),
        warehouseName: str(r.warehouseName),
        inQty: n(r.inQty),
        outQty: n(r.outQty),
        balanceQty: n(r.balanceQty),
        valueDelta: money(r.valueDelta),
        unitCost: money(r.unitCost),
        balanceValue: money(r.balanceValue),
      })),
      pagination: pagination(raw.pagination, query.limit ?? 100),
    };
  },

  async movesAnalysis(query: MovesAnalysisQuery): Promise<MovesAnalysisReport> {
    const raw = await apiRequest<RawPaged>('/inventory/reports/moves-analysis', {
      throwOnError: true,
      query,
    });
    return {
      ...header(raw),
      items: (raw.items ?? []).map((r) => ({
        ...analysisFigures(r),
        key: String(r.key),
        kind: r.kind as WarehouseOperationKind,
        warehouseId: String(r.warehouseId),
        warehouseName: str(r.warehouseName),
      })),
      totals: analysisFigures(raw.totals ?? {}),
    };
  },

  async countVariances(query: CountVarianceQuery): Promise<CountVarianceReport> {
    const raw = await apiRequest<RawPaged>('/inventory/reports/count-variances', {
      throwOnError: true,
      query: { ...query, page: query.page ?? 1, limit: query.limit ?? 50 },
    });
    const t = raw.totals ?? {};
    return {
      ...header(raw),
      items: (raw.items ?? []).map((r) => ({
        lineId: String(r.lineId),
        operationId: String(r.operationId),
        reference: String(r.reference ?? ''),
        kind: r.kind as WarehouseOperationKind,
        occurredAt: String(r.occurredAt),
        warehouseId: String(r.warehouseId),
        warehouseName: str(r.warehouseName),
        locationName: str(r.locationName),
        productId: String(r.productId),
        variantId: str(r.variantId),
        productName: String(r.productName ?? ''),
        variantName: str(r.variantName),
        sku: str(r.sku),
        systemQty: n(r.systemQty),
        countedQty: n(r.countedQty),
        difference: n(r.difference),
        differenceValue: money(r.differenceValue),
      })),
      totals: {
        lines: n(t.lines),
        documents: n(t.documents),
        shortageQty: n(t.shortageQty),
        surplusQty: n(t.surplusQty),
        shortageValue: money(t.shortageValue),
        surplusValue: money(t.surplusValue),
        netValue: money(t.netValue),
      },
      pagination: pagination(raw.pagination, query.limit ?? 50),
    };
  },

  async slowMoving(query: SlowMovingQuery): Promise<SlowMovingReport> {
    const raw = await apiRequest<RawPaged & { idleDays?: number }>('/inventory/reports/slow-moving', {
      throwOnError: true,
      query: { ...query, page: query.page ?? 1, limit: query.limit ?? 50 },
    });
    const t = raw.totals ?? {};
    return {
      ...header(raw),
      idleDays: raw.idleDays ?? query.idleDays ?? 90,
      items: (raw.items ?? []).map((r) => ({
        key: itemKey(r.productId, r.variantId),
        productId: String(r.productId),
        variantId: str(r.variantId),
        productName: String(r.productName ?? ''),
        variantName: str(r.variantName),
        sku: str(r.sku),
        categoryName: str(r.categoryName),
        onHand: n(r.onHand),
        value: money(r.value),
        lastOutAt: str(r.lastOutAt),
        firstInAt: str(r.firstInAt),
        idleDays: n(r.idleDays),
      })),
      totals: { items: n(t.items), onHand: n(t.onHand), value: money(t.value) },
      pagination: pagination(raw.pagination, query.limit ?? 50),
    };
  },
};
