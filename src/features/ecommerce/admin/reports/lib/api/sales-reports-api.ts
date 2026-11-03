import { apiRequest, ensurePaginatedResult, type PaginatedResult } from '@/features/hr/lib/api/client';
import type { OrderStatus } from '@/features/ecommerce/domain/types/order';

export type StorePaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type StorePaymentMethod =
  | 'cash_on_delivery'
  | 'cash'
  | 'bank'
  | 'network'
  | 'wallet'
  | 'card'
  | 'other';
export type StoreOrderSource = 'storefront' | 'seed';
export type SalesReportGranularity = 'day' | 'week' | 'month';

export type SalesReportFilters = {
  companyId: string;
  from?: string;
  to?: string;
  status?: OrderStatus | 'all';
  paymentStatus?: StorePaymentStatus | 'all';
  paymentMethod?: StorePaymentMethod | 'all';
  source?: StoreOrderSource | 'all';
  partnerId?: string;
  hasPartner?: boolean;
  city?: string;
  countryId?: string;
  cityId?: string;
  districtId?: string;
  productId?: string;
  variantId?: string;
  categoryId?: string;
  brandId?: string;
  currencyCode?: string;
  search?: string;
  excludeCancelledRefunded?: boolean;
};

export type SalesSummary = {
  companyId: string;
  from: string | null;
  to: string | null;
  ordersCount: number;
  revenueOrdersCount: number;
  revenueTotal: string;
  merchandiseTotal: string;
  shippingTotal: string;
  averageOrderValue: string;
  /** Orders asked for, paid or not (cancelled, refunded and failed out). */
  bookedOrdersCount: number;
  bookedTotal: string;
  paidOrdersCount: number;
  paidAmount: string;
  pendingOrdersCount: number;
  deliveredOrdersCount: number;
  cancelledOrdersCount: number;
  refundedOrdersCount: number;
  guestOrdersCount: number;
  partnerOrdersCount: number;
  unitsSold: number;
  currencyCode: string | null;
};

export type SalesTimeseriesPoint = {
  periodKey: string;
  periodStart: string;
  ordersCount: number;
  revenueTotal: string;
  merchandiseTotal: string;
  shippingTotal: string;
  unitsSold: number;
};

export type SalesTimeseries = {
  granularity: SalesReportGranularity;
  points: SalesTimeseriesPoint[];
};

export type SalesByStatusRow = {
  status: OrderStatus;
  ordersCount: number;
  revenueTotal: string;
};

export type SalesByPaymentRow = {
  paymentMethod: StorePaymentMethod;
  paymentStatus: StorePaymentStatus;
  ordersCount: number;
  revenueTotal: string;
};

export type SalesByCityRow = {
  cityId: string | null;
  cityName: string;
  countryId: string | null;
  ordersCount: number;
  revenueTotal: string;
  unitsSold: number;
  /** Sum of the delivery lines (system item «رسوم التوصيل»). */
  deliveryTotal?: string;
};

export type SalesByProductRow = {
  productId: string;
  variantId: string | null;
  productName: string;
  productSlug: string;
  ordersCount: number;
  unitsSold: number;
  lineRevenueTotal: string;
};

export type SalesByPartnerRow = {
  partnerId: string | null;
  label: string;
  ordersCount: number;
  revenueTotal: string;
  unitsSold: number;
};

export type SalesLineRow = {
  orderId: string;
  orderNumber: string;
  orderCreatedAt: string;
  status: OrderStatus;
  paymentStatus: StorePaymentStatus;
  paymentMethod: StorePaymentMethod;
  source: StoreOrderSource;
  partnerId: string | null;
  customerNameAr: string;
  shipCity: string;
  shipCityId: string | null;
  lineId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  quantity: number;
  unitPriceAmount: string;
  lineTotalAmount: string;
  currencyCode: string;
};

