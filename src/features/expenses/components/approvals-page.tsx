'use client';

import * as React from 'react';
import Link from 'next/link';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Badge } from '@/components/ui/badge';
import { useExpensesStore } from '../data/store';
import { allTxns } from '../domain/ledger';
import { checkPolicies, groupOf, txnGroupId } from '../domain/policy';
import type { AnyTxn } from '../domain/types';
import { expensesRoutes } from '../constants/routes';
import { EmptyState, LoadingBlock, Money, PartyName, Section } from './common';
import { txnTitle } from './dashboard-page';
import { useCurrency, useDirectory, useExpensesData, useExpensesPermissions } from './expenses-provider';
import { ApprovalTimeline } from './group-policy';
import { mayDecideNow, TxnActions } from './txn-actions';

export function ApprovalsPage() {
  const data = useExpensesData();
  const currency = useCurrency();
  const directory = useDirectory();
  const actorId = useExpensesStore((s) => s.actorId);
  const perms = useExpensesPermissions();
  if (!data) return <LoadingBlock />;
  const pending = allTxns(data).filter((t) => t.status === 'submitted' && t.currency === currency.code).reverse();
  const mine = pending.filter((t) => actorId && mayDecideNow(actorId, t, perms.approve));
  const noApproval = data.groups.every((g) => g.closed || g.policy.approval === 'none');
  const others = pending.filter((t) => !mine.includes(t));
  const drafts = allTxns(data).filter((t) => t.status === 'draft' && t.createdBy === actorId);

  const row = (t: AnyTxn) => {
    const violations = t.kind === 'expense' ? checkPolicies(t, data, currency.format) : [];
    return (
      <li key={t.kind + t.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {t.kind === 'expense' ? (
              <Link href={expensesRoutes.expenseDetail(t.id)} className="text-sm font-medium text-primary hover:underline">{t.description}</Link>
            ) : (
              <p className="text-sm font-medium">{txnTitle(t, directory.nameOf)}</p>
            )}
            <p className="text-xs text-muted-foreground">{t.date} · سجّلها <PartyName id={t.createdBy} link={false} /> · {groupOf(data, txnGroupId(data, t))?.name ?? '—'}</p>
          </div>
          <Money value={t.amount} className="shrink-0 font-semibold" />
        </div>
        {violations.length > 0 ? (
          <div className="flex flex-wrap gap-1">{violations.map((v) => <Badge key={v.code} variant="warning" className="text-[10px]">{v.message}</Badge>)}</div>
        ) : null}
        {t.status === 'submitted' ? <ApprovalTimeline txn={t} /> : null}
        <TxnActions txn={t} compact />
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <SetPageTitle titleAr="الاعتمادات" descriptionAr="العمليات المعلقة لا تؤثر على الأرصدة حتى تُعتمد" iconName="ClipboardList" />
      {noApproval ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">لا تطلب أي مجموعة اعتماداً حالياً: العمليات تُعتمد عند الإرسال. يُفعَّل الاعتماد من سياسة المجموعة.</p>
      ) : null}
      <Section title={`بانتظار اعتمادك (${mine.length})`} description={`بصفتك ${directory.nameOf(actorId)}`}>
        {mine.length === 0 ? <EmptyState text="لا شيء بانتظارك" /> : <ul className="grid gap-2 lg:grid-cols-2">{mine.map(row)}</ul>}
      </Section>
      <Section title={`معلق لدى غيرك (${others.length})`}>
        {others.length === 0 ? <EmptyState text="لا شيء" /> : <ul className="grid gap-2 lg:grid-cols-2">{others.map(row)}</ul>}
      </Section>
      {drafts.length > 0 ? (
        <Section title={`مسوداتي (${drafts.length})`}>
          <ul className="grid gap-2 lg:grid-cols-2">{drafts.map(row)}</ul>
        </Section>
      ) : null}
    </div>
  );
}
