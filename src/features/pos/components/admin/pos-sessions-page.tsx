'use client';

import * as React from 'react';
import { FileText, Lock } from 'lucide-react';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { LocalListTable, LocalListToolbar, useLocalList, type LocalListField } from '@/components/ui/local-list';
import { resolvePosInvoiceStyle, type PosSession } from '@/features/pos/domain/types';
import { PosDataScope, usePosContext } from '@/features/pos/hooks/use-pos-context';
import { formatDateTime, formatMoney } from '@/features/pos/lib/format';
import { sessionToPrintable } from '@/features/pos/lib/receipt';
import { summarizeSession } from '@/features/pos/lib/session-summary';
import { CloseSessionDialog } from '@/features/pos/components/shared/close-session-dialog';
import { EmptyState, PosGate, PrintPreviewDialog, lastDaysPeriod, type PosPeriod } from '@/features/pos/components/shared/pos-shared';

function Sessions({ period, setPeriod }: { period: PosPeriod; setPeriod: (p: PosPeriod) => void }) {
  const { data, currency, can, userId } = usePosContext();
  const [closing, setClosing] = React.useState<PosSession | null>(null);
  const [report, setReport] = React.useState<PosSession | null>(null);
  const sessions = [...data.sessions].sort((a, b) => b.openedAt.localeCompare(a.openedAt));

  const [defaultPeriod] = React.useState(period);
  const periodChanged = period.from !== defaultPeriod.from || period.to !== defaultPeriod.to;

  const registerName = React.useCallback((id: string) => data.registers.find((r) => r.id === id)?.name ?? '—', [data.registers]);
  const fields = React.useMemo<LocalListField<PosSession>[]>(() => {
    const money = (n: number) => formatMoney(n, currency);
    const statusLabel = (s: string) => (s === 'open' ? 'مفتوحة' : 'مغلقة');
    return [
      { key: 'register', label: 'نقطة البيع', kind: 'name', text: (s) => registerName(s.registerId), groupKey: (s) => s.registerId, groupLabel: registerName },
      { key: 'cashier', label: 'الكاشير', text: (s) => s.cashierName, groupKey: (s) => s.cashierName },
      { key: 'opened', label: 'الفتح', kind: 'date', text: (s) => formatDateTime(s.openedAt), sortValue: (s) => s.openedAt, groupKey: (s) => s.openedAt.slice(0, 7) },
      { key: 'closed', label: 'الإغلاق', kind: 'date', optional: true, text: (s) => formatDateTime(s.closedAt), sortValue: (s) => s.closedAt ?? '' },
      { key: 'sales', label: 'المبيعات', kind: 'number', text: (s) => money(summarizeSession(data, s).salesTotal), sortValue: (s) => summarizeSession(data, s).salesTotal, sum: (s) => summarizeSession(data, s).salesTotal, formatSum: money, cell: (s) => { const x = summarizeSession(data, s); return <span className="tabular-nums">{money(x.salesTotal)} ({x.salesCount})</span>; } },
      { key: 'difference', label: 'الفرق', kind: 'number', text: (s) => (s.difference == null ? '—' : formatMoney(s.difference)), sortValue: (s) => s.difference ?? 0, sum: (s) => s.difference ?? 0, formatSum: (n) => formatMoney(n), cell: (s) => (s.difference == null ? '—' : <span className={s.difference === 0 ? 'tabular-nums text-success' : 'tabular-nums text-destructive'}>{formatMoney(s.difference)}</span>) },
      { key: 'reason', label: 'سبب الفرق', optional: true, sortable: false, text: (s) => s.differenceReason ?? '—', cell: (s) => <span className="block max-w-[220px] truncate text-xs" title={s.differenceReason ?? undefined}>{s.differenceReason ?? '—'}</span> },
      { key: 'status', label: 'الحالة', kind: 'status', text: (s) => statusLabel(s.status), groupKey: (s) => s.status, groupLabel: statusLabel, cell: (s) => (
        <>
          {s.status === 'open' ? <Badge variant="success">مفتوحة</Badge> : <Badge variant="subtle">مغلقة</Badge>}
          {s.stockMode === 'inventory' ? <Badge variant="outline" className="ms-1">مخازن</Badge> : null}
        </>
      ) },
      { key: 'actions', label: '', sortable: false, screenOnly: true, text: () => '', cell: (s) => {
        const canClose = s.status === 'open' && ((s.cashierId === userId && can('pos.session.close')) || can('pos.session.close-others'));
        return (
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
        );
      } },
    ];
  }, [data, currency, registerName, userId, can]);
  const list = useLocalList({ section: 'pos', page: 'sessions', fields, rows: sessions });

  usePageHeaderActions(
    () => (
      <LocalListToolbar
        list={list}
        title="ورديات نقاط البيع"
        fileName={`pos-shifts-${period.from}-${period.to}`}
        subtitleLines={[`الفترة: ${period.from} إلى ${period.to}`]}
        before={<FilterToggleButton activeFilterCount={periodChanged ? 1 : 0} />}
      />
    ),
    [periodChanged, period.from, period.to, list.rows, list.visibleFields, list.groups, list.sort.sortKey],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showStatusSection={false}
        showEmployeePicker={false}
        periodValue={period}
        onPeriodChange={setPeriod}
        defaultPeriod={defaultPeriod}
      />
    ),
    [period, defaultPeriod],
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <SetPageTitle titleAr="ورديات نقاط البيع" iconName="Clock" />
      <LocalListTable
        list={list}
        rowKey={(s) => s.id}
        empty={<EmptyState title="لا ورديات" description="تُفتح الوردية من شاشة الكاشير بعدّ العهدة النقدية." />}
        card={(s) => {
          const summary = summarizeSession(data, s);
          const canClose =
            s.status === 'open' &&
            ((s.cashierId === userId && can('pos.session.close')) || can('pos.session.close-others'));
          return (
            <>
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
            </>
          );
        }}
      />
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
  const [period, setPeriod] = React.useState<PosPeriod>(() => lastDaysPeriod(30));
  return (
    <PosDataScope range={period}>
      <PosGate permission="pos.sales.read">
        <Sessions period={period} setPeriod={setPeriod} />
      </PosGate>
    </PosDataScope>
  );
}
