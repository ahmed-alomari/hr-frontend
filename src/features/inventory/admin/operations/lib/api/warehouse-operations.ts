import { apiRequest, type PaginatedResult } from '@/features/hr/lib/api/client';
import type { ListGroupsResult } from '@/components/ui/list-group';
import { toNumber } from '@/features/inventory/lib/api/numbers';
import type {
  CreateWarehouseOperationInput,
  ReplenishmentSuggestion,
  UpdateWarehouseOperationInput,
  WarehouseOperation,
  WarehouseOperationLine,
  WarehouseOperationListQuery,
} from '@/features/inventory/domain/types/warehouse';
import type { AdminWarehouseOperationsPort } from '@/features/inventory/domain/ports/inventory.ports';

type OperationDto = Omit<
  WarehouseOperation,
  'lines' | 'lineCount' | 'totalDemandQuantity' | 'totalQuantity' | 'linesPartial'
> & {
  codeNumber?: number;
  isArchived?: boolean;
  archivedAt?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  /** Embedded by GET /inventory/warehouse-operations (list only) — avoids a follow-up lines fetch. */
  lines?: OperationLineDto[];
  lineCount?: number;
  totalDemandQuantity?: string | number;
  totalQuantity?: string | number;
  linesPartial?: boolean;
};

type OperationLineDto = Omit<WarehouseOperationLine, 'demandQuantity' | 'quantity'> & {
  operationId: string;
  companyId: string;
  demandQuantity: string | number;
  quantity: string | number;
  sortOrder?: number;
  isArchived?: boolean;
  archivedAt?: string | null;
};

function serialsForApi(raw?: string | string[] | null): string[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    const items = raw.map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }
  const text = raw.trim();
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      const items = parsed.map((item) => String(item).trim()).filter(Boolean);
      return items.length > 0 ? items : undefined;
    }
  } catch {
    /* comma or newline list */
  }
  const items = text
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function assertLinesLinkedToProduct(
  lines: CreateWarehouseOperationInput['lines'] | WarehouseOperation['lines'],
): void {
  const missing = lines.filter((line) => !line.productId?.trim());
  if (missing.length > 0) {
    throw new Error('كل بند في مستند المخزون يجب أن يرتبط بمنتج (productId).');
  }
}

function mapLine(dto: OperationLineDto): WarehouseOperationLine {
  return {
    id: dto.id,
    productName: dto.productName,
    sku: dto.sku ?? undefined,
    productId: dto.productId,
    variantId: dto.variantId ?? undefined,
    demandQuantity: toNumber(dto.demandQuantity),
    quantity: toNumber(dto.quantity),
    productUomLineId: dto.productUomLineId ?? undefined,
    uomEnteredQuantity:
      dto.uomEnteredQuantity != null ? toNumber(dto.uomEnteredQuantity) : undefined,
    fromLocationId: dto.fromLocationId ?? undefined,
    toLocationId: dto.toLocationId ?? undefined,
    notes: dto.notes ?? undefined,
    unitCost: dto.unitCost ?? undefined,
    costCurrency: dto.costCurrency ?? undefined,
    receivedQuantity: toNumber(dto.receivedQuantity ?? 0),
    purchaseOrderLineId: dto.purchaseOrderLineId ?? null,
    expiryDate: dto.expiryDate ?? null,
    serialNumbers:
      dto.serialNumbers == null
        ? null
        : typeof dto.serialNumbers === 'string'
          ? dto.serialNumbers
          : JSON.stringify(dto.serialNumbers),
  };
}