function buildQuery(
  filters: SalesReportFilters,
  extra?: Record<string, string | number | boolean | undefined>,
) {
  return {
    companyId: filters.companyId,
    from: filters.from || undefined,
    to: filters.to || undefined,
    status: filters.status && filters.status !== 'all' ? filters.status : undefined,
    paymentStatus:
      filters.paymentStatus && filters.paymentStatus !== 'all'
        ? filters.paymentStatus
        : undefined,
    paymentMethod:
      filters.paymentMethod && filters.paymentMethod !== 'all'
        ? filters.paymentMethod
        : undefined,
    source: filters.source && filters.source !== 'all' ? filters.source : undefined,
    partnerId: filters.partnerId || undefined,
    hasPartner: filters.hasPartner,
    city: filters.city?.trim() || undefined,
    countryId: filters.countryId || undefined,
    cityId: filters.cityId || undefined,
    districtId: filters.districtId || undefined,
    productId: filters.productId || undefined,
    variantId: filters.variantId || undefined,
    categoryId: filters.categoryId || undefined,
    brandId: filters.brandId || undefined,
    currencyCode: filters.currencyCode || undefined,
    search: filters.search?.trim() || undefined,
    excludeCancelledRefunded: filters.excludeCancelledRefunded,
    ...extra,
  };
}

const BASE = '/store-admin/reports/sales';

/** Store Admin sales reports — `/store-admin/reports/sales/*` (`sta.reports.read`). */
export const salesReportsApi = {
  async summary(filters: SalesReportFilters): Promise<SalesSummary> {
    return apiRequest<SalesSummary>(`${BASE}/summary`, {
      query: buildQuery(filters),
      throwOnError: true,
    });
  },

  async timeseries(
    filters: SalesReportFilters,
    granularity: SalesReportGranularity = 'day',
  ): Promise<SalesTimeseries> {
    return apiRequest<SalesTimeseries>(`${BASE}/timeseries`, {
      query: buildQuery(filters, { granularity }),
      throwOnError: true,
    });
  },

  async byStatus(filters: SalesReportFilters): Promise<SalesByStatusRow[]> {
    const data = await apiRequest<SalesByStatusRow[] | { items: SalesByStatusRow[] }>(
      `${BASE}/by-status`,
      { query: buildQuery(filters), throwOnError: true },
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  },

  async byPayment(filters: SalesReportFilters): Promise<SalesByPaymentRow[]> {
    const data = await apiRequest<SalesByPaymentRow[] | { items: SalesByPaymentRow[] }>(
      `${BASE}/by-payment`,
      { query: buildQuery(filters), throwOnError: true },
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  },

  async byCity(filters: SalesReportFilters, limit = 20): Promise<SalesByCityRow[]> {
    const data = await apiRequest<SalesByCityRow[] | { items: SalesByCityRow[] }>(
      `${BASE}/by-city`,
      { query: buildQuery(filters, { limit }), throwOnError: true },
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  },

  async byProduct(filters: SalesReportFilters, limit = 20): Promise<SalesByProductRow[]> {
    const data = await apiRequest<SalesByProductRow[] | { items: SalesByProductRow[] }>(
      `${BASE}/by-product`,
      { query: buildQuery(filters, { limit }), throwOnError: true },
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  },

  async byPartner(filters: SalesReportFilters, limit = 20): Promise<SalesByPartnerRow[]> {
    const data = await apiRequest<SalesByPartnerRow[] | { items: SalesByPartnerRow[] }>(
      `${BASE}/by-partner`,
      { query: buildQuery(filters, { limit }), throwOnError: true },
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  },

  async lines(
    filters: SalesReportFilters,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResult<SalesLineRow>> {
    const result = await apiRequest<PaginatedResult<SalesLineRow>>(`${BASE}/lines`, {
      query: buildQuery(filters, { page, limit }),
      throwOnError: true,
    });
    return ensurePaginatedResult(result);
  },
};
