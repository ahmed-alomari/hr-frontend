'use client';

import { APP, useCompanyApps } from '@/shared/modules/company-apps';

import * as React from 'react';
import { Banknote, CreditCard, StickyNote, Truck, User } from 'lucide-react';
import { WhatsappPhoneAction } from '@/features/ecommerce/admin/cms/whatsapp/components/whatsapp-phone-action';
import { OrderAttachmentsPanel } from '@/features/ecommerce/admin/orders/components/order-attachments-panel';
import { OrderContactPanel } from '@/features/ecommerce/admin/orders/components/order-contact-panel';
import { OrderStockPanel } from '@/features/ecommerce/admin/orders/components/order-stock-panel';
import { OrderLineShipPanel } from '@/features/ecommerce/admin/orders/components/order-line-ship-panel';
import { OrderPaymentProofThumb } from '@/features/ecommerce/admin/orders/components/order-payment-proof-thumb';
import {
  OrderStatusHistoryButton,
  StatusHistoryTimeline,
} from '@/features/ecommerce/admin/orders/components/order-status-history-button';
import {
  OrderStatusStepper,
  type OrderStatusChangeExtra,
} from '@/features/ecommerce/admin/orders/components/order-status-stepper';
import { OrderAssignmentPanel } from '@/features/ecommerce/admin/orders/components/order-assignment-panel';
import { orderTrailNotes } from '@/features/ecommerce/admin/orders/components/order-delivery-panel';
import { useOrderStagesContext } from '@/features/ecommerce/admin/orders/hooks/use-order-stages';
import type { OrderStagesContext } from '@/features/ecommerce/admin/orders/lib/api/order-stages';
import { isViewOnlyOrder, moveBlockReason } from '@/features/ecommerce/admin/orders/lib/order-stage-access';
import {
  useOrderDetail,
  useUpdateOrderPaymentStatus,
  useUpdateOrderStatus,
} from '@/features/ecommerce/admin/orders/hooks/use-orders';
import { formatPrice } from '@/features/ecommerce/shared/utils/format-price';
import {
  getOrderPrepGuidance,
  isPaymentSettled,
  isPrepaidPaymentMethod,
  canTransitionOrderStatus,
  ORDER_LINE_SHIP_STATUS_LABELS_AR,
  ORDER_STATUS_LABELS_AR,
  PAYMENT_METHOD_LABELS_AR,
  PAYMENT_STATUS_LABELS_AR,
  resolveOrderPaymentMethod,
} from '@/features/ecommerce/domain/constants/order-status';
import type { Order, OrderStatus } from '@/features/ecommerce/domain/types/order';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  dialogShellBodyClass,
  dialogMobileFullScreenClass,
  dialogShellContentClass,
  dialogShellHeaderClass,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn, formatDisplayDateTime } from '@/shared/utils';

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

function orderFulfilmentState(order: Order): FulfilmentState {
  if (order.items.length === 0) return 'unfulfilled';
  const shippedCount = order.items.filter((line) => line.shipStatus === 'shipped').length;
  if (shippedCount === order.items.length) return 'fulfilled';
  if (shippedCount === 0) return 'unfulfilled';
  return 'partial';
}

function formatDateTime(iso: string) {
  return formatDisplayDateTime(iso);
}

type DetailTab = 'handle' | 'summary' | 'contact' | 'stock' | 'attachments';

const DETAIL_TAB_LABELS: Record<DetailTab, string> = {
  handle: 'المعالجة',
  summary: 'الملخص',
  contact: 'العنوان والتواصل',
  stock: 'المخزون',
  attachments: 'المرفقات',
};

/** Links from before the delivery and notes tabs were merged. */
const LEGACY_DETAIL_TABS: Record<string, DetailTab> = {
  delivery: 'contact',
  notes: 'contact',
};

/**
 * The stock tab has something to do: an open order without a clear stock
 * source, or returned goods to receive (same rules as OrderStockPanel), or a
 * receipt to read.
 */
