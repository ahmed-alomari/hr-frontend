import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { inventoryStockService } from '@/features/inventory/services/inventory-stock.service';
import { ordersApi } from '@/features/ecommerce/admin/orders/lib/api/orders';
import {
  receiveAdminOrderReturn,
  resolveAdminOrderStockSource,
} from '@/features/ecommerce/shared/lib/api/store-orders-api';
import type {
  CreateStoreOrderAttachmentInput,
  Order,
  OrderListQuery,
  OrderStatus,
  SaveOrderLineAllocationsInput,
  ShipOrderLineInput,
  UpdateOrderLineShipStatusInput,
  UpdateOrderStaffNoteInput,
  UpdateStoreOrderAttachmentInput,
} from '@/features/ecommerce/domain/types/order';
import type { PaginatedResult } from '@/features/ecommerce/domain/types/common';
import { resolvePaymentProofUrls } from '@/features/ecommerce/domain/lib/payment-proofs';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { ApiError } from '@/shared/api/client';
import {
  ORDER_STATUS_LABELS_AR,
  ORDER_STATUS_TRANSITIONS,
  orderPipelineIndex,
} from '@/features/ecommerce/domain/constants/order-status';
import { toast } from 'sonner';

export const ordersQueryKeys = {
  all: ['ecommerce', 'orders'] as const,
  list: (query: OrderListQuery) => [...ordersQueryKeys.all, 'list', query] as const,
  /** One kanban column (a status), paged on scroll. */
  stage: (query: OrderListQuery) => [...ordersQueryKeys.all, 'stage', query] as const,
  detail: (companyId: string, id: string) => [...ordersQueryKeys.all, 'detail', companyId, id] as const,
};

export const stockAvailabilityQueryKeys = {
  all: ['ecommerce', 'stock-availability'] as const,
  product: (companyId: string, productId: string, variantId: string | null = null) =>
    [...stockAvailabilityQueryKeys.all, companyId, productId, variantId] as const,
};

/** A list row as the full order (from a mutation) now reads: its counts follow the lines. */
function asListRow(row: Order, order: Order): Order {
  if (!row.isSummary) return { ...row, ...order };
  const proofs = resolvePaymentProofUrls(order);
  return {
    ...row,
    ...order,
    isSummary: true,
    lineCount: order.items.length,
    shippedLineCount: order.items.filter((line) => line.shipStatus === 'shipped').length,
    itemQuantity: order.items.reduce((sum, line) => sum + line.quantity, 0),
    hasPaymentProof: proofs.length > 0,
  };
}

/** Puts the order a mutation returned in every cache that shows it (no refetch). */
function syncOrderInCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  companyId: string,
  order: Order,
) {
  queryClient.setQueryData(ordersQueryKeys.detail(companyId, order.id), order);
  queryClient.setQueriesData(
    { queryKey: [...ordersQueryKeys.all, 'list'] },
    (old: PaginatedResult<Order> | undefined) => {
      if (!old?.items) return old;
      const index = old.items.findIndex((item) => item.id === order.id);
      if (index < 0) return old;
      const items = old.items.slice();
      items[index] = asListRow(items[index]!, order);
      return { ...old, items };
    },
  );
  queryClient.setQueriesData(
    { queryKey: [...ordersQueryKeys.all, 'stage'] },
    (old: InfiniteData<PaginatedResult<Order>> | undefined) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => (item.id === order.id ? asListRow(item, order) : item)),
        })),
      };
    },
  );
}

/**
 * After a change to one order: refetch only the lists that may now show it
 * differently — the kanban columns of the statuses it left / entered and the
 * list pages (refetched when shown) — not every column, nor every order's
 * detail. The order itself is already updated from the response.
 */
export function invalidateOrderLists(
  queryClient: ReturnType<typeof useQueryClient>,
  statuses: Array<OrderStatus | null | undefined>,
) {
  const touched = new Set(statuses.filter(Boolean));
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const [scope, feature, kind, params] = query.queryKey as [
        unknown,
        unknown,
        unknown,
        { status?: OrderStatus } | undefined,
      ];
      if (scope !== ordersQueryKeys.all[0] || feature !== ordersQueryKeys.all[1]) return false;
      if (kind === 'list') return true;
      if (kind === 'stage') return Boolean(params?.status && touched.has(params.status));
      return false;
    },
  });
}

