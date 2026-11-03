'use client';

import * as React from 'react';
import { CalendarClock, Loader2, MapPin, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAddOrderNote } from '@/features/ecommerce/admin/orders/hooks/use-order-stages';
import { StatusHistoryTimeline } from '@/features/ecommerce/admin/orders/components/order-status-history-button';
import type { OrderStagesContext } from '@/features/ecommerce/admin/orders/lib/api/order-stages';
import { isOrderStage } from '@/features/ecommerce/admin/orders/lib/order-stage-access';
import type { Order } from '@/features/ecommerce/domain/types/order';
import { formatDisplayDate } from '@/shared/utils';

const QUICK_NOTES = [
  'محاولة توصيل: العميل لم يرد',
  'تأجيل التوصيل بطلب العميل',
  'العنوان غير واضح — بانتظار تأكيد العميل',
] as const;

type Props = {
  order: Order;
  companyId: string;
  stages: OrderStagesContext | null | undefined;
};

/** As the backend: orders.update, the assignee, or a handler of the current stage. */
function mayWork(stages: Props['stages'], order: Order): boolean {
  if (!stages) return true;
  if (stages.canUpdate) return true;
  if (order.assignedUserId === stages.userId) return true;
  return isOrderStage(order.status) && stages.stages.includes(order.status);
}

/** Team notes in the order trail (delivery attempts…), oldest → newest from the server. */
export function orderTrailNotes(order: Order) {
  return [...(order.statusHistory ?? [])].filter((entry) => entry.kind === 'note').reverse();
}

/** Recipient and address. The customer corrects them, from tracking, before shipping. */
export function OrderAddressSection({ order }: Props) {
  const addressNote = order.shippingNotes?.trim() || null;

  return (
    <div className="space-y-3">
      <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        العنوان والمستلم
      </h3>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">المستلم</dt>
          <dd className="font-medium">{order.shipFullName ?? order.customerNameAr}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">جوال المستلم</dt>
          <dd className="font-medium" dir="ltr">
            {order.shipPhone ?? order.phone ?? '—'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">العنوان</dt>
          <dd>
            {[order.city, order.shippingDistrict ?? order.region, order.shippingStreet]
              .filter(Boolean)
              .join(' — ') || '—'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            موعد التسليم المتوقع
          </dt>
          <dd>{order.estimatedDeliveryAt ? formatDisplayDate(order.estimatedDeliveryAt) : 'لم يُحدد'}</dd>
        </div>
        {addressNote ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">ملاحظة العنوان (من العميل)</dt>
            <dd className="whitespace-pre-wrap" dir="auto">
              {addressNote}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

/** Team notes in the order trail. Internal: never shown to the customer. */
export function OrderInternalTrail({ order, companyId, stages }: Props) {
  const addNote = useAddOrderNote(companyId);
  const [note, setNote] = React.useState('');
  const allowed = mayWork(stages, order);
  const trailNotes = React.useMemo(() => orderTrailNotes(order), [order]);

  async function submitNote(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await addNote.mutateAsync({ orderId: order.id, note: trimmed });
      setNote('');
    } catch {
      // The error toast is shown by the hook.
    }
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <MessageSquarePlus className="h-3.5 w-3.5 text-muted-foreground" />
        سجل ملاحظات الفريق
      </p>
      {allowed ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_NOTES.map((quick) => (
              <button
                key={quick}
                type="button"
                disabled={addNote.isPending}
                onClick={() => void submitNote(quick)}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                {quick}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="اكتب ملاحظة…"
              maxLength={2000}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void submitNote(note);
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              disabled={!note.trim() || addNote.isPending}
              onClick={() => void submitNote(note)}
            >
              {addNote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              إضافة
            </Button>
          </div>
        </>
      ) : null}
      {trailNotes.length > 0 ? (
        <div className="border-t border-dashed border-border pt-2">
          <StatusHistoryTimeline entries={trailNotes} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">لا توجد ملاحظات للفريق بعد.</p>
      )}
    </div>
  );
}