function orderStockTabRelevant(order: Order): boolean {
  const source = order.stockSource ?? null;
  if (order.returnReceipt) return true;
  if (
    (source === null || source === 'unresolved') &&
    ['pending', 'confirmed', 'processing'].includes(order.status)
  ) {
    return true;
  }
  if (source !== 'inventory' && source !== 'local') return false;
  return (
    ['shipped', 'delivered', 'refunded'].includes(order.status) ||
    (order.status === 'cancelled' && source === 'inventory')
  );
}

/**
 * Every tab — ordered by what the stage needs, the first one opening by
 * default. The stock tab is left out only when it has nothing for this order
 * and the store does not sell from inventory (bridge off): it would show
 * inventory's words with nothing to do.
 */
function orderDetailTabs(order: Order, bridgeOn: boolean): DetailTab[] {
  const stockFirst = orderStockTabRelevant(order);
  const tabs = orderDetailTabsByStage(order, stockFirst);
  return stockFirst || bridgeOn ? tabs : tabs.filter((tab) => tab !== 'stock');
}

function orderDetailTabsByStage(order: Order, stockFirst: boolean): DetailTab[] {
  switch (order.status) {
    case 'pending':
      return ['handle', 'contact', 'attachments', 'stock'];
    case 'confirmed':
    case 'processing':
      return stockFirst
        ? ['handle', 'stock', 'contact', 'attachments']
        : ['handle', 'contact', 'attachments', 'stock'];
    case 'shipped':
      return ['contact', 'handle', 'attachments', 'stock'];
    default:
      return ['summary', 'stock', 'contact', 'attachments'];
  }
}

function isDetailTab(value: string | null | undefined): value is DetailTab {
  return Boolean(value && value in DETAIL_TAB_LABELS);
}

function toDetailTab(value: string | null | undefined): DetailTab | null {
  if (isDetailTab(value)) return value;
  return (value && LEGACY_DETAIL_TABS[value]) || null;
}

const ITEMS_PAGE_SIZE = 8;

