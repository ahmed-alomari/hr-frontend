'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, MonitorSmartphone, Play, Plus } from 'lucide-react';
import { PhoneStatsFold } from '@/components/layouts/phone-fold';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { posRoutes } from '@/features/pos/constants/routes';
import { PosDataScope, usePosContext } from '@/features/pos/hooks/use-pos-context';
import { round2 } from '@/features/pos/lib/calc';
import { formatDateTime, formatMoney } from '@/features/pos/lib/format';
import { EmptyState, PosGate, StatTile } from '@/features/pos/components/shared/pos-shared';

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

function Overview() {
  const { data, currency, actions, can } = usePosContext();
  const today = data.sales.filter((s) => s.status === 'completed' && isToday(s.completedAt));
  const todayTotal = round2(today.reduce((a, s) => a + s.totals.total, 0));
  const todayReturns = round2(
    data.returns.filter((r) => isToday(r.createdAt)).reduce((a, r) => a + r.refund.amount, 0),
  );
  const openSessions = data.sessions.filter((s) => s.status === 'open');
  const exceptions = data.sales.filter((s) => s.status === 'payment_exception');
  const awaiting = data.sales.filter((s) => s.status === 'awaiting_payment');
  const pendingRefunds = data.returns.filter((r) => r.refund.status === 'pending');

  const createFirstRegister = () => {
    void actions?.saveRegister({
      name: 'الكاشير 1',
      code: 'POS1',
      branchId: null,
      branchName: null,
      warehouseName: null,
      isActive: true,
    });
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <SetPageTitle titleAr="نقاط البيع" iconName="ShoppingCart" />

      <PhoneStatsFold summary={<>اليوم {formatMoney(todayTotal, currency)}</>}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="مبيعات اليوم" value={formatMoney(todayTotal, currency)} hint={`${today.length} مستند`} />
          <StatTile label="مرتجعات اليوم" value={formatMoney(todayReturns, currency)} />
          <StatTile label="ورديات مفتوحة" value={String(openSessions.length)} />
          <StatTile label="متوسط الفاتورة" value={formatMoney(today.length ? todayTotal / today.length : 0, currency)} />
        </div>
      </PhoneStatsFold>

      {exceptions.length + awaiting.length + pendingRefunds.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/5 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-warning" />
            تحتاج متابعة
          </div>
          <ul className="space-y-1 text-sm">
            {exceptions.length > 0 ? (
              <li>
                <Link className="text-primary hover:underline" href={`${posRoutes.sales}?status=payment_exception`}>
                  {exceptions.length} استثناء دفع: مبلغ محصّل وبيع لم يكتمل
                </Link>
              </li>
            ) : null}
            {awaiting.length > 0 ? (
              <li>
                <Link className="text-primary hover:underline" href={`${posRoutes.sales}?status=awaiting_payment`}>
                  {awaiting.length} بيع بانتظار الدفع
                </Link>
              </li>
            ) : null}
            {pendingRefunds.length > 0 ? (
              <li>
                <Link className="text-primary hover:underline" href={posRoutes.returns}>
                  {pendingRefunds.length} مرتجع لم يُسجَّل رد ماله بعد
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">نقاط البيع</h2>
          {can('pos.devices.manage') ? (
            <Button asChild size="sm" variant="outline">
              <Link href={posRoutes.registers}>
                <MonitorSmartphone className="h-4 w-4" />
                إدارة نقاط البيع
              </Link>
            </Button>
          ) : null}
        </div>

        {data.registers.length === 0 ? (
          <EmptyState
            title="لا توجد نقطة بيع بعد"
            description="ابدأ بنقطة بيع واحدة بالإعدادات الافتراضية، وأضف الفروع والأجهزة لاحقًا عند الحاجة."
            action={
              can('pos.devices.manage') ? (
                <Button size="sm" onClick={createFirstRegister}>
                  <Plus className="h-4 w-4" />
                  إنشاء أول نقطة بيع
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.registers.map((r) => {
              const session = openSessions.find((s) => s.registerId === r.id);
              return (
                <div key={r.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-soft">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.code} · {r.branchName ?? 'بدون فرع'}
                      </div>
                    </div>
                    {!r.isActive ? (
                      <Badge variant="subtle">موقوفة</Badge>
                    ) : session ? (
                      <Badge variant="success">وردية مفتوحة</Badge>
                    ) : (
                      <Badge variant="outline">مغلقة</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {session ? `${session.cashierName} · منذ ${formatDateTime(session.openedAt)}` : 'لا وردية مفتوحة'}
                  </div>
                  <Button asChild size="sm" disabled={!r.isActive || !can('pos.sell')}>
                    <Link href={`${posRoutes.register}?register=${r.id}`}>
                      <Play className="h-4 w-4" />
                      فتح شاشة الكاشير
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export function PosOverviewPage() {
  return (
    <PosDataScope days={2}>
      <PosGate>
        <Overview />
      </PosGate>
    </PosDataScope>
  );
}
