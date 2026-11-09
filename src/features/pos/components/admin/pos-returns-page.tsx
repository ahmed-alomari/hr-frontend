'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { PackageCheck, Plus, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { LocalListTable, LocalListToolbar, useLocalList, type LocalListField } from '@/components/ui/local-list';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MONEY_METHODS,
  PAYMENT_METHOD_LABELS,
  resolvePosInvoiceStyle,
  RETURN_CONDITION_LABELS,
  type PosPaymentMethod,
  type PosReturn,
  type PosReturnCondition,
  type PosSale,
} from '@/features/pos/domain/types';
import { PosDataScope, usePosContext } from '@/features/pos/hooks/use-pos-context';
import { lookupSaleByNumber, newId } from '@/features/pos/lib/pos-store';
import { lineRefundAmount, round2 } from '@/features/pos/lib/calc';
import { formatDateTime, formatMoney, parseAmount } from '@/features/pos/lib/format';
import { returnToPrintable } from '@/features/pos/lib/receipt';
import { refundMethodLabel } from '@/features/pos/lib/sales-report';
import { EmptyState, PosGate, PrintPreviewDialog, lastDaysPeriod, type PosPeriod } from '@/features/pos/components/shared/pos-shared';

type LineDraft = { quantity: number; condition: PosReturnCondition };

function originalMethod(sale: PosSale): PosPaymentMethod {
  // Still owed: the return comes off the customer's account first.
  if ((sale.credit?.due ?? 0) > 0) return 'credit';
  const paid = sale.payments.filter((p) => p.kind === 'payment' && p.status === 'succeeded');
  const top = [...paid].sort((a, b) => b.amount - a.amount)[0];
  return top?.method ?? 'cash';
}

/** Owed: only to the account. A settled credit invoice: the account or money back. Otherwise: money back. */
function refundMethodsOf(sale: PosSale): PosPaymentMethod[] {
  if (!sale.credit) return [...MONEY_METHODS];
  if (sale.credit.due > 0) return ['credit'];
  return ['credit', ...MONEY_METHODS];
}