function OrderItemsPanel({
  order,
  companyId,
  stages,
  readOnly = false,
}: {
  order: Order;
  companyId: string;
  stages: OrderStagesContext | null;
  /** Lines shown without preparation (a new order, a closed one). */
  readOnly?: boolean;
}) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'pending' | 'shipped'>('all');
  const [visibleCount, setVisibleCount] = React.useState(ITEMS_PAGE_SIZE);
  const fulfilment = orderFulfilmentState(order);

  const shippedCount = order.items.filter((line) => line.shipStatus === 'shipped').length;
  const assignedCount = order.items.filter((line) => line.shipStatus === 'assigned').length;
  const partialCount = order.items.filter((line) => line.shipStatus === 'partial').length;
  const unassignedCount = order.items.filter((line) => line.shipStatus === 'unassigned').length;
  const manyItems = order.items.length > ITEMS_PAGE_SIZE;
  const canPromoteOrder =
    canTransitionOrderStatus(order, 'shipped') && !moveBlockReason(stages, order, 'shipped');

  const normalizedSearch = search.trim().toLowerCase();
  const filteredItems = order.items.filter((line) => {
    const matchesSearch =
      !normalizedSearch || line.productNameAr.toLowerCase().includes(normalizedSearch);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'shipped' ? line.shipStatus === 'shipped' : line.shipStatus !== 'shipped');
    return matchesSearch && matchesStatus;
  });

  const visibleItems = filteredItems.slice(0, visibleCount);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">منتجات الطلب</h3>
            <Badge variant={FULFILMENT_VARIANT[fulfilment]}>{FULFILMENT_LABELS[fulfilment]}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="success" className="tabular-nums">
              {shippedCount} {ORDER_LINE_SHIP_STATUS_LABELS_AR.shipped}
            </Badge>
            {assignedCount > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {assignedCount} {ORDER_LINE_SHIP_STATUS_LABELS_AR.assigned}
              </Badge>
            ) : null}
            {partialCount > 0 ? (
              <Badge variant="warning" className="tabular-nums">
                {partialCount} {ORDER_LINE_SHIP_STATUS_LABELS_AR.partial}
              </Badge>
            ) : null}
            {unassignedCount > 0 ? (
              <Badge variant="outline" className="tabular-nums">
                {unassignedCount} {ORDER_LINE_SHIP_STATUS_LABELS_AR.unassigned}
              </Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">من {order.items.length}</span>
          </div>
        </div>
        {order.items.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { value: 'all', label: 'الكل' },
                { value: 'pending', label: 'غير مشحون' },
                { value: 'shipped', label: 'تم الشحن' },
              ] as const
            ).map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setStatusFilter(pill.value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  statusFilter === pill.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                {pill.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* The move itself is the «تم الشحن» step of the path (handler, note). */}
      {canPromoteOrder && !readOnly ? (
        <p className="mb-3 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-2.5 text-sm text-teal-900 dark:text-teal-200">
          كل الأصناف شُحنت — حالة الطلب ما زالت «{ORDER_STATUS_LABELS_AR[order.status]}». انقله إلى
          «تم الشحن» من مسار الطلب.
        </p>
      ) : null}

      {manyItems ? (
        <EntityFilterSearchField
          value={search}
          onChange={(value) => {
            setSearch(value);
            setVisibleCount(ITEMS_PAGE_SIZE);
          }}
          placeholder="بحث عن منتج في هذا الطلب…"
          className="mb-3 max-w-sm sm:max-w-sm"
        />
      ) : null}

      <div className="space-y-2">
        {visibleItems.map((line, index) => (
          <OrderLineShipPanel
            key={`${order.id}-${line.productId}-${index}-ship`}
            companyId={companyId}
            orderId={order.id}
            orderStatus={order.status}
            stockSource={order.stockSource}
            stockWarehouseId={order.stockWarehouseId}
            line={line}
            readOnly={readOnly}
          />
        ))}
        {filteredItems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            لا توجد منتجات مطابقة.
          </p>
        ) : null}
        {/* The delivery line (system item): no stock, nothing to ship. */}
        {order.deliveryCharge ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <Truck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate text-sm font-medium text-foreground">
                {order.deliveryCharge.productName}
              </span>
              <Badge variant="secondary" className="shrink-0">
                صنف نظام
              </Badge>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {order.deliveryCharge.amount.amount === 0
                ? 'مجاني'
                : formatPrice(order.deliveryCharge.amount)}
            </span>
          </div>
        ) : null}
      </div>

      {filteredItems.length > visibleItems.length ? (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + ITEMS_PAGE_SIZE)}
          className="mt-3 w-full rounded-xl border border-dashed border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          عرض المزيد ({filteredItems.length - visibleItems.length} متبقٍ)
        </button>
      ) : null}
    </div>
  );
}

type OrderDetailPanelProps = {
  order?: Order | null;
  /** Used when list row is missing/stale — detail is fetched by id. */
  orderId?: string | null;
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, dialog shows a loading shell while order detail is fetched. */
  loading?: boolean;
  /** Tab asked for by a link (`?tab=`); the stage's default when hidden. */
  initialTab?: string | null;
};

