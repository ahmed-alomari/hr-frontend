'use client';

import * as React from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Package, Plus, X } from 'lucide-react';
import {
  sumAllocationQty,
  validateAllocations,
} from '@/features/ecommerce/admin/orders/lib/allocation-utils';
import {
  useOrderFulfillmentMutations,
  useProductStockAvailability,
} from '@/features/ecommerce/admin/orders/hooks/use-orders';
import { productsApi } from '@/features/catalog/products/lib/api/products';
import { formatPrice } from '@/features/ecommerce/shared/utils/format-price';
import { ORDER_LINE_SHIP_STATUS_LABELS_AR } from '@/features/ecommerce/domain/constants/order-status';
import type {
  Order,
  OrderLineItem,
  OrderLineShipStatus,
  OrderStockSource,
} from '@/features/ecommerce/domain/types/order';
import { isOrderFulfilmentLocked } from '@/features/ecommerce/domain/constants/order-status';
import { inventoryStockService } from '@/features/inventory/services/inventory-stock.service';
import {
  orderLinePrepNote,
  resolveOrderLinePrepMode,
} from '@/features/ecommerce/admin/orders/lib/order-line-prep-mode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/shared/utils';
import { APP, useCompanyApps } from '@/shared/modules/company-apps';
import { toast } from 'sonner';

type DraftRow = {
  key: string;
  warehouseId: string;
  locationId: string;
  quantity: number;
};

type Props = {
  companyId: string;
  orderId: string;
  /** Parent order status — locks fulfilment when shipped/delivered/cancelled/refunded. */
  orderStatus: Order['status'];
  /** The order's stock source (fixed when placed) decides how lines are prepared. */
  stockSource: OrderStockSource | null | undefined;
  /** Inventory orders: the store warehouse the order is reserved in. */
  stockWarehouseId?: string | null;
  line: OrderLineItem;
  /** Shown without preparation (a new order: prepared once it is confirmed). */
  readOnly?: boolean;
};

const SHIP_STATUS_BADGE_VARIANT: Record<OrderLineShipStatus, NonNullable<BadgeProps['variant']>> = {
  unassigned: 'outline',
  partial: 'warning',
  assigned: 'secondary',
  shipped: 'success',
};

function toDraftRows(line: OrderLineItem): DraftRow[] {
  if (line.allocations.length === 0) {
    return [{ key: 'row-1', warehouseId: '', locationId: '', quantity: line.quantity }];
  }
  return line.allocations.map((allocation, index) => ({
    key: `${allocation.id || 'alloc'}-${index}`,
    warehouseId: allocation.warehouseId,
    locationId: allocation.locationId,
    quantity: allocation.quantity,
  }));
}

