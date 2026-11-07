'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/shared/utils';
import { MONEY_METHODS, PAYMENT_METHOD_LABELS, type PosMoneyMethod } from '@/features/pos/domain/types';
import { round2 } from '@/features/pos/lib/calc';
import { formatMoney, parseAmount } from '@/features/pos/lib/format';

export type CollectCreditInput = { method: PosMoneyMethod; amount: number; reference: string | null };

/** A payment on a credit invoice: up to what is still owed, with a reference for card and transfer. */
export function CollectCreditForm({
  due,
  currency,
  methods = MONEY_METHODS,
  busy,
  note,
  onSubmit,
}: {
  due: number;
  currency: string | null | undefined;
  methods?: readonly PosMoneyMethod[];
  busy: boolean;
  note?: React.ReactNode;
  onSubmit: (input: CollectCreditInput) => void;
}) {
  const [method, setMethod] = React.useState<PosMoneyMethod>(methods[0] ?? 'cash');
  const [amount, setAmount] = React.useState(String(due));
  const [reference, setReference] = React.useState('');
  React.useEffect(() => setAmount(String(due)), [due]);

  const value = round2(parseAmount(amount));
  const needsReference = method !== 'cash';
  const invalid = value <= 0 || value > due + 0.001 || (needsReference && !reference.trim());

  return (
    <div className="space-y-3">
      <div className={cn('grid gap-2', methods.length > 2 ? 'grid-cols-3' : 'grid-cols-2')}>
        {methods.map((m) => (
          <Button key={m} type="button" variant={method === m ? 'default' : 'outline'} onClick={() => setMethod(m)}>
            {PAYMENT_METHOD_LABELS[m]}
          </Button>
        ))}
      </div>
      <div className="space-y-1">
        <Label>المبلغ (المستحق {formatMoney(due, currency)})</Label>
        <Input dir="ltr" inputMode="decimal" className="h-11 text-lg" value={amount} onChange={(e) => setAmount(e.target.value)} />
        {value > due + 0.001 ? <p className="text-xs text-destructive">أكبر من المستحق على الفاتورة.</p> : null}
      </div>
      {needsReference ? (
        <Input
          placeholder={method === 'card' ? 'رقم الموافقة من الجهاز' : 'رقم مرجع التحويل'}
          dir="ltr"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      ) : null}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      <Button
        className="w-full"
        disabled={busy || invalid}
        onClick={() => onSubmit({ method, amount: value, reference: needsReference ? reference.trim() : null })}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        تحصيل {formatMoney(value, currency)}
      </Button>
    </div>
  );
}