function mapOperation(dto: OperationDto, lines: WarehouseOperationLine[]): WarehouseOperation {
  const raw = String(dto.status ?? '').trim().toLowerCase();
  const status =
    raw === 'posted' || raw === 'done' || raw === 'validated'
      ? 'done'
      : (dto.status as WarehouseOperation['status']);
  return {
    id: dto.id,
    companyId: dto.companyId,
    warehouseId: dto.warehouseId,
    kind: dto.kind,
    reference: dto.reference,
    status,
    occurredAt: dto.occurredAt,
    notes: dto.notes ?? undefined,
    partnerId: dto.partnerId ?? undefined,
    partnerName: dto.partnerName ?? undefined,
    sourceDocument: dto.sourceDocument ?? undefined,
    destinationWarehouseId: dto.destinationWarehouseId ?? undefined,
    transferMode: dto.transferMode ?? 'direct',
    transitState: dto.transitState ?? null,
    lines,
    lineCount: dto.lineCount,
    totalDemandQuantity:
      dto.totalDemandQuantity != null ? toNumber(dto.totalDemandQuantity) : undefined,
    totalQuantity: dto.totalQuantity != null ? toNumber(dto.totalQuantity) : undefined,
    linesPartial: dto.linesPartial,
    receiptsClosedAt: dto.receiptsClosedAt ?? null,
    backorderOfId: dto.backorderOfId ?? null,
    origin: dto.origin ?? null,
    cancelReason: dto.cancelReason ?? null,
    receiptState: dto.receiptState ?? null,
    orderedQuantity: dto.orderedQuantity != null ? toNumber(dto.orderedQuantity) : null,
    receivedQuantity: dto.receivedQuantity != null ? toNumber(dto.receivedQuantity) : null,
    orderValue: dto.orderValue != null ? toNumber(dto.orderValue) : null,
    orderLineValues: dto.orderLineValues ?? null,
    fillsPurchaseOrder: dto.fillsPurchaseOrder === true,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    ...(dto.groupKey !== undefined ? { groupKey: dto.groupKey } : {}),
  };
}

function isLockedOperationStatus(status: string | null | undefined): boolean {
  const raw = String(status ?? '').trim().toLowerCase();
  return raw === 'done' || raw === 'posted' || raw === 'validated';
}

/** Who posted / reversed the document, recorded by the server. */
export type WarehouseOperationAudit = {
  postedAt: string | null;
  postedByName: string | null;
  reversedAt: string | null;
  reversedByName: string | null;
};

export async function fetchWarehouseOperationAudit(id: string): Promise<WarehouseOperationAudit> {
  const dto = await apiRequest<Partial<WarehouseOperationAudit>>(
    `/inventory/warehouse-operations/${id}`,
    { silent: true },
  );
  return {
    postedAt: dto?.postedAt ?? null,
    postedByName: dto?.postedByName ?? null,
    reversedAt: dto?.reversedAt ?? null,
    reversedByName: dto?.reversedByName ?? null,
  };
}

export type OpenProductReservation = {
  productId: string;
  operationReference: string;
};

async function fetchOpenProductReservations(input: {
  companyId: string;
  warehouseId: string;
  kind: WarehouseOperation['kind'];
}): Promise<OpenProductReservation[]> {
  const result = await apiRequest<{ items: OpenProductReservation[] }>(
    '/inventory/warehouse-operations/open-product-reservations',
    {
      query: {
        companyId: input.companyId,
        warehouseId: input.warehouseId,
        kind: input.kind,
      },
    },
  );
  return result.items ?? [];
}

async function fetchLinesByOperationId(
  operationId: string,
  companyId: string,
): Promise<WarehouseOperationLine[]> {
  const lines: WarehouseOperationLine[] = [];
  for (let page = 1; ; page += 1) {
    const result = await apiRequest<PaginatedResult<OperationLineDto>>(
      '/inventory/warehouse-operation-lines',
      {
        query: {
          companyId,
          operationId,
          page,
          limit: 500,
          archiveScope: 'active',
        },
      },
    );
    lines.push(...(result.items ?? []).map(mapLine));
    if (page >= (result.pagination?.totalPages ?? 1)) return lines;
  }
}

