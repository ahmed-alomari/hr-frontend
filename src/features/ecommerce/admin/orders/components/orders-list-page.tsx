'use client';

import { FoldedHeaderTool } from '@/components/layouts/phone-fold';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import * as React from 'react';
import { OrderDetailPanel } from '@/features/ecommerce/admin/orders/components/order-detail-panel';
import { OrderPaymentProofButton } from '@/features/ecommerce/admin/orders/components/order-payment-proof-button';
import { OrderStatusHistoryButton } from '@/features/ecommerce/admin/orders/components/order-status-history-button';
import { WhatsappPhoneAction } from '@/features/ecommerce/admin/cms/whatsapp/components/whatsapp-phone-action';
import {
  Banknote,
  CreditCard,
  Eye,
  Kanban,
  List,
  MapPin,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { OrdersKanbanView } from '@/features/ecommerce/admin/orders/components/orders-kanban-view';
import {
  useOrders,
  useUpdateOrderPaymentStatus,
  useUpdateOrderStatus,
} from '@/features/ecommerce/admin/orders/hooks/use-orders';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { formatPrice } from '@/features/ecommerce/shared/utils/format-price';
import {
  getOrderPrepGuidance,
  orderLineShipCounts,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS_AR,
  PAYMENT_METHOD_LABELS_AR,
  PAYMENT_STATUS_LABELS_AR,
  resolveOrderPaymentMethod,
} from '@/features/ecommerce/domain/constants/order-status';
import type { Order, OrderFulfilmentFilter, OrderStatus } from '@/features/ecommerce/domain/types/order';
import { useGeoCities } from '@/features/system/organization/geo/hooks/use-geo';
import { StoreBindingStorageCleaner } from '@/features/ecommerce/storefront/components/store-binding-storage-cleaner';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import { Button } from '@/components/ui/button';
import { cn, formatDisplayDate } from '@/shared/utils';
import { useOrderStagesContext } from '@/features/ecommerce/admin/orders/hooks/use-order-stages';
import { visibleOrderStatuses } from '@/features/ecommerce/admin/orders/lib/order-stage-access';
import { ordersApi } from '@/features/ecommerce/admin/orders/lib/api/orders';
import {
  ORDERS_COLUMN_OPTIONS,
  ORDERS_GROUP_MEASURES,
  ORDERS_GROUP_OPTIONS,
  ORDERS_SORT_OPTIONS,
  ORDER_SOURCE_LABELS_AR,
  ordersExportColumns,
  ordersTotalLabel,
} from '@/features/ecommerce/admin/orders/lib/orders-list-options';
import { GroupedDataTable } from '@/components/ui/grouped-data-table';
import { ListColumnsPicker, useColumnVisibility } from '@/components/ui/list-columns-picker';
import { ListGroupMenu, listGroupQuery, useGroupedList, useListGroup } from '@/components/ui/list-group';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import { ListSortMenu, listSortQuery, useListSort } from '@/components/ui/list-sort';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import { registerExportRows, visibleExportColumns } from '@/components/pdf/lib/register-export-rows';
import { fetchAllPaginatedItems } from '@/shared/api/client';
import { companyCurrencyCode } from '@/features/auth/lib/company-currency';
import {
  hrFiltersKey,
  readPersistedJson,
  writePersistedJson,
} from '@/features/hr/lib/use-persisted-filter-state';
import { usePersistedStateRestore } from '@/shared/hooks/use-persisted-state-restore';

/** The filters kept in the URL (links, the kanban) and saved per user and company. */
const FILTER_PARAMS = [
  'q',
  'status',
  'paymentStatus',
  'paymentMethod',
  'fulfilment',
  'source',
  'city',
  'assignee',
  'dateFrom',
  'dateTo',
] as const;
type SavedFilters = Partial<Record<(typeof FILTER_PARAMS)[number], string>>;

/** Order stages: whose orders (URL `assignee`). */
const ASSIGNEE_FILTER_OPTIONS = [
  { value: 'all', label: 'كل المسؤولين' },
  { value: 'me', label: 'طلباتي' },
  { value: 'unassigned', label: 'غير مسندة' },
];

type ViewMode = 'list' | 'kanban';

const STATUS_FILTER_OPTIONS: Array<{ value: 'all' | OrderStatus; label: string }> = [
  { value: 'all', label: 'كل الحالات' },
  ...(Object.keys(ORDER_STATUS_LABELS_AR) as OrderStatus[]).map((value) => ({
    value,
    label: ORDER_STATUS_LABELS_AR[value],
  })),
];

const PAYMENT_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'كل حالات الدفع' },
  ...(Object.keys(PAYMENT_STATUS_LABELS_AR) as Array<keyof typeof PAYMENT_STATUS_LABELS_AR>).map(
    (value) => ({
      value,
      label: PAYMENT_STATUS_LABELS_AR[value],
    }),
  ),
] as const;

