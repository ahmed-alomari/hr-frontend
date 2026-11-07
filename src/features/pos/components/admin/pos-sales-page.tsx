'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Ban, CheckCircle2, History, Printer, Search, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  customerLabel,
  MONEY_METHODS,
  PAYMENT_METHOD_LABELS,
  resolvePosInvoiceStyle,
  SALE_STATUS_LABELS,
  type PosPaymentMethod,
  type PosSale,
  type PosSaleStatus,
} from '@/features/pos/domain/types';
import { posRoutes } from '@/features/pos/constants/routes';
import { usePosContext } from '@/features/pos/hooks/use-pos-context';
import { paidAmount, priceLines, round2, saleTaxSettings } from '@/features/pos/lib/calc';
import { formatDateTime, formatMoney, parseAmount } from '@/features/pos/lib/format';
import { saleToPrintable } from '@/features/pos/lib/receipt';
import { paymentSummaryOf } from '@/features/pos/lib/sales-report';
import { Badge } from '@/components/ui/badge';
import {
  EmptyState,
  PosGate,
  PrintPreviewDialog,
  SaleStatusBadge,
} from '@/features/pos/components/shared/pos-shared';

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'قيد التنفيذ',
  succeeded: 'ناجحة',
  declined: 'مرفوضة',
  cancelled: 'لم يُخصم',
  unknown: 'مجهولة النتيجة',
};

