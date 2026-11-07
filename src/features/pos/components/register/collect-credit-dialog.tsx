'use client';

import * as React from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/shared/utils';
import { MONEY_METHODS } from '@/features/pos/domain/types';
import { usePosContext } from '@/features/pos/hooks/use-pos-context';
import { formatDateTime, formatMoney } from '@/features/pos/lib/format';
import { newId } from '@/features/pos/lib/pos-store';
import { CollectCreditForm } from '@/features/pos/components/shared/collect-credit-form';

/**
 * A customer pays (part of) a credit invoice at the register: the money goes
 * into this shift's drawer and onto the customer's account in contacts.
 */
export function CollectCreditDialog({ open, sessionId, onClose }: { open: boolean; sessionId: string; onClose: () => void }) {
  const { data, actions, currency } = usePosContext();
  const [term, setTerm] = React.useState('');
  const [saleId, setSaleId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  // One id per payment, kept across retries of the same payment.
  const [paymentId, setPaymentId] = React.useState(newId);

  React.useEffect(() => {
    if (!open) return;
    setTerm('');
    setSaleId(null);
    setPaymentId(newId());
  }, [open]);

  const owed = React.useMemo(
    () =>
      data.sales
        .filter((s) => s.status === 'completed' && (s.credit?.due ?? 0) > 0)
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
    [data.sales],
  );
  const q = term.trim().toLowerCase();
  const shown = q
    ? owed.filter(
        (s) =>
          s.credit!.partnerName.toLowerCase().includes(q) ||
          (s.number ?? '').toLowerCase().includes(q) ||
          (s.customer.kind !== 'walk_in' && (s.customer.phone ?? '').includes(q)),
      )
    : owed;
  const sale = saleId ? owed.find((s) => s.id === saleId) ?? null : null;
  const methods = MONEY_METHODS.filter((m) => data.settings.paymentMethods[m]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تحصيل آجل</DialogTitle>
        </DialogHeader>
        {sale ? (
          <div className="space-y-3">
            <button type="button" className="flex items-center gap-1 text-sm text-primary" onClick={() => setSaleId(null)}>
              <ChevronRight className="h-4 w-4" />
              الفواتير
            </button>
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="font-medium">{sale.credit!.partnerName}</div>
              <div className="text-xs text-muted-foreground">
                فاتورة {sale.number} · {formatDateTime(sale.completedAt)} · آجل {formatMoney(sale.credit!.amount, currency)}
              </div>
            </div>
            <CollectCreditForm
              due={sale.credit!.due}
              currency={currency}
              methods={methods.length ? methods : MONEY_METHODS}
              busy={busy}
              note="النقد يدخل درج هذه الوردية، ويُسجَّل للعميل في حسابه بجهات الاتصال."
              onSubmit={async (input) => {
                if (busy || !actions) return;
                setBusy(true);
                try {
                  const done = await actions.collectCredit({ id: paymentId, saleId: sale.id, sessionId, ...input });
                  if (!done) return;
                  toast.success(`حُصّل ${formatMoney(input.amount, currency)} من ${sale.credit!.partnerName}`);
                  setPaymentId(newId());
                  setSaleId(null);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                className="ps-9"
                placeholder="ابحث باسم العميل أو رقم الفاتورة"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </div>
            <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
              {shown.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  {owed.length === 0 ? 'لا فواتير آجلة مستحقة.' : 'لا نتائج.'}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {shown.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSaleId(s.id)}
                        className={cn('flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-muted/60')}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{s.credit!.partnerName}</span>
                          <span className="block text-xs text-muted-foreground">
                            {s.number} · {formatDateTime(s.completedAt)}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-warning">
                          {formatMoney(s.credit!.due, currency)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {!sale ? (
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
