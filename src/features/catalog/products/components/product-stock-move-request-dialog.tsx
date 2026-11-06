'use client';

import * as React from 'react';
import { ArrowLeftRight, PackageMinus, PackagePlus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { useWarehouseLocations } from '@/features/inventory/admin/locations/hooks/use-warehouse-locations';
import { warehouseOperationsApi } from '@/features/inventory/admin/operations/lib/api/warehouse-operations';
import { warehouseOperationsQueryKeys } from '@/features/inventory/admin/hooks/query-keys';
import { inventoryStockService } from '@/features/inventory/services/inventory-stock.service';
import {
  collectStockShortages,
  formatStockShortageMessage,
} from '@/features/inventory/admin/operations/lib/validate-operation-stock';
import {
  PRODUCT_PAGE_REPLENISHMENT_SOURCE_DOCUMENT,
  REPLENISHMENT_SOURCE_DOCUMENT,
} from '@/features/catalog/products/constants/replenishment';
import { WAREHOUSE_OPERATION_KIND_META } from '@/features/inventory/domain/constants/warehouse-operation-kinds';
import type { ProductFormInput } from '@/features/catalog/products/schemas/product-schema';
import type {
  WarehouseLocation,
  WarehouseLocationType,
  WarehouseOperationKind,
} from '@/features/inventory/domain/types/warehouse';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  dialogShellBodyClass,
  dialogShellContentClass,
  dialogShellHeaderClass,
} from '@/components/ui/dialog';
import { cn } from '@/shared/utils';
import { WarehouseOperationLinesEditor } from '@/features/inventory/admin/operations/components/warehouse-operation-lines-editor';
import { FlexibleQuantityInput } from '@/features/inventory/admin/operations/components/flexible-quantity-input';
import {
  hasDuplicateOperationLineProducts,
  newOperationLineDraftId,
  operationLineDraftsToLines,
  supportsMultiProductLines,
  pickerUsesSourceLocationStock,
  type OperationLineDraft,
} from '@/features/inventory/admin/operations/lib/operation-line-draft';

type VariantRow = ProductFormInput['variants'][number];

/** Matches inventory-stock-mode-contract.md — never mix in one operation. */
type StockLineMode = 'product' | 'variants';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** عادة: replenishment | issue | internal | receipt */
  kind: WarehouseOperationKind;
  productId?: string | null;
  productNameAr: string;
  productSku: string;
  variants: VariantRow[];
  onCreated?: (warehouseId: string, kind: WarehouseOperationKind) => void;
};

type DraftLine = {
  key: string;
  nameAr: string;
  sku: string;
  /** undefined/omitted only in UI draft; submit always sends null or uuid */
  variantId: string | null;
  quantity: number;
};

const LOCATION_TYPE_LABEL_AR: Record<WarehouseLocationType, string> = {
  internal: 'داخلي',
  view: 'عرض',
  supplier: 'مورد',
  customer: 'عميل',
  inventory: 'جرد',
  production: 'إنتاج',
  transit: 'عبور',
};

/** Locations that can hold / receive stock for move requests. */
const STOCKABLE_LOCATION_TYPES = new Set<WarehouseLocationType>([
  'internal',
  'inventory',
  'transit',
  'production',
  'supplier',
]);

function sourceDocumentFor(kind: WarehouseOperationKind): string {
  if (kind === 'purchase_order') return PRODUCT_PAGE_REPLENISHMENT_SOURCE_DOCUMENT;
  if (kind === 'replenishment') return REPLENISHMENT_SOURCE_DOCUMENT;
  if (kind === 'receipt') return 'استلام مخزون يدوي';
  if (kind === 'issue') return 'صرف مخزون يدوي';
  return 'نقل بين مواقع يدوي';
}

function newLineId() {
  return `opl-${Math.random().toString(36).slice(2, 9)}`;
}

function activeVariants(variants: VariantRow[]): VariantRow[] {
  return variants.filter((variant) => variant.isActive !== false);
}

function formatLocationLabel(location: WarehouseLocation): string {
  const typeLabel = LOCATION_TYPE_LABEL_AR[location.locationType] ?? location.locationType;
  const name = location.nameAr?.trim() || location.code;
  return `${name} · ${location.code} (${typeLabel})`;
}