async function createLine(operationId: string, line: WarehouseOperationLine): Promise<WarehouseOperationLine> {
  const dto = await apiRequest<OperationLineDto>('/inventory/warehouse-operation-lines', {
    method: 'POST',
    body: {
      operationId,
      productId: line.productId,
      variantId: line.variantId ?? null,
      productName: line.productName,
      sku: line.sku ?? null,
      demandQuantity: line.demandQuantity ?? line.quantity,
      quantity: line.quantity,
      productUomLineId: line.productUomLineId ?? null,
      fromLocationId: line.fromLocationId ?? null,
      toLocationId: line.toLocationId ?? null,
      notes: line.notes ?? null,
      unitCost: line.unitCost ?? null,
      costCurrency: line.costCurrency ?? null,
      purchaseOrderLineId: line.purchaseOrderLineId ?? null,
      expiryDate: line.expiryDate || null,
      serialNumbers: serialsForApi(line.serialNumbers) ?? null,
    },
  });
  return mapLine(dto);
}

async function syncLines(
  operationId: string,
  companyId: string,
  nextLines: WarehouseOperationLine[],
): Promise<WarehouseOperationLine[]> {
  const existing = await fetchLinesByOperationId(operationId, companyId);
  const existingById = new Map(existing.map((line) => [line.id, line]));
  const keepIds = new Set(nextLines.map((line) => line.id).filter((id) => existingById.has(id)));

  for (const line of existing) {
    if (!keepIds.has(line.id)) {
      await apiRequest<void>(`/inventory/warehouse-operation-lines/${line.id}`, { method: 'DELETE' });
    }
  }

  const synced: WarehouseOperationLine[] = [];
  for (const line of nextLines) {
    const prev = existingById.get(line.id);
    if (prev) {
      if (isLineUnchanged(prev, line)) {
        synced.push(prev);
        continue;
      }
      const dto = await apiRequest<OperationLineDto>(
        `/inventory/warehouse-operation-lines/${line.id}`,
        {
          method: 'PATCH',
          body: {
            productId: line.productId,
            variantId: line.variantId ?? null,
            productName: line.productName,
            sku: line.sku ?? null,
            demandQuantity: line.demandQuantity ?? line.quantity,
            quantity: line.quantity,
            productUomLineId: line.productUomLineId ?? null,
            fromLocationId: line.fromLocationId ?? null,
            toLocationId: line.toLocationId ?? null,
            notes: line.notes ?? null,
            unitCost: line.unitCost ?? null,
            costCurrency: line.costCurrency ?? null,
            purchaseOrderLineId: line.purchaseOrderLineId ?? null,
            expiryDate: line.expiryDate || null,
            serialNumbers: serialsForApi(line.serialNumbers) ?? null,
          },
        },
      );
      synced.push(mapLine(dto));
    } else {
      synced.push(await createLine(operationId, line));
    }
  }
  return synced;
}

function isLineUnchanged(prev: WarehouseOperationLine, next: WarehouseOperationLine): boolean {
  return (
    prev.productId === next.productId &&
    (prev.variantId ?? null) === (next.variantId ?? null) &&
    prev.productName === next.productName &&
    (prev.sku ?? null) === (next.sku ?? null) &&
    Number(prev.demandQuantity ?? prev.quantity) === Number(next.demandQuantity ?? next.quantity) &&
    (prev.productUomLineId ?? null) === (next.productUomLineId ?? null) &&
    Number(prev.quantity) === Number(next.quantity) &&
    (prev.fromLocationId ?? null) === (next.fromLocationId ?? null) &&
    (prev.toLocationId ?? null) === (next.toLocationId ?? null) &&
    (prev.notes ?? null) === (next.notes ?? null) &&
    (prev.unitCost ?? null) === (next.unitCost ?? null) &&
    (prev.costCurrency ?? null) === (next.costCurrency ?? null) &&
    (prev.purchaseOrderLineId ?? null) === (next.purchaseOrderLineId ?? null) &&
    (prev.expiryDate ?? null) === (next.expiryDate ?? null) &&
    (prev.serialNumbers ?? null) === (next.serialNumbers ?? null)
  );
}