/** The status an order had in the caches before a mutation (its kanban column). */
function cachedOrderStatus(
  queryClient: ReturnType<typeof useQueryClient>,
  companyId: string,
  orderId: string,
): OrderStatus | null {
  const detail = queryClient.getQueryData<Order | null>(ordersQueryKeys.detail(companyId, orderId));
  if (detail?.status) return detail.status;
  for (const [, data] of queryClient.getQueriesData<InfiniteData<PaginatedResult<Order>>>({
    queryKey: [...ordersQueryKeys.all, 'stage'],
  })) {
    for (const page of data?.pages ?? []) {
      const row = page.items.find((item) => item.id === orderId);
      if (row) return row.status;
    }
  }
  for (const [, data] of queryClient.getQueriesData<PaginatedResult<Order>>({
    queryKey: [...ordersQueryKeys.all, 'list'],
  })) {
    const row = data?.items?.find((item) => item.id === orderId);
    if (row) return row.status;
  }
  return null;
}

/**
 * Applies a mutation's returned order: caches updated in place, then only the
 * lists of its previous and new status are refetched.
 */
export async function applyOrderMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  companyId: string,
  order: Order,
) {
  // Read before the caches take the new order: the column it is leaving.
  const previousStatus = cachedOrderStatus(queryClient, companyId, order.id);
  syncOrderInCaches(queryClient, companyId, order);
  await invalidateOrderLists(queryClient, [previousStatus, order.status]);
}

/** Orders refresh after this long (and on tab focus once stale). */
const ORDERS_STALE_MS = 30_000;

export function useOrders(query: OrderListQuery, enabled = true) {
  return useQuery({
    queryKey: ordersQueryKeys.list(query),
    // The list rows only (lines / shipped counts included) — no per-order detail.
    queryFn: () => ordersApi.list(query),
    enabled: Boolean(query.companyId && enabled),
    staleTime: ORDERS_STALE_MS,
    // Refresh on tab focus so newly placed orders show up — but only when
    // the data is actually stale (respects the staleTime), unlike a
    // raw `window.addEventListener('focus', refetch)` which would refetch
    // unconditionally on every focus event.
    refetchOnWindowFocus: true,
  });
}

/** Orders shown per kanban column at first, and per "load more". */
export const KANBAN_STAGE_PAGE_SIZE = 10;

/**
 * One kanban column: the first page of its status, then the next page each
 * time the column is scrolled to its last card (that column only).
 */
export function useOrdersStageColumn(query: Omit<OrderListQuery, 'page' | 'limit'> & { status: OrderStatus }) {
  const limit = KANBAN_STAGE_PAGE_SIZE;
  return useInfiniteQuery({
    queryKey: ordersQueryKeys.stage({ ...query, limit }),
    // One list request per page of the column — the cards need no order detail.
    queryFn: ({ pageParam }) => ordersApi.list({ ...query, limit, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      pages.length * limit < lastPage.pagination.total ? pages.length + 1 : undefined,
    enabled: Boolean(query.companyId),
    staleTime: ORDERS_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/** The orders list rows — partner profile / filtered summaries (same cache as `useOrders`). */
export function useOrdersList(query: OrderListQuery, enabled = true) {
  return useOrders(query, enabled);
}

export function useOrderDetail(companyId: string, orderId: string | null) {
  return useQuery({
    queryKey: ordersQueryKeys.detail(companyId, orderId ?? ''),
    queryFn: () => ordersApi.getById(companyId, orderId!),
    enabled: Boolean(companyId && orderId),
  });
}

export function useProductStockAvailability(
  companyId: string,
  productId: string,
  enabled = true,
  variantId?: string | null,
) {
  const scopedVariantId = variantId ?? null;
  return useQuery({
    queryKey: stockAvailabilityQueryKeys.product(companyId, productId, scopedVariantId),
    queryFn: () =>
      inventoryStockService.getAvailability(companyId, productId, {
        variantId: scopedVariantId,
      }),
    enabled: Boolean(companyId && productId && enabled),
  });
}

export function useUpdateOrderStatus(companyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      status,
      note,
      assigneeId,
      paymentCollected,
    }: {
      orderId: string;
      status: OrderStatus;
      note?: string | null;
      /** Order stages: who handles it in the stage it enters (omitted: the settings). */
      assigneeId?: string | null;
      /** Delivering a cash-on-delivery order: the amount was collected. */
      paymentCollected?: boolean;
      /** The status before the move: a forward move offers «تراجع» back to it. */
      from?: OrderStatus;
    }) =>
      ordersApi.updateStatus(companyId, orderId, {
        status,
        note,
        ...(assigneeId !== undefined ? { assigneeId } : {}),
        ...(paymentCollected ? { paymentCollected } : {}),
      }),
    onSuccess: async (order, variables) => {
      await applyOrderMutation(queryClient, companyId, order);
      await queryClient.invalidateQueries({ predicate: (query) => query.queryKey.includes('location-stock') });
      if (variables.status === 'cancelled' || variables.status === 'refunded') {
        toast.success('تم تحديث الحالة — المخزون يُرجع تلقائياً إن سبق خصمه');
      } else if (variables.status === 'shipped') {
        toast.success('تم الشحن وخصم المخزون');
      } else {
        const back = variables.from;
        const undoable = Boolean(
          back &&
            orderPipelineIndex(back) >= 0 &&
            orderPipelineIndex(back) < orderPipelineIndex(order.status) &&
            ORDER_STATUS_TRANSITIONS[order.status]?.includes(back),
        );
        toast.success(
          `نُقل إلى «${ORDER_STATUS_LABELS_AR[order.status]}»`,
          undoable && back
            ? {
                action: {
                  label: 'تراجع',
                  onClick: () =>
                    void ordersApi
                      .updateStatus(companyId, order.id, { status: back, note: null })
                      .then(async (reverted) => {
                        await applyOrderMutation(queryClient, companyId, reverted);
                        toast.success(`أُعيد إلى «${ORDER_STATUS_LABELS_AR[back]}»`);
                      })
                      .catch((err) => handleApiError(err, 'ecommerce.orders.updateStatus')),
                },
              }
            : undefined,
        );
      }
    },
    onError: (err) => {
      handleApiError(err, 'ecommerce.orders.updateStatus');
    },
  });
}

export function useUpdateOrderPaymentStatus(companyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      paymentStatus,
    }: {
      orderId: string;
      paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
    }) => ordersApi.updatePaymentStatus(companyId, orderId, { paymentStatus }),
    onSuccess: async (order) => {
      await applyOrderMutation(queryClient, companyId, order);
      toast.success('تم تحديث حالة الدفع');
    },
    onError: (err) => {
      handleApiError(err, 'ecommerce.orders.updatePaymentStatus');
    },
  });
}