function pickDefaultLocationId(locations: WarehouseLocation[], preferredId?: string): string {
  if (preferredId && locations.some((location) => location.id === preferredId)) {
    return preferredId;
  }
  const stock =
    locations.find((location) => /\/?stock$/i.test(location.code) || /stock/i.test(location.code)) ??
    locations.find((location) => location.locationType === 'internal') ??
    locations[0];
  return stock?.id ?? '';
}

function buildProductLine(productNameAr: string, productSku: string): DraftLine {
  return {
    key: 'product',
    nameAr: productNameAr || 'المنتج الأساسي',
    sku: productSku,
    variantId: null,
    quantity: 0,
  };
}

function buildVariantLines(variants: VariantRow[], productSku: string): DraftLine[] {
  return variants.map((variant, index) => ({
    key: variant.id || `v-${index}`,
    nameAr: variant.nameAr,
    sku: variant.sku || productSku,
    variantId: variant.id,
    quantity: 0,
  }));
}

export function ProductStockMoveRequestDialog({
  open,
  onOpenChange,
  kind,
  productId,
  productNameAr,
  productSku,
  variants,
  onCreated,
}: Props) {
  const companyId = getStorefrontCompanyId();
  const queryClient = useQueryClient();
  const { data: warehousesData } = useWarehouses({ companyId, limit: 100 }, { enabled: open });
  const warehouses = warehousesData?.items ?? [];

  const selectableVariants = React.useMemo(() => activeVariants(variants), [variants]);
  const hasVariants = selectableVariants.length > 0;
  const multiProductMode = supportsMultiProductLines(kind);

  const [warehouseId, setWarehouseId] = React.useState('');
  const [locationId, setLocationId] = React.useState('');
  const [toLocationId, setToLocationId] = React.useState('');
  const [stockMode, setStockMode] = React.useState<StockLineMode>('product');
  const [lines, setLines] = React.useState<DraftLine[]>([]);
  const [lineDrafts, setLineDrafts] = React.useState<OperationLineDraft[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [availableByLineKey, setAvailableByLineKey] = React.useState<Record<string, number>>({});

  // Mounted on every product page: ask inventory only while it is open (it
  // opens from the inventory shortcuts, shown only with inventory enabled).
  const { data: locationsData } = useWarehouseLocations(
    {
      companyId,
      warehouseId: warehouseId || undefined,
      limit: 500,
    },
    { enabled: open },
  );
  const locations = React.useMemo(
    () =>
      (locationsData?.items ?? []).filter(
        (location) =>
          location.warehouseId === warehouseId &&
          location.isActive &&
          STOCKABLE_LOCATION_TYPES.has(location.locationType),
      ),
    [locationsData?.items, warehouseId],
  );

  React.useEffect(() => {
    if (!open) return;
    const firstWarehouse = warehouses[0]?.id ?? '';
    setWarehouseId(firstWarehouse);
    setLocationId('');
    setToLocationId('');
    if (multiProductMode) {
      setLineDrafts([
        {
          id: newOperationLineDraftId(),
          productId: productId ?? '',
          productName: productNameAr || 'منتج',
          sku: productSku,
          quantity: 0,
        },
      ]);
      setStockMode('product');
      setLines([]);
      return;
    }
    const initialMode: StockLineMode = hasVariants ? 'variants' : 'product';
    setStockMode(initialMode);
    setLines(
      initialMode === 'variants'
        ? buildVariantLines(selectableVariants, productSku)
        : [buildProductLine(productNameAr, productSku)],
    );
    setLineDrafts([]);
  }, [open, hasVariants, selectableVariants, productNameAr, productSku, warehouses, multiProductMode, productId]);

  React.useEffect(() => {
    if (!open || !warehouseId) return;
    if (locations.length === 0) {
      setLocationId('');
      setToLocationId('');
      return;
    }
    setLocationId((prev) => pickDefaultLocationId(locations, prev));
    setToLocationId((prev) => {
      const keep = prev && locations.some((location) => location.id === prev) ? prev : '';
      if (keep) return keep;
      const fromId = pickDefaultLocationId(locations);
      const other =
        locations.find((location) => location.id !== fromId) ?? locations[0];
      return other?.id ?? fromId;
    });
  }, [open, warehouseId, locations]);

  function applyStockMode(mode: StockLineMode) {
    setStockMode(mode);
    setLines(
      mode === 'variants'
        ? buildVariantLines(selectableVariants, productSku)
        : [buildProductLine(productNameAr, productSku)],
    );
  }

  function handleWarehouseChange(nextWarehouseId: string) {
    setWarehouseId(nextWarehouseId);
    setLocationId('');
    setToLocationId('');
  }

  const kindMeta = WAREHOUSE_OPERATION_KIND_META[kind];
  const stockEffect = kindMeta.stockEffect;
  const checksSourceStock =
    stockEffect === 'outbound' || stockEffect === 'move' || stockEffect === 'transfer';
  const title = kindMeta.createLabel;
  const Icon =
    stockEffect === 'inbound' || stockEffect === 'order'
      ? RefreshCw
      : stockEffect === 'outbound'
        ? PackageMinus
        : ArrowLeftRight;
  const hasQty = multiProductMode
    ? lineDrafts.some((line) => line.quantity > 0)
    : lines.some((line) => line.quantity > 0);
  const needsFrom = stockEffect === 'outbound' || stockEffect === 'move' || stockEffect === 'transfer';
  const needsTo = stockEffect === 'inbound' || stockEffect === 'move' || stockEffect === 'transfer';

  React.useEffect(() => {
    if (!open || !companyId || !productId || !checksSourceStock || !locationId) {
      setAvailableByLineKey({});
      return;
    }

    let cancelled = false;
    void (async () => {
      const next: Record<string, number> = {};
      await Promise.all(
        lines.map(async (line) => {
          const available = await inventoryStockService.getQuantityAtLocation(
            companyId,
            productId,
            locationId,
            stockMode === 'product' ? undefined : line.variantId ?? undefined,
          );
          next[line.key] = Math.max(0, available);
        }),
      );
      if (!cancelled) setAvailableByLineKey(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, companyId, productId, checksSourceStock, locationId, lines, stockMode]);

  function maxDraftQuantity(lineKey: string): number | null {
    const available = availableByLineKey[lineKey];
    if (available == null) return null;
    const target = lines.find((line) => line.key === lineKey);
    if (!target) return available;
    const usedByOthers = lines
      .filter(
        (line) =>
          line.key !== lineKey &&
          (line.variantId ?? null) === (target.variantId ?? null),
      )
      .reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
    return Math.max(0, available - usedByOthers);
  }

  function applyDraftQuantity(lineKey: string, quantity: number) {
    setLines((prev) => prev.map((item) => (item.key === lineKey ? { ...item, quantity } : item)));
  }

  async function handleSubmit() {
    if (!companyId) return;
    if (!warehouseId) {
      toast.error('اختر المستودع.');
      return;
    }
    if (needsFrom && !locationId) {
      toast.error(
        stockEffect === 'outbound' ? 'اختر موقع الصرف.' : 'اختر موقع المصدر (من موقع).',
      );
      return;
    }
    if (needsTo && !(stockEffect === 'move' || stockEffect === 'transfer' ? toLocationId : locationId)) {
      toast.error(
        stockEffect === 'inbound' ? 'اختر موقع الاستلام.' : 'اختر الموقع الوجهة (إلى موقع).',
      );
      return;
    }
    if (!hasQty) {
      toast.error('أدخل كمية لسطر واحد على الأقل.');
      return;
    }

    const fromId = needsFrom ? locationId : undefined;
    const toId =
      stockEffect === 'inbound'
        ? locationId
        : stockEffect === 'move' || stockEffect === 'transfer'
          ? toLocationId
          : undefined;

    if (stockEffect === 'move' && fromId && toId && fromId === toId) {
      toast.error('اختر موقعين مختلفين داخل نفس المستودع.');
      return;
    }

    if (multiProductMode) {
      if (hasDuplicateOperationLineProducts(lineDrafts)) {
        toast.error('لا يمكن تكرار نفس المنتج في أكثر من سطر.');
        return;
      }
      const opLines = operationLineDraftsToLines(lineDrafts, {
        fromLocationId: fromId,
        toLocationId: toId,
      });
      if (opLines.length === 0) {
        toast.error('أضف صنفًا واحدًا على الأقل مع كمية أكبر من صفر.');
        return;
      }
      if (checksSourceStock && fromId) {
        const issues = await collectStockShortages({
          companyId,
          warehouseId,
          kind,
          destinationWarehouseId: undefined,
          lines: opLines,
        });
        if (issues.length > 0) {
          toast.error(formatStockShortageMessage(issues[0]!));
          return;
        }
      }

      setSaving(true);
      try {
        const created = await warehouseOperationsApi.create({
          companyId,
          warehouseId,
          kind,
          status: 'draft',
          occurredAt: new Date().toISOString(),
          sourceDocument: sourceDocumentFor(kind),
          notes: `طلب ${kindMeta.labelAr} — ${opLines.length} أصناف`,
          lines: opLines,
        });
        void queryClient.invalidateQueries({ queryKey: warehouseOperationsQueryKeys.root(companyId) });
        toast.success(`تم إنشاء ${kindMeta.createLabel} ${created.reference}`);
        onOpenChange(false);
        onCreated?.(warehouseId, kind);
      } catch {
        toast.error('تعذر إنشاء طلب الحركة.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!productId) {
      toast.message('احفظ المنتج أولًا ثم أنشئ طلب الحركة.');
      return;
    }

    // Contract: all lines same mode — product → variantId null; variants → uuid only for qty > 0.
    const opLines = lines
      .filter((line) => line.quantity > 0)
      .map((line) => ({
        id: newLineId(),
        productName:
          stockMode === 'product'
            ? productNameAr || 'المنتج الأساسي'
            : line.nameAr,
        sku: line.sku || undefined,
        productId,
        variantId: stockMode === 'product' ? undefined : (line.variantId ?? undefined),
        demandQuantity: line.quantity,
        quantity: line.quantity,
        ...(fromId ? { fromLocationId: fromId } : {}),
        ...(toId ? { toLocationId: toId } : {}),
      }));

    if (stockMode === 'variants' && opLines.some((line) => !line.variantId)) {
      toast.error('وضع المتغيرات يتطلب اختيار متغير لكل سطر.');
      return;
    }

    if (checksSourceStock && fromId) {
      const draftOperation = {
        companyId,
        warehouseId,
        kind,
        destinationWarehouseId: undefined,
        lines: opLines.map((line, index) => ({
          id: `draft-${index}`,
          productName: line.productName,
          sku: line.sku,
          productId: line.productId!,
          variantId: line.variantId,
          demandQuantity: line.demandQuantity ?? line.quantity,
          quantity: line.quantity,
          fromLocationId: fromId,
          toLocationId: toId,
        })),
      };
      const issues = await collectStockShortages(draftOperation);
      if (issues.length > 0) {
        toast.error(formatStockShortageMessage(issues[0]!));
        return;
      }
    }

    setSaving(true);
    try {
      const created = await warehouseOperationsApi.create({
        companyId,
        warehouseId,
        kind,
        status: 'draft',
        occurredAt: new Date().toISOString(),
        sourceDocument: sourceDocumentFor(kind),
        notes: `طلب ${kindMeta.labelAr} للمنتج ${productNameAr} (${stockMode === 'product' ? 'منتج أساسي' : 'متغيرات'})`,
        lines: opLines,
      });
      void queryClient.invalidateQueries({ queryKey: warehouseOperationsQueryKeys.root(companyId) });
      toast.success(`تم إنشاء ${kindMeta.createLabel} ${created.reference}`);
      onOpenChange(false);
      onCreated?.(warehouseId, kind);
    } catch {
      toast.error('تعذر إنشاء طلب الحركة.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogShellContentClass, 'max-w-2xl sm:max-w-2xl')}>
        <div className={dialogShellHeaderClass}>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Icon className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
        </div>

        <div className={cn(dialogShellBodyClass, 'space-y-4')}>
          <p className="text-xs text-muted-foreground">
            لا تُحدَّث كمية المنتج مباشرة. يُنشأ طلب حركة في المستودع (مسودة) ثم يُعالج من شاشة العمليات.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>المستودع</Label>
              <Select value={warehouseId || undefined} onValueChange={handleWarehouseChange}>
                <SelectTrigger aria-label="المستودع">
                  <SelectValue placeholder="اختر مستودعًا" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {stockEffect === 'inbound' ? (
              <div className="space-y-1.5">
                <Label>موقع الاستلام</Label>
                <Select
                  value={locationId || undefined}
                  onValueChange={setLocationId}
                  disabled={!warehouseId || locations.length === 0}
                >
                  <SelectTrigger aria-label="موقع الاستلام">
                    <SelectValue placeholder="اختر موقع الاستلام" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {formatLocationLabel(location)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {warehouseId && locations.length === 0 ? (
                  <p className="text-xs text-destructive">لا توجد مواقع نشطة في هذا المستودع.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">اختر الموقع الذي ستُضاف إليه الكمية بعد التصديق.</p>
                )}
              </div>
            ) : null}

            {stockEffect === 'outbound' ? (
              <div className="space-y-1.5">
                <Label>موقع الصرف</Label>
                <Select
                  value={locationId || undefined}
                  onValueChange={setLocationId}
                  disabled={!warehouseId || locations.length === 0}
                >
                  <SelectTrigger aria-label="موقع الصرف">
                    <SelectValue placeholder="اختر موقع الصرف" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {formatLocationLabel(location)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {stockEffect === 'move' || stockEffect === 'transfer' ? (
              <>
                <div className="space-y-1.5">
                  <Label>من موقع</Label>
                  <Select
                    value={locationId || undefined}
                    onValueChange={setLocationId}
                    disabled={!warehouseId || locations.length === 0}
                  >
                    <SelectTrigger aria-label="من موقع">
                      <SelectValue placeholder="اختر موقع المصدر" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {formatLocationLabel(location)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>إلى موقع</Label>
                  <Select
                    value={toLocationId || undefined}
                    onValueChange={setToLocationId}
                    disabled={!warehouseId || locations.length === 0}
                  >
                    <SelectTrigger aria-label="إلى موقع">
                      <SelectValue placeholder="اختر الموقع الوجهة" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {formatLocationLabel(location)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
          </div>

          {hasVariants && !multiProductMode ? (
            <div className="space-y-1.5">
              <Label>نطاق الكمية</Label>
              <Select
                value={stockMode}
                onValueChange={(value) => applyStockMode(value as StockLineMode)}
              >
                <SelectTrigger aria-label="نطاق الكمية">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">المنتج الأساسي فقط</SelectItem>
                  <SelectItem value="variants">حسب المتغيرات</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                لا يمكن مزج الوضعين في نفس الطلب. اختر أحدهما ثم أدخل الكميات.
              </p>
            </div>
          ) : null}

          {multiProductMode ? (
            <WarehouseOperationLinesEditor
              companyId={companyId}
              lines={lineDrafts}
              onChange={setLineDrafts}
              fromLocationId={locationId || undefined}
              checksSourceStock={checksSourceStock}
              restrictToSourceLocation={pickerUsesSourceLocationStock(kind)}
              disabled={saving}
            />
          ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                  <th className="px-3 py-2.5 text-start font-medium">
                    {stockMode === 'variants' ? 'المتغير' : 'المنتج'}
                  </th>
                  <th className="px-3 py-2.5 text-start font-medium">الكمية المطلوبة</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{line.nameAr}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">
                        {line.sku}
                      </div>
                      {stockMode === 'product' ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">منتج أساسي (بدون متغير)</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <FlexibleQuantityInput
                        className="h-8 w-28"
                        value={line.quantity}
                        max={maxDraftQuantity(line.key)}
                        onChange={(quantity) => applyDraftQuantity(line.key, quantity)}
                      />
                      {checksSourceStock && availableByLineKey[line.key] != null ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          المتاح في الموقع: {availableByLineKey[line.key]}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border px-6 py-4 sm:justify-start">
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              saving ||
              !hasQty ||
              !warehouseId ||
              (needsFrom && !locationId) ||
              (needsTo &&
                !(stockEffect === 'move' || stockEffect === 'transfer' ? toLocationId : locationId))
            }
          >
            {saving ? 'جاري الإنشاء…' : kindMeta.createLabel}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StockMoveKindIcon({ kind }: { kind: WarehouseOperationKind }) {
  const effect = WAREHOUSE_OPERATION_KIND_META[kind].stockEffect;
  if (effect === 'inbound') return <PackagePlus className="h-4 w-4" />;
  if (effect === 'outbound') return <PackageMinus className="h-4 w-4" />;
  return <ArrowLeftRight className="h-4 w-4" />;
}