export function OrderDetailPanel({
  order: orderProp = null,
  orderId: orderIdProp = null,
  companyId,
  open,
  onOpenChange,
  loading: loadingProp = false,
  initialTab = null,
}: OrderDetailPanelProps) {
  const orderId = orderIdProp || orderProp?.id || null;
  const detailQuery = useOrderDetail(companyId, open ? orderId : null);
  // A list row has no lines / history / proof image: wait for the detail instead.
  const order = detailQuery.data ?? (orderProp?.isSummary ? null : orderProp);
  const loading =
    loadingProp || (Boolean(open && orderId) && detailQuery.isLoading && !order);

  const updateStatus = useUpdateOrderStatus(companyId);
  const updatePayment = useUpdateOrderPaymentStatus(companyId);
  const stages = useOrderStagesContext(companyId).data ?? null;
  const flowBusy = updateStatus.isPending || updatePayment.isPending;
  const prep = order ? getOrderPrepGuidance(order) : null;
  const paymentMethod = order ? resolveOrderPaymentMethod(order) : null;
  const isCard = paymentMethod === 'card';
  const hasProof = Boolean(
    order?.paymentProofUrls?.some((url) => url?.trim()) || order?.paymentProofUrl?.trim(),
  );
  const phone = order?.phone?.trim() || null;
  const customerNote = order?.customerNote?.trim() || null;
  // No payment is recorded on a cancelled or refunded order (server rule).
  const needsPaymentConfirm = Boolean(
    order &&
      !isPaymentSettled(order) &&
      order.status !== 'cancelled' &&
      order.status !== 'refunded' &&
      order.paymentStatus !== 'refunded' &&
      (!stages || stages.canUpdate),
  );
  const PaymentIcon = isCard ? CreditCard : Banknote;

  // The tabs this stage needs; a hidden or unknown tab falls back to the default.
  const bridgeOn = useCompanyApps().isEnabled(APP.storeStockSync);
  const tabs = order ? orderDetailTabs(order, bridgeOn) : [];
  const [pickedTab, setPickedTab] = React.useState<{ orderId: string; tab: DetailTab } | null>(
    null,
  );
  const wantedTab =
    pickedTab && pickedTab.orderId === order?.id
      ? pickedTab.tab
      : toDetailTab(initialTab);
  const activeTab: DetailTab | undefined =
    wantedTab && tabs.includes(wantedTab) ? wantedTab : tabs[0];
  const pickTab = (tab: DetailTab) => {
    if (order) setPickedTab({ orderId: order.id, tab });
  };

  async function markPaid() {
    if (!order) return;
    await updatePayment.mutateAsync({ orderId: order.id, paymentStatus: 'paid' });
  }

  const [mobileActionSlot, setMobileActionSlot] = React.useState<HTMLDivElement | null>(null);

  async function advanceStatus(
    nextStatus: OrderStatus,
    note?: string | null,
    extra?: OrderStatusChangeExtra,
  ) {
    if (!order || order.status === nextStatus) return;
    if (!canTransitionOrderStatus(order, nextStatus)) return;
    await updateStatus.mutateAsync({
      orderId: order.id,
      status: nextStatus,
      note,
      ...extra,
      from: order.status,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          dialogShellContentClass,
          dialogMobileFullScreenClass,
          'max-w-3xl sm:max-w-3xl max-sm:overflow-y-auto',
        )}
      >
        <div className={cn(dialogShellHeaderClass, 'max-sm:px-4 max-sm:py-4')}>
          {loading && !order ? (
            <>
              <DialogTitle>تفاصيل الطلب</DialogTitle>
              <DialogDescription>جاري التحميل…</DialogDescription>
            </>
          ) : null}
          {order && prep && paymentMethod ? (
            <div className="space-y-3 pe-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DialogTitle className="tracking-tight" dir="ltr">
                      {order.orderNumber}
                    </DialogTitle>
                    <OrderStatusHistoryButton
                      companyId={companyId}
                      orderId={order.id}
                      orderNumber={order.orderNumber}
                      history={order.statusHistory}
                    />
                  </div>
                  <DialogDescription className="mt-0.5">
                    {formatDateTime(order.createdAt)}
                    {order.source === 'storefront' || order.orderNumber.startsWith('ND-')
                      ? ' · المتجر'
                      : null}
                  </DialogDescription>
                </div>
                <div className="text-end">
                  <p className="text-[11px] text-muted-foreground">الإجمالي</p>
                  <p className="text-lg font-bold tabular-nums tracking-tight text-foreground">
                    {formatPrice(order.totalAmount)}
                  </p>
                  {order.subtotalAmount && order.shippingFeeAmount ? (
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      المنتجات {formatPrice(order.subtotalAmount)} · التوصيل{' '}
                      {order.shippingFeeAmount.amount === 0
                        ? 'مجاني'
                        : formatPrice(order.shippingFeeAmount)}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Who the order is for; the address and notes are in «العنوان والتواصل». */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {order.customerNameAr}
                </p>
                {phone ? (
                  <WhatsappPhoneAction
                    phone={phone}
                    customerName={order.customerNameAr}
                    orderId={order.id}
                    className="rounded-md bg-primary/10 px-2 py-0.5 text-sm font-bold hover:bg-primary/15"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">لا يوجد جوال</span>
                )}
                {customerNote && tabs.includes('contact') ? (
                  <button
                    type="button"
                    onClick={() => pickTab('contact')}
                    title={`ملاحظة العميل: ${customerNote}`}
                    aria-label="ملاحظة العميل — في العنوان والتواصل"
                    className="ms-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-amber-600 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
                  >
                    <StickyNote className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {order.stockReservation === 'short' &&
              ['pending', 'confirmed', 'processing'].includes(order.status) ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-200">
                  تم تأكيد الدفع لكن الكمية غير متوفرة حالياً — الطلب لا يتقدم حتى تتوفر الكمية أو
                  يُلغى ويُسترد.
                </p>
              ) : null}
            </div>
          ) : !loading ? (
            <>
              <DialogTitle>{order?.orderNumber}</DialogTitle>
              {order ? <DialogDescription>{formatDateTime(order.createdAt)}</DialogDescription> : null}
            </>
          ) : null}
        </div>

        <div
          className={cn(
            dialogShellBodyClass,
            // Phones: one scroll for the whole order; room for the action bar.
            'max-sm:flex-none max-sm:overflow-visible max-sm:px-3 max-sm:pb-4 max-sm:pt-4',
          )}
        >
          {loading && !order ? (
            <p className="py-8 text-center text-sm text-muted-foreground">جاري تحميل تفاصيل الطلب…</p>
          ) : null}
          {order && prep && paymentMethod ? (
            <div className="space-y-4">
              <OrderStatusStepper
                order={order}
                companyId={companyId}
                stages={stages}
                mobileActionSlot={mobileActionSlot}
                disabled={flowBusy}
                onOrderStatusChange={(nextStatus, note, extra) => {
                  void advanceStatus(nextStatus, note, extra).catch(() => undefined);
                }}
                onPaymentPaid={() => {
                  void markPaid();
                }}
                renderPaymentActions={(close) => (
                  <>
                    {!prep.paid && order.status !== 'cancelled' && order.status !== 'refunded' ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">{prep.prepHint}</p>
                    ) : null}
                    {hasProof || needsPaymentConfirm ? (
                      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                        {hasProof ? (
                          <OrderPaymentProofThumb
                            urls={order.paymentProofUrls}
                            url={order.paymentProofUrl}
                            orderNumber={order.orderNumber}
                            size="sm"
                          />
                        ) : null}
                        {needsPaymentConfirm ? (
                          <Button
                            type="button"
                            size="sm"
                            className="ms-auto max-sm:h-10"
                            disabled={flowBusy}
                            onClick={() => {
                              void markPaid()
                                .then(close)
                                .catch(() => undefined);
                            }}
                          >
                            {isPrepaidPaymentMethod(paymentMethod) ? 'تأكيد الدفع' : 'تأكيد التحصيل'}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              />

              {/* Only the tabs this stage needs; the first one opens. */}
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  if (isDetailTab(value)) pickTab(value);
                }}
                className="space-y-3"
              >
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-muted/60 p-1 max-sm:flex-nowrap max-sm:overflow-x-auto">
                  {tabs.map((value) => {
                    const count =
                      value === 'contact'
                        ? (customerNote ? 1 : 0) +
                          (order.staffNote?.trim() ? 1 : 0) +
                          orderTrailNotes(order).length
                        : value === 'attachments'
                          ? (order.attachments?.length ?? 0)
                          : 0;
                    return (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="flex-1 gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm max-sm:flex-none max-sm:py-2"
                      >
                        {DETAIL_TAB_LABELS[value]}
                        {count > 0 ? (
                          <span className="rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">
                            {count}
                          </span>
                        ) : null}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {tabs.includes('handle') ? (
                  <TabsContent value="handle" className="mt-0 space-y-4">
                    <section className="rounded-2xl border border-border bg-card p-4">
                      <OrderAssignmentPanel order={order} companyId={companyId} stages={stages} />
                    </section>
                    <section className="rounded-2xl border border-border bg-card p-4">
                      <OrderItemsPanel
                        order={order}
                        companyId={companyId}
                        stages={stages}
                        readOnly={order.status === 'pending' || isViewOnlyOrder(stages, order)}
                      />
                    </section>
                  </TabsContent>
                ) : null}

                {tabs.includes('summary') ? (
                  <TabsContent value="summary" className="mt-0 space-y-4">
                    <section className="rounded-2xl border border-border bg-card p-4">
                      <OrderItemsPanel order={order} companyId={companyId} stages={stages} readOnly />
                    </section>
                    <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
                      <h3 className="text-sm font-semibold text-foreground">الدفع</h3>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                          <PaymentIcon className="h-4 w-4 text-muted-foreground" />
                          {PAYMENT_METHOD_LABELS_AR[paymentMethod]}
                        </span>
                        {order.paymentAccountSnapshot?.nameAr ? (
                          <span className="text-xs text-muted-foreground">
                            {order.paymentAccountSnapshot.nameAr}
                            {order.paymentAccountSnapshot.mobile
                              ? ` · ${order.paymentAccountSnapshot.mobile}`
                              : ''}
                          </span>
                        ) : null}
                        <Badge variant={PAYMENT_STATUS_VARIANT[order.paymentStatus ?? 'pending']}>
                          {PAYMENT_STATUS_LABELS_AR[order.paymentStatus ?? 'pending']}
                        </Badge>
                        {hasProof ? (
                          <OrderPaymentProofThumb
                            urls={order.paymentProofUrls}
                            url={order.paymentProofUrl}
                            orderNumber={order.orderNumber}
                            size="sm"
                            className="ms-auto"
                          />
                        ) : null}
                      </div>
                    </section>
                    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                      <h3 className="text-sm font-semibold text-foreground">سجل الطلب</h3>
                      <StatusHistoryTimeline entries={order.statusHistory ?? []} />
                    </section>
                  </TabsContent>
                ) : null}

                {tabs.includes('contact') ? (
                  <TabsContent value="contact" className="mt-0 space-y-4">
                    {/* Shipped orders have no «المعالجة» tab: the courier is picked here. */}
                    {!tabs.includes('handle') && order.status === 'shipped' ? (
                      <section className="rounded-2xl border border-border bg-card p-4">
                        <OrderAssignmentPanel order={order} companyId={companyId} stages={stages} />
                      </section>
                    ) : null}
                    <OrderContactPanel order={order} companyId={companyId} stages={stages} />
                  </TabsContent>
                ) : null}

                {tabs.includes('stock') ? (
                  <TabsContent value="stock" className="mt-0">
                    <section className="rounded-2xl border border-border bg-card p-4">
                      <OrderStockPanel order={order} companyId={companyId} />
                    </section>
                  </TabsContent>
                ) : null}

                {tabs.includes('attachments') ? (
                  <TabsContent value="attachments" className="mt-0">
                    <section className="rounded-2xl border border-border bg-card p-4">
                      <OrderAttachmentsPanel order={order} companyId={companyId} />
                    </section>
                  </TabsContent>
                ) : null}
              </Tabs>
            </div>
          ) : null}
        </div>
        {/* Phones: the next step sits here as one chip, in a bar of its own. */}
        <div
          ref={setMobileActionSlot}
          className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur empty:hidden sm:hidden"
        />
      </DialogContent>
    </Dialog>
  );
}