export function useOrderFulfillmentMutations(companyId: string) {
  const queryClient = useQueryClient();

  const invalidate = async (order: Order) => {
    await applyOrderMutation(queryClient, companyId, order);
    await queryClient.invalidateQueries({ queryKey: stockAvailabilityQueryKeys.all });
  };

  const saveAllocations = useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: SaveOrderLineAllocationsInput }) =>
      ordersApi.saveLineAllocations(companyId, orderId, input),
    onSuccess: async (order) => {
      await invalidate(order);
      toast.success('تم حفظ توزيع الشحن');
    },
    onError: (err) => {
      handleApiError(err, 'ecommerce.orders.saveAllocations');
    },
  });

  const shipLine = useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: ShipOrderLineInput }) =>
      ordersApi.shipLine(companyId, orderId, input),
    onSuccess: async (order) => {
      await invalidate(order);
      toast.success('تم شحن الصنف');
    },
    onError: (err) => {
      handleApiError(err, 'ecommerce.orders.shipLine');
    },
  });

  const updateLineShipStatus = useMutation({
    mutationFn: ({
      orderId,
      input,
    }: {
      orderId: string;
      input: UpdateOrderLineShipStatusInput;
    }) => ordersApi.updateLineShipStatus(companyId, orderId, input),
    onSuccess: async (order, variables) => {
      await invalidate(order);
      toast.success(
        variables.input.shipStatus === 'shipped'
          ? 'تم شحن الصنف'
          : 'تم إرجاع حالة تجهيز الصنف',
      );
    },
    onError: (err) => {
      handleApiError(err, 'ecommerce.orders.updateLineShipStatus');
    },
  });

  return { saveAllocations, shipLine, updateLineShipStatus };
}

