'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resolvePosInvoiceStyle, type PosSession } from '@/features/pos/domain/types';
import { usePosContext } from '@/features/pos/hooks/use-pos-context';
import { round2 } from '@/features/pos/lib/calc';
import { formatMoney, parseAmount } from '@/features/pos/lib/format';
import { sessionToPrintable } from '@/features/pos/lib/receipt';
import { summarizeSession } from '@/features/pos/lib/session-summary';
import { PrintPreviewDialog } from '@/features/pos/components/shared/pos-shared';

/**
 * Close a shift: blind count (optionally by denomination), then the expected
 * amount and the difference, with a reason past the tolerance. A shift with a
 * sale still awaiting payment does not close.
 */
export function CloseSessionDialog({
  session,
  onOpenChange,
  onClosed,
}: {
  session: PosSession | null;
  onOpenChange: (open: boolean) => void;
  onClosed?: () => void;
}) {
  const { data, actions, userName, currency } = usePosContext();
  const settings = data.settings.shifts;
  const [step, setStep] = React.useState<'count' | 'review'>('count');
  const [total, setTotal] = React.useState('');
  const [counts, setCounts] = React.useState<Record<string, string>>({});
  const [reason, setReason] = React.useState('');
  const [zSession, setZSession] = React.useState<PosSession | null>(null);

  React.useEffect(() => {
    setStep('count');
    setTotal('');
    setCounts({});
    setReason('');
  }, [session?.id]);

  if (!session && !zSession) return null;
  const register = data.registers.find((r) => r.id === (session ?? zSession)!.registerId);

  if (!session) {
    const closed = data.sessions.find((s) => s.id === zSession!.id) ?? zSession!;
    return (
      <PrintPreviewDialog
        open
        onOpenChange={(o) => !o && setZSession(null)}
        title="تقرير إغلاق الوردية"
        invoiceStyle={resolvePosInvoiceStyle(register, data.settings)}
        document={sessionToPrintable(closed, register, summarizeSession(data, closed))}
      />
    );
  }

  const summary = summarizeSession(data, session);
  const counted = settings.countByDenomination
    ? round2(settings.denominations.reduce((a, d) => a + d * parseAmount(counts[d] ?? '0'), 0))
    : parseAmount(total);
  const difference = round2(counted - summary.expectedCash);
  const needsReason = Math.abs(difference) > settings.differenceTolerance;
  const blocked = summary.openSales.length > 0;

  const confirm = async () => {
    if (!actions) return;
    const closed = await actions.closeSession(
      session.id,
      {
        countedCash: counted,
        expectedCash: summary.expectedCash,
        difference,
        differenceReason: reason.trim() || null,
        denominationCounts: settings.countByDenomination
          ? Object.fromEntries(settings.denominations.map((d) => [String(d), parseAmount(counts[d] ?? '0')]))
          : null,
      },
      userName,
    );
    if (!closed) return;
    toast.success('أُغلقت الوردية');
    setZSession(session);
    onOpenChange(false);
    onClosed?.();
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>إغلاق الوردية — {register?.name}</DialogTitle>
        </DialogHeader>
        {blocked ? (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            في الوردية {summary.openSales.length} بيع بانتظار الدفع. أكمله أو ألغه قبل الإغلاق.
          </div>
        ) : step === 'count' ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">عُدّ النقد في الدرج وأدخله{settings.blindCount ? '. المتوقع يظهر بعد العدّ.' : '.'}</p>
            {settings.countByDenomination ? (
              <div className="grid grid-cols-3 gap-2">
                {settings.denominations.map((d) => (
                  <div key={d} className="space-y-1">
                    <Label className="text-xs">فئة {d}</Label>
                    <Input
                      className="h-9"
                      dir="ltr"
                      inputMode="numeric"
                      value={counts[d] ?? ''}
                      onChange={(e) => setCounts((c) => ({ ...c, [d]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Input
                autoFocus
                dir="ltr"
                inputMode="decimal"
                className="h-11 text-lg"
                placeholder="0.00"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            )}
            <div className="text-sm">المعدود: <b>{formatMoney(counted, currency)}</b></div>
            {!settings.blindCount ? (
              <div className="text-sm text-muted-foreground">المتوقع: {formatMoney(summary.expectedCash, currency)}</div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-1 rounded-md bg-muted/50 p-3">
              <span>العهدة</span><span className="text-end">{formatMoney(session.openingFloat)}</span>
              <span>نقد محصّل</span><span className="text-end">{formatMoney(summary.byMethod.cash ?? 0)}</span>
              {summary.collectionsByMethod.cash ? (
                <>
                  <span>تحصيل آجل نقدًا</span><span className="text-end">{formatMoney(summary.collectionsByMethod.cash)}</span>
                </>
              ) : null}
              <span>نقد مردود</span><span className="text-end">{formatMoney(summary.refundsCash)}</span>
              <span>مقبوضات / مصروفات</span><span className="text-end">{formatMoney(summary.cashIn)} / {formatMoney(summary.cashOut)}</span>
              <b>المتوقع</b><b className="text-end">{formatMoney(summary.expectedCash, currency)}</b>
              <b>المعدود</b><b className="text-end">{formatMoney(counted, currency)}</b>
              <b>الفرق</b>
              <b className={`text-end ${difference === 0 ? 'text-success' : 'text-destructive'}`}>{formatMoney(difference, currency)}</b>
            </div>
            {summary.exceptions.length > 0 ? (
              <p className="text-xs text-warning">{summary.exceptions.length} استثناء دفع يُنقل لقائمة المدير، ودفعاته محسوبة هنا.</p>
            ) : null}
            {needsReason ? (
              <div className="space-y-1">
                <Label className="text-xs">سبب الفرق (إلزامي)</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => (step === 'review' ? setStep('count') : onOpenChange(false))}>
            {step === 'review' ? 'رجوع للعدّ' : 'إلغاء'}
          </Button>
          {!blocked && step === 'count' ? (
            <Button onClick={() => setStep('review')}>متابعة</Button>
          ) : null}
          {!blocked && step === 'review' ? (
            <Button onClick={confirm} disabled={needsReason && !reason.trim()}>
              تأكيد الإغلاق
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
