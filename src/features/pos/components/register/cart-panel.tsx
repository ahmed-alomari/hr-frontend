'use client';

import * as React from 'react';
import { Minus, PauseCircle, Percent, Plus, Trash2, User, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/shared/utils';
import { customerLabel as customerLabelOf, type PosCustomer, type PosDiscount, type PosSaleLine, type PosSaleTotals } from '@/features/pos/domain/types';
import { formatAmount, formatMoney, parseAmount } from '@/features/pos/lib/format';
import { ContactCustomerPicker } from '@/features/pos/components/register/customer-picker';

export type CartState = {
  lines: PosSaleLine[];
  orderDiscount: PosDiscount | null;
  customer: PosCustomer;
};

function DiscountEditor({ value, onChange }: { value: PosDiscount | null; onChange: (d: PosDiscount | null) => void }) {
  const type = value?.type ?? 'percent';
  return (
    <div className="flex gap-2">
      <div className="flex overflow-hidden rounded-md border border-border">
        {(['percent', 'amount'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ type: t, value: value?.value ?? 0 })}
            className={cn('px-3 text-sm', type === t ? 'bg-primary text-primary-foreground' : 'bg-background')}
          >
            {t === 'percent' ? '%' : 'مبلغ'}
          </button>
        ))}
      </div>
      <Input
        dir="ltr"
        inputMode="decimal"
        className="h-9"
        value={value?.value ? String(value.value) : ''}
        placeholder="0"
        onChange={(e) => {
          const v = parseAmount(e.target.value);
          onChange(v > 0 ? { type, value: v } : null);
        }}
      />
    </div>
  );
}