export function OrderLineShipPanel({
  companyId,
  orderId,
  orderStatus,
  stockSource,
  stockWarehouseId,
  line,
  readOnly = false,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [staffNote, setStaffNote] = React.useState('');
  const isShipped = line.shipStatus === 'shipped';
  const fulfilmentLocked = readOnly || isOrderFulfilmentLocked(orderStatus) || isShipped;
  // Decided by the order (its source is fixed when placed), not by today's
  // link setting: an order placed while the store was not linked keeps
  // selling from the store's own quantity, and the other way round.
  const prepMode = resolveOrderLinePrepMode(stockSource);
  const sellsFromInventory = prepMode === 'inventory';
  // Inventory orders are reserved in the store warehouse: prepared from it only.
  const lockedWarehouseId =
    line.allocations[0]?.warehouseId || (sellsFromInventory ? stockWarehouseId : '') || '';
  // Stock figures are inventory's: not asked for once it is disabled (a
  // shipped inventory order stays readable from its own lines).
  const companyApps = useCompanyApps();
  const inventoryOn = companyApps.isEnabled(APP.inventory);
  // Where the store can be linked to inventory, a local order says so.
  const storeCanLinkInventory = companyApps.isEnabled(APP.storeStockSync);
  const needsStockContext = (open || isShipped) && sellsFromInventory && inventoryOn;

  const { data: product } = useQuery({
    queryKey: ['ecommerce', 'products', 'track-inventory', companyId, line.productId],
    queryFn: () => productsApi.getById(companyId, line.productId),
    enabled: needsStockContext && Boolean(companyId && line.productId),
    staleTime: 60_000,
  });
  // Tracking is the product's setting (inventory reads the product row): a
  // variant always follows its product — a variant row with no value of its
  // own never turns tracking off.
  const productTracksInventory = product?.inventory.trackInventory ?? true;
  const trackInventory = sellsFromInventory && productTracksInventory;
  const prepNote = orderLinePrepNote(prepMode, productTracksInventory, storeCanLinkInventory);
  const sourceUnresolved = prepMode === 'unresolved';
  const lineVariantId = line.variantId ?? null;

  const { data: availability = [], isLoading } = useProductStockAvailability(
    companyId,
    line.productId,
    needsStockContext && trackInventory,
    lineVariantId,
  );
  const { data: onHandByVariant } = useQuery({
    queryKey: ['ecommerce', 'stock-by-variant', companyId, line.productId],
    queryFn: () => inventoryStockService.getOnHandByVariant(companyId, line.productId),
    enabled: needsStockContext && trackInventory && Boolean(companyId && line.productId && lineVariantId),
    staleTime: 60_000,
  });
  const thisVariantOnHand = lineVariantId
    ? onHandByVariant?.byVariant[lineVariantId] ?? 0
    : 0;
  const otherVariantsOnHand = onHandByVariant
    ? Math.max(0, onHandByVariant.total - thisVariantOnHand)
    : 0;
  const selectableAvailability = React.useMemo(
    () =>
      lockedWarehouseId
        ? availability.filter((row) => row.warehouseId === lockedWarehouseId)
        : availability,
    [availability, lockedWarehouseId],
  );
  const variantOutOfStockHint =
    Boolean(lineVariantId) &&
    !isLoading &&
    selectableAvailability.length === 0 &&
    otherVariantsOnHand > 0;
  const { saveAllocations, shipLine } = useOrderFulfillmentMutations(companyId);
  const [multi, setMulti] = React.useState(line.allocations.length > 1);
  const [rows, setRows] = React.useState<DraftRow[]>(() => toDraftRows(line));
  const [showAvailability, setShowAvailability] = React.useState(false);

  const allocationsSyncKey = line.allocations
    .map((row) => `${row.id}:${row.warehouseId}:${row.locationId}:${row.quantity}`)
    .join('|');

  React.useEffect(() => {
    setRows(toDraftRows(line));
    setMulti(line.allocations.length > 1);
  }, [line.lineId, line.shipStatus, line.quantity, allocationsSyncKey]);

  React.useEffect(() => {
    if (!trackInventory || selectableAvailability.length === 0) return;
    setRows((prev) => {
      let changed = false;
      const preferred =
        selectableAvailability.find(
          (row) => (row.availableQuantity ?? row.quantity) >= line.quantity,
        ) ?? selectableAvailability[0];

      const next = prev.map((row) => {
        if (row.locationId && !row.warehouseId) {
          const found = selectableAvailability.find((item) => item.locationId === row.locationId);
          if (found) {
            changed = true;
            return { ...row, warehouseId: found.warehouseId };
          }
        }
        if (!row.locationId && preferred) {
          changed = true;
          return {
            ...row,
            locationId: preferred.locationId,
            warehouseId: preferred.warehouseId,
          };
        }
        return row;
      });

      return changed ? next : prev;
    });
  }, [selectableAvailability, line.quantity, trackInventory]);

  const availableByLocation = React.useMemo(
    () =>
      Object.fromEntries(
        selectableAvailability.map((row) => [
          row.locationId,
          row.availableQuantity ?? row.quantity,
        ]),
      ),
    [selectableAvailability],
  );

  const total = sumAllocationQty(rows);
  const validation = trackInventory
    ? validateAllocations(
        line.quantity,
        rows.map((row) => ({
          warehouseId: row.warehouseId,
          locationId: row.locationId,
          quantity: row.quantity,
        })),
        availableByLocation,
        { lockedWarehouseId },
      )
    : { ok: true as const };

  const assignedQty = sumAllocationQty(line.allocations);
  const progressLabel = `${assignedQty}/${line.quantity}`;
  const isSaving = saveAllocations.isPending || shipLine.isPending;
  const canShipWithoutAlloc =
    !trackInventory || line.shipStatus === 'assigned' || line.shipStatus === 'partial';

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (patch.locationId) {
          const found = selectableAvailability.find(
            (item) => item.locationId === patch.locationId,
          );
          if (found) next.warehouseId = found.warehouseId;
        }
        return next;
      }),
    );
  }

  function setMode(nextMulti: boolean) {
    setMulti(nextMulti);
    if (!nextMulti) {
      setRows((prev) => {
        const first = prev[0] ?? {
          key: 'row-1',
          warehouseId: '',
          locationId: '',
          quantity: line.quantity,
        };
        return [{ ...first, quantity: line.quantity, key: 'row-1' }];
      });
    }
  }

  async function onSave() {
    if (fulfilmentLocked) {
      toast.error('لا يمكن تعديل التجهيز بعد شحن الصنف أو قفل الطلب.');
      return;
    }
    if (!trackInventory) return;
    if (!validation.ok) {
      toast.error('error' in validation && validation.error ? validation.error : 'أكمل توزيع الكمية أولاً');
      return;
    }
    if (!line.lineId) {
      toast.error('معرّف بند الطلب غير متوفر. حدّث الصفحة ثم أعد المحاولة.');
      return;
    }
    try {
      await saveAllocations.mutateAsync({
        orderId,
        input: {
          productId: line.productId,
          lineId: line.lineId,
          allocations: rows.map((row) => ({
            warehouseId: row.warehouseId,
            locationId: row.locationId,
            quantity: row.quantity,
          })),
        },
      });
    } catch {
      // toast handled by mutation onError
    }
  }

  async function onShip() {
    if (fulfilmentLocked) {
      toast.error('لا يمكن تغيير حالة تجهيز الصنف بعد القفل.');
      return;
    }
    if (sourceUnresolved) {
      toast.error('اختر مصدر مخزون الطلب أولاً من تبويب «المخزون».');
      return;
    }
    const note = staffNote.trim() || null;
    if (trackInventory) {
      if (!validation.ok && line.shipStatus !== 'assigned' && line.shipStatus !== 'partial') {
        toast.error('error' in validation && validation.error ? validation.error : 'أكمل توزيع الكمية أولاً');
        return;
      }
      const allocations = rows.map((row) => ({
        warehouseId: row.warehouseId,
        locationId: row.locationId,
        quantity: row.quantity,
      }));
      try {
        if (line.shipStatus !== 'assigned' && line.shipStatus !== 'partial') {
          if (!line.lineId) {
            toast.error('معرّف بند الطلب غير متوفر. حدّث الصفحة ثم أعد المحاولة.');
            return;
          }
          await saveAllocations.mutateAsync({
            orderId,
            input: { productId: line.productId, lineId: line.lineId, allocations },
          });
        }
        await shipLine.mutateAsync({
          orderId,
          input: { productId: line.productId, lineId: line.lineId, allocations, note },
        });
        setStaffNote('');
        setOpen(false);
      } catch {
        // toast handled by mutation onError
      }
    } else {
      try {
        await shipLine.mutateAsync({
          orderId,
          input: { productId: line.productId, lineId: line.lineId, note },
        });
        setStaffNote('');
        setOpen(false);
      } catch {
        // toast handled by mutation onError
      }
    }
  }

  const shippedFromLabels = React.useMemo(() => {
    if (!isShipped) return [];
    if (line.allocations.length === 0) {
      if (prepMode === 'local') return ['كمية المنتج'];
      return [trackInventory ? '—' : 'بدون خصم مخزون'];
    }
    return line.allocations.map((allocation) => {
      const match = availability.find((row) => row.locationId === allocation.locationId);
      const warehouseName = match?.warehouseNameAr ?? 'مستودع';
      return `${warehouseName} (${allocation.quantity})`;
    });
  }, [availability, isShipped, line.allocations, prepMode, trackInventory]);

  const lineTotal = {
    amount: line.unitPrice.amount * line.quantity,
    currency: line.unitPrice.currency,
  };

  const shippedFromBadges = isShipped ? (
    <div className="flex flex-wrap gap-1.5">
      {isLoading && shippedFromLabels.length === 0 ? (
        <Badge variant="success" className="max-w-full truncate border-success/30 bg-success/15 font-medium">
          شُحن من: …
        </Badge>
      ) : (
        shippedFromLabels.map((label, index) => (
          <Badge
            key={`${label}-${index}`}
            variant="success"
            className="max-w-full truncate border-success/30 bg-success/15 font-medium"
            title={`شُحن من: ${label}`}
          >
            شُحن من: {label}
          </Badge>
        ))
      )}
    </div>
  ) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border/80">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2.5 text-start"
        onClick={() => setOpen((value) => !value)}
      >
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
          {line.imageUrl ? (
            <Image src={line.imageUrl} alt="" fill unoptimized className="object-cover" sizes="44px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Package className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium text-foreground">{line.productNameAr}</p>
          <p className="text-xs text-muted-foreground">
            {line.quantity} × {formatPrice(line.unitPrice)}
            {lineVariantId ? ' · متغير' : ''}
          </p>
          {!open ? shippedFromBadges : null}
        </div>

        <p className="hidden shrink-0 text-sm font-semibold tabular-nums text-foreground sm:block">
          {formatPrice(lineTotal)}
        </p>

        <Badge className="shrink-0" variant={SHIP_STATUS_BADGE_VARIANT[line.shipStatus]}>
          {ORDER_LINE_SHIP_STATUS_LABELS_AR[line.shipStatus]}
          {line.shipStatus === 'partial' || line.shipStatus === 'assigned'
            ? ` ${progressLabel}`
            : ''}
        </Badge>

        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && fulfilmentLocked ? (
        <div className="space-y-3 border-t border-border px-3 py-3">
          {shippedFromBadges}
          <p className="text-xs text-muted-foreground">
            {isShipped
              ? 'الصنف مشحون — لا يمكن إعادة تجهيزه أو تغيير حالته.'
              : orderStatus === 'pending'
                ? 'طلب جديد — يبدأ تجهيز الأصناف بعد تأكيد الطلب.'
                : 'الطلب مقفول (مشحون/مسلم/ملغي/مسترد) — لا يمكن تعديل التخصيص أو حالة الأصناف.'}
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            إغلاق
          </Button>
        </div>
      ) : null}

      {open && !fulfilmentLocked ? (
        <div className="space-y-3 border-t border-border px-3 pb-4 pt-4">
          <p className="text-sm font-medium">
            توزيع {line.productNameAr} ({line.quantity} قطعة)
          </p>

          {prepNote ? (
            <div
              className={cn(
                'rounded-lg border px-3 py-2 text-sm',
                sourceUnresolved
                  ? 'border-warning/30 bg-warning/10 text-foreground'
                  : 'border-border bg-muted/30 text-muted-foreground',
              )}
            >
              {prepNote}
            </div>
          ) : sellsFromInventory ? (
            <p className="text-xs text-muted-foreground">
              خصم المخزون يتم عند تغيير حالة الطلب إلى «تم الشحن». التوزيع هنا للتجهيز فقط
              {lineVariantId ? ' · التوفر حسب متغير هذا البند فقط.' : ' · التوفر للمنتج الأساسي.'}
              {lockedWarehouseId ? ' · التخصيص مقيّد بنفس المستودع لأول تخصيص.' : ''}
            </p>
          ) : null}

          {variantOutOfStockHint ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              نفد مخزون هذا المتغير في المواقع. يوجد حوالي {otherVariantsOnHand} قطعة من متغيرات
              أخرى لنفس المنتج — لا يمكن تجهيز هذا البند منها.
            </div>
          ) : null}

          {trackInventory ? (
            <>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setShowAvailability((value) => !value)}
              >
                {showAvailability ? 'إخفاء التوفر' : 'عرض توفر المواقع'}
              </button>

              {showAvailability ? (
                <div className="flex flex-wrap gap-2">
                  {isLoading ? (
                    <p className="text-xs text-muted-foreground">جاري التحميل…</p>
                  ) : selectableAvailability.length === 0 ? (
                    <p className="text-xs text-destructive">لا توجد كمية متاحة في المواقع.</p>
                  ) : (
                    selectableAvailability.map((row, index) => (
                      <Badge key={`${row.warehouseId}-${row.locationId}-${index}`} variant="outline">
                        {row.warehouseNameAr} / {row.locationNameAr} ({row.quantity})
                      </Badge>
                    ))
                  )}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={multi ? 'outline' : 'default'}
                  onClick={() => setMode(false)}
                >
                  موقع واحد
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={multi ? 'default' : 'outline'}
                  onClick={() => setMode(true)}
                >
                  مواقع متعددة
                </Button>
              </div>

              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.key} className="flex flex-wrap items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      dir="ltr"
                      className="w-20"
                      value={row.quantity}
                      onChange={(event) =>
                        updateRow(row.key, { quantity: Math.max(0, Number(event.target.value) || 0) })
                      }
                      disabled={!multi && rows.length === 1}
                    />
                    <Select
                      value={row.locationId || undefined}
                      onValueChange={(value) => updateRow(row.key, { locationId: value })}
                    >
                      <SelectTrigger className="min-w-0 flex-1" aria-label="اختر الموقع">
                        <SelectValue placeholder="اختر الموقع" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableAvailability
                          .filter((option) => (option.availableQuantity ?? option.quantity) > 0)
                          .map((option, index) => (
                            <SelectItem
                              key={`${option.warehouseId}-${option.locationId}-${index}`}
                              value={option.locationId}
                            >
                              {option.warehouseNameAr} / {option.locationNameAr} (
                              {option.availableQuantity ?? option.quantity})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {multi ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="حذف الصف"
                        onClick={() => setRows((prev) => prev.filter((item) => item.key !== row.key))}
                        disabled={rows.length <= 1}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>

              {multi ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setRows((prev) => [
                      ...prev,
                      {
                        key: `row-${Math.random().toString(36).slice(2, 7)}`,
                        warehouseId: lockedWarehouseId || '',
                        locationId: '',
                        quantity: 1,
                      },
                    ])
                  }
                >
                  <Plus className="me-1 h-3.5 w-3.5" />
                  موقع
                </Button>
              ) : null}

              {!validation.ok && total > 0 && rows.every((row) => row.locationId) ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {'error' in validation ? validation.error : null}
                </div>
              ) : null}

              {!isLoading && selectableAvailability.length === 0 ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {variantOutOfStockHint
                    ? 'لا مواقع متاحة لهذا المتغير. أضف رصيدًا للمتغير المطلوب أو اختر بديلاً من الطلب.'
                    : 'لا توجد مواقع مخزون متاحة لهذا الصنف. أضف رصيدًا من المخازن أولًا.'}
                </div>
              ) : null}

              {validation.ok ? (
                <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                  التوزيع يغطي الكمية المطلوبة ({total}/{line.quantity}).
                </div>
              ) : null}
            </>
          ) : null}

          <Input
            value={staffNote}
            onChange={(event) => setStaffNote(event.target.value)}
            placeholder="ملاحظة التجهيز (اختياري) — تُسجَّل في سجل الحالة"
            maxLength={500}
          />

          <div className="flex flex-wrap gap-2 pt-1">
            {trackInventory ? (
              <Button
                type="button"
                size="sm"
                disabled={!validation.ok || isSaving}
                onClick={() => void onSave()}
              >
                <Check className="me-1 h-3.5 w-3.5" />
                حفظ
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={sourceUnresolved || isSaving || (!validation.ok && !canShipWithoutAlloc)}
              onClick={() => void onShip()}
            >
              تم الشحن للصنف
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              إغلاق
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