const PAYMENT_METHOD_FILTER_OPTIONS = [
  { value: 'all', label: 'كل طرق الدفع' },
  ...(Object.keys(PAYMENT_METHOD_LABELS_AR) as Array<keyof typeof PAYMENT_METHOD_LABELS_AR>).map(
    (value) => ({
      value,
      label: PAYMENT_METHOD_LABELS_AR[value],
    }),
  ),
] as const;

const FULFILMENT_FILTER_OPTIONS: Array<{ value: 'all' | OrderFulfilmentFilter; label: string }> = [
  { value: 'all', label: 'كل حالات التجهيز' },
  { value: 'unfulfilled', label: 'لم يُجهز' },
  { value: 'partial', label: 'تجهيز جزئي' },
  { value: 'fulfilled', label: 'تم التجهيز' },
];

const SOURCE_FILTER_OPTIONS = [
  { value: 'all', label: 'كل المصادر' },
  { value: 'storefront', label: 'المتجر' },
  { value: 'seed', label: 'يدوي / تجريبي' },
] as const;

const VALID_ORDER_STATUSES = new Set<OrderStatus>(
  Object.keys(ORDER_STATUS_LABELS_AR) as OrderStatus[],
);
const VALID_PAYMENT_STATUSES = new Set(Object.keys(PAYMENT_STATUS_LABELS_AR));
const VALID_PAYMENT_METHODS = new Set(Object.keys(PAYMENT_METHOD_LABELS_AR));
const VALID_FULFILMENTS = new Set<OrderFulfilmentFilter>(['fulfilled', 'partial', 'unfulfilled']);
const VALID_SOURCES = new Set(['storefront', 'seed']);

const PAYMENT_STATUS_VARIANT: Record<string, NonNullable<BadgeProps['variant']>> = {
  pending: 'warning',
  paid: 'success',
  failed: 'destructive',
  refunded: 'outline',
};

type FulfilmentState = 'fulfilled' | 'partial' | 'unfulfilled';

const FULFILMENT_LABELS: Record<FulfilmentState, string> = {
  fulfilled: 'تم التجهيز',
  partial: 'تجهيز جزئي',
  unfulfilled: 'لم يُجهز',
};

const FULFILMENT_VARIANT: Record<FulfilmentState, NonNullable<BadgeProps['variant']>> = {
  fulfilled: 'success',
  partial: 'warning',
  unfulfilled: 'outline',
};

/** From the row's line counts (the list carries no lines). */
function orderFulfilmentState(order: Order): FulfilmentState {
  const counts = orderLineShipCounts(order);
  if (!counts || counts.lines === 0 || counts.shipped === 0) return 'unfulfilled';
  if (counts.shipped === counts.lines) return 'fulfilled';
  return 'partial';
}

function itemCount(order: Order): number {
  if (order.items.length === 0 && order.itemQuantity !== undefined) return order.itemQuantity;
  return order.items.reduce((sum, line) => sum + line.quantity, 0);
}

function formatShortDate(iso: string): string {
  return formatDisplayDate(iso);
}

