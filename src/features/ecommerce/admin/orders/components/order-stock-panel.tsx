'use client';

import * as React from 'react';
import { Boxes, Loader2, PackageCheck } from 'lucide-react';
import { useCan } from '@/features/auth/hooks/use-can';
import {
  useReceiveOrderReturn,
  useResolveOrderStockSource,
} from '@/features/ecommerce/admin/orders/hooks/use-orders';
import type {
  Order,
  OrderStockReservation,
  OrderStockSource,
} from '@/features/ecommerce/domain/types/order';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/shared/utils';
import { APP, useCompanyApps } from '@/shared/modules/company-apps';

const STOCK_UPDATE_PERMISSION = 'sta.stock.update';

const SOURCE_LABEL: Record<OrderStockSource, string> = {
  local: 'كمية المنتج',
  inventory: 'المخازن',
  none: 'بلا أثر مخزني',
  unresolved: 'غير محدد — يحتاج مراجعة',
};

/** Inventory orders: reserved once paid (cash on delivery: once confirmed). */
const RESERVATION_LABEL: Record<OrderStockReservation, string> = {
  awaiting: 'لم تُحجز الكمية بعد — تُحجز عند تأكيد الدفع (الدفع عند الاستلام: عند تأكيد الطلب)',
  short:
    'تم تأكيد الدفع لكن الكمية غير متوفرة حالياً — الطلب لا يتقدم حتى تتوفر الكمية أو يُلغى ويُسترد',
  reserved: 'الكمية محجوزة في مستودع المتجر',
  released: 'أُعيدت الكمية المحجوزة',
  issued: 'صُرفت الكمية من المستودع',
};

const OPEN = new Set(['pending', 'confirmed', 'processing']);
const AFTER_SHIPPING = new Set(['shipped', 'delivered', 'refunded']);

/**
 * The order's stock (phase 4): where it comes from (fixed when placed), the
 * choice for an older order without a clear source, and the receipt of the
 * returned goods — refunding the money moves no stock; this does, once.
 */
export function OrderStockPanel({ order, companyId }: { order: Order; companyId: string }) {
  const can = useCan();
  const canManage = can(STOCK_UPDATE_PERMISSION);
  const source = order.stockSource ?? null;
  const unresolved = source === null || source === 'unresolved';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Boxes className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">مخزون الطلب</h3>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium',
            unresolved ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground',
          )}
        >
          {SOURCE_LABEL[source ?? 'unresolved']}
        </span>
      </div>
      {source === 'inventory' && order.stockReservation ? (
        <p
          className={cn(
            'text-xs',
            order.stockReservation === 'short' ? 'font-medium text-warning' : 'text-muted-foreground',
          )}
        >
          {RESERVATION_LABEL[order.stockReservation]}
        </p>
      ) : null}
      {order.stockSourceNote && !unresolved ? (
        <p className="text-xs text-muted-foreground">{order.stockSourceNote}</p>
      ) : null}

      {unresolved && OPEN.has(order.status) ? (
        <ResolveSource order={order} companyId={companyId} canManage={canManage} />
      ) : null}

      {order.returnReceipt ? (
        <ReceiptSummary order={order} />
      ) : (source === 'inventory' || source === 'local') &&
        (AFTER_SHIPPING.has(order.status) ||
          (order.status === 'cancelled' && source === 'inventory')) ? (
        <ReturnReceiptForm order={order} companyId={companyId} canManage={canManage} />
      ) : null}
    </div>
  );
}

