'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, CheckSquare, HandCoins, Hourglass, Plus, Receipt, Users, Wallet } from 'lucide-react';
import { PhoneStatsFold } from '@/components/layouts/phone-fold';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { Button } from '@/components/ui/button';
import { useExpensesStore } from '../data/store';
import { allTxns, partyBalance } from '../domain/ledger';
import { expenseReport } from '../domain/reports';
import { ORG } from '../domain/types';
import type { AnyTxn } from '../domain/types';
import { expensesRoutes } from '../constants/routes';
import { EmptyState, LoadingBlock, Money, PartyName, Section, StatusBadge } from './common';
import { ExpenseFormDialog } from './expense-form-dialog';
import { todayIso, useCurrency, useDirectory, useExpensesData, useExpensesPermissions, useLedger } from './expenses-provider';

export const TXN_KIND_LABELS: Record<AnyTxn['kind'], string> = {
  expense: 'مصروف',
  custody_move: 'حركة عهدة',
  advance: 'سلفة',
  settlement: 'سداد',
};

export function txnTitle(t: AnyTxn, nameOf: (id: string) => string): string {
  switch (t.kind) {
    case 'expense':
      return t.description;
    case 'custody_move':
      return t.type === 'issue' ? 'تسليم عهدة' : t.type === 'topup' ? 'تغذية عهدة' : 'إرجاع من عهدة';
    case 'advance':
      return `سلفة: ${nameOf(t.personId)}`;
    case 'settlement':
      return `سداد: ${nameOf(t.fromId)} ← ${nameOf(t.toId)}`;
  }
}

export function txnHref(t: AnyTxn): string {
  if (t.kind === 'expense') return expensesRoutes.expenseDetail(t.id);
  if (t.kind === 'custody_move') return expensesRoutes.custodyDetail(t.custodyId);
  if (t.kind === 'settlement') return expensesRoutes.settlements;
  return expensesRoutes.custody;
}