export function useOrderAttachmentMutations(companyId: string) {
  const queryClient = useQueryClient();

  const invalidate = (order: Order) => applyOrderMutation(queryClient, companyId, order);

  const add = useMutation({
    mutationFn: ({
      orderId,
      input,
    }: {
      orderId: string;
      input: CreateStoreOrderAttachmentInput;
    }) => ordersApi.addAttachment(companyId, orderId, input),
    onSuccess: async (order) => {
      await invalidate(order);
      toast.success('تم إضافة المرفق');
    },
    onError: (err) => {
      handleApiError(err, 'ecommerce.orders.addAttachment');
    },
  });

  const update = useMutation({
    mutationFn: ({
      orderId,
      attachmentId,
      input,
    }: {
      orderId: string;
      attachmentId: string;
      input: UpdateStoreOrderAttachmentInput;
    }) => ordersApi.updateAttachment(companyId, orderId, attachmentId, input),
    onSuccess: async (order, variables) => {
      await invalidate(order);
      toast.success(
        variables.input.visibleToCustomer === false
          ? 'تم إخفاء المرفق عن العميل'
          : variables.input.visibleToCustomer === true
            ? 'تم إظهار المرفق للعميل'
            : 'تم تحديث المرفق',
      );
    },
    onError: (err) => {
      handleApiError(err, 'ecommerce.orders.updateAttachment');
    },
  });

  const remove = useMutation({
    mutationFn: ({ orderId, attachmentId }: { orderId: string; attachmentId: string }) =>
      ordersApi.removeAttachment(companyId, orderId, attachmentId),
    onSuccess: async (order) => {
      await invalidate(order);
      toast.success('تم حذف المرفق');
    },
    onError: (err) => {
      handleApiError(err, 'ecommerce.orders.removeAttachment');
    },
  });

  return { add, update, remove };
}

function stockSourceChoiceError(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.envelope?.error || typeof error.envelope.error !== 'object') {
    return null;
  }
  const body = error.envelope.error as { code?: string };
  if (body.code === 'STORE_ORDER_NOT_LOCAL') {
    return 'المتجر يبيع من المخازن الآن، فلا تُخصم كمية المنتج. لإغلاق طلب قديم دون حركة مخزون: اكتب ملاحظة ثم اضغط «بلا أثر مخزني».';
  }
  if (body.code === 'STORE_STOCK_SHORT') {
    return 'الكمية غير موجودة في مستودع المتجر. أدخل الرصيد ثم أعد «المخازن»، أو اكتب ملاحظة واضغط «بلا أثر مخزني».';
  }
  if (body.code === 'STORE_INVENTORY_BRIDGE_DISABLED') {
    return 'الربط مع المخازن غير مفعّل، فلا يُحجز من المستودع. استخدم «كمية المنتج» أو «بلا أثر مخزني».';
  }
  return null;
}

/** Older (unresolved) order: choose its stock source (phase 4). */
export function useResolveOrderStockSource(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      source,
      note,
    }: {
      orderId: string;
      source: 'inventory' | 'local' | 'none';
      note?: string;
    }) => resolveAdminOrderStockSource(orderId, { source, note }),
    onSuccess: async (order) => {
      await applyOrderMutation(queryClient, companyId, order);
      toast.success('تم تحديد مصدر المخزون للطلب');
    },
    onError: (error) => {
      const text = stockSourceChoiceError(error);
      if (text) {
        toast.error(text);
        return;
      }
      handleApiError(error, 'ecommerce.orders.stock-source');
    },
  });
}

/** Confirms the whole returned order was received (phase 4). */
export function useReceiveOrderReturn(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      lines,
      notes,
    }: {
      orderId: string;
      lines: Array<{ lineId: string; sellableQuantity: number; damagedQuantity: number }>;
      notes?: string;
    }) => receiveAdminOrderReturn(orderId, { lines, notes }),
    onSuccess: async (order) => {
      await applyOrderMutation(queryClient, companyId, order);
      toast.success('تم تأكيد استلام المرتجع وإعادة الكمية الصالحة للمخزون');
    },
    onError: (error) => {
      handleApiError(error, 'ecommerce.orders.return-receipt');
    },
  });
}

export function useUpdateOrderStaffNote(companyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      input,
    }: {
      orderId: string;
      input: UpdateOrderStaffNoteInput;
    }) => ordersApi.updateStaffNote(companyId, orderId, input),
    onSuccess: async (order, variables) => {
      await applyOrderMutation(queryClient, companyId, order);
      const cleared =
        variables.input.staffNote !== undefined &&
        (variables.input.staffNote ?? '').trim().length === 0;
      toast.success(
        cleared
          ? 'تم مسح ملاحظة المتجر'
          : variables.input.visibleToCustomer === true
            ? 'تم حفظ الملاحظة وإظهارها للعميل'
            : variables.input.visibleToCustomer === false
              ? 'تم حفظ الملاحظة وإخفاؤها عن العميل'
              : 'تم حفظ ملاحظة المتجر',
      );
    },
    onError: (err) => {
      handleApiError(err, 'ecommerce.orders.updateStaffNote');
    },
  });
}