function ResolveSource({
  order,
  companyId,
  canManage,
}: {
  order: Order;
  companyId: string;
  canManage: boolean;
}) {
  const mutation = useResolveOrderStockSource(companyId);
  // Selling from inventory is the store–inventory bridge's.
  const bridgeOn = useCompanyApps().isEnabled(APP.storeStockSync);
  const noteRef = React.useRef<HTMLInputElement>(null);
  const [note, setNote] = React.useState('');
  const [noteMissing, setNoteMissing] = React.useState(false);
  const run = (source: 'inventory' | 'local' | 'none') =>
    mutation.mutate({ orderId: order.id, source, note: note.trim() || undefined });
  const chooseNone = () => {
    if (note.trim().length === 0) {
      setNoteMissing(true);
      noteRef.current?.focus();
      return;
    }
    run('none');
  };

  return (
    <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
      <p className="text-xs text-foreground">
        طلب قديم لا يُعرف من أين يأخذ مخزونه، ولا يُشحن قبل تحديد ذلك. اختر:
      </p>
      <ul className="list-disc space-y-0.5 ps-5 text-xs text-muted-foreground">
        <li>المخازن: يُحجز الآن من مستودع المتجر (أو يُعتبر مصروفاً إن صُرف له سابقاً).</li>
        <li>كمية المنتج: تُخصم منها الآن.</li>
        <li>بلا أثر مخزني: يُشحن دون حركة مخزون، مع ملاحظة إلزامية.</li>
      </ul>
      <p className="text-xs font-medium text-foreground">
        لإغلاق الطلب دون خصم مخزون: اكتب ملاحظة ثم اضغط «بلا أثر مخزني».
      </p>
      <Input
        ref={noteRef}
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
          if (event.target.value.trim()) setNoteMissing(false);
        }}
        placeholder="مثال: طلب قديم قبل الربط، البضاعة خرجت سابقاً"
        className="h-9 text-sm"
        disabled={!canManage || mutation.isPending}
        aria-invalid={noteMissing}
      />
      {noteMissing ? (
        <p className="text-xs font-medium text-destructive">اكتب الملاحظة أولاً، ثم اضغط الزر.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {bridgeOn ? (
          <Button size="sm" disabled={!canManage || mutation.isPending} onClick={() => run('inventory')}>
            المخازن
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          disabled={!canManage || mutation.isPending}
          onClick={() => run('local')}
        >
          كمية المنتج
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!canManage || mutation.isPending}
          onClick={chooseNone}
        >
          بلا أثر مخزني
        </Button>
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>
    </div>
  );
}

function ReturnReceiptForm({
  order,
  companyId,
  canManage,
}: {
  order: Order;
  companyId: string;
  canManage: boolean;
}) {
  const mutation = useReceiveOrderReturn(companyId);
  const [open, setOpen] = React.useState(false);
  const lines = order.items.filter((item) => item.lineId);
  const [damaged, setDamaged] = React.useState<Record<string, string>>({});
  const [notes, setNotes] = React.useState('');

  const parsed = lines.map((item) => {
    const d = Number(damaged[item.lineId!] ?? '0');
    return { item, damaged: d, valid: Number.isFinite(d) && d >= 0 && d <= item.quantity };
  });
  const valid = parsed.every((p) => p.valid);

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={!canManage}
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <PackageCheck className="h-4 w-4" />
        تأكيد استلام المرتجع
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">
        استلام كامل الطلب المرتجع: الكمية الصالحة تعود إلى المخزون الذي خرجت منه، والتالفة تُسجَّل فقط. لا يتكرر.
      </p>
      <div className="space-y-2">
        {parsed.map(({ item, damaged: d, valid: ok }) => (
          <div key={item.lineId} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{item.productNameAr}</span>
            <span className="text-xs text-muted-foreground">الكمية {item.quantity}</span>
            <label className="flex items-center gap-1 text-xs">
              تالف
              <Input
                type="number"
                min={0}
                max={item.quantity}
                dir="rtl"
                className={cn('h-8 w-20', !ok && 'border-destructive')}
                value={damaged[item.lineId!] ?? '0'}
                onChange={(event) =>
                  setDamaged((prev) => ({ ...prev, [item.lineId!]: event.target.value }))
                }
              />
            </label>
            <span className="text-xs text-muted-foreground">
              صالح {ok ? item.quantity - d : '—'}
            </span>
          </div>
        ))}
      </div>
      <Input
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="ملاحظة (اختياري)"
        className="h-9 text-sm"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!valid || mutation.isPending}
          onClick={() =>
            mutation.mutate(
              {
                orderId: order.id,
                notes: notes.trim() || undefined,
                lines: parsed.map(({ item, damaged: d }) => ({
                  lineId: item.lineId!,
                  sellableQuantity: item.quantity - d,
                  damagedQuantity: d,
                })),
              },
              { onSuccess: () => setOpen(false) },
            )
          }
        >
          {mutation.isPending ? 'جارٍ الحفظ…' : 'تأكيد الاستلام'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          إلغاء
        </Button>
      </div>
    </div>
  );
}

function ReceiptSummary({ order }: { order: Order }) {
  const receipt = order.returnReceipt!;
  const byLine = new Map(order.items.map((item) => [item.lineId, item.productNameAr]));
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
      <p className="mb-1 font-medium text-foreground">
        استُلم المرتجع في {new Date(receipt.receivedAt).toLocaleString('ar')}
      </p>
      <ul className="space-y-0.5 text-muted-foreground">
        {receipt.lines.map((line) => (
          <li key={line.lineId}>
            {byLine.get(line.lineId) ?? line.lineId}: صالح {line.sellableQuantity} · تالف{' '}
            {line.damagedQuantity}
          </li>
        ))}
      </ul>
      {receipt.notes ? <p className="mt-1">{receipt.notes}</p> : null}
    </div>
  );
}