/** Edit one line: quantity, discount, and price when allowed. */
export function LineEditDialog({
  line,
  canDiscount,
  canOverridePrice,
  onClose,
  onSave,
}: {
  line: PosSaleLine | null;
  canDiscount: boolean;
  canOverridePrice: boolean;
  onClose: () => void;
  onSave: (patch: { quantity: number; discount: PosDiscount | null; unitPrice: number }) => void;
}) {
  const [quantity, setQuantity] = React.useState('1');
  const [discount, setDiscount] = React.useState<PosDiscount | null>(null);
  const [price, setPrice] = React.useState('0');
  React.useEffect(() => {
    if (!line) return;
    setQuantity(String(line.quantity));
    setDiscount(line.discount);
    setPrice(String(line.unitPrice));
  }, [line]);
  if (!line) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{line.name}{line.variantName ? ` — ${line.variantName}` : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>الكمية</Label>
            <Input dir="ltr" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-10 text-lg" />
          </div>
          {canDiscount ? (
            <div className="space-y-1.5">
              <Label>خصم السطر</Label>
              <DiscountEditor value={discount} onChange={setDiscount} />
            </div>
          ) : null}
          {canOverridePrice ? (
            <div className="space-y-1.5">
              <Label>السعر (سعر الكتالوج {formatAmount(line.sourcePrice)})</Label>
              <Input dir="ltr" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="h-9" />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            onClick={() =>
              onSave({
                quantity: Math.max(1, Math.round(parseAmount(quantity))),
                discount,
                unitPrice: canOverridePrice ? Math.max(0, parseAmount(price)) : line.unitPrice,
              })
            }
          >
            تطبيق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrderDiscountDialog({
  open,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  value: PosDiscount | null;
  onClose: () => void;
  onSave: (d: PosDiscount | null) => void;
}) {
  const [draft, setDraft] = React.useState<PosDiscount | null>(value);
  React.useEffect(() => setDraft(value), [value, open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>خصم على الفاتورة</DialogTitle>
        </DialogHeader>
        <DiscountEditor value={draft} onChange={setDraft} />
        <p className="text-xs text-muted-foreground">يُوزَّع على السطور حسب قيمتها، ويُحفظ نصيب كل سطر للمرتجع.</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onSave(null)}>إزالة الخصم</Button>
          <Button onClick={() => onSave(draft)}>تطبيق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerDialog({
  open,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  value: PosCustomer;
  onClose: () => void;
  onSave: (c: PosCustomer) => void;
}) {
  const named = value.kind === 'named' ? value : null;
  const [mode, setMode] = React.useState<'contact' | 'named'>(value.kind === 'named' ? 'named' : 'contact');
  const [name, setName] = React.useState(named?.name ?? '');
  const [phone, setPhone] = React.useState(named?.phone ?? '');
  const [taxNumber, setTaxNumber] = React.useState(named?.taxNumber ?? '');
  React.useEffect(() => {
    setMode(value.kind === 'named' ? 'named' : 'contact');
    setName(named?.name ?? '');
    setPhone(named?.phone ?? '');
    setTaxNumber(named?.taxNumber ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>العميل</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button variant={mode === 'contact' ? 'default' : 'outline'} onClick={() => setMode('contact')}>
            من جهات الاتصال
          </Button>
          <Button variant={mode === 'named' ? 'default' : 'outline'} onClick={() => setMode('named')}>
            اسم على الإيصال فقط
          </Button>
        </div>
        {mode === 'contact' ? (
          <>
            {value.kind === 'partner' ? (
              <p className="text-sm">
                المختار: <b>{value.name}</b>
              </p>
            ) : null}
            <ContactCustomerPicker
              selectedId={value.kind === 'partner' ? value.partnerId : null}
              onPick={(c) =>
                onSave({ kind: 'partner', partnerId: c.id, name: c.name, phone: c.phone ?? undefined, taxNumber: c.taxNumber ?? undefined })
              }
            />
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">يُطبع على الإيصال فقط، دون جهة اتصال، ولا يُباع له آجلًا.</p>
            <div className="space-y-2">
              <Input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="الجوال" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Input placeholder="الرقم الضريبي (للمنشآت)" dir="ltr" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onSave({ kind: 'walk_in' })}>عميل عابر</Button>
          {mode === 'named' ? (
            <Button
              disabled={!name.trim()}
              onClick={() =>
                onSave({ kind: 'named', name: name.trim(), phone: phone.trim() || undefined, taxNumber: taxNumber.trim() || undefined })
              }
            >
              حفظ
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Supervisor confirmation on the same device (the backend will verify the supervisor). */
export function ApprovalDialog({
  request,
  onClose,
}: {
  request: { title: string; detail: string; onApprove: (supervisor: string) => void } | null;
  onClose: () => void;
}) {
  const [supervisor, setSupervisor] = React.useState('');
  React.useEffect(() => setSupervisor(''), [request]);
  if (!request) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{request.detail}</p>
        <Input placeholder="اسم المشرف الموافق" value={supervisor} onChange={(e) => setSupervisor(e.target.value)} />
        <p className="text-xs text-muted-foreground">في التشغيل الفعلي يُدخل المشرف رمزه، وتتحقق الخلفية من صلاحيته.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>رفض</Button>
          <Button
            disabled={!supervisor.trim()}
            onClick={() => {
              request.onApprove(supervisor.trim());
              onClose();
            }}
          >
            موافقة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CartPanel({
  cart,
  totals,
  currency,
  locked,
  lockedLabel,
  canDiscount,
  onQuantity,
  onEditLine,
  onRemoveLine,
  onCustomer,
  onOrderDiscount,
  onHold,
  onVoid,
  onPay,
  header,
  className,
}: {
  cart: CartState;
  totals: PosSaleTotals;
  currency: string | null;
  locked: boolean;
  lockedLabel?: React.ReactNode;
  canDiscount: boolean;
  onQuantity: (lineId: string, delta: number) => void;
  onEditLine: (line: PosSaleLine) => void;
  onRemoveLine: (lineId: string) => void;
  onCustomer: () => void;
  onOrderDiscount: () => void;
  onHold: () => void;
  onVoid: () => void;
  onPay: () => void;
  /** Above the customer row (the phone's way back to the products). */
  header?: React.ReactNode;
  className?: string;
}) {
  const empty = cart.lines.length === 0;
  const customerLabel = customerLabelOf(cart.customer);

  return (
    <div className={cn('flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-soft', className)}>
      {header}
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <button
          type="button"
          onClick={onCustomer}
          disabled={locked}
          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted disabled:opacity-60"
        >
          <User className="h-4 w-4" />
          {customerLabel}
        </button>
        <span className="text-xs text-muted-foreground">{cart.lines.reduce((a, l) => a + l.quantity, 0)} قطعة</span>
      </div>

      {lockedLabel ? <div className="border-b border-border bg-warning/10 px-3 py-2 text-xs">{lockedLabel}</div> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex h-full min-h-40 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            امسح صنفًا أو اختره من القائمة
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {cart.lines.map((l) => (
              <li key={l.id} className="flex items-start gap-2 p-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-start"
                  disabled={locked}
                  onClick={() => onEditLine(l)}
                >
                  <div className="truncate text-sm font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.variantName ? `${l.variantName} · ` : ''}
                    {formatAmount(l.unitPrice)}
                    {l.unitPrice !== l.sourcePrice ? ' (سعر معدّل)' : ''}
                    {l.discountAmount > 0 ? ` · خصم ${formatAmount(l.discountAmount)}` : ''}
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" disabled={locked} onClick={() => onQuantity(l.id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-7 text-center text-sm tabular-nums">{l.quantity}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" disabled={locked} onClick={() => onQuantity(l.id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="w-20 text-end text-sm font-semibold tabular-nums">{formatAmount(l.total)}</div>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={locked} onClick={() => onRemoveLine(l.id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1 border-t border-border p-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>المجموع</span>
          <span className="tabular-nums">{formatAmount(totals.subtotal)}</span>
        </div>
        {totals.discount > 0 ? (
          <div className="flex justify-between text-muted-foreground">
            <span>الخصم</span>
            <span className="tabular-nums">−{formatAmount(totals.discount)}</span>
          </div>
        ) : null}
        {totals.tax > 0 ? (
          <div className="flex justify-between text-muted-foreground">
            <span>الضريبة</span>
            <span className="tabular-nums">{formatAmount(totals.tax)}</span>
          </div>
        ) : null}
        <div className="flex justify-between pt-1 text-xl font-bold">
          <span>الإجمالي</span>
          <span className="tabular-nums">{formatMoney(totals.total, currency)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-border p-3">
        <Button variant="outline" size="sm" disabled={locked || empty || !canDiscount} onClick={onOrderDiscount}>
          <Percent className="h-4 w-4" />
          خصم
        </Button>
        <Button variant="outline" size="sm" disabled={locked || empty} onClick={onHold}>
          <PauseCircle className="h-4 w-4" />
          تعليق
        </Button>
        <Button variant="outline" size="sm" disabled={locked || empty} onClick={onVoid}>
          <Trash2 className="h-4 w-4" />
          إلغاء
        </Button>
        <Button className="col-span-3 h-14 text-lg" disabled={empty} onClick={onPay}>
          <Wallet className="h-5 w-5" />
          {locked ? 'متابعة الدفع' : 'الدفع'}
        </Button>
      </div>
    </div>
  );
}
