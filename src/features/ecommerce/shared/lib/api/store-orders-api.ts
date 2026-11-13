import { companyCurrencyCode } from '@/features/auth/lib/company-currency';
import { apiRequest, ensurePaginatedResult, type PaginatedResult } from '@/features/hr/lib/api/client';
import type { CreateStoreOrderAttachmentInput,
  OrderHistoryKind,
  UpdateOrderDeliveryInput,
  Order,
  OrderAttachmentVisibilityFilter,
  OrderListQuery,
  OrderLineItem,
  SaveOrderLineAllocationsInput,
  ShipOrderLineInput,
  StoreOrderAttachment,
  UpdateOrderPaymentStatusInput,
  UpdateOrderStaffNoteInput,
  UpdateOrderStatusInput,
  UpdateStoreOrderAttachmentInput,
  OrderReturnReceipt,
  OrderStockSource,
  OrderStockReservation,
} from '@/features/ecommerce/domain/types/order';
import type {
  PlaceOrderInput,
  StorefrontCustomerOrder,
} from '@/features/ecommerce/storefront/domain/checkout';
import { resolveStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import type { ListGroupsResult } from '@/components/ui/list-group';
import {
  fromDecimalString,
  isStoreHttpEnabled,
  publicStoreRequest,
  toDecimalString,
} from '@/features/ecommerce/storefront/lib/api/store-http';
import { resolvePaymentProofUrls } from '@/features/ecommerce/domain/lib/payment-proofs';

type StorePaginatedMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type StoreOrderLineDto = {
  id: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  productSlug: string;
  imageUrl?: string | null;
  quantity: number;
  unitPriceAmount: string;
  unitPriceCurrency: string;
  lineTotalAmount: string;
  shipStatus: OrderLineItem['shipStatus'];
  sortOrder: number;
  allocations: Array<{
    id: string;
    warehouseId: string;
    locationId: string;
    quantity: string;
  }>;
};

type StoreOrderAttachmentDto = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  sizeBytes?: string | number | null;
  label?: string | null;
  visibleToCustomer?: boolean | null;
  uploadedBy?: string | null;
  createdAt: string;
};

type StoreOrderDto = {
  id: string;
  companyId: string;
  orderNumber: string;
  partnerId?: string | null;
  customerNameAr: string;
  phone?: string | null;
  status: Order['status'];
  paymentMethod: NonNullable<Order['paymentMethod']>;
  paymentStatus: NonNullable<Order['paymentStatus']>;
  paymentAccountId?: string | null;
  paymentAccountSnapshot?: Order['paymentAccountSnapshot'];
  paymentProofUrl?: string | null;
  paymentProofUrls?: string[] | null;
  source?: Order['source'];
  locale?: string;
  shipFullName: string;
  shipPhone: string;
  shipCity: string;
  shipDistrict: string;
  shipStreet: string;
  shipNotes?: string | null;
  customerNote?: string | null;
  staffNote?: string | null;
  staffNoteVisibleToCustomer?: boolean | null;
  stockSource?: OrderStockSource | null;
  stockSourceNote?: string | null;
  stockWarehouseId?: string | null;
  stockReservation?: OrderStockReservation | null;
  returnReceipt?: OrderReturnReceipt | null;
  shipLat?: number | null;
  shipLng?: number | null;
  shipMapAddress?: string | null;
  currencyCode: string;
  subtotalAmount: string;
  shippingFeeAmount: string;
  deliveryCharge?: {
    productId: string;
    productName: string;
    amount: string;
    currencyCode: string;
  } | null;
  totalAmount: string;
  estimatedDeliveryAt?: string | null;
  lines: StoreOrderLineDto[];
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedAt?: string | null;
  statusHistory?: Array<{
    id?: string;
    kind?: OrderHistoryKind;
    fromStatus?: Order['status'] | null;
    toStatus: Order['status'];
    changedBy?: string | null;
    changedByName?: string | null;
    assignedTo?: string | null;
    assignedToName?: string | null;
    note?: string | null;
    createdAt: string;
  }>;
  attachments?: StoreOrderAttachmentDto[] | null;
  createdAt: string;
  updatedAt: string;
};