function MiniStat({ icon: Icon, label, value, hint, tone }: { icon: React.ElementType; label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className={`h-3.5 w-3.5 ${tone ?? 'text-primary'}`} />{label}</div>
      <p className={`mt-1 truncate text-base font-bold tabular-nums sm:text-lg ${tone ?? ''}`} dir="ltr">{value}</p>
      {hint ? <p className="truncate text-[10.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function DashboardPage() {
  const fullAccess = useExpensesStore((s) => s.fullAccess);
  const data = useExpensesData();
  const ledger = useLedger();
  const currency = useCurrency();
  const directory = useDirectory();
  const actorId = useExpensesStore((s) => s.actorId);
  const perms = useExpensesPermissions();
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);

  usePageHeaderActions(
    () => (
      <PageHeaderPrimaryButton icon={Plus} label="مصروف جديد" disabled={!perms.create} onClick={() => setAdding(true)}>
        مصروف جديد
      </PageHeaderPrimaryButton>
    ),
    [perms.create],
  );

  if (!data || !ledger) return <LoadingBlock />;

  const today = todayIso();
  const monthStart = `${today.slice(0, 7)}-01`;
  const month = expenseReport(data, { currency: currency.code, from: monthStart, to: today }, 'day');
  const org = partyBalance(ledger, ORG);
  const custodyActual = [...ledger.custodies.values()].reduce((t, c) => t + c.actual, 0);
  const custodyExpected = [...ledger.custodies.values()].reduce((t, c) => t + c.expected, 0);
  const me = actorId ? partyBalance(ledger, actorId) : null;
  const recent = allTxns(data).filter((t) => t.currency === currency.code).slice(-8).reverse();
  const maxCat = Math.max(1, ...month.byCategory.map((r) => r.amount));
  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? '—';
  const catColor = (id: string) => data.categories.find((c) => c.id === id)?.color ?? '#94a3b8';

  return (
    <div className="space-y-4">
      <SetPageTitle titleAr="المصاريف والعهد المالية" descriptionAr="المصروفات والعهد والمستحقات في مكان واحد" iconName="Wallet" />

      <PhoneStatsFold summary={currency.format(month.total)}>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MiniStat icon={Receipt} label="مصروفات هذا الشهر" value={currency.format(month.total)} hint={`${month.count} عملية معتمدة`} />
          <MiniStat icon={Hourglass} tone="text-warning" label="بانتظار الاعتماد" value={currency.format(ledger.pending.amount)} hint={`${ledger.pending.count} عملية — خارج الأرصدة`} />
          <MiniStat icon={Wallet} label="أرصدة العهد" value={currency.format(custodyActual)} hint={`المتوقع: ${currency.format(custodyExpected)}`} />
          <MiniStat icon={HandCoins} tone="text-destructive" label="على المنشأة للأشخاص" value={currency.format(org.liabilities)} hint={`لها عليهم: ${currency.format(org.entitlements)}`} />
        </div>
      </PhoneStatsFold>

      {fullAccess ? null : <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">تعرض هذه الصفحة عملياتك أنت فقط.</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button className="h-11 justify-start gap-2" disabled={!perms.create} onClick={() => setAdding(true)}><Plus className="h-4 w-4" />مصروف جديد</Button>
        <Button variant="outline" className="h-11 justify-start gap-2" asChild><Link href={expensesRoutes.custody}><Wallet className="h-4 w-4" />العهد والسلف</Link></Button>
        <Button variant="outline" className="h-11 justify-start gap-2" asChild><Link href={expensesRoutes.settlements}><ArrowLeftRight className="h-4 w-4" />تسوية وسداد</Link></Button>
        <Button variant="outline" className="h-11 justify-start gap-2" asChild><Link href={expensesRoutes.approvals}><CheckSquare className="h-4 w-4" />الاعتمادات ({ledger.pending.count})</Link></Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="حسابي" description={`بصفتك: ${directory.nameOf(actorId)}`}>
          {me ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-success/10 p-2.5"><p className="text-[11px] text-muted-foreground">لي</p><Money value={me.entitlements} className="text-sm font-semibold text-success" /></div>
              <div className="rounded-xl bg-destructive/10 p-2.5"><p className="text-[11px] text-muted-foreground">عليّ</p><Money value={me.liabilities} className="text-sm font-semibold text-destructive" /></div>
              <div className="rounded-xl bg-primary/10 p-2.5"><p className="text-[11px] text-muted-foreground">عهدتي</p><Money value={me.custodyActual} className="text-sm font-semibold text-primary" /></div>
            </div>
          ) : null}
          {actorId ? <Button variant="link" className="mt-1 h-auto px-0 text-xs" asChild><Link href={expensesRoutes.personDetail(actorId)}>كشف حسابي</Link></Button> : null}
        </Section>

        <Section title="أعلى الفئات هذا الشهر" className="lg:col-span-2">
          {month.byCategory.length === 0 ? <EmptyState text="لا مصروفات معتمدة هذا الشهر" /> : (
            <ul className="space-y-2">
              {month.byCategory.slice(0, 6).map((r) => (
                <li key={r.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs"><span>{catName(r.key)}</span><Money value={r.amount} className="font-medium" /></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(r.amount / maxCat) * 100}%`, backgroundColor: catColor(r.key) }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="العهد المفتوحة" actions={<Button size="sm" variant="ghost" asChild><Link href={expensesRoutes.custody}>الكل</Link></Button>}>
          {[...ledger.custodies.values()].filter((c) => c.custody.status === 'open').length === 0 ? <EmptyState text="لا عهد مفتوحة" /> : (
            <ul className="divide-y divide-border">
              {[...ledger.custodies.values()].filter((c) => c.custody.status === 'open').map((c) => (
                <li key={c.custody.id}>
                  <Link href={expensesRoutes.custodyDetail(c.custody.id)} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{directory.nameOf(c.custody.holderId)}</p><p className="truncate text-xs text-muted-foreground">{c.custody.purpose}</p></div>
                    <div className="text-end"><Money value={c.actual} className="text-sm font-semibold" />{c.pendingOut > 0 ? <p className="text-[11px] text-warning">متوقع <Money value={c.expected} /></p> : null}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="آخر العمليات" actions={<Button size="sm" variant="ghost" asChild><Link href={expensesRoutes.expenses}>المصروفات</Link></Button>}>
          {recent.length === 0 ? <EmptyState text="لا عمليات بعد" /> : (
            <ul className="divide-y divide-border">
              {recent.map((t) => (
                <li key={t.kind + t.id}>
                  <button type="button" onClick={() => router.push(txnHref(t))} className="flex w-full items-center justify-between gap-2 py-2.5 text-start">
                    <div className="min-w-0"><p className="truncate text-sm">{txnTitle(t, directory.nameOf)}</p><p className="text-xs text-muted-foreground">{t.date} · <PartyName id={t.createdBy} link={false} /></p></div>
                    <div className="flex shrink-0 flex-col items-end gap-1"><Money value={t.amount} className="text-sm font-medium" /><StatusBadge status={t.status} /></div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="المستحقات بين الأطراف" description="ما على كل طرف لغيره (بعد المقاصة بين الطرفين فقط)" actions={<Button size="sm" variant="ghost" asChild><Link href={expensesRoutes.people}><Users className="me-1 h-3.5 w-3.5" />حسابات الأشخاص</Link></Button>}>
        {[...ledger.parties.values()].every((p) => p.liabilities === 0) ? <EmptyState text="لا مستحقات قائمة" /> : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {[...ledger.parties.values()].flatMap((p) => p.pairs.filter((pair) => pair.net > 0).map((pair) => (
              <li key={p.partyId + pair.counterparty} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                <span className="min-w-0 truncate"><PartyName id={p.partyId} /> ← <PartyName id={pair.counterparty} /></span>
                <Money value={pair.net} className="shrink-0 font-semibold" />
              </li>
            )))}
          </ul>
        )}
      </Section>

      <ExpenseFormDialog open={adding} onOpenChange={setAdding} onSaved={(e) => router.push(expensesRoutes.expenseDetail(e.id))} />
    </div>
  );
}
