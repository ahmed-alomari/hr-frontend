'use client';

import * as React from 'react';
import { ArrowDown, Check, ChevronDown, Plus, Printer, ScanBarcode, Trash2, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { useInventoryCompanySettings } from '@/features/inventory/admin/notifications/hooks/use-inventory-settings';
import { PartnerSinglePicker } from '@/features/contacts/admin/partners/components/partner-single-picker';
import { useWarehouseLocations } from '@/features/inventory/admin/locations/hooks/use-warehouse-locations';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { useWarehouseOperationMutations } from '@/features/inventory/admin/operations/hooks/use-warehouse-operation-mutations';
import { useOpenOperationProductReservations } from '@/features/inventory/admin/operations/hooks/use-open-operation-product-reservations';
import {
  changePurchaseOrderLinePrice,
  closePurchaseOrderReceipts,
  fetchWarehouseOperationAudit,
  fetchWarehouseOperationLine,
  receiveWarehouseTransfer,
  reopenPurchaseOrderReceipts,
  warehouseOperationsApi,
} from '@/features/inventory/admin/operations/lib/api/warehouse-operations';
import { useCan } from '@/features/auth/hooks/use-can';
import { warehouseOperationsQueryKeys } from '@/features/inventory/admin/hooks/query-keys';
import { operationNeedsFullLinesFetch } from '@/features/inventory/admin/operations/lib/operation-list-line-totals';
import {
  fromDateTimeLocalInput,
  toDateTimeLocalInput,
} from '@/features/inventory/admin/operations/lib/datetime-local';
import { inventoryStockService } from '@/features/inventory/services/inventory-stock.service';
import {
  collectStockShortages,
  formatStockShortageMessage,
  maxQuantityForLine,
  readAvailableAtSourceLine,
} from '@/features/inventory/admin/operations/lib/validate-operation-stock';
import { WAREHOUSE_OPERATION_KIND_META } from '@/features/inventory/domain/constants/warehouse-operation-kinds';
import {
  PURCHASE_ORDER_RECEIPT_STATE_BADGE,
  PURCHASE_ORDER_RECEIPT_STATE_LABELS_AR,
  WAREHOUSE_OPERATION_FLOW_STEPS,
  WAREHOUSE_OPERATION_KIND_LABELS_AR,
  WAREHOUSE_OPERATION_STATUS_LABELS_AR,
} from '@/features/inventory/domain/constants/warehouse-operation-status';
import type {
  UpdateWarehouseOperationInput,
  WarehouseOperation,
  WarehouseOperationLine,
  WarehouseOperationListQuery,
  WarehouseOperationStatus,
} from '@/features/inventory/domain/types/warehouse';
import { Button } from '@/components/ui/button';
import { PrintDocumentDialog } from '@/features/print-templates/components/print-document-dialog';
import { toPrintCompany } from '@/features/print-templates/lib/print-company';
import { useActiveCompany } from '@/features/hr/organization/hooks/useActiveCompany';
import {
  buildOperationPrintDocument,
  operationPrintDocumentType,
} from '@/features/inventory/admin/operations/lib/operation-print-document';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileFullScreenClass,
  dialogShellBodyClass,
  dialogShellContentClass,
  dialogShellHeaderClass,
} from '@/components/ui/dialog';
import { ProductSinglePicker } from '@/features/catalog/products/components/product-single-picker';
import { FlexibleQuantityInput } from '@/features/inventory/admin/operations/components/flexible-quantity-input';
import {
  LocationChip,
  WarehouseChip,
} from '@/features/inventory/admin/operations/components/inventory-chips';
import {
  emptyOperationLineDraft,
  hasDuplicateOperationLineProducts,
  lineCapturesLot,
  lineNeedsUnitCost,
  newOperationLineDraftId,
  operationLinesToDrafts,
  serialsToText,
  supportsMultiProductLines,
  pickerUsesSourceLocationStock,
} from '@/features/inventory/admin/operations/lib/operation-line-draft';
import { OperationLineVariantSelect } from '@/features/inventory/admin/operations/components/operation-line-variant-select';
import type { ProductVariant } from '@/features/ecommerce/domain/types/product';
import { OperationUnitCostInput } from '@/features/inventory/admin/operations/components/operation-unit-cost-input';
import { fetchActiveProductVariants } from '@/features/inventory/admin/operations/lib/fetch-active-product-variants';
import { formatVariantCompactLabel } from '@/features/inventory/admin/operations/lib/variant-display-label';
import { OPERATION_FORM_TAB_TRIGGER } from '@/features/inventory/admin/operations/components/operation-form-ui';
import {
  filterOperationFromLocations,
  filterOperationToLocations,
} from '@/features/inventory/admin/operations/lib/operation-location-filters';
import { operationPartnerLabel } from '@/features/inventory/admin/operations/lib/operation-partner-label';
import { BarcodeScannerDialog } from '@/components/shared/barcode-scanner-dialog';
import { resolveScannedCode } from '@/features/catalog/products/lib/resolve-scanned-code';
import { companyCurrencyCode } from '@/features/auth/lib/company-currency';
import { currencySymbolAr } from '@/shared/currencies';
import { cn, formatDateTime } from '@/shared/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: WarehouseOperation | null;
};

function formatLineQuantity(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
}