function NewReturnDialog({ open, initialSaleId, onClose }: { open: boolean; initialSaleId: string | null; onClose: () => void }) {
  const { companyId, data, actions, userName, currency, can } = usePosContext();
  const queryClient = useQueryClient();
  const [saleQuery, setSaleQuery] = React.useState('');
  const [saleId, setSaleId] = React.useState<string | null>(initialSaleId);
  const [lines, setLines] = React.useState<Record<string, LineDraft>>({});
  const [reason, setReason] = React.useState('');
  const [method, setMethod] = React.useState<PosPaymentMethod>('cash');
  const [reference, setReference] = React.useState('');
  const [sessionId, setSessionId] = React.useState<string>('');
  const [openedAt] = React.useState(() => Date.now());
  // One key per return being entered: a double submit has one effect.
  const [submitting, setSubmitting] = React.useState(false);
  const [operationKey, setOperationKey] = React.useState(() => newId());

  const sale = data.sales.find((s) => s.id === saleId && s.status === 'completed') ?? null;
  // Cash goes back from a drawer of the sale's branch (the server's rule).
  const branchOf = (registerId: string | undefined) => data.registers.find((r) => r.id === registerId)?.branchId ?? null;
  const openSessions = data.sessions.filter((s) => s.status === 'open' && (!sale || branchOf(s.registerId) === branchOf(sale.registerId)));

  React.useEffect(() => {
    if (open) {
      setSaleId(initialSaleId);
      setOperationKey(newId());
    }
  }, [open, initialSaleId]);

  React.useEffect(() => {
    setLines({});
    setReason('');
    setReference('');
    if (sale) {
      setMethod(originalMethod(sale));
      setSessionId(openSessions.find((s) => s.registerId === sale.registerId)?.id ?? openSessions[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  // An old sale is outside the period on screen: the server finds it by its number.
  React.useEffect(() => {
    const number = saleQuery.trim().toUpperCase();
    if (!companyId || !open || number.length < 5) return;
    if (data.sales.some((s) => s.number === number)) return;
    const timer = setTimeout(() => void lookupSaleByNumber(companyId, number, queryClient).catch(() => undefined), 400);
    return () => clearTimeout(timer);
  }, [companyId, data.sales, open, queryClient, saleQuery]);

  const matches = saleQuery.trim()
    ? data.sales.filter((s) => s.status === 'completed' && (s.number ?? '').toLowerCase().includes(saleQuery.trim().toLowerCase())).slice(0, 6)
    : [];

  const ageDays = sale?.completedAt ? (openedAt - new Date(sale.completedAt).getTime()) / 86_400_000 : 0;
  const outOfWindow = !!sale && ageDays > data.settings.returns.windowDays;
  const chosen = sale
    ? sale.lines
        .map((l) => ({ line: l, draft: lines[l.id] }))
        .filter((x): x is { line: (typeof sale.lines)[number]; draft: LineDraft } => !!x.draft && x.draft.quantity > 0)
    : [];
  const amount = round2(chosen.reduce((a, x) => a + lineRefundAmount(x.line, x.draft.quantity), 0));
  const paidWith = new Set<PosPaymentMethod>([
    ...(sale?.payments ?? []).filter((p) => p.kind === 'payment' && p.status === 'succeeded').map((p) => p.method),
    ...data.collections.filter((c) => c.saleId === sale?.id).map((c) => c.method),
  ]);
  const otherMethod = !!sale && paidWith.size > 0 && !paidWith.has(method);
  const otherMethodBlocked = otherMethod && data.settings.returns.refundToOtherMethodNeedsApproval && !can('pos.refund.other-method');
  const cashWithoutSession = method === 'cash' && !sessionId;
  const valid = !!sale && chosen.length > 0 && reason.trim() && !otherMethodBlocked && !cashWithoutSession && !outOfWindow;

  const submit = async () => {
    if (!sale || !actions || !valid || submitting) return;
    const refundDone = method === 'cash' || method === 'credit' || !!reference.trim();
    const hasDamaged = chosen.some((x) => x.draft.condition === 'damaged');
    setSubmitting(true);
    const created = await actions.createReturn({
      operationKey,
      saleId: sale.id,
      saleNumber: sale.number ?? sale.id,
      sessionId: sessionId || null,
      createdBy: userName,
      reason: reason.trim(),
      lines: chosen.map((x) => ({
        saleLineId: x.line.id,
        name: x.line.variantName ? `${x.line.name} — ${x.line.variantName}` : x.line.name,
        quantity: x.draft.quantity,
        condition: x.draft.condition,
        amount: lineRefundAmount(x.line, x.draft.quantity),
      })),
      refund: { method, amount, reference: reference.trim() || null, status: refundDone ? 'done' : 'pending' },
      damagedDecision: hasDamaged ? 'pending' : null,
    });
    setSubmitting(false);
    if (!created) return;
    toast.success(`أُنشئ المرتجع ${created.number}${refundDone ? '' : ' — رد المال بانتظار التنفيذ'}`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>مرتجع جديد</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto text-sm">
          {!sale ? (
            <div className="space-y-2">
              <Label>رقم إيصال البيع</Label>
              <Input value={saleQuery} onChange={(e) => setSaleQuery(e.target.value)} placeholder="POS1-000123" dir="ltr" />
              <div className="space-y-1">
                {matches.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="flex w-full justify-between rounded-md border border-border px-3 py-2 text-start hover:bg-muted/50"
                    onClick={() => setSaleId(s.id)}
                  >
                    <span dir="ltr">{s.number}</span>
                    <span>{formatMoney(s.totals.total, currency)} · {formatDateTime(s.completedAt)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                <span>
                  البيع <b dir="ltr">{sale.number}</b> · {formatDateTime(sale.completedAt)} · {sale.stockSource === 'inventory' ? 'من المخازن' : 'دون تتبع'}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setSaleId(null)}>تغيير</Button>
              </div>
              {outOfWindow ? (
                <p className="text-xs text-destructive">تجاوز مدة المرتجع ({data.settings.returns.windowDays} يوم).</p>
              ) : null}

              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">1. الأصناف واستلام البضاعة</div>
                {sale.lines.map((l) => {
                  const returnable = l.quantity - l.returnedQuantity;
                  const draft = lines[l.id] ?? { quantity: 0, condition: 'resellable' as PosReturnCondition };
                  return (
                    <div key={l.id} className="grid grid-cols-[1fr_80px] items-center gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_80px_150px]">
                      <div>
                        <div className="font-medium">{l.name}{l.variantName ? ` — ${l.variantName}` : ''}</div>
                        <div className="text-xs text-muted-foreground">
                          مباع {l.quantity} · مرتجع سابقًا {l.returnedQuantity} · للقطعة {formatMoney(lineRefundAmount(l, 1))}
                        </div>
                      </div>
                      <Input
                        className="h-8"
                        dir="ltr"
                        inputMode="numeric"
                        disabled={returnable <= 0}
                        value={String(draft.quantity)}
                        onChange={(e) => {
                          const q = Math.min(returnable, Math.max(0, Math.round(parseAmount(e.target.value))));
                          setLines((x) => ({ ...x, [l.id]: { ...draft, quantity: q } }));
                        }}
                      />
                      <Select
                        value={draft.condition}
                        onValueChange={(v) => setLines((x) => ({ ...x, [l.id]: { ...draft, condition: v as PosReturnCondition } }))}
                      >
                        <SelectTrigger className="h-8 max-sm:col-span-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(RETURN_CONDITION_LABELS) as PosReturnCondition[]).map((c) => (
                            <SelectItem key={c} value={c}>{RETURN_CONDITION_LABELS[c]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground">
                  الصالح يعود إلى موقع البيع إن كان البيع من المخازن. التالف يذهب إلى موقع غير قابل للبيع وينتظر قرارًا. «لم يُستلم» تعويض سعر دون بضاعة.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">2. رد المال</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">الوسيلة</Label>
                    <Select value={method} onValueChange={(v) => setMethod(v as PosPaymentMethod)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {refundMethodsOf(sale).map((m) => (
                          <SelectItem key={m} value={m}>
                            {refundMethodLabel(m)}{m === originalMethod(sale) ? ' (الأصلية)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {method === 'cash' ? (
                    <div className="space-y-1">
                      <Label className="text-xs">من درج الوردية</Label>
                      <Select value={sessionId} onValueChange={setSessionId}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="لا وردية مفتوحة" /></SelectTrigger>
                        <SelectContent>
                          {openSessions.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {data.registers.find((r) => r.id === s.registerId)?.name} · {s.cashierName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : method === 'credit' ? (
                    <div className="space-y-1">
                      <Label className="text-xs">العميل</Label>
                      <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3">
                        {sale.credit?.partnerName}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs">مرجع الرد (إن نُفّذ الآن)</Label>
                      <Input className="h-9" dir="ltr" value={reference} onChange={(e) => setReference(e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">المبلغ</Label>
                    <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 font-semibold">
                      {formatMoney(amount, currency)}
                    </div>
                  </div>
                </div>
                {otherMethodBlocked ? <p className="text-xs text-destructive">الرد بوسيلة غير الأصلية يحتاج صلاحية الموافقة.</p> : null}
                {cashWithoutSession ? <p className="text-xs text-destructive">الرد النقدي يحتاج وردية مفتوحة.</p> : null}
                {method === 'credit' ? (
                  <p className="text-xs text-muted-foreground">
                    يُخصم من المستحق على العميل ({formatMoney(sale.credit?.due ?? 0, currency)})، ويُسجَّل له في حسابه بجهات الاتصال
                    {(sale.credit?.due ?? 0) > 0 ? '. لا يُرد مال لفاتورة عليها مستحق.' : '.'}
                  </p>
                ) : method !== 'cash' && !reference.trim() ? (
                  <p className="text-xs text-muted-foreground">دون مرجع يُحفظ الرد «بانتظار التنفيذ» حتى يُسجَّل لاحقًا.</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">السبب</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مقاس غير مناسب، عيب مصنعي…" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={!valid || submitting}>إنشاء المرتجع</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReturnRow({ ret }: { ret: PosReturn }) {
  const { data, actions, userName, currency, can } = usePosContext();
  const [reference, setReference] = React.useState('');
  const [printOpen, setPrintOpen] = React.useState(false);
  const damaged = ret.lines.filter((l) => l.condition === 'damaged');

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <span dir="ltr">{ret.number}</span>
            {ret.refund.method === 'credit' ? (
              <Badge variant="outline">إلى حساب العميل</Badge>
            ) : ret.refund.status === 'done' ? (
              <Badge variant="success">رُدّ المال</Badge>
            ) : (
              <Badge variant="warning">رد المال بانتظار التنفيذ</Badge>
            )}
            {ret.damagedDecision === 'pending' ? <Badge variant="destructive">تالف بانتظار قرار</Badge> : null}
            {ret.stockPosting === 'pending' ? <Badge variant="warning">ترحيل مخزون معلّق</Badge> : null}
            {ret.stockPosting === 'reviewed' ? <Badge variant="outline">رُوجع — يُرحَّل عند عودة الربط</Badge> : null}
            {ret.stockPosting === 'posted' ? <Badge variant="outline">أُعيد للمخازن</Badge> : null}
          </div>
          <div className="text-xs text-muted-foreground">
            على البيع <span dir="ltr">{ret.saleNumber}</span> · {formatDateTime(ret.createdAt)} · {ret.createdBy} · {ret.reason}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <b>{formatMoney(ret.refund.amount, currency)}</b>
          <Button size="sm" variant="outline" onClick={() => setPrintOpen(true)}>
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ul className="text-xs text-muted-foreground">
        {ret.lines.map((l) => (
          <li key={l.saleLineId}>
            {l.quantity} × {l.name} · {RETURN_CONDITION_LABELS[l.condition]} · {formatMoney(l.amount)}
          </li>
        ))}
      </ul>
      {ret.refund.status === 'pending' && can('pos.refund') ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-2">
          <span className="text-xs">رد {PAYMENT_METHOD_LABELS[ret.refund.method]}: سجّل المرجع بعد تنفيذه على الجهاز أو الحساب</span>
          <Input className="h-8 w-44" dir="ltr" value={reference} onChange={(e) => setReference(e.target.value)} />
          <Button
            size="sm"
            disabled={!reference.trim()}
            onClick={() => {
              actions?.recordRefund(ret.id, reference.trim(), userName);
              toast.success('سُجّل رد المال');
            }}
          >
            تسجيل التنفيذ
          </Button>
        </div>
      ) : null}
      {ret.stockPosting === 'pending' ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs">
          <span>
            بيع من المخازن ونقاط البيع غير مربوطة الآن: البضاعة هنا ولم تُرحَّل للمخازن. راجِع عدّها ومكانها قبل
            ترحيلها، حتى لا تُحتسب مرتين.
          </span>
          <Button size="sm" variant="outline" onClick={() => actions?.reviewStockPosting(ret.id, userName)}>
            تمت المراجعة
          </Button>
        </div>
      ) : null}
      {(ret.stockPosting === 'pending' || ret.stockPosting === 'reviewed') && data.settings.stockMode === 'inventory' ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs">
          <span>عاد الربط بالمخازن: يمكن ترحيل الصالح من هذا المرتجع إلى مستودعه بتكلفته الأصلية، مرة واحدة.</span>
          <Button size="sm" variant="outline" onClick={() => actions?.postReturnStock(ret.id)}>
            ترحيل إلى المخازن
          </Button>
        </div>
      ) : null}
      {damaged.length > 0 && ret.damagedDecision === 'pending' ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs">
          <PackageCheck className="h-4 w-4 text-muted-foreground" />
          مصير التالف ({damaged.reduce((a, l) => a + l.quantity, 0)} قطعة، في موقع غير قابل للبيع):
          {(['scrap', 'supplier', 'repair'] as const).map((d) => (
            <Button key={d} size="sm" variant="outline" onClick={() => actions?.setDamagedDecision(ret.id, d)}>
              {d === 'scrap' ? 'إتلاف' : d === 'supplier' ? 'إرجاع للمورد' : 'إصلاح'}
            </Button>
          ))}
        </div>
      ) : ret.damagedDecision && ret.damagedDecision !== 'pending' ? (
        <div className="text-xs text-muted-foreground">
          قرار التالف: {ret.damagedDecision === 'scrap' ? 'إتلاف' : ret.damagedDecision === 'supplier' ? 'إرجاع للمورد' : 'إصلاح'}
        </div>
      ) : null}
      <PrintPreviewDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        title="طباعة إشعار المرتجع"
        invoiceStyle={resolvePosInvoiceStyle(
          data.registers.find((register) => register.id === data.sales.find((sale) => sale.id === ret.saleId)?.registerId),
          data.settings,
        )}
        document={returnToPrintable(ret)}
      />
    </div>
  );
}

function Returns({ period, setPeriod }: { period: PosPeriod; setPeriod: (p: PosPeriod) => void }) {
  const { data, can, currency } = usePosContext();
  const params = useSearchParams();
  const initialSale = params.get('sale');
  const [open, setOpen] = React.useState(!!initialSale);

  const [defaultPeriod] = React.useState(period);
  const periodChanged = period.from !== defaultPeriod.from || period.to !== defaultPeriod.to;
  const mayReturn = can('pos.return');

  const fields = React.useMemo<LocalListField<PosReturn>[]>(() => {
    const amountOf = (r: PosReturn) => r.lines.reduce((s, l) => s + l.amount, 0);
    const money = (n: number) => formatMoney(n, currency);
    return [
      { key: 'number', label: 'رقم المرتجع', kind: 'code', text: (r) => r.number },
      { key: 'sale', label: 'البيع الأصلي', kind: 'code', text: (r) => r.saleNumber, groupKey: (r) => r.saleNumber },
      { key: 'date', label: 'التاريخ', kind: 'date', text: (r) => formatDateTime(r.createdAt), sortValue: (r) => r.createdAt, groupKey: (r) => r.createdAt.slice(0, 7) },
      { key: 'items', label: 'الأصناف', sortable: false, text: (r) => r.lines.map((l) => `${l.name} × ${l.quantity}`).join('، ') },
      { key: 'reason', label: 'السبب', optional: true, sortable: false, text: (r) => r.reason || '—' },
      { key: 'amount', label: 'المبلغ', kind: 'number', text: (r) => money(amountOf(r)), sortValue: amountOf, sum: amountOf, formatSum: money },
    ];
  }, [currency]);
  const list = useLocalList({ section: 'pos', page: 'returns', fields, rows: data.returns });

  usePageHeaderActions(
    () => (
      <LocalListToolbar
        list={list}
        title="مرتجعات نقاط البيع"
        fileName={`pos-returns-${period.from}-${period.to}`}
        subtitleLines={[`الفترة: ${period.from} إلى ${period.to}`]}
        before={<FilterToggleButton activeFilterCount={periodChanged ? 1 : 0} />}
        primary={mayReturn ? (
          <PageHeaderPrimaryButton icon={Plus} label="مرتجع جديد" onClick={() => setOpen(true)}>
            مرتجع جديد
          </PageHeaderPrimaryButton>
        ) : undefined}
      />
    ),
    [periodChanged, mayReturn, period.from, period.to, list.rows, list.visibleFields, list.groups, list.sort.sortKey],
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
      <SetPageTitle titleAr="مرتجعات نقاط البيع" iconName="Receipt" />
      <LocalListTable
        list={list}
        cardsOnly
        cardsClassName="space-y-3"
        rowKey={(r) => r.id}
        empty={<EmptyState title="لا مرتجعات" description="كل مرتجع يشير إلى سطور بيعه الأصلي، واستلام البضاعة ورد المال جزءان مستقلان." />}
        card={(r) => <ReturnRow ret={r} />}
      />
      <NewReturnDialog open={open} initialSaleId={initialSale} onClose={() => setOpen(false)} />
    </div>
  );
}

export function PosReturnsPage() {
  const [period, setPeriod] = React.useState<PosPeriod>(() => lastDaysPeriod(30));
  return (
    <PosDataScope range={period}>
      <PosGate permission="pos.return">
        <Returns period={period} setPeriod={setPeriod} />
      </PosGate>
    </PosDataScope>
  );
}