/** Document counts of the filtered operations, per `groupBy` group and overall. */
export function fetchWarehouseOperationGroups(query: WarehouseOperationListQuery): Promise<ListGroupsResult> {
  return apiRequest<ListGroupsResult>('/inventory/warehouse-operations/groups', {
    throwOnError: true,
    query: {
      companyId: query.companyId,
      warehouseId: query.warehouseId,
      kind: query.kind,
      status: query.status,
      partnerId: query.partnerId,
      purchaseOrderId: query.purchaseOrderId,
      receiptState: query.receiptState,
      origin: query.origin,
      occurredAtFrom: query.occurredAtFrom,
      occurredAtTo: query.occurredAtTo,
      search: query.search,
      archiveScope: 'active',
      groupBy: query.groupBy,
    },
  });
}

/** One line by id (e.g. the purchase-order line a receipt line fills). */
export async function fetchWarehouseOperationLine(
  companyId: string,
  id: string,
): Promise<(WarehouseOperationLine & { operationId: string }) | null> {
  const result = await apiRequest<PaginatedResult<OperationLineDto>>(
    '/inventory/warehouse-operation-lines',
    { query: { companyId, id, limit: 1 }, throwOnError: true, silent: true },
  );
  const dto = result.items?.[0];
  return dto ? { ...mapLine(dto), operationId: dto.operationId } : null;
}

async function purchaseOrderReceiptsAction(
  companyId: string,
  id: string,
  action: 'close-receipts' | 'reopen-receipts',
): Promise<WarehouseOperation> {
  const dto = await apiRequest<OperationDto>(
    `/inventory/warehouse-operations/${id}/${action}`,
    { method: 'POST', silent: true },
  );
  const lines = await fetchLinesByOperationId(id, companyId || dto.companyId);
  return mapOperation(dto, lines);
}

/** The rest of a purchase order will not arrive: further receipts are refused. */
export function closePurchaseOrderReceipts(companyId: string, id: string) {
  return purchaseOrderReceiptsAction(companyId, id, 'close-receipts');
}

/** The rest of a purchase order is expected again. */
export function reopenPurchaseOrderReceipts(companyId: string, id: string) {
  return purchaseOrderReceiptsAction(companyId, id, 'reopen-receipts');
}

/** New price of a confirmed order line: what is still to be received takes it. */
export async function changePurchaseOrderLinePrice(
  companyId: string,
  id: string,
  lineId: string,
  unitCost: number,
): Promise<WarehouseOperation> {
  const dto = await apiRequest<OperationDto>(
    `/inventory/warehouse-operations/${id}/lines/${lineId}/price`,
    { method: 'POST', body: { unitCost }, silent: true },
  );
  const lines = await fetchLinesByOperationId(id, companyId || dto.companyId);
  return mapOperation(dto, lines);
}

export async function fetchReplenishmentSuggestions(query: {
  companyId: string;
  warehouseId?: string;
  search?: string;
}): Promise<ReplenishmentSuggestion[]> {
  const result = await apiRequest<{ items: ReplenishmentSuggestion[] }>(
    '/inventory/warehouse-operations/replenishment-suggestions',
    {
      query: {
        companyId: query.companyId,
        warehouseId: query.warehouseId,
        search: query.search,
      },
      throwOnError: true,
    },
  );
  return (result.items ?? []).map((item) => ({
    ...item,
    onHand: toNumber(item.onHand),
    onOrder: toNumber(item.onOrder),
    threshold: toNumber(item.threshold),
    suggestedQuantity: toNumber(item.suggestedQuantity),
  }));
}

export async function receiveWarehouseTransfer(
  companyId: string,
  id: string,
): Promise<WarehouseOperation> {
  const dto = await apiRequest<OperationDto>(
    `/inventory/warehouse-operations/${id}/receive-transfer`,
    { method: 'POST' },
  );
  const lines = await fetchLinesByOperationId(id, companyId || dto.companyId);
  return mapOperation(dto, lines);
}

