'use client';

import * as React from 'react';
import { Banknote, CheckCircle2, CreditCard, HandCoins, Landmark, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/shared/utils';
import { PAYMENT_METHOD_LABELS, type PosPaymentMethod, type PosSale } from '@/features/pos/domain/types';
import { usePosContext } from '@/features/pos/hooks/use-pos-context';
import { paidAmount, round2 } from '@/features/pos/lib/calc';
import { formatAmount, formatMoney, parseAmount } from '@/features/pos/lib/format';
import { ContactCustomerPicker } from '@/features/pos/components/register/customer-picker';

export const METHOD_ICONS: Record<PosPaymentMethod, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  transfer: Landmark,
  credit: HandCoins,
};

/** The contact a credit payment is owed by: picked here, saved on the open sale. */
function CreditCustomer({ sale }: { sale: PosSale }) {
  const { actions } = usePosContext();
  const partner = sale.customer.kind === 'partner' ? sale.customer : null;
  const [changing, setChanging] = React.useState(false);
  const locked = sale.payments.some((p) => p.method === 'credit' && p.status === 'succeeded');
  if (partner && !changing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
        <span>
          على حساب: <b>{partner.name}</b>
        </span>
        {!locked ? (
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setChanging(true)}>
            تغيير
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Label>العميل من جهات الاتصال</Label>
      <ContactCustomerPicker
        selectedId={partner?.partnerId ?? null}
        onPick={async (c) => {
          const saved = await actions?.setSaleCustomer(sale.id, { kind: 'partner', partnerId: c.id, name: c.name });
          if (saved) setChanging(false);
        }}
      />
    </div>
  );
}

/**
 * Payment of a committed sale. Each payment is saved the moment it is
 * recorded, so nothing is lost if the screen closes. A card on an external
 * terminal starts as a pending attempt *before* the terminal is charged; it
 * then becomes approved (with its code), declined, or "not charged".
 */
export function PaymentDialog({
  saleId,
  sessionId,
  onClose,
  onCompleted,
}: {
  saleId: string | null;
  sessionId: string;
  onClose: () => void;
  onCompleted: (number: string) => void;
}) {
  const { data, actions } = usePosContext();
  const sale = data.sales.find((s) => s.id === saleId) ?? null;
  const enabledMethods = (Object.keys(PAYMENT_METHOD_LABELS) as PosPaymentMethod[]).filter((m) => data.settings.paymentMethods[m]);
  const [method, setMethod] = React.useState<PosPaymentMethod>(enabledMethods[0] ?? 'cash');
  const [split, setSplit] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [reference, setReference] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const paid = sale ? paidAmount(sale.payments) : 0;
  const remaining = sale ? round2(sale.totals.total - paid) : 0;
  const pendingCard = sale?.payments.find((p) => p.kind === 'payment' && (p.status === 'pending' || p.status === 'unknown')) ?? null;

  React.useEffect(() => {
    setAmount(remaining > 0 ? String(remaining) : '');
    setReference('');
    setSplit(false);
  }, [saleId]);

  React.useEffect(() => {
    if (remaining > 0) setAmount(String(remaining));
  }, [remaining]);

  if (!sale || !actions) return null;

  const applied = Math.min(parseAmount(amount) || remaining, remaining);
  const partner = sale.customer.kind === 'partner' ? sale.customer : null;
  const creditAmount = round2(
    sale.payments.filter((p) => p.method === 'credit' && p.status === 'succeeded').reduce((s, p) => s + p.amount, 0),
  );
  const blocked = (m: PosPaymentMethod) => (m === 'transfer' && !reference.trim()) || (m === 'credit' && !partner);
  const payLabel =
    method === 'card'
      ? 'بدء الدفع بالبطاقة'
      : method === 'transfer'
        ? 'تسجيل التحويل'
        : method === 'credit'
          ? 'تسجيل آجل على حساب العميل'
          : 'تسجيل النقد';

  // One action at a time: a second tap while the server answers would pay twice.
  const once = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const pay = (nextMethod: PosPaymentMethod, value: number) =>
    once(async () => {
      const amountDue = round2(Math.min(value, remaining));
      if (amountDue <= 0) return;
      if (nextMethod === 'transfer' && !reference.trim()) return;
      if (nextMethod === 'credit') {
        if (!partner) return;
        await actions.addPayment(sale.id, {
          kind: 'payment',
          method: 'credit',
          amount: amountDue,
          status: 'succeeded',
          reference: null,
          tendered: null,
          change: null,
          sessionId,
        });
        return;
      }
      if (nextMethod === 'card') {
        await actions.addPayment(sale.id, {
          kind: 'payment',
          method: 'card',
          amount: amountDue,
          status: 'pending',
          reference: null,
          tendered: null,
          change: null,
          sessionId,
        });
        return;
      }
      const paid = await actions.addPayment(sale.id, {
        kind: 'payment',
        method: nextMethod,
        amount: amountDue,
        status: 'succeeded',
        reference: nextMethod === 'transfer' ? reference.trim() : null,
        tendered: nextMethod === 'cash' ? amountDue : null,
        change: null,
        sessionId,
      });
      if (paid) setReference('');
    });

  const complete = () =>
    once(async () => {
      const number = await actions.completeSale(sale.id);
      if (number) onCompleted(number);
    });

  const canComplete = remaining === 0 && !pendingCard;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>الدفع</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/50 p-2">
            <div className="text-xs text-muted-foreground">الإجمالي</div>
            <div className="text-lg font-bold tabular-nums">{formatAmount(sale.totals.total)}</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <div className="text-xs text-muted-foreground">المدفوع</div>
            <div className="text-lg font-bold tabular-nums text-success">{formatAmount(paid)}</div>
            {creditAmount > 0 ? (
              <div className="text-xs text-muted-foreground">منه آجل {formatAmount(creditAmount)}</div>
            ) : null}
          </div>
          <div className={cn('rounded-lg p-2', remaining > 0 ? 'bg-warning/10' : 'bg-success/10')}>
            <div className="text-xs text-muted-foreground">المتبقي</div>
            <div className="text-lg font-bold tabular-nums">{formatAmount(remaining)}</div>
          </div>
        </div>

        {sale.payments.length > 0 ? (
          <ul className="space-y-1 rounded-md border border-border p-2 text-xs">
            {sale.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>
                  {PAYMENT_METHOD_LABELS[p.method]}
                  {p.method === 'credit' && partner ? ` · ${partner.name}` : ''}
                  {p.reference ? ` · ${p.reference}` : ''}
                  {p.status === 'pending' ? ' · قيد التنفيذ على الجهاز' : ''}
                  {p.status === 'declined' ? ' · مرفوضة' : ''}
                  {p.status === 'cancelled' ? (p.method === 'credit' ? ' · أُلغي' : ' · لم يُخصم') : ''}
                  {p.change ? ` · الباقي ${formatAmount(p.change)}` : ''}
                </span>
                <span className="flex items-center gap-2">
                  {p.method === 'credit' && p.status === 'succeeded' ? (
                    <button
                      type="button"
                      className="text-destructive hover:underline"
                      disabled={busy}
                      onClick={() => once(() => actions.updatePayment(sale.id, p.id, { status: 'cancelled' }))}
                    >
                      إلغاء
                    </button>
                  ) : null}
                  <span className={cn('tabular-nums', p.status !== 'succeeded' && 'text-muted-foreground line-through')}>
                    {formatAmount(p.amount)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {pendingCard ? (
          <PendingCardPanel saleId={sale.id} paymentId={pendingCard.id} amount={pendingCard.amount} />
        ) : remaining > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={split ? 'outline' : 'default'} onClick={() => setSplit(false)}>
                دفع كامل
              </Button>
              <Button type="button" variant={split ? 'default' : 'outline'} onClick={() => setSplit(true)}>
                تقسيم
              </Button>
            </div>

            {split ? (
              <div className="space-y-2">
                <div className={cn('grid gap-2', enabledMethods.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
                  {enabledMethods.map((m) => {
                    const Icon = METHOD_ICONS[m];
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border p-3 text-sm',
                          method === m ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/40',
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {PAYMENT_METHOD_LABELS[m]}
                      </button>
                    );
                  })}
                </div>
                <Label>جزء من الفاتورة</Label>
                <Input
                  dir="ltr"
                  inputMode="decimal"
                  className="h-11 text-lg"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {method === 'transfer' ? (
                  <Input placeholder="رقم مرجع التحويل" dir="ltr" value={reference} onChange={(e) => setReference(e.target.value)} />
                ) : null}
                {method === 'credit' ? <CreditCustomer sale={sale} /> : null}
                <Button
                  className="w-full"
                  onClick={() => pay(method, applied)}
                  disabled={busy || applied <= 0 || blocked(method)}
                >
                  تسجيل {formatAmount(applied)} · {PAYMENT_METHOD_LABELS[method]}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-center text-sm text-muted-foreground">
                  المبلغ من الفاتورة: <b className="text-foreground">{formatAmount(remaining)}</b>
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {enabledMethods.map((m) => {
                    const Icon = METHOD_ICONS[m];
                    return (
                      <Button key={m} type="button" variant={method === m ? 'default' : 'outline'} className="h-12 justify-start" onClick={() => setMethod(m)}>
                        <Icon className="h-5 w-5" />
                        {PAYMENT_METHOD_LABELS[m]} · {formatAmount(remaining)}
                      </Button>
                    );
                  })}
                </div>
                {method === 'transfer' ? (
                  <Input placeholder="رقم مرجع التحويل" dir="ltr" value={reference} onChange={(e) => setReference(e.target.value)} />
                ) : null}
                {method === 'credit' ? <CreditCustomer sale={sale} /> : null}
                <Button className="w-full" onClick={() => pay(method, remaining)} disabled={busy || blocked(method)}>
                  {payLabel}
                </Button>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            إغلاق (يبقى البيع مفتوحًا)
          </Button>
          <Button onClick={complete} disabled={busy || !canComplete} className="flex-1">
            <CheckCircle2 className="h-4 w-4" />
            إتمام البيع
          </Button>
        </div>
        {remaining > 0 && sale.payments.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {data.settings.paymentMethods.credit
              ? 'أكمل المتبقي بوسيلة أخرى، أو سجّله «آجل» على حساب عميل من جهات الاتصال.'
              : 'أكمل المتبقي بوسيلة أخرى. البيع الآجل غير مفعّل في إعدادات نقاط البيع.'}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PendingCardPanel({ saleId, paymentId, amount }: { saleId: string; paymentId: string; amount: number }) {
  const { actions, userName, currency } = usePosContext();
  const [code, setCode] = React.useState('');
  if (!actions) return null;
  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Loader2 className="h-4 w-4 animate-spin" />
        نفّذ {formatMoney(amount, currency)} على جهاز الدفع
      </div>
      <div className="space-y-1">
        <Label className="text-xs">رقم الموافقة من الجهاز</Label>
        <Input autoFocus dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} className="h-10" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button
          disabled={!code.trim()}
          onClick={() => {
            actions.updatePayment(saleId, paymentId, { status: 'succeeded', reference: code.trim() });
            toast.success('تمت الموافقة');
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
          تمت
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            actions.updatePayment(saleId, paymentId, { status: 'declined' });
            toast.error('رُفضت البطاقة');
          }}
        >
          <XCircle className="h-4 w-4" />
          رُفضت
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            actions.updatePayment(saleId, paymentId, { status: 'cancelled' });
            actions.logAudit(userName, 'payment_not_charged', saleId);
          }}
        >
          لم يُخصم
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        لا تبدأ محاولة جديدة قبل حسم هذه. إن لم تتأكد من النتيجة، راجع سجل الجهاز، أو اترك البيع مفتوحًا ليحسمه المشرف.
      </p>
    </div>
  );
}