type StoreOrderListItemDto = {
  id: string;
  orderNumber: string;
  customerNameAr: string;
  phone?: string | null;
  status: Order['status'];
  paymentMethod: NonNullable<Order['paymentMethod']>;
  paymentStatus: NonNullable<Order['paymentStatus']>;
  shipCity: string;
  currencyCode: string;
  totalAmount: string;
  lineCount: number;
  /** Older servers omit the fields below (then the counts are unknown). */
  shippedLineCount?: number;
  itemQuantity?: number;
  hasPaymentProof?: boolean;
  paymentAccountId?: string | null;
  partnerId?: string | null;
  source?: Order['source'];
  shipPhone?: string;
  shipDistrict?: string;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  createdAt: string;
  updatedAt?: string;
  groupKey?: string | null;
};

function mapLine(dto: StoreOrderLineDto): OrderLineItem {
  return {
    lineId: dto.id,
    productId: dto.productId,
    variantId: dto.variantId ?? null,
    productNameAr: dto.productName,
    quantity: dto.quantity,
    unitPrice: {
      amount: fromDecimalString(dto.unitPriceAmount),
      currency: dto.unitPriceCurrency,
    },
    allocations: (dto.allocations ?? []).map((row) => ({
      id: row.id,
      warehouseId: row.warehouseId,
      locationId: row.locationId,
      quantity: fromDecimalString(row.quantity),
    })),
    shipStatus: dto.shipStatus ?? 'unassigned',
    imageUrl: dto.imageUrl ?? null,
  };
}

function mapAttachments(
  rows: StoreOrderAttachmentDto[] | null | undefined,
): StoreOrderAttachment[] {
  if (!rows?.length) return [];
  return rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    mimeType: row.mimeType ?? null,
    sizeBytes: row.sizeBytes == null ? null : String(row.sizeBytes),
    label: row.label ?? null,
    visibleToCustomer: row.visibleToCustomer ?? true,
    uploadedBy: row.uploadedBy ?? null,
    createdAt: row.createdAt,
  }));
}