export const warehouseOperationsApi: AdminWarehouseOperationsPort & {
  getOpenProductReservations: typeof fetchOpenProductReservations;
} = {
  getOpenProductReservations: fetchOpenProductReservations,

  async getAll(query: WarehouseOperationListQuery) {
    if (!query.companyId?.trim()) {
      throw new Error('companyId مطلوب لقائمة عمليات المستودع.');
    }
    const linesMode =
      query.linesMode ?? (query.productId ? 'full' : 'preview');

    const fetchPage = (page: number) =>
      apiRequest<PaginatedResult<OperationDto>>('/inventory/warehouse-operations', {
        query: {
          companyId: query.companyId,
          warehouseId: query.warehouseId,
          kind: query.kind,
          status: query.status,
          partnerId: query.partnerId,
          purchaseOrderId: query.purchaseOrderId,
          receiptState: query.receiptState,
          origin: query.origin,
          occurredAtFrom: query.occurredAtFrom,
          occurredAtTo: query.occurredAtTo,
          search: query.search,
          linesMode,
          page,
          limit: query.limit ?? 200,
          archiveScope: 'active',
          sortBy: query.sortBy,
          sortDir: query.sortDir,
          groupBy: query.groupBy,
          groupValue: query.groupValue,
        },
      });

    const result = await fetchPage(query.all ? 1 : (query.page ?? 1));
    if (query.all) {
      // Reports aggregate over every document, not just the first page.
      const totalPages = result.pagination?.totalPages ?? 1;
      for (let page = 2; page <= totalPages; page += 1) {
        const next = await fetchPage(page);
        result.items = [...(result.items ?? []), ...(next.items ?? [])];
      }
    }

    // Lines are embedded per item by the backend (single batched query) —
    // no separate warehouse-operation-lines fetch needed for the list.
    let items = result.items ?? [];
    if (query.productId) {
      items = items.filter((item) =>
        (item.lines ?? []).some((line) => line.productId === query.productId),
      );
      return {
        items: items.map((item) => mapOperation(item, (item.lines ?? []).map(mapLine))),
        pagination: {
          ...result.pagination,
          total: items.length,
          totalPages: 1,
        },
      };
    }

    return {
      items: items.map((item) => mapOperation(item, (item.lines ?? []).map(mapLine))),
      pagination: result.pagination,
    };
  },

  async getById(companyId, id) {
    try {
      const dto = await apiRequest<OperationDto>(`/inventory/warehouse-operations/${id}`);
      if (!dto?.id) return null;
      const lines = await fetchLinesByOperationId(id, companyId || dto.companyId);
      return mapOperation(dto, lines);
    } catch {
      return null;
    }
  },

  async create(input: CreateWarehouseOperationInput) {
    assertLinesLinkedToProduct(input.lines);
    // Backend blocks line POST when status is done/cancelled — create as draft first,
    // then promote after lines exist (same pattern as the validate UI).
    const requestedStatus = input.status;
    const createStatus = requestedStatus === 'done' || requestedStatus === 'cancelled'
      ? 'draft'
      : requestedStatus;

    const dto = await apiRequest<OperationDto>('/inventory/warehouse-operations', {
      method: 'POST',
      body: {
        companyId: input.companyId,
        warehouseId: input.warehouseId,
        destinationWarehouseId: input.destinationWarehouseId ?? null,
        kind: input.kind,
        ...(input.kind === 'transfer'
          ? { transferMode: input.transferMode ?? 'direct' }
          : {}),
        status: createStatus,
        occurredAt: input.occurredAt,
        notes: input.notes ?? null,
        partnerId: input.partnerId ?? null,
        partnerName: input.partnerName ?? null,
        sourceDocument: input.sourceDocument ?? null,
        ...(input.origin ? { origin: input.origin } : {}),
      },
    });

    const lines: WarehouseOperationLine[] = [];
    for (const line of input.lines) {
      lines.push(
        await createLine(dto.id, {
          ...line,
          demandQuantity: line.demandQuantity ?? line.quantity,
        }),
      );
    }

    if (requestedStatus === 'done' || requestedStatus === 'cancelled') {
      const updated = await this.update(input.companyId, dto.id, {
        status: requestedStatus,
      });
      if (!updated) {
        throw new Error('تعذر تصديق مستند المخزون بعد إنشاء البنود.');
      }
      return updated;
    }

    return mapOperation(dto, lines);
  },

  async update(companyId, id, patch: UpdateWarehouseOperationInput) {
    if (patch.lines) {
      assertLinesLinkedToProduct(patch.lines);
    }

    // Read raw DTO first so a locked server status cannot be missed by mapping quirks.
    let rawDto: OperationDto;
    try {
      rawDto = await apiRequest<OperationDto>(`/inventory/warehouse-operations/${id}`);
    } catch {
      throw new Error('تعذر قراءة حالة العملية من الخادم.');
    }
    if (!rawDto?.id) {
      throw new Error('العملية غير موجودة.');
    }

    const locked = isLockedOperationStatus(rawDto.status);
    if (locked) {
      // Preferred undo path: done → ready (backend reverses ledger + quantityCache).
      if (patch.status === 'ready' && !patch.lines) {
        return warehouseOperationsApi.undo(companyId, id);
      }
      if (patch.status === 'cancelled') {
        throw new Error(
          'لا يمكن إلغاء عملية منتهية (done → cancelled). استخدم التراجع عن التصديق أولاً.',
        );
      }
      throw new Error(
        'لا يمكن تعديل عملية منتهية (done). للتراجع استخدم «تراجع عن التصديق» (POST …/undo).',
      );
    }

    const linesBefore = await fetchLinesByOperationId(id, companyId || rawDto.companyId);
    const before = mapOperation(rawDto, linesBefore);

    const headerPatch: Record<string, unknown> = {};
    if (patch.destinationWarehouseId !== undefined) {
      headerPatch.destinationWarehouseId = patch.destinationWarehouseId ?? null;
    }
    if (patch.kind !== undefined) headerPatch.kind = patch.kind;
    if (patch.status !== undefined) headerPatch.status = patch.status;
    if (patch.occurredAt !== undefined) headerPatch.occurredAt = patch.occurredAt;
    if (patch.notes !== undefined) headerPatch.notes = patch.notes ?? null;
    if (patch.partnerId !== undefined) headerPatch.partnerId = patch.partnerId ?? null;
    if (patch.partnerName !== undefined) headerPatch.partnerName = patch.partnerName ?? null;
    if (patch.sourceDocument !== undefined) {
      headerPatch.sourceDocument = patch.sourceDocument ?? null;
    }
    if (patch.receiptRemainder !== undefined) {
      headerPatch.receiptRemainder = patch.receiptRemainder;
    }
    if (patch.cancelReason !== undefined) {
      headerPatch.cancelReason = patch.cancelReason ?? '';
    }

    // Sync lines BEFORE locking the operation (`done` / `cancelled`). Backend rejects
    // line PATCH once status is done — that was causing false "done" + 400 on validate.
    const linesEditable = before.status === 'draft' || before.status === 'ready';
    let lines = before.lines;
    if (patch.lines) {
      if (!linesEditable) {
        throw new Error(
          `لا يمكن تعديل بنود عملية بحالة "${before.status}". احفظ البنود قبل التصديق.`,
        );
      }
      lines = await syncLines(id, companyId || rawDto.companyId, patch.lines);
    }

    let dto: OperationDto = rawDto;
    if (Object.keys(headerPatch).length > 0) {
      dto = await apiRequest<OperationDto>(`/inventory/warehouse-operations/${id}`, {
        method: 'PATCH',
        body: headerPatch,
      });
    }

    const normalized = mapOperation(dto, lines);

    return normalized;
  },

  async undo(companyId, id) {
    const dto = await apiRequest<OperationDto>(`/inventory/warehouse-operations/${id}/undo`, {
      method: 'POST',
    });
    const lines = await fetchLinesByOperationId(id, companyId || dto.companyId);
    // Backend writes reverse ledger rows and refreshes quantityCache; do not reverse again client-side.
    return mapOperation(dto, lines);
  },

  async remove(_companyId, id) {
    await apiRequest<void>(`/inventory/warehouse-operations/${id}`, { method: 'DELETE' });
    return true;
  },
};