function lineUnitCostNumber(unitCost?: string): number | null {
  const raw = unitCost?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function formatLineMoney(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(decimals)} ${currencySymbolAr(companyCurrencyCode())}`;
}

function OperationLineVariantReadout({
  companyId,
  productId,
  productName,
  variantId,
}: {
  companyId: string;
  productId: string;
  productName: string;
  variantId?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'operation-line-variant-label', companyId, productId],
    queryFn: async () => {
      try {
        return await fetchActiveProductVariants(companyId, productId);
      } catch {
        return [];
      }
    },
    enabled: Boolean(companyId && productId && variantId),
    staleTime: 5 * 60_000,
  });

  if (!productId) return <span className="text-muted-foreground">—</span>;
  if (!variantId) return <span>المنتج الأساسي</span>;
  if (isLoading) return <span className="text-muted-foreground">…</span>;

  const variant = data?.find((row) => row.id === variantId);
  const label = variant ? formatVariantCompactLabel(variant, productName) : '';
  return <span>{label || 'متغير'}</span>;
}

function statusBadgeVariant(
  status: WarehouseOperationStatus,
): 'subtle' | 'warning' | 'success' | 'destructive' {
  if (status === 'ready') return 'warning';
  if (status === 'done') return 'success';
  if (status === 'cancelled') return 'destructive';
  return 'subtle';
}

function OperationStatusStepper({ status }: { status: WarehouseOperationStatus }) {
  const cancelled = status === 'cancelled';
  const currentIndex = cancelled ? -1 : WAREHOUSE_OPERATION_FLOW_STEPS.indexOf(status);

  return (
    <div className="flex flex-wrap items-center gap-1" role="list" aria-label="مراحل المستند">
      {WAREHOUSE_OPERATION_FLOW_STEPS.map((step, index) => {
        const active = !cancelled && index === currentIndex;
        const passed = !cancelled && index < currentIndex;
        return (
          <div
            key={step}
            role="listitem"
            className={cn(
              'inv-stepper-item relative flex items-center justify-center px-4 py-2 text-xs font-semibold',
              index === 0 ? 'rounded-s-md' : '',
              index === WAREHOUSE_OPERATION_FLOW_STEPS.length - 1 ? 'rounded-e-md' : '',
              active
                ? 'bg-primary text-primary-foreground'
                : passed
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {WAREHOUSE_OPERATION_STATUS_LABELS_AR[step]}
            {index < WAREHOUSE_OPERATION_FLOW_STEPS.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  'absolute -end-1.5 top-1/2 z-10 h-3 w-3 -translate-y-1/2 rotate-45 border-e border-t',
                  active
                    ? 'border-primary bg-primary'
                    : passed
                      ? 'border-primary/30 bg-primary/15'
                      : 'border-border bg-muted',
                )}
              />
            ) : null}
          </div>
        );
      })}
      {cancelled ? (
        <Badge variant="destructive" className="ms-2">
          ملغى
        </Badge>
      ) : null}
    </div>
  );
}

export function WarehouseOperationDetailDialog({ open, onOpenChange, operation }: Props) {
  const companyId = getInventoryCompanyId();
  const { data: inventorySettings } = useInventoryCompanySettings({ enabled: open });
  const costDisplayDecimals = inventorySettings?.costDisplayDecimals ?? 2;
  const kind = operation?.kind ?? 'receipt';
  const { update, undo } = useWarehouseOperationMutations(operation?.warehouseId ?? '', kind);
  const destinationWarehouseId = operation?.destinationWarehouseId ?? '';

  const { data: locationsData } = useWarehouseLocations(
    {
      companyId,
      warehouseId: operation?.warehouseId,
      page: 1,
      limit: 200,
    },
    { enabled: open && Boolean(companyId && operation?.warehouseId) },
  );
  // Transfers land in another warehouse, so its locations are needed both for the
  // receiving picker and to name the destination instead of printing a raw id.
  const { data: destLocationsData } = useWarehouseLocations(
    {
      companyId,
      warehouseId: destinationWarehouseId || undefined,
      page: 1,
      limit: 200,
    },
    { enabled: open && Boolean(destinationWarehouseId) },
  );
  const { data: warehousesData } = useWarehouses(
    { companyId, limit: 100 },
    { enabled: open && Boolean(companyId) },
  );

  const { data: openProductReservations } = useOpenOperationProductReservations({
    companyId,
    warehouseId: operation?.warehouseId ?? '',
    kind: operation?.kind ?? kind,
    enabled:
      open &&
      Boolean(companyId && operation?.warehouseId && operation?.kind) &&
      supportsMultiProductLines(operation?.kind ?? kind),
  });

  const reservedProductIdsOtherDocs = React.useMemo(() => {
    const ref = operation?.reference ?? '';
    if (!ref) return [];
    return (openProductReservations ?? [])
      .filter((row) => row.operationReference !== ref)
      .map((row) => row.productId);
  }, [openProductReservations, operation?.reference]);

  const needsFullLines = open && operationNeedsFullLinesFetch(operation);
  const { data: fullOperation } = useQuery({
    queryKey: warehouseOperationsQueryKeys.detail(companyId, operation?.id ?? ''),
    queryFn: () => warehouseOperationsApi.getById(companyId, operation!.id),
    enabled: Boolean(companyId && operation?.id && needsFullLines),
  });
  const documentOperation = fullOperation ?? operation;
  const warehouseName = React.useMemo(() => {
    const map = new Map((warehousesData?.items ?? []).map((item) => [item.id, item.nameAr]));
    return (id?: string) => (id ? (map.get(id) ?? null) : null);
  }, [warehousesData?.items]);
  const locations = React.useMemo(
    () => (locationsData?.items ?? []).filter((item) => item.isActive),
    [locationsData?.items],
  );
  const destinationLocations = React.useMemo(
    () =>
      destinationWarehouseId
        ? (destLocationsData?.items ?? []).filter((item) => item.isActive)
        : locations,
    [destinationWarehouseId, destLocationsData?.items, locations],
  );
  const locationName = React.useMemo(() => {
    const map = new Map(
      [...locations, ...destinationLocations].map((item) => [item.id, item.nameAr || item.code]),
    );
    return (id?: string) => (id ? (map.get(id) ?? id) : '—');
  }, [locations, destinationLocations]);

  const formatLocationOption = React.useCallback(
    (id: string) => {
      const loc =
        locations.find((item) => item.id === id) ??
        destinationLocations.find((item) => item.id === id);
      if (!loc) return id;
      return `${loc.nameAr || loc.code} · ${loc.code}`;
    },
    [locations, destinationLocations],
  );

  const [headerFromLocationId, setHeaderFromLocationId] = React.useState('');
  const [headerToLocationId, setHeaderToLocationId] = React.useState('');

  const fromLocationOptions = React.useMemo(
    () =>
      filterOperationFromLocations(
        kind,
        locations,
        headerToLocationId || undefined,
        headerFromLocationId || undefined,
      ),
    [kind, locations, headerToLocationId, headerFromLocationId],
  );
  const toLocationOptions = React.useMemo(
    () =>
      filterOperationToLocations(
        kind,
        destinationLocations,
        headerFromLocationId || undefined,
        headerToLocationId || undefined,
      ),
    [kind, destinationLocations, headerFromLocationId, headerToLocationId],
  );

  const [lines, setLines] = React.useState<WarehouseOperationLine[]>([]);
  const [notes, setNotes] = React.useState('');
  // Printed with the company template for its document type.
  const [printOpen, setPrintOpen] = React.useState(false);
  const { data: activeCompany } = useActiveCompany();
  const [partnerId, setPartnerId] = React.useState('');
  const [partnerName, setPartnerName] = React.useState('');
  const [sourceDocument, setSourceDocument] = React.useState('');
  const [occurredAt, setOccurredAt] = React.useState('');
  const can = useCan();
  const canPost = can('inv.warehouse.operations.post');
  const canReadCost = can('inv.warehouse.costs.read');
  const queryClient = useQueryClient();
  const [arrivalPending, setArrivalPending] = React.useState(false);
  const [status, setStatus] = React.useState<WarehouseOperationStatus>('draft');
  const { data: audit } = useQuery({
    queryKey: [...warehouseOperationsQueryKeys.detail(companyId, operation?.id ?? ''), 'audit', status],
    queryFn: () => fetchWarehouseOperationAudit(operation!.id),
    enabled: open && Boolean(companyId && operation?.id),
  });
  /**
   * A posted purchase order: its received quantities change as its receipts
   * are posted, so they are read fresh, and its receipts (drafts included)
   * are listed so a second click opens the open receipt instead of a copy.
   */
  const isPostedPurchaseOrder = kind === 'purchase_order' && status === 'done';
  const { data: purchaseOrderFresh } = useQuery({
    queryKey: [...warehouseOperationsQueryKeys.detail(companyId, operation?.id ?? ''), 'po-progress'],
    queryFn: () => warehouseOperationsApi.getById(companyId, operation!.id),
    enabled: open && isPostedPurchaseOrder && Boolean(companyId && operation?.id),
  });
  const linkedReceiptsQuery: WarehouseOperationListQuery = {
    companyId,
    kind: 'receipt',
    purchaseOrderId: operation?.id,
    linesMode: 'preview',
    limit: 50,
    sortBy: 'occurredAt',
    sortDir: 'desc',
  };
  const { data: linkedReceiptsData, isLoading: linkedReceiptsLoading } = useQuery({
    queryKey: warehouseOperationsQueryKeys.list(linkedReceiptsQuery),
    queryFn: () => warehouseOperationsApi.getAll(linkedReceiptsQuery),
    enabled: open && isPostedPurchaseOrder && Boolean(companyId && operation?.id),
  });
  const linkedReceipts = linkedReceiptsData?.items ?? [];
  const openLinkedReceipt = linkedReceipts.find(
    (row) => row.status === 'draft' || row.status === 'ready',
  );
  const [linkedOperation, setLinkedOperation] = React.useState<WarehouseOperation | null>(null);
  /** A confirmed order line's new price, being entered. */
  const [priceEdit, setPriceEdit] = React.useState<{ lineId: string; productName: string; value: string } | null>(null);
  const [pricePending, setPricePending] = React.useState(false);
  const [closurePending, setClosurePending] = React.useState(false);
  /** A receipt posting less than its orders' remainder: a backorder for the rest, or close it. */
  const [partialPrompt, setPartialPrompt] = React.useState<{
    orderIds: string[];
    received: number;
    remaining: number;
  } | null>(null);
  const poReceiptsClosed = Boolean(
    purchaseOrderFresh ? purchaseOrderFresh.receiptsClosedAt : operation?.receiptsClosedAt,
  );
  const poReceiptState = isPostedPurchaseOrder
    ? ((purchaseOrderFresh ?? operation)?.receiptState ?? null)
    : null;
  const [tab, setTab] = React.useState('operations');
  /** Phones: the document fields fold away so the lines come first (open for a draft). */
  const [phoneDetailsOpen, setPhoneDetailsOpen] = React.useState(false);
  const [scanOpen, setScanOpen] = React.useState(false);
  const [scanStatus, setScanStatus] = React.useState<string | null>(null);
  const [availableByLineId, setAvailableByLineId] = React.useState<Record<string, number>>({});
  const loadedOperationIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!open || !documentOperation) return;
    if (needsFullLines && !fullOperation) return;
    const switched = loadedOperationIdRef.current !== documentOperation.id;
    loadedOperationIdRef.current = documentOperation.id;

    setLines(
      documentOperation.lines.map((line) => ({
        ...line,
        demandQuantity: line.demandQuantity ?? line.quantity,
        quantity: line.quantity,
      })),
    );
    setNotes(documentOperation.notes ?? '');
    setPartnerId(documentOperation.partnerId ?? '');
    setPartnerName(documentOperation.partnerName ?? '');
    setSourceDocument(documentOperation.sourceDocument ?? '');
    setOccurredAt(toDateTimeLocalInput(documentOperation.occurredAt));
    // Avoid flicker from stale list props:
    // - after validate: local done must not regress to ready
    // - after undo: local ready must not jump back to done
    setStatus((prev) => {
      if (switched) return documentOperation.status;
      const incoming = documentOperation.status;
      if (incoming === 'cancelled' || prev === 'cancelled') return incoming;
      if (prev === 'done' && (incoming === 'ready' || incoming === 'draft')) return prev;
      if (prev === 'ready' && incoming === 'done') return prev;
      return incoming;
    });
    setTab('operations');
    if (switched) setPhoneDetailsOpen(documentOperation.status === 'draft');
    const first = documentOperation.lines[0];
    setHeaderFromLocationId(first?.fromLocationId ?? '');
    setHeaderToLocationId(first?.toLocationId ?? '');
  }, [open, documentOperation, needsFullLines, fullOperation]);

  React.useEffect(() => {
    if (!open) loadedOperationIdRef.current = null;
  }, [open]);

  const stockEffect = WAREHOUSE_OPERATION_KIND_META[kind].stockEffect;
  const checksSourceStock =
    stockEffect === 'outbound' || stockEffect === 'move' || stockEffect === 'transfer';

  React.useEffect(() => {
    if (!open || !documentOperation || !companyId || !checksSourceStock) {
      setAvailableByLineId({});
      return;
    }

    let cancelled = false;
    void (async () => {
      const next: Record<string, number> = {};
      await Promise.all(
        lines.map(async (line) => {
          const available = await readAvailableAtSourceLine({
            companyId,
            kind,
            line,
            fromLocationId: headerFromLocationId || undefined,
          });
          if (available != null) next[line.id] = available;
        }),
      );
      if (!cancelled) setAvailableByLineId(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, documentOperation, companyId, kind, lines, headerFromLocationId, checksSourceStock]);

  function applyLineQuantity(
    lineId: string,
    field: 'demandQuantity' | 'quantity',
    nextValue: number,
  ) {
    const value = Math.max(0, nextValue);
    setLines((prev) =>
      prev.map((item) => {
        if (item.id !== lineId) return item;
        if (field === 'demandQuantity') {
          return {
            ...item,
            demandQuantity: value,
            quantity: status === 'draft' ? value : item.quantity,
          };
        }
        return { ...item, quantity: value };
      }),
    );
  }

  function applyLineUnitCost(lineId: string, nextValue: string) {
    setLines((prev) =>
      prev.map((item) => (item.id === lineId ? { ...item, unitCost: nextValue } : item)),
    );
  }

  async function assertStockBeforeSave(nextLines: WarehouseOperationLine[] = lines): Promise<boolean> {
    if (!documentOperation || !checksSourceStock) return true;
    const issues = await collectStockShortages({
      companyId: documentOperation.companyId,
      warehouseId: documentOperation.warehouseId,
      kind,
      destinationWarehouseId: documentOperation.destinationWarehouseId,
      lines: nextLines,
    });
    if (issues.length === 0) return true;
    toast.error(formatStockShortageMessage(issues[0]!));
    return false;
  }

  function normalizeMultiProductLines(options?: {
    allowEmpty?: boolean;
  }): WarehouseOperationLine[] | null {
    if (hasDuplicateOperationLineProducts(operationLinesToDrafts(lines))) {
      toast.error('لا يمكن تكرار نفس المنتج/المتغير في أكثر من سطر.');
      return null;
    }
    const hasIncomplete = lines.some(
      (line) => !line.productId?.trim() && ((line.demandQuantity ?? 0) > 0 || line.quantity > 0),
    );
    if (hasIncomplete) {
      toast.error('اختر منتجًا لكل سطر يحتوي على كمية.');
      return null;
    }
    const normalized = lines
      .filter(
        (line) => line.productId?.trim() && ((line.demandQuantity ?? 0) > 0 || line.quantity > 0),
      )
      .map((line) => ({
        ...line,
        productId: line.productId.trim(),
        fromLocationId: headerFromLocationId || line.fromLocationId,
        toLocationId: headerToLocationId || line.toLocationId,
      }));
    if (normalized.length === 0 && !options?.allowEmpty) {
      toast.error('أضف صنفًا واحدًا على الأقل مع كمية أكبر من صفر.');
      return null;
    }
    return normalized;
  }

  function addProductLine() {
    setLines((prev) => [
      ...prev,
      {
        id: newOperationLineDraftId(),
        productId: '',
        productName: '',
        sku: undefined,
        demandQuantity: 0,
        quantity: 0,
        fromLocationId: headerFromLocationId || undefined,
        toLocationId: headerToLocationId || undefined,
        unitCost: undefined,
      },
    ]);
  }

  function removeProductLine(lineId: string) {
    setLines((prev) => {
      const next = prev.filter((line) => line.id !== lineId);
      if (next.length > 0) return next;
      const blank = emptyOperationLineDraft();
      return [
        {
          id: blank.id,
          productId: '',
          productName: '',
          sku: undefined,
          demandQuantity: 0,
          quantity: 0,
          fromLocationId: headerFromLocationId || undefined,
          toLocationId: headerToLocationId || undefined,
        },
      ];
    });
  }

  function applyLineProduct(
    lineId: string,
    product: { id: string; nameAr: string; sku?: string } | null,
  ) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        if (!product) {
          return {
            ...line,
            productId: '',
            productName: '',
            variantId: undefined,
            sku: undefined,
            demandQuantity: 0,
            quantity: 0,
          };
        }
        return {
          ...line,
          productId: product.id,
          productName: product.nameAr,
          variantId: undefined,
          sku: product.sku,
        };
      }),
    );
  }

  function applyLineVariant(
    lineId: string,
    variantId: string | undefined,
    variant?: ProductVariant,
  ) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        if (!variantId || !variant) {
          return { ...line, variantId: undefined };
        }
        return {
          ...line,
          variantId: variant.id,
          sku: variant.sku || line.sku,
        };
      }),
    );
  }

  /**
   * A scanned code: the line of that product/variant gets one more; a new
   * one is added in a draft (filling an empty line first). In a ready document
   * lines are fixed, so a scan only counts an item already listed.
   */
  async function addScannedCode(code: string) {
    if (!companyId) return;
    let item;
    try {
      item = await resolveScannedCode(companyId, code);
    } catch {
      setScanStatus(null);
      return;
    }
    if (!item) {
      toast.error(`لا يوجد منتج بالرمز ${code}`);
      setScanStatus(`لا يوجد منتج بالرمز ${code}`);
      return;
    }
    const label = item.variantName ? `${item.productName} — ${item.variantName}` : item.productName;
    const countLike = kind === 'physical_count' || kind === 'adjustment';
    const hit = lines.find(
      (l) => l.productId === item.productId && (l.variantId ?? '') === (item.variantId ?? ''),
    );
    if (hit) {
      setLines((prev) =>
        prev.map((l) => {
          if (l.id !== hit.id) return l;
          const quantity = l.quantity + 1;
          // A draft's ordered quantity follows (as typing it does); a count keeps its theoretical one.
          return status === 'draft' && !countLike
            ? { ...l, quantity, demandQuantity: (l.demandQuantity ?? l.quantity) + 1 }
            : { ...l, quantity };
        }),
      );
      setScanStatus(`+1 ${label} (${hit.quantity + 1})`);
      return;
    }
    // Lines are fixed once ready, and a one-product document (count, scrap) never gets another.
    if (status !== 'draft' || !supportsMultiProductLines(kind)) {
      toast.error(`«${label}» ليس في هذا المستند`);
      setScanStatus(`«${label}» ليس في هذا المستند`);
      return;
    }
    setLines((prev) => {
      const line: WarehouseOperationLine = {
        id: newOperationLineDraftId(),
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        variantId: item.variantId,
        demandQuantity: countLike ? 0 : 1,
        quantity: 1,
        fromLocationId: headerFromLocationId || undefined,
        toLocationId: headerToLocationId || undefined,
        unitCost: undefined,
      };
      const blank = prev.findIndex((l) => !l.productId);
      if (blank < 0) return [...prev, line];
      const next = [...prev];
      next[blank] = { ...line, id: prev[blank]!.id };
      return next;
    });
    setScanStatus(`أُضيف: ${label}`);
  }

  if (!documentOperation) return null;

  const editable = status === 'draft' || status === 'ready';
  const qtyEditable = status === 'draft' || status === 'ready';
  const multiProductMode = supportsMultiProductLines(kind);
  const canEditProducts = editable && status === 'draft' && multiProductMode;
  const isCountLike = kind === 'physical_count' || kind === 'adjustment';
  const showDemandColumn = !isCountLike;
  const showCostColumns = lineNeedsUnitCost(kind) && canReadCost;
  const showSystemQty =
    kind === 'adjustment' || (kind === 'physical_count' && status === 'done');
  const capturesLot = lineCapturesLot(kind);
  const lineColumnCount =
    5 + (showDemandColumn ? 1 : 0) + (showCostColumns ? 2 : 0) + (canEditProducts ? 1 : 0);
  const pricedLines = lines.filter((line) => line.productId?.trim());
  const demandTotal = pricedLines.reduce(
    (sum, line) => sum + (line.demandQuantity ?? line.quantity),
    0,
  );
  const executedTotal = pricedLines.reduce((sum, line) => sum + line.quantity, 0);
  const moneyTotal = pricedLines.reduce((sum, line) => {
    const unitCost = lineUnitCostNumber(line.unitCost);
    return unitCost == null ? sum : sum + unitCost * line.quantity;
  }, 0);
  const isSaving = update.isPending || undo.isPending;
  const meta = WAREHOUSE_OPERATION_KIND_META[kind];
  const needsFrom = meta.needsFrom;
  const needsTo = meta.needsTo;

  const destinationLabel = (() => {
    if (meta.stockEffect === 'inbound') return 'موقع الاستلام';
    if (meta.stockEffect === 'adjust_set') return 'موقع المخزون';
    if (meta.stockEffect === 'outbound') return 'موقع الصرف';
    if (meta.stockEffect === 'transfer') return 'مسار الحركة بين المستودعات';
    if (meta.stockEffect === 'move') return 'مسار الحركة بين المواقع';
    return 'المواقع';
  })();

  // Each side of the route names its warehouse, so a same-named location on both
  // ends (WH/Stock → WH/Stock) still reads unambiguously.
  const crossWarehouse = Boolean(
    destinationWarehouseId && destinationWarehouseId !== documentOperation.warehouseId,
  );
  const sourceWarehouseName = warehouseName(documentOperation.warehouseId);
  const targetWarehouseName = crossWarehouse
    ? warehouseName(destinationWarehouseId)
    : sourceWarehouseName;
  const fromFieldLabel =
    kind === 'issue'
      ? 'موقع المخزون (من)'
      : meta.stockEffect === 'move'
        ? 'الموقع الحالي'
        : 'موقع الصرف';
  const toFieldLabel =
    kind === 'issue'
      ? 'موقع العميل (إلى)'
      : meta.stockEffect === 'move'
        ? 'الموقع الجديد'
        : meta.stockEffect === 'adjust_set'
          ? 'موقع المخزون'
          : 'موقع الاستلام';

  const destinationLine = lines[0] ?? documentOperation.lines[0];

  async function savePatch(
    patch: UpdateWarehouseOperationInput,
    successMessage: string,
    options?: { includeLines?: boolean },
  ): Promise<boolean> {
    if (!companyId || !documentOperation) return false;
    const includeLines = options?.includeLines === true || patch.lines !== undefined;

    // Backend locks fully validated ops — use undoValidation for done → ready.
    if (status === 'done' || documentOperation?.status === 'done') {
      toast.error('لا يمكن تعديل مستند منتهٍ. استخدم «تراجع عن التصديق» أولاً.');
      return false;
    }

    try {
      const updated = await update.mutateAsync({
        companyId,
        id: documentOperation.id,
        patch: {
          ...patch,
          ...(includeLines ? { lines: patch.lines ?? lines } : {}),
          notes: notes.trim() || undefined,
          partnerId: partnerId.trim() || null,
          partnerName: partnerName.trim() || undefined,
          sourceDocument: sourceDocument.trim() || undefined,
          occurredAt: fromDateTimeLocalInput(occurredAt) ?? documentOperation.occurredAt,
        },
      });
      if (!updated) {
        toast.error('تعذر تحديث المستند.');
        return false;
      }
      setStatus(updated.status);
      setLines(updated.lines.map((line) => ({ ...line })));
      setHeaderFromLocationId(updated.lines[0]?.fromLocationId ?? '');
      setHeaderToLocationId(updated.lines[0]?.toLocationId ?? '');
      toast.success(successMessage);
      return true;
    } catch {
      // ApiError already toasted in useWarehouseOperationMutations.onError
      return false;
    }
  }

  async function markReady() {
    if (multiProductMode) {
      const normalized = normalizeMultiProductLines();
      if (!normalized) return;
      if (!(await assertStockBeforeSave(normalized))) return;
      await savePatch({ status: 'ready', lines: normalized }, 'تم تحديد المستند كجاهز');
      return;
    }
    if (!(await assertStockBeforeSave())) return;
    // Header only — avoid rewriting lines on every status change.
    await savePatch({ status: 'ready' }, 'تم تحديد المستند كجاهز');
  }

  /** References of the warehouse's other live opening documents. */
  async function otherOpeningReferences(): Promise<string[]> {
    if (!companyId || !documentOperation) return [];
    try {
      const result = await warehouseOperationsApi.getAll({
        companyId,
        warehouseId: documentOperation.warehouseId,
        kind: 'opening',
        limit: 100,
      });
      return result.items
        .filter((op) => op.id !== documentOperation.id && op.status !== 'cancelled')
        .map((op) => op.reference);
    } catch {
      return [];
    }
  }

  /**
   * A receipt filling purchase-order lines with less than their remainder:
   * what it leaves on the orders. Read fresh, since other receipts may have
   * been posted since this one was opened.
   */
  async function purchaseOrderShortfall(
    linesToPost: WarehouseOperationLine[],
  ): Promise<{ orderIds: string[]; received: number; remaining: number } | null> {
    const linked = linesToPost.filter((line) => line.purchaseOrderLineId);
    if (kind !== 'receipt' || linked.length === 0) return null;
    const orderLines = await Promise.all(
      linked.map((line) => fetchWarehouseOperationLine(companyId, line.purchaseOrderLineId!)),
    );
    const orderIds = new Set<string>();
    let received = 0;
    let remaining = 0;
    linked.forEach((line, index) => {
      const orderLine = orderLines[index];
      if (!orderLine) return;
      const left = Math.max(0, orderedQty(orderLine) - (orderLine.receivedQuantity ?? 0));
      received += line.quantity;
      remaining += left;
      if (line.quantity < left - 1e-6) orderIds.add(orderLine.operationId);
    });
    return orderIds.size > 0 ? { orderIds: [...orderIds], received, remaining } : null;
  }

  async function validate(
    confirmedDuplicateOpening = false,
    receiptRemainder?: 'backorder' | 'close',
  ) {
    if (kind === 'opening' && !confirmedDuplicateOpening) {
      const others = await otherOpeningReferences();
      if (others.length > 0) {
        toast.warning(
          `لهذا المستودع مستند رصيد افتتاحي آخر (${others.join('، ')}). تصديق هذا المستند يضيف كمياته فوق الأرصدة الحالية.`,
          {
            duration: 15_000,
            action: { label: 'تصديق رغم ذلك', onClick: () => void validate(true) },
          },
        );
        return;
      }
    }
    const isCountLike = kind === 'physical_count' || kind === 'adjustment';
    let linesToValidate = lines;
    if (multiProductMode) {
      const normalized = normalizeMultiProductLines();
      if (!normalized) return;
      linesToValidate = normalized;
    }
    const invalid = linesToValidate.some(
      (line) => line.quantity < 0 || (!isCountLike && line.demandQuantity <= 0),
    );
    if (invalid) {
      toast.error('تحقق من كميات البنود قبل التصديق.');
      return;
    }
    if (!(await assertStockBeforeSave(linesToValidate))) return;
    if (!receiptRemainder) {
      let shortfall: Awaited<ReturnType<typeof purchaseOrderShortfall>>;
      try {
        shortfall = await purchaseOrderShortfall(linesToValidate);
      } catch {
        toast.error('تعذر قراءة المتبقي من أمر الشراء. حاول مرة أخرى.');
        return;
      }
      if (shortfall) {
        setPartialPrompt(shortfall);
        return;
      }
    }
    setPartialPrompt(null);
    await savePatch(
      { status: 'done', lines: linesToValidate, ...(receiptRemainder ? { receiptRemainder } : {}) },
      receiptRemainder === 'close'
        ? 'تم تصديق الاستلام وأُغلق المتبقي من أمر الشراء'
        : receiptRemainder === 'backorder'
          ? 'تم تصديق الاستلام، وأُنشئ سند استلام للمتبقي'
          : 'تم تصديق المستند',
    );
  }

  async function setPurchaseOrderReceiptsClosed(close: boolean) {
    if (!companyId || !documentOperation || closurePending) return;
    setClosurePending(true);
    try {
      const updated = close
        ? await closePurchaseOrderReceipts(companyId, documentOperation.id)
        : await reopenPurchaseOrderReceipts(companyId, documentOperation.id);
      queryClient.setQueryData(
        [...warehouseOperationsQueryKeys.detail(companyId, documentOperation.id), 'po-progress'],
        updated,
      );
      void queryClient.invalidateQueries({ queryKey: warehouseOperationsQueryKeys.root(companyId) });
      toast.success(
        close
          ? 'أُغلق المتبقي من أمر الشراء؛ لن يُنتظر استلامه.'
          : 'أُعيد فتح المتبقي؛ يمكن استلامه الآن.',
      );
    } catch (error) {
      const { displayMessage } = handleApiError(error, 'ecommerce.warehouseOperations.update');
      toast.error(displayMessage);
    } finally {
      setClosurePending(false);
    }
  }

  function confirmCloseReceipts() {
    toast.warning(
      `سيُغلق المتبقي (${formatLineQuantity(purchaseOrderRemaining)}) من أمر الشراء ولن يُستلم منه شيء بعد ذلك. يمكن إعادة فتحه لاحقاً.`,
      {
        duration: 15_000,
        action: { label: 'إغلاق المتبقي', onClick: () => void setPurchaseOrderReceiptsClosed(true) },
      },
    );
  }

  async function undoValidation() {
    if (!companyId || !documentOperation) return;
    if (status !== 'done' && documentOperation.status !== 'done') {
      toast.error('التراجع متاح فقط للمستندات المصدّقة (done).');
      return;
    }
    try {
      const updated = await undo.mutateAsync({ companyId, id: documentOperation.id });
      setStatus(updated.status);
      setLines(updated.lines.map((line) => ({ ...line })));
      setHeaderFromLocationId(updated.lines[0]?.fromLocationId ?? '');
      setHeaderToLocationId(updated.lines[0]?.toLocationId ?? '');
      toast.success('تم التراجع عن التصديق — المستند جاهز للتعديل');
    } catch {
      // ApiError already toasted in useWarehouseOperationMutations.onError
    }
  }

  /** Ready → draft: to add, remove or change products before readying again. */
  async function backToDraft() {
    await savePatch({ status: 'draft' }, 'أُعيد المستند إلى مسودة');
  }

  /** A cancelled document never moved stock: it can be reopened as a draft. */
  async function reopenOperation() {
    await savePatch({ status: 'draft' }, 'أُعيد فتح المستند كمسودة');
  }

  async function cancelOperation() {
    if (status === 'done' || documentOperation?.status === 'done') {
      toast.error('لا يمكن إلغاء مستند منتهٍ. استخدم التراجع عن التصديق أولاً.');
      return;
    }
    await savePatch({ status: 'cancelled' }, 'تم إلغاء المستند');
  }

  async function fillTheoreticalFromStock() {
    if (!companyId || !documentOperation) return;
    const isCountLike = kind === 'physical_count' || kind === 'adjustment';
    if (!isCountLike || !editable) return;

    try {
      const next = await Promise.all(
        lines.map(async (line) => {
          if (!line.productId || !line.toLocationId) return line;
          const theoretical = await inventoryStockService.getQuantityAtLocation(
            companyId,
            line.productId,
            line.toLocationId,
            line.variantId,
          );
          return { ...line, demandQuantity: theoretical };
        }),
      );
      setLines(next);
      toast.success('تم تعبئة الكمية النظامية من مخزون المواقع');
    } catch {
      toast.error('تعذر قراءة رصيد المواقع');
    }
  }

  async function saveDraftChanges() {
    let linesToSave = lines;
    if (multiProductMode) {
      // An unfinished draft may intentionally contain no products. Readying or
      // validating it still requires at least one complete line.
      const normalized = normalizeMultiProductLines({ allowEmpty: status === 'draft' });
      if (!normalized) return;
      linesToSave = normalized;
    }
    if (!(await assertStockBeforeSave(linesToSave))) return;
    await savePatch({ status, lines: linesToSave }, 'تم حفظ التعديلات');
  }

  /** What a line shows, whatever the layout (desktop table row or phone card). */
  function lineView(line: WarehouseOperationLine) {
    const available = availableByLineId[line.id];
    const maxQty =
      checksSourceStock && available != null
        ? maxQuantityForLine({
            lines,
            lineId: line.id,
            availableAtLocation: available,
            fromLocationId: headerFromLocationId || undefined,
          })
        : null;
    const demand = line.demandQuantity ?? line.quantity;
    const gap = demand - line.quantity;
    const unitCost = lineUnitCostNumber(line.unitCost);
    const lineTotal = unitCost == null ? null : unitCost * line.quantity;
    return { available, maxQty, demand, gap, unitCost, lineTotal };
  }

  function lineProductField(line: WarehouseOperationLine) {
    return canEditProducts && !line.purchaseOrderLineId ? (
      <div className="space-y-1">
        <ProductSinglePicker
          companyId={companyId ?? ''}
          value={line.productId}
          status="active"
          disabled={isSaving}
          excludeIds={reservedProductIdsOtherDocs}
          sourceLocationId={
            pickerUsesSourceLocationStock(kind) ? headerFromLocationId || undefined : undefined
          }
          placeholder={
            pickerUsesSourceLocationStock(kind) && !headerFromLocationId
              ? 'حدّد موقع الصرف أولًا…'
              : 'ابحث عن منتج…'
          }
          onChange={(productId) => {
            if (!productId) applyLineProduct(line.id, null);
          }}
          onProductSelect={(product) => applyLineProduct(line.id, product)}
        />
        {line.sku ? (
          <p className="text-[11px] text-muted-foreground" dir="ltr">
            {line.sku}
          </p>
        ) : null}
      </div>
    ) : (
      <div className="min-w-0">
        <p className="font-medium leading-snug text-foreground">{line.productName || '—'}</p>
        {line.sku ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">
            {line.sku}
          </p>
        ) : null}
      </div>
    );
  }

  function lineVariantField(line: WarehouseOperationLine) {
    return canEditProducts && line.productId && !line.purchaseOrderLineId ? (
      <OperationLineVariantSelect
        companyId={companyId ?? ''}
        productId={line.productId}
        catalogProductName={line.productName}
        variantId={line.variantId}
        disabled={isSaving}
        onChange={(nextId, variant) => applyLineVariant(line.id, nextId, variant)}
      />
    ) : (
      <p className="text-sm leading-snug text-foreground">
        <OperationLineVariantReadout
          companyId={companyId ?? ''}
          productId={line.productId}
          productName={line.productName}
          variantId={line.variantId}
        />
      </p>
    );
  }

  function lineDemandField(
    line: WarehouseOperationLine,
    view: ReturnType<typeof lineView>,
    phone: boolean,
  ) {
    return (
      <>
        {editable && status !== 'ready' && !line.purchaseOrderLineId ? (
          <FlexibleQuantityInput
            className={
              phone
                ? 'h-11 min-w-0 flex-1 text-center text-base'
                : 'mx-auto h-9 w-full max-w-[7rem] text-center'
            }
            stepper={phone}
            value={view.demand}
            max={view.maxQty}
            disabled={!editable || isSaving}
            aria-label="كمية الطلب"
            onChange={(value) => applyLineQuantity(line.id, 'demandQuantity', value)}
          />
        ) : (
          <p className="font-semibold tabular-nums">{formatLineQuantity(view.demand)}</p>
        )}
        {checksSourceStock && view.available != null ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            المتاح {formatLineQuantity(view.available)}
          </p>
        ) : null}
      </>
    );
  }

  function lineQuantityField(
    line: WarehouseOperationLine,
    view: ReturnType<typeof lineView>,
    phone: boolean,
  ) {
    return (
      <>
        {qtyEditable ? (
          <FlexibleQuantityInput
            className={
              phone
                ? 'h-11 min-w-0 flex-1 text-center text-base'
                : 'mx-auto h-9 w-full max-w-[7rem] text-center'
            }
            stepper={phone}
            value={line.quantity}
            max={view.maxQty}
            disabled={!qtyEditable || isSaving}
            aria-label={isCountLike ? 'الكمية المعدودة' : 'الكمية المنفذة'}
            onChange={(value) => applyLineQuantity(line.id, 'quantity', value)}
          />
        ) : (
          <p className="font-semibold tabular-nums">{formatLineQuantity(line.quantity)}</p>
        )}
        {showDemandColumn && Math.abs(view.gap) >= 1e-9 ? (
          <p
            className={cn(
              'mt-1 text-[11px]',
              view.gap > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-sky-700 dark:text-sky-400',
            )}
          >
            {view.gap > 0
              ? `ناقص ${formatLineQuantity(view.gap)}`
              : `زائد ${formatLineQuantity(Math.abs(view.gap))}`}
          </p>
        ) : null}
      </>
    );
  }

  function lineCostField(line: WarehouseOperationLine, view: ReturnType<typeof lineView>) {
    // The purchase cost stays editable until posting (draft and ready): a
    // ready document without it could not be validated otherwise. A line
    // received against a purchase order takes the order's price.
    return editable && !line.purchaseOrderLineId ? (
      <OperationUnitCostInput
        value={line.unitCost ?? ''}
        disabled={isSaving || !line.productId}
        showRequiredHint={Boolean(line.productId)}
        onChange={(raw) => applyLineUnitCost(line.id, raw)}
      />
    ) : (
      <p className="text-center font-semibold tabular-nums">
        {view.unitCost == null ? '—' : formatLineMoney(view.unitCost, costDisplayDecimals)}
      </p>
    );
  }

  function lineRemoveButton(line: WarehouseOperationLine, phone = false) {
    if (line.purchaseOrderLineId) return null;
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={phone ? 'h-10 w-10 shrink-0' : 'h-8 w-8'}
        disabled={isSaving}
        aria-label="حذف السطر"
        onClick={() => removeProductLine(line.id)}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    );
  }

  function orderedQty(line: WarehouseOperationLine): number {
    return (line.demandQuantity ?? 0) > 0 ? (line.demandQuantity ?? 0) : line.quantity;
  }

  /** Received so far on a purchase-order line: posted receipts only, read fresh. */
  function receivedQty(line: WarehouseOperationLine): number {
    const fresh = purchaseOrderFresh?.lines.find((row) => row.id === line.id);
    return fresh?.receivedQuantity ?? line.receivedQuantity ?? 0;
  }

  function poProgress(line: WarehouseOperationLine) {
    if (kind !== 'purchase_order') return null;
    const ordered = orderedQty(line);
    const received = receivedQty(line);
    const left = Math.max(0, ordered - received);
    const canChangePrice =
      isPostedPurchaseOrder && canPost && canReadCost && !poReceiptsClosed && left > 1e-6;
    return (
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span>
          المطلوب {formatLineQuantity(ordered)} · المستلم {formatLineQuantity(received)} · المتبقي{' '}
          {formatLineQuantity(left)}
        </span>
        {canChangePrice ? (
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={() =>
              setPriceEdit({
                lineId: line.id,
                productName: line.productName ?? '',
                value: line.unitCost ?? '',
              })
            }
          >
            تعديل السعر
          </button>
        ) : null}
      </div>
    );
  }

  function lotEditor(line: WarehouseOperationLine) {
    if (!capturesLot || !line.productId) return null;
    return (
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">تاريخ الانتهاء</Label>
          <Input
            type="date"
            dir="ltr"
            value={line.expiryDate?.slice(0, 10) ?? ''}
            disabled={!qtyEditable}
            onChange={(event) =>
              setLines((prev) =>
                prev.map((row) =>
                  row.id === line.id ? { ...row, expiryDate: event.target.value || null } : row,
                ),
              )
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">أرقام تسلسلية</Label>
          <Input
            dir="ltr"
            placeholder="رقم لكل قطعة"
            value={serialsToText(line.serialNumbers)}
            disabled={!qtyEditable}
            onChange={(event) => {
              const items = event.target.value
                .split(/[\n,]+/)
                .map((item) => item.trim())
                .filter(Boolean);
              setLines((prev) =>
                prev.map((row) =>
                  row.id === line.id
                    ? { ...row, serialNumbers: items.length > 0 ? JSON.stringify(items) : null }
                    : row,
                ),
              );
            }}
          />
        </div>
      </div>
    );
  }

  const purchaseOrderRemaining = lines.reduce(
    (sum, line) => sum + (line.productId ? Math.max(0, orderedQty(line) - receivedQty(line)) : 0),
    0,
  );

  /** A receipt of purchase orders: opened, cancelled and closed by the orders only. */
  const isPurchaseOrderReceipt =
    kind === 'receipt' &&
    (lines.some((line) => line.purchaseOrderLineId) || Boolean(documentOperation.backorderOfId));

  /** The receipt a click on «الاستلامات» opens: the one waiting, else the latest. */
  const activeLinkedReceipts = linkedReceipts.filter((row) => row.status !== 'cancelled');
  const receiptToOpen = openLinkedReceipt ?? activeLinkedReceipts[0] ?? null;

  async function savePurchaseOrderLinePrice() {
    if (!companyId || !documentOperation || !priceEdit || pricePending) return;
    const unitCost = lineUnitCostNumber(priceEdit.value);
    if (unitCost == null || unitCost < 0) {
      toast.error('أدخل سعراً صحيحاً.');
      return;
    }
    setPricePending(true);
    try {
      const updated = await changePurchaseOrderLinePrice(
        companyId,
        documentOperation.id,
        priceEdit.lineId,
        unitCost,
      );
      setLines(updated.lines.map((line) => ({ ...line })));
      queryClient.setQueryData(
        [...warehouseOperationsQueryKeys.detail(companyId, documentOperation.id), 'po-progress'],
        updated,
      );
      void queryClient.invalidateQueries({ queryKey: warehouseOperationsQueryKeys.root(companyId) });
      setPriceEdit(null);
      toast.success('تم تعديل السعر؛ تُستلم الكمية المتبقية به، والمستلم يبقى بسعره.');
    } catch (error) {
      const { displayMessage } = handleApiError(error, 'ecommerce.warehouseOperations.update');
      toast.error(displayMessage);
    } finally {
      setPricePending(false);
    }
  }

  async function confirmArrival() {
    if (!companyId || !documentOperation) return;
    setArrivalPending(true);
    try {
      const updated = await receiveWarehouseTransfer(companyId, documentOperation.id);
      setLines(updated.lines.map((line) => ({ ...line })));
      void queryClient.invalidateQueries({ queryKey: warehouseOperationsQueryKeys.root(companyId) });
      toast.success('تم تأكيد وصول البضاعة إلى المستودع الوجهة.');
    } catch (error) {
      const { displayMessage } = handleApiError(error, 'ecommerce.warehouseOperations.update');
      toast.error(displayMessage);
    } finally {
      setArrivalPending(false);
    }
  }

  /** The document's actions: in the header on larger screens, at the bottom (thumb reach) on phones. */
  const actionButtons = (
    <>
      {status === 'draft' ? (
        <Button type="button" size="sm" disabled={isSaving} onClick={() => void markReady()}>
          <Check className="h-4 w-4" />
          تحديد كجاهز
        </Button>
      ) : null}
      {status === 'ready' && canPost ? (
        <Button type="button" size="sm" disabled={isSaving} onClick={() => void validate()}>
          <Check className="h-4 w-4" />
          تصديق
        </Button>
      ) : null}
      {status === 'ready' ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSaving}
          onClick={() => void backToDraft()}
        >
          <Undo2 className="h-4 w-4" />
          إرجاع إلى مسودة
        </Button>
      ) : null}
      {status === 'cancelled' && kind !== 'physical_count' && !isPurchaseOrderReceipt ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSaving}
          onClick={() => void reopenOperation()}
        >
          <Undo2 className="h-4 w-4" />
          إعادة فتح
        </Button>
      ) : null}
      {status === 'done' && canPost ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSaving}
          onClick={() => void undoValidation()}
        >
          <Undo2 className="h-4 w-4" />
          تراجع عن التصديق
        </Button>
      ) : null}
      {editable ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSaving}
          onClick={() => void saveDraftChanges()}
        >
          حفظ
        </Button>
      ) : null}
      {status !== 'done' && status !== 'cancelled' && !isPurchaseOrderReceipt ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSaving}
          onClick={() => void cancelOperation()}
        >
          <X className="h-4 w-4" />
          إلغاء
        </Button>
      ) : null}
      {kind === 'adjustment' && editable ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSaving}
          onClick={() => void fillTheoreticalFromStock()}
        >
          تعبئة النظامي من المخزون
        </Button>
      ) : null}
      {isPostedPurchaseOrder &&
      !linkedReceiptsLoading &&
      receiptToOpen ? (
        <Button
          type="button"
          size="sm"
          variant={openLinkedReceipt ? 'default' : 'outline'}
          disabled={isSaving}
          onClick={() => setLinkedOperation(receiptToOpen)}
        >
          {`الاستلامات (${activeLinkedReceipts.length})`}
        </Button>
      ) : null}
      {isPostedPurchaseOrder &&
      canPost &&
      !linkedReceiptsLoading &&
      !poReceiptsClosed &&
      purchaseOrderRemaining > 1e-6 ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSaving || closurePending}
          onClick={confirmCloseReceipts}
        >
          <X className="h-4 w-4" />
          إغلاق المتبقي
        </Button>
      ) : null}
      {isPostedPurchaseOrder && canPost && poReceiptsClosed && purchaseOrderRemaining > 1e-6 ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSaving || closurePending}
          onClick={() => void setPurchaseOrderReceiptsClosed(false)}
        >
          <Undo2 className="h-4 w-4" />
          إعادة فتح المتبقي
        </Button>
      ) : null}
      {kind === 'transfer' &&
      documentOperation.transferMode === 'two_step' &&
      documentOperation.transitState === 'in_transit' &&
      status === 'done' &&
      canPost ? (
        <Button
          type="button"
          size="sm"
          disabled={isSaving || arrivalPending}
          onClick={() => void confirmArrival()}
        >
          تأكيد وصول البضاعة
        </Button>
      ) : null}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(dialogShellContentClass, dialogMobileFullScreenClass, 'max-w-6xl sm:max-w-6xl')}
      >
        <div className={cn(dialogShellHeaderClass, 'max-sm:px-4 max-sm:py-3')}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-semibold">
                <span dir="ltr">{documentOperation.reference || 'بدون مرجع'}</span>
                <Badge variant={statusBadgeVariant(status)}>
                  {WAREHOUSE_OPERATION_STATUS_LABELS_AR[status]}
                </Badge>
                {poReceiptState ? (
                  <Badge variant={PURCHASE_ORDER_RECEIPT_STATE_BADGE[poReceiptState]}>
                    {PURCHASE_ORDER_RECEIPT_STATE_LABELS_AR[poReceiptState]}
                  </Badge>
                ) : null}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {WAREHOUSE_OPERATION_KIND_LABELS_AR[kind]}
                {documentOperation.transferMode === 'two_step'
                  ? documentOperation.transitState === 'received'
                    ? ' · وصلت للمستودع الوجهة'
                    : ' · في الطريق'
                  : ''}
                {' · متابعة ومعالجة المستند'}
              </p>
              {audit?.postedAt || audit?.reversedAt ? (
                <p className="text-xs text-muted-foreground">
                  {audit.postedAt
                    ? `رحّله ${audit.postedByName ?? '—'} في ${formatDateTime(audit.postedAt)}`
                    : null}
                  {audit.postedAt && audit.reversedAt ? ' · ' : null}
                  {audit.reversedAt
                    ? `تراجع عنه ${audit.reversedByName ?? '—'} في ${formatDateTime(audit.reversedAt)}`
                    : null}
                </p>
              ) : null}
            </div>
            <div className="hidden sm:block">
              <OperationStatusStepper status={status} />
            </div>
          </div>

          <div className="mt-3 hidden flex-wrap gap-2 sm:flex">{actionButtons}</div>
        </div>

        <div className={cn(dialogShellBodyClass, 'space-y-5 max-sm:px-4 max-sm:py-4')}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm font-medium sm:hidden"
            aria-expanded={phoneDetailsOpen}
            onClick={() => setPhoneDetailsOpen((v) => !v)}
          >
            <span>تفاصيل المستند</span>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', phoneDetailsOpen && 'rotate-180')}
            />
          </button>
          <div className={cn('grid gap-4 sm:grid-cols-2', !phoneDetailsOpen && 'max-sm:hidden')}>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>
                  {operationPartnerLabel(kind)}
                </Label>
                <PartnerSinglePicker
                  companyId={companyId}
                  value={partnerId}
                  onChange={setPartnerId}
                  onPartnerSelect={(partner) => setPartnerName(partner.displayName)}
                  disabled={!editable}
                  deferSearchUntilOpen
                  placeholder="اختر جهة اتصال (اختياري)"
                />
                <Input
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  disabled={!editable || Boolean(partnerId)}
                  placeholder="أو اكتب اسمًا يدويًا إن لم تجد جهة الاتصال"
                  className="mt-1.5"
                />
              </div>
              <div className="space-y-1.5">
                <Label>نوع العملية</Label>
                <Input value={WAREHOUSE_OPERATION_KIND_LABELS_AR[kind]} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>{destinationLabel}</Label>
                <div className="space-y-2 rounded-md border border-input bg-muted/20 p-2.5">
                  {needsFrom ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">من</span>
                        <WarehouseChip name={sourceWarehouseName} />
                      </div>
                      {editable ? (
                        <Select
                          value={headerFromLocationId || ''}
                          onValueChange={(value) => {
                            setHeaderFromLocationId(value);
                            setLines((prev) =>
                              prev.map((line) => ({
                                ...line,
                                fromLocationId: value || undefined,
                                ...(needsTo
                                  ? { toLocationId: headerToLocationId || line.toLocationId }
                                  : {}),
                              })),
                            );
                          }}
                        >
                          <SelectTrigger aria-label={fromFieldLabel}>
                            <SelectValue placeholder={`اختر ${fromFieldLabel}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {fromLocationOptions.map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                {formatLocationOption(location.id)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <LocationChip
                          name={locationName(destinationLine?.fromLocationId)}
                          label={fromFieldLabel}
                        />
                      )}
                    </div>
                  ) : null}

                  {needsFrom && needsTo ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ArrowDown aria-hidden className="h-3.5 w-3.5 shrink-0" />
                      <span aria-hidden className="h-px flex-1 bg-border" />
                    </div>
                  ) : null}

                  {needsTo ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">إلى</span>
                        <WarehouseChip name={targetWarehouseName} />
                      </div>
                      {editable ? (
                        <Select
                          value={headerToLocationId || ''}
                          onValueChange={(value) => {
                            setHeaderToLocationId(value);
                            setLines((prev) =>
                              prev.map((line) => ({
                                ...line,
                                toLocationId: value || undefined,
                                ...(needsFrom
                                  ? { fromLocationId: headerFromLocationId || line.fromLocationId }
                                  : {}),
                              })),
                            );
                          }}
                        >
                          <SelectTrigger aria-label={toFieldLabel}>
                            <SelectValue placeholder={`اختر ${toFieldLabel}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {toLocationOptions.map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                {formatLocationOption(location.id)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <LocationChip
                          name={locationName(destinationLine?.toLocationId)}
                          label={toFieldLabel}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="op-detail-date">التاريخ المجدول</Label>
                <Input
                  id="op-detail-date"
                  type="datetime-local"
                  dir="ltr"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  disabled={!editable}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{kind === 'customer_return' ? 'رقم مستند البيع الأصلي' : 'المستند المصدر'}</Label>
                <Input
                  value={sourceDocument}
                  onChange={(e) => setSourceDocument(e.target.value)}
                  disabled={!editable}
                  placeholder={
                    kind === 'customer_return'
                      ? 'رقم فاتورة البيع أو مستند الصرف — منه تُؤخذ التكلفة'
                      : 'مثال: تجديد المخزون يدويًا'
                  }
                />
              </div>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} dir="rtl" className="space-y-3">
            <TabsList className="sto-tabs-scroll h-auto w-full justify-start rounded-2xl border border-border/80 bg-muted/40 p-1">
              <TabsTrigger value="operations" className={OPERATION_FORM_TAB_TRIGGER}>
                الأصناف
              </TabsTrigger>
              <TabsTrigger value="notes" className={OPERATION_FORM_TAB_TRIGGER}>
                الملاحظات
              </TabsTrigger>
            </TabsList>

            <TabsContent value="operations" className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {pricedLines.length} {pricedLines.length === 1 ? 'صنف' : 'أصناف'}
                </p>
                <div className="flex gap-2">
                  {(multiProductMode || isCountLike) && qtyEditable ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => {
                        setScanStatus(null);
                        setScanOpen(true);
                      }}
                    >
                      <ScanBarcode className="me-1 h-3.5 w-3.5" />
                      مسح
                    </Button>
                  ) : null}
                  {canEditProducts ? (
                    <Button type="button" variant="outline" size="sm" disabled={isSaving} onClick={addProductLine}>
                      <Plus className="me-1 h-3.5 w-3.5" />
                      إضافة صنف
                    </Button>
                  ) : null}
                </div>
              </div>
              {/* Phones: one card per line — the table would put the quantity off-screen. */}
              <div className="space-y-2.5 md:hidden">
                {lines.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                    لا توجد أصناف في هذا المستند.
                  </p>
                ) : (
                  lines.map((line, index) => {
                    const view = lineView(line);
                    return (
                      <div key={line.id} className="space-y-3 rounded-xl border border-border bg-card p-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-2.5 w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1 space-y-2">
                            {lineProductField(line)}
                            {poProgress(line)}
                            {lotEditor(line)}
                            {line.productId ? lineVariantField(line) : null}
                          </div>
                          {canEditProducts ? lineRemoveButton(line, true) : null}
                        </div>
                        {/* Read-only quantities side by side; editable ones stacked (steppers need the width). */}
                        <div className={cn('grid gap-3', !qtyEditable && 'grid-cols-2')}>
                          {showDemandColumn ? (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">كمية الطلب</Label>
                              {lineDemandField(line, view, true)}
                            </div>
                          ) : null}
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {isCountLike ? 'الكمية المعدودة' : 'الكمية المُنفَّذة'}
                            </Label>
                            {lineQuantityField(line, view, true)}
                          </div>
                        </div>
                        {showSystemQty && (line.demandQuantity ?? 0) > 0 ? (
                          // Count: the book quantity (filled from stock) and the difference the count makes.
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                            <span>
                              <span className="text-xs text-muted-foreground">النظامي </span>
                              <span className="font-semibold tabular-nums">{formatLineQuantity(line.demandQuantity ?? 0)}</span>
                            </span>
                            {(() => {
                              const diff = line.quantity - (line.demandQuantity ?? 0);
                              return (
                                <span
                                  className={cn(
                                    'font-semibold tabular-nums',
                                    Math.abs(diff) < 1e-9
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : diff > 0
                                        ? 'text-sky-700 dark:text-sky-400'
                                        : 'text-amber-700 dark:text-amber-400',
                                  )}
                                >
                                  {Math.abs(diff) < 1e-9
                                    ? 'مطابق'
                                    : diff > 0
                                      ? `زائد ${formatLineQuantity(diff)}`
                                      : `ناقص ${formatLineQuantity(-diff)}`}
                                </span>
                              );
                            })()}
                          </div>
                        ) : null}
                        {showCostColumns ? (
                          <div className="grid grid-cols-2 items-end gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">تكلفة الشراء</Label>
                              {lineCostField(line, view)}
                            </div>
                            <div className="space-y-1 text-end">
                              <p className="text-xs text-muted-foreground">الإجمالي</p>
                              <p className="font-semibold tabular-nums">
                                {view.lineTotal == null
                                  ? '—'
                                  : formatLineMoney(view.lineTotal, costDisplayDecimals)}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
                {pricedLines.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm font-semibold">
                    <span>الإجمالي</span>
                    <span className="flex flex-wrap gap-3 tabular-nums">
                      {showDemandColumn ? (
                        <span>
                          <span className="text-xs font-normal text-muted-foreground">الطلب </span>
                          {formatLineQuantity(demandTotal)}
                        </span>
                      ) : null}
                      <span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {isCountLike ? 'المعدود ' : 'المُنفَّذ '}
                        </span>
                        {formatLineQuantity(executedTotal)}
                      </span>
                      {showCostColumns ? (
                        <span>{formatLineMoney(moneyTotal, costDisplayDecimals)}</span>
                      ) : null}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
                <table className="w-full min-w-[52rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                      <th scope="col" className="w-12 px-3 py-2.5 text-center font-medium">
                        #
                      </th>
                      <th scope="col" className="min-w-[14rem] px-3 py-2.5 text-start font-medium">
                        المنتج
                      </th>
                      <th scope="col" className="min-w-[9rem] px-3 py-2.5 text-start font-medium">
                        المتغير
                      </th>
                      {showDemandColumn ? (
                        <th scope="col" className="min-w-[7rem] px-3 py-2.5 text-center font-medium">
                          كمية الطلب
                        </th>
                      ) : null}
                      <th scope="col" className="min-w-[7.5rem] px-3 py-2.5 text-center font-medium">
                        {isCountLike ? 'الكمية المعدودة' : 'الكمية المُنفَّذة'}
                      </th>
                      <th scope="col" className="min-w-[5rem] px-3 py-2.5 text-center font-medium">
                        الوحدة
                      </th>
                      {showCostColumns ? (
                        <th scope="col" className="min-w-[8.5rem] px-3 py-2.5 text-center font-medium">
                          تكلفة الشراء
                        </th>
                      ) : null}
                      {showCostColumns ? (
                        <th scope="col" className="min-w-[8rem] px-3 py-2.5 text-center font-medium">
                          الإجمالي
                        </th>
                      ) : null}
                      {canEditProducts ? <th scope="col" className="w-12 px-2 py-2.5" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 ? (
                      <tr>
                        <td
                          colSpan={lineColumnCount}
                          className="px-3 py-8 text-center text-sm text-muted-foreground"
                        >
                          لا توجد أصناف في هذا المستند.
                        </td>
                      </tr>
                    ) : (
                      lines.map((line, index) => {
                        const view = lineView(line);
                        return (
                          <tr
                            key={line.id}
                            className="border-b border-border align-top last:border-0 even:bg-muted/20"
                          >
                            <td className="px-3 py-3 text-center text-xs tabular-nums text-muted-foreground">
                              {index + 1}
                            </td>
                            <td className="px-3 py-3">
                              {lineProductField(line)}
                              {poProgress(line)}
                              {lotEditor(line)}
                            </td>
                            <td className="px-3 py-3">{lineVariantField(line)}</td>
                            {showDemandColumn ? (
                              <td className="px-3 py-3 text-center">{lineDemandField(line, view, false)}</td>
                            ) : null}
                            <td className="px-3 py-3 text-center">{lineQuantityField(line, view, false)}</td>
                            <td className="px-3 py-3 text-center text-sm text-foreground">وحدات</td>
                            {showCostColumns ? (
                              <td className="px-3 py-3">{lineCostField(line, view)}</td>
                            ) : null}
                            {showCostColumns ? (
                              <td className="px-3 py-3 text-center font-semibold tabular-nums">
                                {view.lineTotal == null
                                  ? '—'
                                  : formatLineMoney(view.lineTotal, costDisplayDecimals)}
                              </td>
                            ) : null}
                            {canEditProducts ? (
                              <td className="px-2 py-3">{lineRemoveButton(line)}</td>
                            ) : null}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {pricedLines.length > 0 ? (
                    <tfoot>
                      <tr className="border-t border-border bg-muted/30 text-sm font-semibold">
                        <td colSpan={3} className="px-3 py-2.5 text-start">
                          الإجمالي
                        </td>
                        {showDemandColumn ? (
                          <td className="px-3 py-2.5 text-center tabular-nums">
                            {formatLineQuantity(demandTotal)}
                          </td>
                        ) : null}
                        <td className="px-3 py-2.5 text-center tabular-nums">
                          {formatLineQuantity(executedTotal)}
                        </td>
                        <td />
                        {showCostColumns ? <td /> : null}
                        {showCostColumns ? (
                          <td className="px-3 py-2.5 text-center tabular-nums">
                            {formatLineMoney(moneyTotal, costDisplayDecimals)}
                          </td>
                        ) : null}
                        {canEditProducts ? <td /> : null}
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>

              {isPostedPurchaseOrder ? (
                <div className="space-y-2 rounded-xl border border-border/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">سندات الاستلام من هذا الأمر</h4>
                    <span className="text-xs text-muted-foreground">
                      {purchaseOrderRemaining <= 1e-6
                        ? 'استُلم الأمر بالكامل'
                        : poReceiptsClosed
                          ? `أُغلق المتبقي ${formatLineQuantity(purchaseOrderRemaining)} — لن يُستلم`
                          : `المتبقي ${formatLineQuantity(purchaseOrderRemaining)}`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    الكمية لا تدخل المخزون ولا تُحسب «مستلمة» إلا بعد تصديق سند الاستلام.
                  </p>
                  {linkedReceiptsLoading ? (
                    <p className="text-xs text-muted-foreground">جاري التحميل…</p>
                  ) : linkedReceipts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">لا توجد سندات استلام بعد.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {linkedReceipts.map((receipt) => (
                        <li key={receipt.id}>
                          <button
                            type="button"
                            className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-start text-sm hover:bg-muted/40"
                            onClick={() => setLinkedOperation(receipt)}
                          >
                            <span className="flex items-center gap-2">
                              <span dir="ltr" className="font-medium">
                                {receipt.reference}
                              </span>
                              <Badge variant={statusBadgeVariant(receipt.status)}>
                                {WAREHOUSE_OPERATION_STATUS_LABELS_AR[receipt.status]}
                              </Badge>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(receipt.occurredAt)}
                              {receipt.totalQuantity != null
                                ? ` · الكمية ${formatLineQuantity(receipt.totalQuantity)}`
                                : ''}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="notes" className="mt-3">
              <Textarea
                className="min-h-[120px] resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!editable}
                placeholder="ملاحظات داخلية حول هذا المستند…"
              />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border px-6 py-4 max-sm:px-4 max-sm:py-3 sm:justify-start">
          {/* Phones: the actions sit here, within thumb reach. */}
          <div className="flex w-full flex-wrap gap-2 sm:hidden [&>button]:h-11 [&>button]:flex-1">
            {actionButtons}
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 max-sm:w-full"
            onClick={() => setPrintOpen(true)}
            disabled={lines.length === 0 && documentOperation.lines.length === 0}
          >
            <Printer className="h-4 w-4" aria-hidden />
            طباعة
          </Button>
          <Button
            type="button"
            variant="outline"
            className="max-sm:hidden"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
      <PrintDocumentDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        documentType={operationPrintDocumentType(documentOperation.kind)}
        companyId={companyId}
        company={toPrintCompany(activeCompany)}
        document={
          printOpen
            ? buildOperationPrintDocument({
                operation: { ...documentOperation, notes: notes || documentOperation.notes },
                lines: lines.length > 0 ? lines : documentOperation.lines,
                warehouseName: sourceWarehouseName,
                destinationWarehouseName: crossWarehouse ? targetWarehouseName : null,
                locationName,
              })
            : null
        }
      />
      <BarcodeScannerDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        continuous
        title={status === 'draft' ? 'مسح الأصناف' : 'عدّ الأصناف بالمسح'}
        status={scanStatus ? <p className="font-medium">{scanStatus}</p> : null}
        onCode={(code) => void addScannedCode(code)}
      />
      {isPostedPurchaseOrder ? (
        <WarehouseOperationDetailDialog
          open={Boolean(linkedOperation)}
          onOpenChange={(next) => {
            if (!next) setLinkedOperation(null);
          }}
          operation={linkedOperation}
        />
      ) : null}
      <Dialog open={Boolean(partialPrompt)} onOpenChange={(next) => !next && setPartialPrompt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>استلام أقل من المتبقي في أمر الشراء</DialogTitle>
            <DialogDescription>
              {partialPrompt
                ? `يستلم هذا السند ${formatLineQuantity(partialPrompt.received)} من أصل المتبقي ${formatLineQuantity(partialPrompt.remaining)}. هل ستصل بقية البضاعة لاحقاً؟`
                : null}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            «إنشاء استلام متبقٍّ» ينشئ سند استلام جديداً بالكمية الباقية وينتظرها. «لا استلام متبقٍّ» يعني أن المورد
            لن يرسل البقية: يُغلق المتبقي من أمر الشراء ولا يُحسب في تجديد المخزون، ويمكن إعادة فتحه من الأمر لاحقاً.
          </p>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="button" disabled={isSaving} onClick={() => void validate(true, 'backorder')}>
              إنشاء استلام متبقٍّ
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => void validate(true, 'close')}
            >
              لا استلام متبقٍّ
            </Button>
            <Button type="button" variant="ghost" disabled={isSaving} onClick={() => setPartialPrompt(null)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(priceEdit)} onOpenChange={(next) => !next && setPriceEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تعديل سعر الشراء</DialogTitle>
            <DialogDescription>
              {priceEdit?.productName}: السعر الجديد يقع على الكمية التي لم تُستلم بعد، وتأخذه سندات الاستلام
              المفتوحة. ما استُلم يبقى بسعره.
            </DialogDescription>
          </DialogHeader>
          <OperationUnitCostInput
            value={priceEdit?.value ?? ''}
            disabled={pricePending}
            showRequiredHint
            onChange={(raw) => setPriceEdit((prev) => (prev ? { ...prev, value: raw } : prev))}
          />
          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="button" disabled={pricePending} onClick={() => void savePurchaseOrderLinePrice()}>
              حفظ السعر
            </Button>
            <Button type="button" variant="ghost" disabled={pricePending} onClick={() => setPriceEdit(null)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
