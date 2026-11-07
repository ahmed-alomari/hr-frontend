'use client';

import * as React from 'react';
import { FileText, Lock } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { resolvePosInvoiceStyle, type PosSession } from '@/features/pos/domain/types';
import { usePosContext } from '@/features/pos/hooks/use-pos-context';
import { formatDateTime, formatMoney } from '@/features/pos/lib/format';
import { sessionToPrintable } from '@/features/pos/lib/receipt';
import { summarizeSession } from '@/features/pos/lib/session-summary';
import { CloseSessionDialog } from '@/features/pos/components/shared/close-session-dialog';
import { EmptyState, PosGate, PrintPreviewDialog } from '@/features/pos/components/shared/pos-shared';

function Sessions() {
  const { data, currency, can, userId } = usePosContext();
  const [closing, setClosing] = React.useState<PosSession | null>(null);
  const [report, setReport] = React.useState<PosSession | null>(null);
  const sessions = [...data.sessions].sort((a, b) => b.openedAt.localeCompare(a.openedAt));

  return (
    <div className="space-y-4 sm:space-y-5">
      <SetPageTitle titleAr="ورديات نقاط البيع" iconName="Clock" />
      {sessions.length === 0 ? (
        <EmptyState title="لا ورديات" description="تُفتح الوردية من شاشة الكاشير بعدّ العهدة النقدية." />
      ) : (
        <>
        {/* Phone: one card per shift. */}
        <div className="space-y-2 md:hidden">
          {sessions.map((s) => {
            const summary = summarizeSession(data, s);
            const canClose =
              s.status === 'open' &&
              ((s.cashierId === userId && can('pos.session.close')) || can('pos.session.close-others'));
            return (
              <div key={s.id} className="rounded-xl border border-border bg-card p-3 shadow-soft">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">
                    {data.registers.find((r) => r.id === s.registerId)?.name ?? '—'} · {s.cashierName}
                  </span>
                  {s.status === 'open' ? <Badge variant="success">مفتوحة</Badge> : <Badge variant="subtle">مغلقة</Badge>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(s.openedAt)}
                  {s.closedAt ? ` ← ${formatDateTime(s.closedAt)}` : ''}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                  <span className="tabular-nums">
                    المبيعات: <b>{formatMoney(summary.salesTotal, currency)}</b> ({summary.salesCount})
                  </span>
                  {s.difference == null ? null : (
                    <span className={s.difference === 0 ? 'text-success' : 'text-destructive'}>
                      الفرق {formatMoney(s.difference)}
                    </span>
                  )}
                </div>
                {s.differenceReason ? (
                  <div className="mt-1 text-xs text-muted-foreground">سبب الفرق: {s.differenceReason}</div>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setReport(s)}>
                    <FileText className="h-4 w-4" />
                    {s.status === 'open' ? 'تقرير X' : 'تقرير Z'}
                  </Button>
                  {canClose ? (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setClosing(s)}>
                      <Lock className="h-4 w-4" />
                      إغلاق
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft max-md:hidden">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start">نقطة البيع</th>
                <th className="px-3 py-2 text-start">الكاشير</th>
                <th className="px-3 py-2 text-start">الفتح</th>
                <th className="px-3 py-2 text-start">الإغلاق</th>
                <th className="px-3 py-2 text-start">المبيعات</th>
                <th className="px-3 py-2 text-start">الفرق</th>
                <th className="px-3 py-2 text-start">سبب الفرق</th>
                <th className="px-3 py-2 text-start">الحالة</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const summary = summarizeSession(data, s);
                const canClose =
                  s.status === 'open' &&
                  ((s.cashierId === userId && can('pos.session.close')) || can('pos.session.close-others'));
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-2">{data.registers.find((r) => r.id === s.registerId)?.name ?? '—'}</td>
                    <td className="px-3 py-2">{s.cashierName}</td>
                    <td className="px-3 py-2">{formatDateTime(s.openedAt)}</td>
                    <td className="px-3 py-2">{formatDateTime(s.closedAt)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMoney(summary.salesTotal, currency)} ({summary.salesCount})
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {s.difference == null ? '—' : (
                        <span className={s.difference === 0 ? 'text-success' : 'text-destructive'}>{formatMoney(s.difference)}</span>
                      )}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-xs" title={s.differenceReason ?? undefined}>
                      {s.differenceReason ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {s.status === 'open' ? <Badge variant="success">مفتوحة</Badge> : <Badge variant="subtle">مغلقة</Badge>}
                      {s.stockMode === 'inventory' ? <Badge variant="outline" className="ms-1">مخازن</Badge> : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setReport(s)}>
                          <FileText className="h-4 w-4" />
                          {s.status === 'open' ? 'X' : 'Z'}
                        </Button>
                        {canClose ? (
                          <Button size="sm" variant="outline" onClick={() => setClosing(s)}>
                            <Lock className="h-4 w-4" />
                            إغلاق
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
      <CloseSessionDialog session={closing} onOpenChange={(o) => !o && setClosing(null)} />
      <PrintPreviewDialog
        open={!!report}
        onOpenChange={(o) => !o && setReport(null)}
        title="تقرير الوردية"
        invoiceStyle={resolvePosInvoiceStyle(
          data.registers.find((r) => r.id === report?.registerId),
          data.settings,
        )}
        document={
          report
            ? sessionToPrintable(
                report,
                data.registers.find((r) => r.id === report.registerId),
                summarizeSession(data, report),
              )
            : null
        }
      />
    </div>
  );
}

export function PosSessionsPage() {
  return (
    <PosGate permission="pos.sales.read">
      <Sessions />
    </PosGate>
  );
}