/** Resolution of a sale that holds money but did not complete (or still waits). */
function ResolvePanel({ sale, onDone }: { sale: PosSale; onDone: () => void }) {
  const { data, actions, userName, currency, can } = usePosContext();
  const paid = paidAmount(sale.payments);
  const refunded = round2(
    sale.payments.filter((p) => p.kind === 'refund' && p.status === 'succeeded').reduce((a, p) => a + p.amount, 0),
  );
  const net = round2(paid - refunded);
  const pending = sale.payments.filter((p) => p.kind === 'payment' && (p.status === 'pending' || p.status === 'unknown'));
  const openSession = data.sessions.find((s) => s.registerId === sale.registerId && s.status === 'open');
  const [lateRef, setLateRef] = React.useState('');
  const [refundMethod, setRefundMethod] = React.useState<PosPaymentMethod>('cash');
  const [refundRef, setRefundRef] = React.useState('');
  const [quantities, setQuantities] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(sale.lines.map((l) => [l.id, l.quantity])),
  );
  const [reason, setReason] = React.useState('');
  const canResolve = can('pos.exceptions.resolve');

  if (!actions) return null;
  const difference = round2(sale.totals.total - net);

  const revised = priceLines(
    sale.lines.filter((l) => (quantities[l.id] ?? 0) > 0).map((l) => ({ ...l, quantity: quantities[l.id] ?? l.quantity })),
    sale.orderDiscount,
    // The tax the sale was made with, not today's settings.
    saleTaxSettings(sale.lines, data.settings.tax),
  );
  const revisionChanged = sale.lines.some((l) => (quantities[l.id] ?? l.quantity) !== l.quantity);

  return (
    <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
      <div className="font-semibold">معالجة المستند</div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>الإجمالي: <b>{formatMoney(sale.totals.total, currency)}</b></div>
        <div>المحصّل الصافي: <b>{formatMoney(net, currency)}</b></div>
        <div>الفرق: <b>{formatMoney(difference, currency)}</b></div>
      </div>

      {pending.map((p) => (
        <div key={p.id} className="space-y-2 rounded-md border border-border bg-card p-2">
          <div className="text-xs">
            محاولة {PAYMENT_METHOD_LABELS[p.method]} بمبلغ {formatMoney(p.amount, currency)} — {PAYMENT_STATUS_LABELS[p.status]}.
            الحجز باقٍ حتى تُحسم. راجع سجل جهاز الدفع أولًا.
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-40 flex-1 space-y-1">
              <Label className="text-xs">رقم الموافقة من الجهاز</Label>
              <Input value={lateRef} onChange={(e) => setLateRef(e.target.value)} className="h-8" dir="ltr" />
            </div>
            <Button
              size="sm"
              disabled={!lateRef.trim() || !canResolve}
              onClick={() => {
                actions.updatePayment(sale.id, p.id, { status: 'succeeded', reference: lateRef.trim(), lateEntryReason: 'تسجيل متأخر بعد انقطاع' });
                actions.logAudit(userName, 'payment_late_entry', `${sale.id} ${lateRef.trim()}`);
                toast.success('سُجّلت الدفعة');
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              خُصم — سجّل المرجع
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canResolve}
              onClick={() => {
                actions.updatePayment(sale.id, p.id, { status: 'cancelled' });
                actions.logAudit(userName, 'payment_not_charged', sale.id);
                toast.success('سُجّل أن المبلغ لم يُخصم');
              }}
            >
              لم يُخصم
            </Button>
          </div>
        </div>
      ))}

      {sale.status === 'payment_exception' ? (
        <div className="space-y-2 rounded-md border border-border bg-card p-2">
          <div className="text-xs font-semibold">استبدال أو تعديل الأصناف</div>
          <p className="text-xs text-muted-foreground">النسخة الحالية تُحفظ، والأسعار من اللقطة الأصلية. فرق المبلغ يُعالج بدفعة أو رد مستقل.</p>
          {sale.lines.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate">{l.name}{l.variantName ? ` — ${l.variantName}` : ''}</span>
              <Input
                className="h-7 w-20"
                dir="ltr"
                inputMode="numeric"
                value={String(quantities[l.id] ?? l.quantity)}
                onChange={(e) => setQuantities((q) => ({ ...q, [l.id]: Math.max(0, Math.round(parseAmount(e.target.value))) }))}
              />
            </div>
          ))}
          {revisionChanged ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-40 flex-1 space-y-1">
                <Label className="text-xs">السبب</Label>
                <Input className="h-8" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <span className="text-xs">الإجمالي الجديد {formatMoney(revised.totals.total, currency)}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={!reason.trim() || !canResolve || revised.lines.length === 0}
                onClick={() => {
                  actions.reviseSale(sale.id, revised.lines, revised.totals, reason.trim(), userName);
                  toast.success('حُفظت نسخة معدّلة، والسابقة في السجل');
                }}
              >
                حفظ النسخة المعدّلة
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {sale.status === 'payment_exception' && difference !== 0 ? (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card p-2">
          <div className="space-y-1">
            <Label className="text-xs">
              {difference > 0
                ? `تحصيل الفرق ${formatMoney(difference, currency)}`
                : `رد الزيادة ${formatMoney(-difference, currency)}`}
            </Label>
            <Select value={refundMethod} onValueChange={(v) => setRefundMethod(v as PosPaymentMethod)}>
              <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONEY_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input className="h-8 w-40" placeholder="المرجع" dir="ltr" value={refundRef} onChange={(e) => setRefundRef(e.target.value)} />
          <Button
            size="sm"
            disabled={!openSession || !canResolve || (refundMethod !== 'cash' && !refundRef.trim())}
            onClick={async () => {
              const paid = await actions.addPayment(sale.id, {
                kind: difference > 0 ? 'payment' : 'refund',
                method: refundMethod,
                amount: Math.abs(difference),
                status: 'succeeded',
                reference: refundRef.trim() || null,
                tendered: null,
                change: null,
                sessionId: openSession!.id,
              });
              if (!paid) return;
              toast.success(difference > 0 ? 'سُجّلت الدفعة' : 'سُجّل الرد');
            }}
          >
            {difference > 0 ? 'تسجيل الدفعة' : 'تسجيل الرد'}
          </Button>
          {!openSession ? <span className="text-xs text-warning">يلزم وردية مفتوحة على نقطة البيع لتسجيل حركة مال.</span> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!canResolve || difference !== 0 || pending.length > 0 || sale.lines.length === 0}
          onClick={async () => {
            const number = await actions.completeSale(sale.id);
            if (!number) return;
            void actions.logAudit(userName, 'exception_resolved', `${number} اكتمل`);
            toast.success(`اكتمل البيع ${number}`);
            onDone();
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
          إكمال البيع
        </Button>
        {sale.status === 'awaiting_payment' ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`${posRoutes.register}?register=${sale.registerId}&sale=${sale.id}`}>استئناف في شاشة الكاشير</Link>
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          disabled={!canResolve || net !== 0 || pending.length > 0}
          onClick={async () => {
            if (!(await actions.cancelSale(sale.id, 'إلغاء من المعالجة بعد تصفير المال', userName))) return;
            toast.success('أُلغي المستند وحُرّر الحجز');
            onDone();
          }}
        >
          <Ban className="h-4 w-4" />
          إلغاء المستند
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        لا يُلغى مستند فيه مال غير مردود، ولا يُكمل بفرق أو بمحاولة معلّقة.
      </p>
    </div>
  );
}

function SaleDialog({ sale, onClose }: { sale: PosSale | null; onClose: () => void }) {
  const { data, currency, actions, userName, can } = usePosContext();
  const [printOpen, setPrintOpen] = React.useState(false);
  if (!sale) return null;
  const register = data.registers.find((r) => r.id === sale.registerId);
  const returns = data.returns.filter((r) => r.saleId === sale.id);
  const collections = data.collections.filter((c) => c.saleId === sale.id);
  const needsAction = sale.status === 'payment_exception' || sale.status === 'awaiting_payment';

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {sale.number ?? 'بلا رقم بعد'}
              <SaleStatusBadge status={sale.status} />
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
              <span>العميل: {customerLabel(sale.customer)}</span>
              <span>نقطة البيع: {register?.name ?? '—'}</span>
              <span>الكاشير: {sale.cashierName}</span>
              <span>التاريخ: {formatDateTime(sale.completedAt ?? sale.createdAt)}</span>
              <span>المخزون: {sale.stockSource === 'inventory' ? 'من المخازن' : 'دون تتبع'}</span>
              <span className="col-span-2 sm:col-span-4" dir="ltr">pos:{sale.id}</span>
            </div>
            {sale.exceptionReason ? <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{sale.exceptionReason}</div> : null}

            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-1 text-start">الصنف</th>
                  <th className="text-start">الكمية</th>
                  <th className="text-start">مرتجع</th>
                  <th className="text-start">السعر</th>
                  <th className="text-start">الخصم</th>
                  <th className="text-start">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {sale.lines.map((l) => (
                  <tr key={l.id} className="border-b border-border/60">
                    <td className="py-1">{l.name}{l.variantName ? ` — ${l.variantName}` : ''}</td>
                    <td>{l.quantity}</td>
                    <td>{l.returnedQuantity || '—'}</td>
                    <td>{formatMoney(l.unitPrice)}</td>
                    <td>{l.discountAmount ? formatMoney(l.discountAmount) : '—'}</td>
                    <td>{formatMoney(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap justify-end gap-4 text-xs">
              <span>المجموع {formatMoney(sale.totals.subtotal)}</span>
              <span>الخصم {formatMoney(sale.totals.discount)}</span>
              <span>الضريبة {formatMoney(sale.totals.tax)}</span>
              <b>الإجمالي {formatMoney(sale.totals.total, currency)}</b>
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold">المدفوعات</div>
              {sale.payments.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا مدفوعات.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {sale.payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span>
                        {p.kind === 'refund' ? 'رد · ' : ''}
                        {PAYMENT_METHOD_LABELS[p.method]} · {PAYMENT_STATUS_LABELS[p.status]}
                        {p.reference ? ` · ${p.reference}` : ''}
                        {p.lateEntryReason ? ' · تسجيل متأخر' : ''}
                      </span>
                      <span>{formatMoney(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {sale.revisions.length > 0 ? (
              <div>
                <div className="mb-1 flex items-center gap-1 text-xs font-semibold">
                  <History className="h-3.5 w-3.5" />
                  النسخ السابقة
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {sale.revisions.map((r, i) => (
                    <li key={i}>
                      {formatDateTime(r.at)} · {r.by} · {r.reason} · كان الإجمالي {formatMoney(r.totals.total)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {sale.credit ? (
              <div className="space-y-1 rounded-md border border-border p-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">آجل على {sale.credit.partnerName}</span>
                  {sale.credit.due > 0 ? (
                    <Badge variant="warning">المتبقي {formatMoney(sale.credit.due, currency)}</Badge>
                  ) : (
                    <Badge variant="success">مسدّدة</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 text-muted-foreground">
                  <span>آجل {formatMoney(sale.credit.amount)}</span>
                  <span>حُصّل {formatMoney(sale.credit.collected)}</span>
                  <span>مرتجع إلى الحساب {formatMoney(sale.credit.returned)}</span>
                </div>
                {collections.length > 0 ? (
                  <ul className="space-y-0.5 border-t border-border/60 pt-1">
                    {collections.map((c) => (
                      <li key={c.id} className="flex justify-between gap-2">
                        <span>
                          تحصيل · {PAYMENT_METHOD_LABELS[c.method]}
                          {c.reference ? ` · ${c.reference}` : ''} · {formatDateTime(c.createdAt)} · {c.createdBy}
                          {c.sessionId ? '' : ' · خارج الوردية'}
                        </span>
                        <span>{formatMoney(c.amount)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {returns.length > 0 ? (
              <div className="text-xs">
                <span className="font-semibold">المرتجعات: </span>
                {returns.map((r) => r.number).join('، ')}
              </div>
            ) : null}

            {needsAction ? <ResolvePanel sale={sale} onDone={onClose} /> : null}
          </div>
          {sale.status === 'completed' ? (
            <div className="flex flex-wrap justify-end gap-2">
              {can('pos.return') ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`${posRoutes.returns}?sale=${sale.id}`}>
                    <Undo2 className="h-4 w-4" />
                    مرتجع
                  </Link>
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => setPrintOpen(true)}>
                <Printer className="h-4 w-4" />
                إعادة طباعة
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <PrintPreviewDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        title="إعادة طباعة المستند"
        invoiceStyle={resolvePosInvoiceStyle(register, data.settings)}
        document={saleToPrintable(sale, register, {
          copy: true,
          invoiceStyle: resolvePosInvoiceStyle(register, data.settings),
        })}
        onPrinted={() => actions?.logAudit(userName, 'receipt_reprint', sale.number ?? sale.id)}
      />
    </>
  );
}

function Sales() {
  const { data, currency } = usePosContext();
  const params = useSearchParams();
  const [status, setStatus] = React.useState<PosSaleStatus | 'all'>(
    (params.get('status') as PosSaleStatus | null) ?? 'all',
  );
  const [registerId, setRegisterId] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const sales = data.sales.filter(
    (s) =>
      (status === 'all' || s.status === status) &&
      (registerId === 'all' || s.registerId === registerId) &&
      (!q || (s.number ?? '').toLowerCase().includes(q) || (s.customer.kind !== 'walk_in' && s.customer.name.toLowerCase().includes(q))),
  );
  const selected = data.sales.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <SetPageTitle titleAr="مبيعات نقاط البيع" iconName="Receipt" />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-9 ps-9" placeholder="رقم الإيصال أو اسم العميل" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as PosSaleStatus | 'all')}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {(Object.keys(SALE_STATUS_LABELS) as PosSaleStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{SALE_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={registerId} onValueChange={setRegisterId}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل نقاط البيع</SelectItem>
            {data.registers.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sales.length === 0 ? (
        <EmptyState title="لا مبيعات" description="تظهر هنا مستندات البيع من شاشة الكاشير." />
      ) : (
        <>
        {/* Phone: one card per sale. */}
        <div className="space-y-2 md:hidden">
          {sales.map((s) => (
            <button
              key={s.id}
              type="button"
              className="w-full rounded-xl border border-border bg-card p-3 text-start shadow-soft active:bg-muted/40"
              onClick={() => setSelectedId(s.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold" dir="ltr">{s.number ?? '—'}</span>
                <SaleStatusBadge status={s.status} />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {data.registers.find((r) => r.id === s.registerId)?.name ?? '—'} · {s.cashierName}
                </span>
                <span className="shrink-0">{formatDateTime(s.completedAt ?? s.createdAt)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-base font-bold tabular-nums">{formatMoney(s.totals.total, currency)}</span>
                <span className="text-xs text-muted-foreground">{paymentSummaryOf(s)}</span>
              </div>
              {(s.credit?.due ?? 0) > 0 ? (
                <div className="mt-1 text-xs text-warning">
                  على {s.credit!.partnerName}: {formatMoney(s.credit!.due, currency)}
                </div>
              ) : null}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft max-md:hidden">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start">الرقم</th>
                <th className="px-3 py-2 text-start">التاريخ</th>
                <th className="px-3 py-2 text-start">نقطة البيع</th>
                <th className="px-3 py-2 text-start">الكاشير</th>
                <th className="px-3 py-2 text-start">الإجمالي</th>
                <th className="px-3 py-2 text-start">الدفع</th>
                <th className="px-3 py-2 text-start">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr
                  key={s.id}
                  className="cursor-pointer border-t border-border hover:bg-muted/40"
                  onClick={() => setSelectedId(s.id)}
                >
                  <td className="px-3 py-2 font-medium" dir="ltr">{s.number ?? '—'}</td>
                  <td className="px-3 py-2">{formatDateTime(s.completedAt ?? s.createdAt)}</td>
                  <td className="px-3 py-2">{data.registers.find((r) => r.id === s.registerId)?.name ?? '—'}</td>
                  <td className="px-3 py-2">{s.cashierName}</td>
                  <td className="px-3 py-2 tabular-nums">{formatMoney(s.totals.total, currency)}</td>
                  <td className="px-3 py-2 text-xs">
                    {paymentSummaryOf(s)}
                    {(s.credit?.due ?? 0) > 0 ? (
                      <span className="block text-warning">
                        على {s.credit!.partnerName}: {formatMoney(s.credit!.due, currency)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2"><SaleStatusBadge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      <SaleDialog sale={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

export function PosSalesPage() {
  return (
    <PosGate permission="pos.sales.read">
      <Sales />
    </PosGate>
  );
}