function mapStatusHistory(
  rows: StoreOrderDto['statusHistory'],
): NonNullable<Order['statusHistory']> {
  if (!rows?.length) return [];
  return [...rows]
    .map((row) => ({
      id: row.id,
      kind: row.kind ?? 'status',
      fromStatus: row.fromStatus ?? null,
      toStatus: row.toStatus,
      changedBy: row.changedBy ?? null,
      changedByName: row.changedByName ?? null,
      assignedTo: row.assignedTo ?? null,
      assignedToName: row.assignedToName ?? null,
      note: row.note ?? null,
      createdAt: row.createdAt,
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function mapAdminOrder(dto: StoreOrderDto): Order {
  const proofUrls = resolvePaymentProofUrls({
    paymentProofUrls: dto.paymentProofUrls,
    paymentProofUrl: dto.paymentProofUrl,
  });
  const currency = dto.currencyCode || companyCurrencyCode();
  return {
    id: dto.id,
    companyId: dto.companyId,
    orderNumber: dto.orderNumber,
    customerId: dto.partnerId ?? `guest:${dto.shipPhone}`,
    customerNameAr: dto.customerNameAr,
    city: dto.shipCity,
    region: dto.shipDistrict,
    status: dto.status,
    items: (dto.lines ?? []).map(mapLine),
    totalAmount: { amount: fromDecimalString(dto.totalAmount), currency },
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    phone: dto.phone ?? dto.shipPhone,
    shippingStreet: dto.shipStreet,
    shippingDistrict: dto.shipDistrict,
    shippingNotes: dto.shipNotes ?? undefined,
    customerNote: dto.customerNote ?? null,
    staffNote: dto.staffNote ?? null,
    staffNoteVisibleToCustomer: dto.staffNoteVisibleToCustomer ?? false,
    stockSource: dto.stockSource ?? null,
    stockSourceNote: dto.stockSourceNote ?? null,
    stockWarehouseId: dto.stockWarehouseId ?? null,
    stockReservation: dto.stockReservation ?? null,
    returnReceipt: dto.returnReceipt ?? null,
    paymentMethod: dto.paymentMethod,
    paymentStatus: dto.paymentStatus,
    paymentAccountId: dto.paymentAccountId ?? null,
    paymentAccountSnapshot: dto.paymentAccountSnapshot ?? null,
    paymentProofUrls: proofUrls,
    paymentProofUrl: proofUrls[0] ?? null,
    subtotalAmount: { amount: fromDecimalString(dto.subtotalAmount), currency },
    shippingFeeAmount: { amount: fromDecimalString(dto.shippingFeeAmount), currency },
    deliveryCharge: dto.deliveryCharge
      ? {
          productId: dto.deliveryCharge.productId,
          productName: dto.deliveryCharge.productName,
          amount: { amount: fromDecimalString(dto.deliveryCharge.amount), currency },
        }
      : null,
    source: dto.source ?? 'storefront',
    assignedUserId: dto.assignedUserId ?? null,
    assignedUserName: dto.assignedUserName ?? null,
    assignedAt: dto.assignedAt ?? null,
    shipFullName: dto.shipFullName,
    shipPhone: dto.shipPhone,
    estimatedDeliveryAt: dto.estimatedDeliveryAt ?? null,
    statusHistory: mapStatusHistory(dto.statusHistory),
    attachments: mapAttachments(dto.attachments),
  };
}

/**
 * A list row (no lines, no history, no proof image): `isSummary` with the
 * line counts instead — the detail is fetched when the order is opened.
 */
function mapListItem(dto: StoreOrderListItemDto, companyId: string): Order {
  const currency = dto.currencyCode || companyCurrencyCode(companyId);
  return {
    id: dto.id,
    companyId,
    orderNumber: dto.orderNumber,
    customerId: dto.partnerId ?? `guest:${dto.shipPhone ?? dto.phone ?? dto.orderNumber}`,
    customerNameAr: dto.customerNameAr,
    city: dto.shipCity,
    region: dto.shipDistrict,
    shippingDistrict: dto.shipDistrict,
    status: dto.status,
    items: [],
    isSummary: true,
    lineCount: dto.lineCount,
    shippedLineCount: dto.shippedLineCount,
    itemQuantity: dto.itemQuantity,
    hasPaymentProof: dto.hasPaymentProof,
    totalAmount: { amount: fromDecimalString(dto.totalAmount), currency },
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? dto.createdAt,
    phone: dto.phone ?? dto.shipPhone ?? undefined,
    shipPhone: dto.shipPhone,
    paymentMethod: dto.paymentMethod,
    paymentStatus: dto.paymentStatus,
    paymentAccountId: dto.paymentAccountId ?? null,
    assignedUserId: dto.assignedUserId ?? null,
    assignedUserName: dto.assignedUserName ?? null,
    source: dto.source ?? 'storefront',
    ...(dto.groupKey !== undefined ? { groupKey: dto.groupKey } : {}),
  };
}

function mapStorefrontOrder(dto: StoreOrderDto): StorefrontCustomerOrder {
  const proofUrls = resolvePaymentProofUrls({
    paymentProofUrls: dto.paymentProofUrls,
    paymentProofUrl: dto.paymentProofUrl,
  });
  const currency = dto.currencyCode || 'YER';
  return {
    id: dto.id,
    companyId: dto.companyId,
    orderNumber: dto.orderNumber,
    status: dto.status === 'refunded' ? 'cancelled' : dto.status,
    paymentMethod: dto.paymentMethod,
    paymentStatus: dto.paymentStatus,
    paymentAccountId: dto.paymentAccountId ?? null,
    paymentAccountSnapshot: dto.paymentAccountSnapshot ?? null,
    paymentProofUrls: proofUrls,
    paymentProofUrl: proofUrls[0] ?? null,
    customerNote: dto.customerNote ?? null,
    staffNote: dto.staffNote ?? null,
    address: {
      fullName: dto.shipFullName,
      phone: dto.shipPhone,
      city: dto.shipCity,
      district: dto.shipDistrict,
      street: dto.shipStreet,
      notes: dto.shipNotes ?? undefined,
      lat: dto.shipLat ?? undefined,
      lng: dto.shipLng ?? undefined,
      mapAddress: dto.shipMapAddress ?? undefined,
    },
    lines: (dto.lines ?? []).map((line) => ({
      productId: line.productId,
      variantId: line.variantId ?? undefined,
      productName: line.productName,
      productSlug: line.productSlug,
      quantity: line.quantity,
      unitPrice: {
        amount: fromDecimalString(line.unitPriceAmount),
        currency: line.unitPriceCurrency || currency,
      },
      imageUrl: line.imageUrl ?? null,
      lineTotal: {
        amount: fromDecimalString(line.lineTotalAmount),
        currency: line.unitPriceCurrency || currency,
      },
    })),
    subtotal: { amount: fromDecimalString(dto.subtotalAmount), currency },
    shippingFee: { amount: fromDecimalString(dto.shippingFeeAmount), currency },
    total: { amount: fromDecimalString(dto.totalAmount), currency },
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    estimatedDeliveryAt: dto.estimatedDeliveryAt ?? dto.createdAt,
    attachments: mapAttachments(dto.attachments),
  };
}

export async function placePublicStoreOrder(
  input: PlaceOrderInput,
  partnerToken?: string | null,
  /** Server actions: the customer's X-Forwarded-For (API rate limits). */
  clientHeaders?: Record<string, string>,
): Promise<StorefrontCustomerOrder> {
  const proofUrls = resolvePaymentProofUrls({
    paymentProofUrls: input.paymentProofUrls,
    paymentProofUrl: input.paymentProofUrl,
  });
  // The browser keeps one key per attempt; without one, this send is its own.
  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `order-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const postOrder = () =>
    publicStoreRequest<StoreOrderDto>('/public/store/orders', {
      method: 'POST',
      token: partnerToken,
      headers: { ...clientHeaders, 'Idempotency-Key': idempotencyKey },
      body: {
        companyId: resolveStorefrontCompanyId(input.companyId),
        paymentMethod: input.paymentMethod,
        ...(input.paymentAccountId
          ? { paymentAccountId: input.paymentAccountId }
          : {}),
        paymentProofUrl: proofUrls[0] ?? null,
        locale: input.locale || 'ar',
        ...(input.customerNote?.trim()
          ? { customerNote: input.customerNote.trim() }
          : {}),
        address: {
          fullName: input.address.fullName,
          phone: input.address.phone,
          ...(input.address.countryId ? { countryId: input.address.countryId } : {}),
          ...(input.address.cityId ? { cityId: input.address.cityId } : {}),
          ...(input.address.districtId ? { districtId: input.address.districtId } : {}),
          city: input.address.city,
          district: input.address.district,
          street: input.address.street,
          notes: input.address.notes ?? null,
          lat: input.address.lat ?? null,
          lng: input.address.lng ?? null,
          mapAddress: input.address.mapAddress ?? null,
        },
        items: input.lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId ?? null,
          quantity: line.quantity,
        })),
        ...(input.attachments?.length
          ? {
              attachments: input.attachments.slice(0, 20).map((attachment) => ({
                fileName: attachment.fileName,
                fileUrl: attachment.fileUrl,
                mimeType: attachment.mimeType ?? null,
                sizeBytes: attachment.sizeBytes ?? null,
                label: attachment.label ?? null,
              })),
            }
          : {}),
      },
    });

  const toOrder = (dto: StoreOrderDto | null): StorefrontCustomerOrder => {
    if (!dto) throw new Error('ORDER_CREATE_FAILED');
    console.log('[orders] place-order created (no frontend stock deduct)', {
      orderNumber: dto.orderNumber,
      id: dto.id,
      status: dto.status,
    });
    return mapStorefrontOrder(dto);
  };

  return toOrder(await postOrder());
}

export async function fetchPublicStoreOrder(input: {
  companyId: string;
  orderNumber: string;
  phone?: string | null;
  partnerToken?: string | null;
  /** Server actions: the customer's X-Forwarded-For (API rate limits). */
  clientHeaders?: Record<string, string>;
}): Promise<StorefrontCustomerOrder | null> {
  return publicStoreRequest<StoreOrderDto>(
    `/public/store/orders/${encodeURIComponent(input.orderNumber)}`,
    {
      headers: input.clientHeaders,
      query: {
        companyId: resolveStorefrontCompanyId(input.companyId),
        phone: input.phone?.trim() || undefined,
      },
      token: input.partnerToken,
      nullOn404: true,
    },
  ).then((dto) => (dto ? mapStorefrontOrder(dto) : null));
}

/** The customer corrects the delivery address. Only before the order ships. */
export async function updatePublicStoreOrderAddress(input: {
  companyId: string;
  orderNumber: string;
  phone?: string | null;
  partnerToken?: string | null;
  shipFullName: string;
  shipPhone: string;
  shipDistrict: string;
  shipStreet: string;
  shipNotes: string | null;
}): Promise<StorefrontCustomerOrder> {
  const dto = await publicStoreRequest<StoreOrderDto>(
    `/public/store/orders/${encodeURIComponent(input.orderNumber)}/address`,
    {
      method: 'PATCH',
      query: {
        companyId: resolveStorefrontCompanyId(input.companyId),
        phone: input.phone?.trim() || undefined,
      },
      token: input.partnerToken,
      body: {
        shipFullName: input.shipFullName,
        shipPhone: input.shipPhone,
        shipDistrict: input.shipDistrict,
        shipStreet: input.shipStreet,
        shipNotes: input.shipNotes,
      },
    },
  );
  if (!dto) throw new Error('ORDER_NOT_FOUND');
  return mapStorefrontOrder(dto);
}

/** GET /public/store/orders — partner Bearer required (typ=partner). */
export async function fetchPartnerStoreOrders(input: {
  accessToken: string;
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ items: StorefrontCustomerOrder[]; pagination: StorePaginatedMeta }> {
  const page = await publicStoreRequest<{
    items: StoreOrderDto[];
    pagination: StorePaginatedMeta;
  }>('/public/store/orders', {
    token: input.accessToken,
    query: {
      page: input.page ?? 1,
      limit: input.limit ?? 50,
      status: input.status,
    },
  });
  const items = page?.items ?? [];
  const pagination = page?.pagination ?? {
    page: 1,
    limit: input.limit ?? 50,
    total: items.length,
    totalPages: 1,
  };
  return {
    items: items.map(mapStorefrontOrder),
    pagination,
  };
}

/** The list's filters as query parameters (the list and its groups). */
function orderFilterQuery(query: OrderListQuery, companyId: string) {
  return {
    companyId,
    status: query.status,
    paymentStatus: query.paymentStatus,
    paymentMethod: query.paymentMethod,
    paymentAccountId: query.paymentAccountId,
    city: query.city,
    search: query.search,
    partnerId: query.partnerId,
    assignedTo: query.assignedTo,
    fulfilment: query.fulfilment,
    source: query.source,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    groupBy: query.groupBy,
  };
}

/** Counts and amounts of the filtered orders, per `groupBy` group and overall. */
export async function fetchAdminStoreOrderGroups(query: OrderListQuery): Promise<ListGroupsResult> {
  const companyId = resolveStorefrontCompanyId(query.companyId);
  return apiRequest<ListGroupsResult>('/store-admin/orders/groups', {
    throwOnError: true,
    query: orderFilterQuery(query, companyId),
  });
}

export async function fetchAdminStoreOrders(
  query: OrderListQuery,
): Promise<PaginatedResult<Order>> {
  const companyId = resolveStorefrontCompanyId(query.companyId);
  const page = await apiRequest<PaginatedResult<StoreOrderListItemDto>>('/store-admin/orders', {
    throwOnError: true,
    query: {
      ...orderFilterQuery(query, companyId),
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      groupValue: query.groupValue,
    },
  });
  const safe = ensurePaginatedResult(page);
  return {
    items: safe.items.map((item) => mapListItem(item, companyId)),
    pagination: safe.pagination,
  };
}

export async function fetchAdminStoreOrder(
  companyId: string,
  id: string,
  options?: { attachments?: OrderAttachmentVisibilityFilter },
): Promise<Order | null> {
  try {
    const dto = await apiRequest<StoreOrderDto>(`/store-admin/orders/${id}`, {
      throwOnError: true,
      query: {
        attachments:
          options?.attachments && options.attachments !== 'all'
            ? options.attachments
            : undefined,
      },
    });
    return mapAdminOrder(dto);
  } catch {
    return null;
  }
}

export async function updateAdminStoreOrderStatus(
  companyId: string,
  id: string,
  input: UpdateOrderStatusInput,
): Promise<Order> {
  const dto = await apiRequest<StoreOrderDto>(`/store-admin/orders/${id}/status`, {
    method: 'PATCH',
    throwOnError: true,
    body: {
      status: input.status,
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.paymentCollected ? { paymentCollected: true } : {}),
    },
  });
  return mapAdminOrder(dto);
}

/** Order stages: assign the order in its current stage (null takes it off). */
export async function assignAdminStoreOrder(
  id: string,
  assigneeId: string | null,
  note?: string | null,
): Promise<Order> {
  const dto = await apiRequest<StoreOrderDto>(`/store-admin/orders/${id}/assignee`, {
    method: 'PATCH',
    throwOnError: true,
    body: { assigneeId, ...(note ? { note } : {}) },
  });
  return mapAdminOrder(dto);
}

/** An internal note in the order's trail (e.g. a failed delivery attempt). */
export async function addAdminStoreOrderNote(id: string, note: string): Promise<Order> {
  const dto = await apiRequest<StoreOrderDto>(`/store-admin/orders/${id}/notes`, {
    method: 'POST',
    throwOnError: true,
    body: { note },
  });
  return mapAdminOrder(dto);
}

/** Corrects the delivery details of an open order / sets the expected date. */
export async function updateAdminStoreOrderDelivery(
  id: string,
  input: UpdateOrderDeliveryInput,
): Promise<Order> {
  const dto = await apiRequest<StoreOrderDto>(`/store-admin/orders/${id}/delivery`, {
    method: 'PATCH',
    throwOnError: true,
    body: input,
  });
  return mapAdminOrder(dto);
}

export async function updateAdminStoreOrderPayment(
  companyId: string,
  id: string,
  input: UpdateOrderPaymentStatusInput,
): Promise<Order> {
  const dto = await apiRequest<StoreOrderDto>(`/store-admin/orders/${id}/payment`, {
    method: 'PATCH',
    throwOnError: true,
    body: {
      paymentStatus: input.paymentStatus,
      ...(input.paymentProofUrl !== undefined
        ? { paymentProofUrl: input.paymentProofUrl }
        : {}),
    },
  });
  return mapAdminOrder(dto);
}

export async function saveAdminStoreLineAllocations(
  companyId: string,
  orderId: string,
  lineId: string,
  input: SaveOrderLineAllocationsInput,
): Promise<Order> {
  const current = await fetchAdminStoreOrder(companyId, orderId);
  const existing =
    current?.items.find((item) => item.lineId === lineId)?.allocations ?? [];

  // Replace strategy: DELETE existing allocations then POST the new set.
  for (const allocation of existing) {
    if (!allocation.id) continue;
    await apiRequest(
      `/store-admin/orders/${orderId}/lines/${lineId}/allocations/${allocation.id}`,
      {
        method: 'DELETE',
        throwOnError: true,
      },
    );
  }

  for (const row of input.allocations) {
    if (!row.warehouseId || !row.locationId || !(row.quantity > 0)) {
      throw new Error('توزيع غير صالح: يلزم مستودع وموقع وكمية أكبر من صفر.');
    }
    await apiRequest(`/store-admin/orders/${orderId}/lines/${lineId}/allocations`, {
      method: 'POST',
      throwOnError: true,
      body: {
        warehouseId: row.warehouseId,
        locationId: row.locationId,
        // Backend validates: "quantity must be a number string" (e.g. "1" / "1.0000").
        quantity: toDecimalString(row.quantity),
      },
    });
  }

  // Always re-fetch full order — allocation POST/DELETE payloads are not reliable order DTOs.
  const order = await fetchAdminStoreOrder(companyId, orderId);
  if (!order) throw new Error('الطلب غير موجود.');
  return order;
}

export async function deleteAdminStoreLineAllocation(
  companyId: string,
  orderId: string,
  lineId: string,
  allocationId: string,
): Promise<Order> {
  const dto = await apiRequest<StoreOrderDto>(
    `/store-admin/orders/${orderId}/lines/${lineId}/allocations/${allocationId}`,
    {
      method: 'DELETE',
      throwOnError: true,
    },
  );
  return mapAdminOrder(dto);
}

export async function updateAdminStoreLineShipStatus(
  companyId: string,
  orderId: string,
  lineId: string,
  shipStatus: OrderLineItem['shipStatus'],
  note?: string | null,
): Promise<Order> {
  const trimmed = note?.trim();
  await apiRequest(`/store-admin/orders/${orderId}/lines/${lineId}/ship-status`, {
    method: 'PATCH',
    throwOnError: true,
    body: {
      shipStatus,
      ...(trimmed ? { note: trimmed } : {}),
    },
  });
  const order = await fetchAdminStoreOrder(companyId, orderId);
  if (!order) throw new Error('الطلب غير موجود.');
  return order;
}

/** @deprecated Prefer updateAdminStoreLineShipStatus — kept for callers that only mark shipped. */
export async function shipAdminStoreLine(
  companyId: string,
  orderId: string,
  lineId: string,
  input: ShipOrderLineInput,
): Promise<Order> {
  return updateAdminStoreLineShipStatus(
    companyId,
    orderId,
    lineId,
    'shipped',
    input.note,
  );
}

/** POST /store-admin/orders/:id/attachments → returns the full updated order. */
export async function addAdminStoreOrderAttachment(
  companyId: string,
  orderId: string,
  input: CreateStoreOrderAttachmentInput,
): Promise<Order> {
  const dto = await apiRequest<StoreOrderDto>(`/store-admin/orders/${orderId}/attachments`, {
    method: 'POST',
    throwOnError: true,
    body: {
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes ?? null,
      label: input.label ?? null,
      ...(input.visibleToCustomer === undefined
        ? {}
        : { visibleToCustomer: input.visibleToCustomer }),
    },
  });
  return mapAdminOrder(dto);
}

/** PATCH /store-admin/orders/:id/attachments/:attachmentId → returns the full order. */
export async function updateAdminStoreOrderAttachment(
  companyId: string,
  orderId: string,
  attachmentId: string,
  input: UpdateStoreOrderAttachmentInput,
): Promise<Order> {
  const dto = await apiRequest<StoreOrderDto>(
    `/store-admin/orders/${orderId}/attachments/${attachmentId}`,
    {
      method: 'PATCH',
      throwOnError: true,
      body: {
        ...(input.label === undefined ? {} : { label: input.label }),
        ...(input.visibleToCustomer === undefined
          ? {}
          : { visibleToCustomer: input.visibleToCustomer }),
      },
    },
  );
  return mapAdminOrder(dto);
}

/** DELETE /store-admin/orders/:id/attachments/:attachmentId → returns the full order. */
export async function deleteAdminStoreOrderAttachment(
  companyId: string,
  orderId: string,
  attachmentId: string,
): Promise<Order> {
  const dto = await apiRequest<StoreOrderDto>(
    `/store-admin/orders/${orderId}/attachments/${attachmentId}`,
    {
      method: 'DELETE',
      throwOnError: true,
    },
  );
  return mapAdminOrder(dto);
}

/** PATCH /store-admin/orders/:id/staff-note → returns the full updated order. */
export async function updateAdminStoreOrderStaffNote(
  companyId: string,
  orderId: string,
  input: UpdateOrderStaffNoteInput,
): Promise<Order> {
  const dto = await apiRequest<StoreOrderDto>(`/store-admin/orders/${orderId}/staff-note`, {
    method: 'PATCH',
    throwOnError: true,
    body: {
      ...(input.staffNote === undefined ? {} : { staffNote: input.staffNote }),
      ...(input.visibleToCustomer === undefined
        ? {}
        : { visibleToCustomer: input.visibleToCustomer }),
    },
  });
  return mapAdminOrder(dto);
}

/** Older (unresolved) order: choose where its stock comes from (phase 4). */
export async function resolveAdminOrderStockSource(
  orderId: string,
  input: { source: 'inventory' | 'local' | 'none'; note?: string },
): Promise<Order> {
  const dto = await apiRequest<StoreOrderDto>(`/store-admin/orders/${orderId}/stock-source`, {
    method: 'POST',
    throwOnError: true,
    body: input,
  });
  return mapAdminOrder(dto);
}

/** Confirms the whole returned order was received: sellable back to stock, damaged recorded. */
export async function receiveAdminOrderReturn(
  orderId: string,
  input: {
    lines: Array<{ lineId: string; sellableQuantity: number; damagedQuantity: number }>;
    notes?: string;
  },
): Promise<Order> {
  const dto = await apiRequest<StoreOrderDto>(`/store-admin/orders/${orderId}/return-receipt`, {
    method: 'POST',
    throwOnError: true,
    body: input,
  });
  return mapAdminOrder(dto);
}

export function storeOrdersHttpEnabled(): boolean {
  return isStoreHttpEnabled();
}

/** One problem the order check found (Arabic message for the customer). */
export type StoreOrderCheckIssue = {
  code: string;
  message: string;
  productId: string | null;
  variantId: string | null;
};

export type StoreOrderCheckResult = {
  ok: boolean;
  /** The whole order was tried with its payment account. */
  complete: boolean;
  issues: StoreOrderCheckIssue[];
};

/**
 * Checks the cart before the customer pays, with the rules of placing it:
 * lines only (cart), with the address (stock and address), then with the
 * payment account. Nothing is written.
 */
export async function checkPublicStoreOrder(input: {
  companyId?: string | null;
  lines: Array<{ productId: string; variantId?: string | null; quantity: number }>;
  address?: PlaceOrderInput['address'] | null;
  paymentMethod?: PlaceOrderInput['paymentMethod'] | null;
  paymentAccountId?: string | null;
}): Promise<StoreOrderCheckResult> {
  const address = input.address;
  const result = await publicStoreRequest<StoreOrderCheckResult>('/public/store/orders/check', {
    method: 'POST',
    body: {
      companyId: resolveStorefrontCompanyId(input.companyId ?? undefined),
      items: input.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId ?? null,
        quantity: line.quantity,
      })),
      ...(address
        ? {
            address: {
              fullName: address.fullName,
              phone: address.phone,
              ...(address.countryId ? { countryId: address.countryId } : {}),
              ...(address.cityId ? { cityId: address.cityId } : {}),
              ...(address.districtId ? { districtId: address.districtId } : {}),
              city: address.city,
              district: address.district,
              street: address.street,
              notes: address.notes ?? null,
              lat: address.lat ?? null,
              lng: address.lng ?? null,
              mapAddress: address.mapAddress ?? null,
            },
          }
        : {}),
      ...(input.paymentMethod && input.paymentAccountId
        ? { paymentMethod: input.paymentMethod, paymentAccountId: input.paymentAccountId }
        : {}),
    },
  });
  return result ?? { ok: true, complete: false, issues: [] };
}
