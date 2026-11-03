'use client';

import * as React from 'react';
import { Hand, Loader2, UserCheck, UserRound, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  HANDLER_NONE,
  OrderHandlerSelect,
} from '@/features/ecommerce/admin/orders/components/order-handler-select';
import { useAssignOrder } from '@/features/ecommerce/admin/orders/hooks/use-order-stages';
import {
  ORDER_STAGE_SCOPE_LABELS,
  type OrderStage,
  type OrderStagesContext,
} from '@/features/ecommerce/admin/orders/lib/api/order-stages';
import {
  ORDER_STAGE_LABELS_AR,
  canAssignAnyone,
  canTakeOrder,
  isOrderStage,
  isViewOnlyOrder,
  stageScopeOf,
} from '@/features/ecommerce/admin/orders/lib/order-stage-access';
import type { Order } from '@/features/ecommerce/domain/types/order';
import { formatDisplayDateTime } from '@/shared/utils';

type Props = {
  order: Order;
  companyId: string;
  stages: OrderStagesContext | null | undefined;
};

/**
 * Who handles the order in its stage: take an unassigned order of your
 * stage, give back your own, or (who may assign) give it to a handler.
 */
export function OrderAssignmentPanel({ order, companyId, stages }: Props) {
  const assign = useAssignOrder(companyId);
  const [target, setTarget] = React.useState('');
  const open = isOrderStage(order.status);
  const mine = Boolean(stages && order.assignedUserId === stages.userId);
  const mayAssign = open && canAssignAnyone(stages);
  const mayTake = open && canTakeOrder(stages, order);
  const myScope = open && stages?.enabled ? stageScopeOf(stages, order.status as OrderStage) : null;

  const run = (assigneeId: string | null) =>
    void assign
      .mutateAsync({ orderId: order.id, assigneeId })
      .then(() => setTarget(''))
      .catch(() => undefined);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">المسؤول عن الطلب</h3>
        {open ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">
              مرحلة: {ORDER_STAGE_LABELS_AR[order.status as keyof typeof ORDER_STAGE_LABELS_AR]}
            </Badge>
            {myScope ? (
              <Badge variant="subtle" title="نطاق رؤيتك في هذه المرحلة (من إعدادات المراحل)">
                نطاقك: {ORDER_STAGE_SCOPE_LABELS[myScope]}
              </Badge>
            ) : isViewOnlyOrder(stages, order) ? (
              <Badge variant="subtle" title="صلاحيتك في هذه المرحلة من إعدادات مراحل الطلبات">
                عرض فقط
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/25 px-3 py-2.5">
        {order.assignedUserId ? (
          <>
            <UserCheck className="h-4 w-4 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {order.assignedUserName ?? 'مستخدم'}
                {mine ? <span className="ms-1 text-xs font-normal text-primary">(أنت)</span> : null}
              </p>
              {order.assignedAt ? (
                <p className="text-xs text-muted-foreground">
                  {open ? 'أُسند' : 'آخر من تعامل معه'} · {formatDisplayDateTime(order.assignedAt)}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <UserRound className="h-4 w-4 text-muted-foreground" />
            <p className="flex-1 text-sm text-muted-foreground">
              {open ? 'غير مسند — يستلمه أحد أعضاء المرحلة' : 'لم يُسند لأحد'}
            </p>
          </>
        )}
        {mayTake ? (
          <Button
            type="button"
            size="sm"
            className="gap-1.5 max-sm:h-10 max-sm:w-full"
            disabled={assign.isPending}
            onClick={() => run(stages!.userId)}
          >
            {assign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
            استلام الطلب
          </Button>
        ) : null}
        {open && mine ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 max-sm:h-10 max-sm:w-full"
            disabled={assign.isPending}
            onClick={() => run(null)}
          >
            {assign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
            إرجاع للمرحلة
          </Button>
        ) : null}
      </div>

      {mayAssign && isOrderStage(order.status) ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <OrderHandlerSelect
              companyId={companyId}
              stage={order.status}
              value={target}
              onChange={setTarget}
              excludeUserId={order.assignedUserId}
              allowNone={Boolean(order.assignedUserId)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="max-sm:h-10"
            disabled={!target || assign.isPending}
            onClick={() => run(target === HANDLER_NONE ? null : target)}
          >
            {assign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {order.assignedUserId ? 'إعادة الإسناد' : 'إسناد'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
