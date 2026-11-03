import { apiRequest } from '@/features/hr/lib/api/client';
import type {
  SalesByPaymentRow,
  SalesByStatusRow,
  SalesReportFilters,
  SalesReportGranularity,
  SalesTimeseries,
} from '@/features/ecommerce/admin/reports/lib/api/sales-reports-api';

export type { SalesReportFilters, SalesReportGranularity };

export type DashboardKpiBlock = {
  ordersCount: number;
  revenueTotal: string;
  averageOrderValue: string;
  unitsSold: number;
  merchandiseTotal?: string;
  shippingTotal?: string;
  paidAmount?: string;
  paidOrdersCount?: number;
};

export type ReportsDashboard = {
  current: DashboardKpiBlock;
  previous: DashboardKpiBlock | null;
  changePercent: Record<string, number | null>;
  alerts: {
    pendingFulfillmentOrdersCount: number;
    pendingPaymentOrdersCount: number;
    unassignedLineUnitsCount: number;
    contactMessagesInPeriodCount: number;
    pendingReviewsCount: number;
    overdueDeliveryOrdersCount: number;
  };
  timeseries: SalesTimeseries;
  byStatus: SalesByStatusRow[];
  byPayment: SalesByPaymentRow[];
};

export type GeoByDistrictRow = {
  districtId: string | null;
  districtName: string;
  cityId: string | null;
  cityName: string;
  ordersCount: number;
  revenueTotal: string;
  unitsSold: number;
  /** Sum of the delivery lines (system item «رسوم التوصيل»). */
  deliveryTotal?: string;
};

export type PaymentByAccountRow = {
  paymentAccountId: string | null;
  accountLabel: string;
  paymentMethod: string;
  ordersCount: number;
  paidOrdersCount: number;
  unpaidOrdersCount: number;
  revenueTotal: string;
  paidAmount: string;
};

export type CatalogByCategoryRow = {
  categoryId: string | null;
  categoryName: string;
  ordersCount: number;
  unitsSold: number;
  revenueTotal: string;
};

export type CatalogByBrandRow = {
  brandId: string | null;
  brandName: string;
  ordersCount: number;
  unitsSold: number;
  revenueTotal: string;
};

export type FulfillmentByShipStatusRow = {
  lineShipStatus: string;
  lineCount: number;
  unitsCount: number;
  ordersCount: number;
};

export type OrdersBySourceRow = {
  source: string;
  ordersCount: number;
  revenueTotal: string;
  unitsSold: number;
};

export type OperationsSummary = {
  contactMessagesByType: { type: string; count: number }[];
  contactMessagesTotal: number;
  wishlistAddsInPeriodCount: number;
  wishlistTotalActiveCount: number;
  reviewsSubmittedInPeriodCount: number;
  pendingReviewsCount: number;
  approvedReviewsCount: number;
  rejectedReviewsCount: number;
  averageApprovedRating: number | null;
};

function sharedQuery(
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

async function asArray<T>(data: T[] | { items: T[] }): Promise<T[]> {
  return Array.isArray(data) ? data : (data.items ?? []);
}

const BASE = '/store-admin/reports';

/** Store Admin reports — dashboard + geo/catalog/payment/fulfillment/operations (+ sales via salesReportsApi). */
export const storeReportsApi = {
  dashboard(
    filters: SalesReportFilters,
    options?: {
      comparePreviousPeriod?: boolean;
      timeseriesGranularity?: SalesReportGranularity;
    },
  ): Promise<ReportsDashboard> {
    return apiRequest<ReportsDashboard>(`${BASE}/dashboard`, {
      query: sharedQuery(filters, {
        comparePreviousPeriod: options?.comparePreviousPeriod ?? true,
        timeseriesGranularity: options?.timeseriesGranularity ?? 'day',
      }),
      throwOnError: true,
    });
  },

  async geoByDistrict(filters: SalesReportFilters, limit = 20): Promise<GeoByDistrictRow[]> {
    const data = await apiRequest<GeoByDistrictRow[] | { items: GeoByDistrictRow[] }>(
      `${BASE}/geo/by-district`,
      { query: sharedQuery(filters, { limit }), throwOnError: true },
    );
    return asArray(data);
  },

  async paymentsByAccount(filters: SalesReportFilters, limit = 20): Promise<PaymentByAccountRow[]> {
    const data = await apiRequest<PaymentByAccountRow[] | { items: PaymentByAccountRow[] }>(
      `${BASE}/payments/by-account`,
      { query: sharedQuery(filters, { limit }), throwOnError: true },
    );
    return asArray(data);
  },

  async catalogByCategory(filters: SalesReportFilters, limit = 20): Promise<CatalogByCategoryRow[]> {
    const data = await apiRequest<CatalogByCategoryRow[] | { items: CatalogByCategoryRow[] }>(
      `${BASE}/catalog/by-category`,
      { query: sharedQuery(filters, { limit }), throwOnError: true },
    );
    return asArray(data);
  },

  async catalogByBrand(filters: SalesReportFilters, limit = 20): Promise<CatalogByBrandRow[]> {
    const data = await apiRequest<CatalogByBrandRow[] | { items: CatalogByBrandRow[] }>(
      `${BASE}/catalog/by-brand`,
      { query: sharedQuery(filters, { limit }), throwOnError: true },
    );
    return asArray(data);
  },

  async fulfillmentByShipStatus(
    filters: SalesReportFilters,
  ): Promise<FulfillmentByShipStatusRow[]> {
    const data = await apiRequest<
      FulfillmentByShipStatusRow[] | { items: FulfillmentByShipStatusRow[] }
    >(`${BASE}/fulfillment/by-ship-status`, {
      query: sharedQuery(filters),
      throwOnError: true,
    });
    return asArray(data);
  },

  async ordersBySource(filters: SalesReportFilters): Promise<OrdersBySourceRow[]> {
    const data = await apiRequest<OrdersBySourceRow[] | { items: OrdersBySourceRow[] }>(
      `${BASE}/orders/by-source`,
      { query: sharedQuery(filters), throwOnError: true },
    );
    return asArray(data);
  },

  async operationsSummary(
    companyId: string,
    from?: string,
    to?: string,
  ): Promise<OperationsSummary> {
    return apiRequest<OperationsSummary>(`${BASE}/operations/summary`, {
      query: { companyId, from: from || undefined, to: to || undefined },
      throwOnError: true,
    });
  },
};