export function OrdersListPage() {
  const companyId = getStorefrontCompanyId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get('q') ?? '';
  const statusParam = searchParams.get('status') ?? 'all';
  const status = VALID_ORDER_STATUSES.has(statusParam as OrderStatus)
    ? (statusParam as OrderStatus)
    : undefined;
  const paymentStatusParam = searchParams.get('paymentStatus') ?? 'all';
  const paymentStatus = VALID_PAYMENT_STATUSES.has(paymentStatusParam)
    ? (paymentStatusParam as 'pending' | 'paid' | 'failed' | 'refunded')
    : undefined;
  const paymentMethodParam = searchParams.get('paymentMethod') ?? 'all';
  const paymentMethod = VALID_PAYMENT_METHODS.has(paymentMethodParam)
    ? (paymentMethodParam as keyof typeof PAYMENT_METHOD_LABELS_AR)
    : undefined;
  const fulfilmentParam = searchParams.get('fulfilment') ?? 'all';
  const fulfilment = VALID_FULFILMENTS.has(fulfilmentParam as OrderFulfilmentFilter)
    ? (fulfilmentParam as OrderFulfilmentFilter)
    : undefined;
  const sourceParam = searchParams.get('source') ?? 'all';
  const source = VALID_SOURCES.has(sourceParam)
    ? (sourceParam as 'storefront' | 'seed')
    : undefined;
  const cityFilter = searchParams.get('city') ?? 'all';
  const assigneeParam = searchParams.get('assignee') ?? 'all';
  const assignee = assigneeParam === 'me' || assigneeParam === 'unassigned' ? assigneeParam : undefined;

  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const view: ViewMode = searchParams.get('view') === 'list' ? 'list' : 'kanban';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE;
  const selectedOrderId = searchParams.get('order') ?? '';

  // Sort, grouping and columns: kept per user and company (list-screens skill).
  const stateKeys = listStateKeys('store', 'orders', companyId);
  const sort = useListSort(stateKeys.sort, ORDERS_SORT_OPTIONS);
  const group = useListGroup(stateKeys.group, ORDERS_GROUP_OPTIONS, ORDERS_GROUP_MEASURES);
  // Grouping is a list view; the kanban is grouped by stage already.
  const groupBy = view === 'list' ? group.groupBy : null;
  const columnVisibility = useColumnVisibility(
    hrFiltersKey('store', 'orders', companyId, 'hiddenColumns'),
    ORDERS_COLUMN_OPTIONS,
  );

  const stagesQuery = useOrderStagesContext(companyId);
  const stagesContext = stagesQuery.data ?? null;
  // Stage users see only the stages granted to them (order stages settings).
  const visibleStatuses = visibleOrderStatuses(stagesContext, Object.keys(ORDER_STATUS_LABELS_AR) as OrderStatus[]);
  const statusFilterOptions = visibleStatuses
    ? STATUS_FILTER_OPTIONS.filter((o) => o.value === 'all' || visibleStatuses.includes(o.value))
    : STATUS_FILTER_OPTIONS;
  const geoCitiesQuery = useGeoCities(
    {
      companyId,
      page: 1,
      limit: 200,
      archiveScope: 'active',
    },
    // Stage handlers without "view orders" (e.g. a driver) skip the city list.
    Boolean(companyId && stagesContext?.canReadAll),
  );
  const cityOptions = React.useMemo(
    () => [
      { value: 'all', label: 'كل المدن' },
      ...(geoCitiesQuery.data?.items ?? []).map((city) => ({
        value: city.nameAr,
        label: city.nameAr,
      })),
    ],
    [geoCitiesQuery.data?.items],
  );

  const [searchInput, setSearchInput] = React.useState(search);
  const datePeriod = React.useMemo(
    () => ({ from: dateFrom, to: dateTo }),
    [dateFrom, dateTo],
  );

  function updateParams(next: {
    q?: string;
    status?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    fulfilment?: string;
    source?: string;
    city?: string;
    assignee?: string;
    dateFrom?: string;
    dateTo?: string;
    view?: ViewMode;
    page?: number;
    pageSize?: number;
    order?: string | null;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q);
      else params.delete('q');
    }
    if (next.status !== undefined) {
      if (next.status && next.status !== 'all') params.set('status', next.status);
      else params.delete('status');
    }
    if (next.paymentStatus !== undefined) {
      if (next.paymentStatus && next.paymentStatus !== 'all') {
        params.set('paymentStatus', next.paymentStatus);
      } else params.delete('paymentStatus');
    }
    if (next.paymentMethod !== undefined) {
      if (next.paymentMethod && next.paymentMethod !== 'all') {
        params.set('paymentMethod', next.paymentMethod);
      } else params.delete('paymentMethod');
    }
    if (next.fulfilment !== undefined) {
      if (next.fulfilment && next.fulfilment !== 'all') params.set('fulfilment', next.fulfilment);
      else params.delete('fulfilment');
    }
    if (next.source !== undefined) {
      if (next.source && next.source !== 'all') params.set('source', next.source);
      else params.delete('source');
    }
    if (next.city !== undefined) {
      if (next.city && next.city !== 'all') params.set('city', next.city);
      else params.delete('city');
    }
    if (next.assignee !== undefined) {
      if (next.assignee && next.assignee !== 'all') params.set('assignee', next.assignee);
      else params.delete('assignee');
    }
    if (next.dateFrom !== undefined) {
      if (next.dateFrom) params.set('dateFrom', next.dateFrom);
      else params.delete('dateFrom');
    }
    if (next.dateTo !== undefined) {
      if (next.dateTo) params.set('dateTo', next.dateTo);
      else params.delete('dateTo');
    }
    if (next.view !== undefined) {
      if (next.view === 'list') params.set('view', 'list');
      else params.delete('view');
    }
    if (next.page !== undefined) {
      if (next.page > 1) params.set('page', String(next.page));
      else params.delete('page');
    }
    if (next.pageSize !== undefined) {
      if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(next.pageSize));
      else params.delete('pageSize');
    }
    if (next.order !== undefined) {
      if (next.order) params.set('order', next.order);
      else params.delete('order');
    }
    params.delete('tab');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // The URL's filters are saved for this user and company: opening the
  // screen without any brings the last ones back, and a saved view restores
  // them (it writes the saved copy, then asks every list to re-read).
  const filtersKey = hrFiltersKey('store', 'orders', companyId, 'filters');
  const currentFilters: SavedFilters = Object.fromEntries(
    FILTER_PARAMS.map((key) => [key, searchParams.get(key) ?? '']),
  );
  const currentFiltersJson = JSON.stringify(currentFilters);
  const applySavedFilters = (saved: SavedFilters | null) => {
    setSearchInput(saved?.q ?? '');
    updateParams({
      q: saved?.q ?? '',
      status: saved?.status || 'all',
      paymentStatus: saved?.paymentStatus || 'all',
      paymentMethod: saved?.paymentMethod || 'all',
      fulfilment: saved?.fulfilment || 'all',
      source: saved?.source || 'all',
      city: saved?.city || 'all',
      assignee: saved?.assignee || 'all',
      dateFrom: saved?.dateFrom ?? '',
      dateTo: saved?.dateTo ?? '',
      page: 1,
    });
  };
  const applySavedFiltersRef = React.useRef(applySavedFilters);
  applySavedFiltersRef.current = applySavedFilters;
  const filtersRestored = React.useRef(false);
  React.useEffect(() => {
    if (!filtersKey) return;
    const current = JSON.parse(currentFiltersJson) as SavedFilters;
    if (!filtersRestored.current) {
      filtersRestored.current = true;
      const saved = readPersistedJson<SavedFilters>(filtersKey);
      const urlHasFilters = Object.values(current).some(Boolean);
      if (!urlHasFilters && saved && Object.values(saved).some(Boolean)) {
        applySavedFiltersRef.current(saved);
        return;
      }
    }
    writePersistedJson(filtersKey, current);
  }, [filtersKey, currentFiltersJson]);
  usePersistedStateRestore(() => {
    if (filtersKey) applySavedFiltersRef.current(readPersistedJson<SavedFilters>(filtersKey));
  });

  const searchRef = React.useRef(search);
  const updateParamsRef = React.useRef(updateParams);
  searchRef.current = search;
  updateParamsRef.current = updateParams;

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput.trim() !== searchRef.current) {
        updateParamsRef.current({ q: searchInput.trim(), page: 1 });
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  // The filters both views apply (the kanban adds each column's status and pages it).
  const filters = {
    companyId,
    search: search || undefined,
    paymentStatus,
    paymentMethod,
    fulfilment,
    source,
    city: cityFilter === 'all' ? undefined : cityFilter,
    assignedTo: assignee,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };
  const sortQuery = listSortQuery(sort.sort);
  const { data, isLoading, isError } = useOrders(
    { ...filters, status, ...sortQuery, page, limit: pageSize },
    view === 'list' && !groupBy,
  );

  // Grouped: the groups (count, amount) and the rows of the open ones; flat:
  // the grand total over every page (the totals row).
  const listFilters = { ...filters, status };
  const grouped = useGroupedList<Order>({
    enabled: Boolean(companyId) && view === 'list',
    groupBy,
    resetKey: JSON.stringify({ ...listFilters, ...sortQuery }),
    fetchGroups: () => ordersApi.groups({ ...listFilters, ...listGroupQuery(groupBy) }),
    fetchGroupRows: (groupValue, p, l) =>
      ordersApi.list({ ...listFilters, ...sortQuery, ...listGroupQuery(groupBy), groupValue, page: p, limit: l }),
  });
  const totalsCurrency = data?.items[0]?.totalAmount.currency ?? companyCurrencyCode(companyId);

  const exportColumns = visibleExportColumns(ordersExportColumns(totalsCurrency), columnVisibility.isVisible);
  const filterSummary = [
    search ? `بحث: ${search}` : null,
    view === 'list' && status ? `الحالة: ${ORDER_STATUS_LABELS_AR[status]}` : null,
    paymentMethod ? `طريقة الدفع: ${PAYMENT_METHOD_LABELS_AR[paymentMethod]}` : null,
    paymentStatus ? `حالة الدفع: ${PAYMENT_STATUS_LABELS_AR[paymentStatus]}` : null,
    fulfilment
      ? `التجهيز: ${FULFILMENT_FILTER_OPTIONS.find((o) => o.value === fulfilment)?.label ?? fulfilment}`
      : null,
    source ? `المصدر: ${ORDER_SOURCE_LABELS_AR[source] ?? source}` : null,
    cityFilter !== 'all' ? `المدينة: ${cityFilter}` : null,
    assignee
      ? `المسؤول: ${ASSIGNEE_FILTER_OPTIONS.find((o) => o.value === assignee)?.label ?? assignee}`
      : null,
    dateFrom || dateTo ? `الفترة: ${dateFrom || '…'} — ${dateTo || '…'}` : null,
    sort.label,
    view === 'list' ? group.label : null,
  ].filter((line): line is string => Boolean(line));
  const activeFilterCount = FILTER_PARAMS.filter((key) => key !== 'q' && currentFilters[key]).length;

  /** Every filtered order (all pages) in the screen's order, grouped like the screen. */
  const getExportRows = async () => {
    const query = {
      ...filters,
      status: view === 'list' ? status : undefined,
      ...sortQuery,
      ...listGroupQuery(groupBy),
    };
    const [{ items: all }, summary] = await Promise.all([
      fetchAllPaginatedItems((p, l) => ordersApi.list({ ...query, page: p, limit: l })),
      ordersApi.groups(query),
    ]);
    return registerExportRows({
      columns: exportColumns,
      rows: all,
      total: summary.total,
      grouping:
        groupBy && group.option
          ? {
              fieldLabel: group.option.label,
              groups: group.sortGroups(summary.groups),
              labelOf: group.labelOf,
              groupKeyOf: (order) => order.groupKey,
            }
          : undefined,
    });
  };

  const updateStatus = useUpdateOrderStatus(companyId);
  const updatePayment = useUpdateOrderPaymentStatus(companyId);

  const items = data?.items ?? [];
  const selectedOrder = items.find((order) => order.id === selectedOrderId) ?? null;

  const viewButtons: { mode: ViewMode; icon: typeof List; label: string }[] = [
    { mode: 'kanban', icon: Kanban, label: 'كانبان' },
    { mode: 'list', icon: List, label: 'قائمة' },
  ];

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {view === 'list' ? (
          <>
            <ListColumnsPicker model={columnVisibility} />
            <ListSortMenu model={sort} />
            <ListGroupMenu model={group} />
          </>
        ) : null}
        <ListSavedViews storageKey={stateKeys.views} prefixes={stateKeys.prefixes} />
        <FoldedHeaderTool>
          <div className="flex rounded-lg border border-border p-0.5">
            {viewButtons.map(({ mode, icon: Icon, label }) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant="ghost"
                className={cn('h-7 gap-1.5 px-2', view === mode && 'bg-muted')}
                onClick={() => updateParams({ view: mode, page: 1, status: mode === 'kanban' ? 'all' : status ?? 'all' })}
                aria-label={label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>
        </FoldedHeaderTool>
        <RegisterExportMenu
          title="سجل الطلبات"
          fileName="store-orders"
          columns={exportColumns}
          getRows={getExportRows}
          subtitleLines={filterSummary}
          landscape
          emptyMessage="لا توجد طلبات للتصدير ضمن الفلاتر الحالية."
        />
      </div>
    ),
    [
      view,
      status,
      activeFilterCount,
      sort.sortKey,
      sort.label,
      group.groupKey,
      group.label,
      columnVisibility.hiddenKey,
      currentFiltersJson,
      totalsCurrency,
      stateKeys.views,
    ],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection
        optionalDateRange
        showStatusSection={false}
        showEmployeePicker={false}
        periodValue={datePeriod}
        onPeriodChange={(range) =>
          updateParams({ dateFrom: range.from, dateTo: range.to, page: 1 })
        }
        periodFilterActive={Boolean(dateFrom || dateTo)}
        onPeriodFilterClear={() => updateParams({ dateFrom: '', dateTo: '', page: 1 })}
        onClearAll={() => {
          // One URL change for all filters (and the search box).
          setSearchInput('');
          updateParams({
            q: '',
            paymentStatus: 'all',
            paymentMethod: 'all',
            fulfilment: 'all',
            source: 'all',
            city: 'all',
            assignee: 'all',
            dateFrom: '',
            dateTo: '',
            page: 1,
          });
        }}
        leadingFilters={
          <EntityFilterSearchField
            value={searchInput}
            onChange={setSearchInput}
            placeholder="بحث برقم الطلب أو اسم العميل أو الهاتف…"
          />
        }
        inlineSelects={[
          ...(view === 'list'
            ? [
                {
                  id: 'status',
                  value: status ?? 'all',
                  onChange: (value: string) => updateParams({ status: value, page: 1 }),
                  placeholder: 'كل الحالات',
                  options: statusFilterOptions,
                },
              ]
            : []),
          {
            id: 'paymentMethod',
            value: paymentMethod ?? 'all',
            onChange: (value) => updateParams({ paymentMethod: value, page: 1 }),
            placeholder: 'كل طرق الدفع',
            options: [...PAYMENT_METHOD_FILTER_OPTIONS],
          },
          {
            id: 'paymentStatus',
            value: paymentStatus ?? 'all',
            onChange: (value) => updateParams({ paymentStatus: value, page: 1 }),
            placeholder: 'كل حالات الدفع',
            options: [...PAYMENT_STATUS_FILTER_OPTIONS],
          },
          {
            id: 'assignee',
            value: assignee ?? 'all',
            onChange: (value) => updateParams({ assignee: value, page: 1 }),
            placeholder: 'كل المسؤولين',
            options: ASSIGNEE_FILTER_OPTIONS,
          },
          {
            id: 'fulfilment',
            value: fulfilment ?? 'all',
            onChange: (value) => updateParams({ fulfilment: value, page: 1 }),
            placeholder: 'كل حالات التجهيز',
            options: FULFILMENT_FILTER_OPTIONS,
          },
        ]}
        moreFilters={[
          {
            id: 'source',
            value: source ?? 'all',
            onChange: (value) => updateParams({ source: value, page: 1 }),
            placeholder: 'كل المصادر',
            options: [...SOURCE_FILTER_OPTIONS],
          },
          {
            id: 'city',
            value: cityFilter,
            onChange: (value) => updateParams({ city: value, page: 1 }),
            placeholder: 'كل المدن',
            options: cityOptions,
          },
        ]}
      />
    ),
    [
      searchInput,
      status,
      paymentStatus,
      paymentMethod,
      fulfilment,
      source,
      cityFilter,
      cityOptions,
      assignee,
      view,
      dateFrom,
      dateTo,
      datePeriod,
    ],
  );

  const columns: ColumnDef<Order>[] = [
    {
      key: 'order',
      title: 'الطلب',
      sortKey: 'orderNumber',
      render: (order) => (
        <span className="font-semibold tracking-tight text-foreground" dir="ltr">
          {order.orderNumber}
        </span>
      ),
    },
    {
      key: 'date',
      title: 'التاريخ',
      sortKey: 'createdAt',
      hideOnMobile: true,
      render: (order) => <span className="text-sm text-muted-foreground">{formatShortDate(order.createdAt)}</span>,
    },
    {
      key: 'customer',
      title: 'العميل',
      sortKey: 'customer',
      render: (order) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{order.customerNameAr}</span>
          {order.phone ? (
            <WhatsappPhoneAction
              phone={order.phone}
              customerName={order.customerNameAr}
              orderId={order.id}
            />
          ) : null}
          {order.city ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {order.city}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      title: 'الحالة',
      sortKey: 'status',
      render: (order) => (
        <Badge variant="outline" className={ORDER_STATUS_COLORS[order.status].badge}>
          {ORDER_STATUS_LABELS_AR[order.status]}
        </Badge>
      ),
    },
    {
      key: 'assignee',
      title: 'المسؤول',
      render: (order) =>
        order.assignedUserId ? (
          <span
            className={cn(
              'text-sm',
              order.assignedUserId === stagesContext?.userId
                ? 'font-semibold text-primary'
                : 'text-foreground',
            )}
          >
            {order.assignedUserName ?? 'مستخدم'}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">غير مسند</span>
        ),
    },
    {
      key: 'payment',
      title: 'الدفع',
      sortKey: 'paymentStatus',
      render: (order) => {
        const prep = getOrderPrepGuidance(order);
        const isCard = prep.paymentMethod === 'card';
        return (
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-semibold',
                  isCard ? 'text-sky-800 dark:text-sky-300' : 'text-teal-800 dark:text-teal-300',
                )}
              >
                {isCard ? <CreditCard className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                {prep.methodLabel}
              </span>
              <Badge variant={PAYMENT_STATUS_VARIANT[order.paymentStatus ?? 'pending']}>
                {prep.statusLabel}
              </Badge>
              <span
                className={cn(
                  'text-[11px] leading-snug',
                  prep.canPrepare
                    ? isCard
                      ? 'text-sky-700 dark:text-sky-400'
                      : 'text-teal-700 dark:text-teal-400'
                    : 'text-amber-700 dark:text-amber-400',
                )}
              >
                {prep.prepLabel}
              </span>
            </div>
            <OrderPaymentProofButton companyId={companyId} order={order} />
          </div>
        );
      },
    },
    {
      key: 'total',
      title: 'الإجمالي',
      sortKey: 'total',
      total: (totals) => (
        <span className="font-semibold tabular-nums">{ordersTotalLabel(totals, totalsCurrency)}</span>
      ),
      render: (order) => <span className="font-semibold tabular-nums text-foreground">{formatPrice(order.totalAmount)}</span>,
    },
    {
      key: 'delivery',
      title: 'التوصيل',
      sortKey: 'city',
      hideOnMobile: true,
      render: (order) => (
        <span className="text-sm text-muted-foreground">
          {[order.city, order.region].filter(Boolean).join(' — ') || '—'}
        </span>
      ),
    },
    {
      key: 'items',
      title: 'العناصر',
      hideOnMobile: true,
      render: (order) => <span className="text-sm tabular-nums text-muted-foreground">{itemCount(order)} قطعة</span>,
    },
    {
      key: 'fulfilment',
      title: 'التجهيز',
      render: (order) => (
        <Badge variant={FULFILMENT_VARIANT[orderFulfilmentState(order)]}>
          {FULFILMENT_LABELS[orderFulfilmentState(order)]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      title: '',
      isActions: true,
      render: (order) => (
        <div className="flex items-center gap-0.5">
          <OrderStatusHistoryButton
            companyId={companyId}
            orderId={order.id}
            orderNumber={order.orderNumber}
            history={order.statusHistory}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="عرض تفاصيل الطلب"
            onClick={() => updateParams({ order: order.id })}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const visibleColumns = columns.filter((col) => columnVisibility.isVisible(col.key));

  function renderMobileCard(order: Order) {
    const prep = getOrderPrepGuidance(order);
    const isCard = prep.paymentMethod === 'card';
    const phone = order.phone?.trim() || null;

    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold tracking-tight text-foreground" dir="ltr">
              {order.orderNumber}
            </p>
            <p className="text-xs text-muted-foreground">{formatShortDate(order.createdAt)}</p>
          </div>
          <Badge variant="outline" className={cn('shrink-0', ORDER_STATUS_COLORS[order.status].badge)}>
            {ORDER_STATUS_LABELS_AR[order.status]}
          </Badge>
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{order.customerNameAr}</p>
          {phone ? (
            <div onClick={(event) => event.stopPropagation()}>
              <WhatsappPhoneAction phone={phone} customerName={order.customerNameAr} orderId={order.id} />
            </div>
          ) : null}
          {order.city ? (
            <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {order.city}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-2.5 py-1.5">
          <span className="font-semibold tabular-nums text-foreground">{formatPrice(order.totalAmount)}</span>
          <Badge variant={FULFILMENT_VARIANT[orderFulfilmentState(order)]}>
            {FULFILMENT_LABELS[orderFulfilmentState(order)]}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold',
              isCard ? 'text-sky-800 dark:text-sky-300' : 'text-teal-800 dark:text-teal-300',
            )}
          >
            {isCard ? <CreditCard className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
            {prep.methodLabel}
          </span>
          <Badge variant={PAYMENT_STATUS_VARIANT[order.paymentStatus ?? 'pending']}>{prep.statusLabel}</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StoreBindingStorageCleaner />
      <SetPageTitle
        titleAr="الطلبات"
        descriptionAr="متابعة مسار الطلب من طلب العميل حتى التسليم — قائمة أو كانبان حسب الحالة."
        iconName="ShoppingCart"
      />

      {isError ? <p className="text-sm text-destructive">تعذر تحميل الطلبات.</p> : null}

      {view === 'kanban' ? (
        <OrdersKanbanView
          companyId={companyId}
          filters={filters}
          stages={stagesContext}
          stagesPending={stagesQuery.isPending}
          onOpen={(order) => updateParams({ order: order.id })}
          updatingOrderId={
            updateStatus.isPending
              ? updateStatus.variables?.orderId
              : updatePayment.isPending
                ? updatePayment.variables?.orderId
                : null
          }
          onStatusChange={(order, nextStatus, note, extra) => {
            if (order.status === nextStatus) return;
            void updateStatus
              .mutateAsync({ orderId: order.id, status: nextStatus, note, ...extra, from: order.status })
              .catch(() => undefined);
          }}
          onMarkPaid={(order) => {
            void updatePayment.mutateAsync({ orderId: order.id, paymentStatus: 'paid' });
          }}
        />
      ) : groupBy ? (
        <GroupedDataTable
          columns={visibleColumns}
          group={group}
          list={grouped}
          keyExtractor={(order) => order.id}
          onRowClick={(order) => updateParams({ order: order.id })}
          sort={sort.sort}
          onSort={sort.toggle}
          emptyText="لا توجد طلبات مطابقة — جرّب تعديل الفلاتر"
        />
      ) : (
        <DirectoryPagedViews
          items={items}
          loading={isLoading}
          serverPagination={
            data
              ? {
                  page,
                  pageSize,
                  total: data.pagination.total,
                  totalPages: Math.max(1, Math.ceil(data.pagination.total / pageSize)),
                  setPage: (nextPage) => updateParams({ page: nextPage }),
                  setPageSize: (size) => updateParams({ pageSize: size, page: 1 }),
                }
              : undefined
          }
        >
          {(ordersPage) => (
            <DataTable
              variant="directory"
              className="sto-table-host"
              columns={visibleColumns}
              data={ordersPage}
              sort={sort.sort}
              onSort={sort.toggle}
              totals={grouped.summary?.total}
              keyExtractor={(order) => order.id}
              loading={isLoading}
              emptyText="لا توجد طلبات مطابقة. أنشئ طلبًا من المتجر ليظهر هنا مباشرة."
              onRowClick={(order) => updateParams({ order: order.id })}
              mobileCard={renderMobileCard}
            />
          )}
        </DirectoryPagedViews>
      )}

      <OrderDetailPanel
        order={selectedOrder}
        orderId={selectedOrderId || null}
        companyId={companyId}
        open={Boolean(selectedOrderId)}
        initialTab={searchParams.get('tab')}
        onOpenChange={(open) => {
          if (!open) updateParams({ order: null });
        }}
      />
    </div>
  );
}
