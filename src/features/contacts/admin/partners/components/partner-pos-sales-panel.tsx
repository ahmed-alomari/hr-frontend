'use client';

import * as React from 'react';
import { HandCoins, Loader2, Store } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCan } from '@/features/auth/hooks/use-can';
import { partnersQueryKeys } from '@/features/contacts/admin/hooks/query-keys';
import { PAYMENT_METHOD_LABELS } from '@/features/pos/domain/types';
import { formatDateTime, formatMoney } from '@/features/pos/lib/format';
import { newId, posDataQueryKey } from '@/features/pos/lib/pos-store';
import {
  collectPosCredit,
  partnerCreditSalesKey,
  usePartnerCreditSales,
  type PosPartnerCreditSale,
} from '@/features/pos/lib/pos-customers-api';
import { CollectCreditForm } from '@/features/pos/components/shared/collect-credit-form';
import { splitSummary } from '@/features/pos/lib/sales-report';

/**
 * The contact's credit invoices from the point of sale (POS's: shown only
 * while POS is enabled — see the tab's `requiresApp`). A payment here is made
 * outside any shift, so it never enters a drawer; it shows in the POS reports
 * as «خارج الوردية» and on the contact's account.
 */
export function PartnerPosSalesPanel({ companyId, partnerId }: { companyId: string | null; partnerId: string }) {
  const can = useCan();
  const mayCollect = can('pos.credit.collect');
  const { data: sales, isLoading, isError } = usePartnerCreditSales(companyId, partnerId);
  const [collecting, setCollecting] = React.useState<PosPartnerCreditSale | null>(null);

  if (!companyId) return <p className="text-sm text-muted-foreground">اختر شركة لعرض فواتير نقاط البيع.</p>;
  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError) return <p className="text-sm text-destructive">تعذّر تحميل فواتير نقاط البيع.</p>;

  const list = sales ?? [];
  const due = list.reduce((a, s) => a + s.credit.due, 0);
  const currency = list[0]?.currency ?? null;

  return (
    <section className="space-y-3 rounded-3xl border border-border/70 bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">فواتير نقاط البيع الآجلة</h2>
          <p className="text-xs text-muted-foreground">ما بيع لهذا العميل آجلًا، وما حُصّل منه وما بقي.</p>
        </div>
        {due > 0.004 ? <Badge variant="warning">المستحق {formatMoney(due, currency)}</Badge> : null}
      </header>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا فواتير آجلة من نقاط البيع.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((s) => (
            <li key={s.id} className="space-y-2 rounded-2xl border border-border/70 bg-background/60 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <span dir="ltr">{s.number ?? '—'}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(s.completedAt)} · {s.cashierName} · الإجمالي {formatMoney(s.total, s.currency)} ·{' '}
                    {splitSummary(s.payments)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.credit.due > 0.004 ? (
                    <Badge variant="warning">المتبقي {formatMoney(s.credit.due, s.currency)}</Badge>
                  ) : (
                    <Badge variant="success">مسدّدة</Badge>
                  )}
                  {mayCollect && s.credit.due > 0.004 ? (
                    <Button size="sm" onClick={() => setCollecting(s)}>
                      <HandCoins className="h-4 w-4" />
                      تحصيل
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                <span>آجل {formatMoney(s.credit.amount)}</span>
                <span>حُصّل {formatMoney(s.credit.collected)}</span>
                <span>مرتجع إلى الحساب {formatMoney(s.credit.returned)}</span>
              </div>
              {s.collections.length > 0 || s.returns.length > 0 ? (
                <ul className="space-y-0.5 border-t border-border/60 pt-1 text-xs">
                  {s.collections.map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span>
                        تحصيل · {PAYMENT_METHOD_LABELS[c.method]}
                        {c.reference ? ` · ${c.reference}` : ''} · {formatDateTime(c.createdAt)} · {c.createdBy}
                        {c.sessionId ? '' : ' · خارج الوردية'}
                      </span>
                      <span className="tabular-nums">{formatMoney(c.amount)}</span>
                    </li>
                  ))}
                  {s.returns.map((r) => (
                    <li key={r.id} className="flex justify-between gap-2">
                      <span>
                        مرتجع <span dir="ltr">{r.number}</span> · {formatDateTime(r.createdAt)}
                      </span>
                      <span className="tabular-nums">{formatMoney(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <CollectDialog companyId={companyId} partnerId={partnerId} sale={collecting} onClose={() => setCollecting(null)} />
    </section>
  );
}

function CollectDialog({
  companyId,
  partnerId,
  sale,
  onClose,
}: {
  companyId: string;
  partnerId: string;
  sale: PosPartnerCreditSale | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  // One id per payment, kept across retries of the same payment.
  const [paymentId, setPaymentId] = React.useState(newId);
  React.useEffect(() => {
    if (sale) setPaymentId(newId());
  }, [sale]);

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تحصيل على الفاتورة {sale?.number}</DialogTitle>
        </DialogHeader>
        {sale ? (
          <CollectCreditForm
            due={sale.credit.due}
            currency={sale.currency}
            busy={busy}
            note="خارج أي وردية: لا يدخل درج نقطة بيع، ويظهر في تقارير نقاط البيع «خارج الوردية» وفي حساب العميل."
            onSubmit={async (input) => {
              if (busy) return;
              setBusy(true);
              try {
                await collectPosCredit(companyId, { id: paymentId, saleId: sale.id, ...input });
                toast.success(`حُصّل ${formatMoney(input.amount, sale.currency)}`);
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: partnerCreditSalesKey(companyId, partnerId) }),
                  queryClient.invalidateQueries({ queryKey: partnersQueryKeys.ledgerAll(companyId, partnerId) }),
                  queryClient.invalidateQueries({ queryKey: posDataQueryKey(companyId) }),
                ]);
                onClose();
              } catch (error) {
                const message = (error as { message?: unknown } | null)?.message;
                toast.error(typeof message === 'string' && message && !message.startsWith('HTTP ') ? message : 'تعذّر التحصيل الآن.');
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
