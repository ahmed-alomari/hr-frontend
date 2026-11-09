'use client';

import * as React from 'react';
import Link from 'next/link';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Badge } from '@/components/ui/badge';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { ListFilterBar, type PeriodRange } from '@/components/ui/list-filter-bar';
import { LocalListTable, LocalListToolbar, useLocalList, type LocalListField } from '@/components/ui/local-list';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUrlTab } from '@/components/ui/use-url-tab';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';
import { useExpensesStore } from '../data/store';
import { allTxns } from '../domain/ledger';
import { checkPolicies, groupOf, groupStatusOf, STATUS_LABELS_AR, txnGroupId } from '../domain/policy';
import type { AnyTxn, TxnStatus } from '../domain/types';
import { expensesRoutes } from '../constants/routes';
import { EmptyState, LoadingBlock, Money, PartyName } from './common';
import { TXN_KIND_LABELS, txnTitle } from './dashboard-page';
import { useCurrency, useDirectory, useExpensesData, useExpensesPermissions } from './expenses-provider';
import { ApprovalTimeline } from './group-policy';
import { mayDecideNow, TxnActions } from './txn-actions';

const TABS = ['mine', 'others', 'drafts'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = { mine: 'بانتظار اعتمادك', others: 'معلق لدى غيرك', drafts: 'مسوداتي' };
const TAB_EMPTY: Record<Tab, string> = { mine: 'لا شيء بانتظارك', others: 'لا شيء معلق لدى غيرك', drafts: 'لا مسودات' };

export function ApprovalsPage() {
  const data = useExpensesData();
  const currency = useCurrency();
  const directory = useDirectory();
  const actorId = useExpensesStore((s) => s.actorId);
  const companyId = useExpensesStore((s) => s.companyId);
  const perms = useExpensesPermissions();
  const [tab, setTab] = useUrlTab<Tab>(TABS, 'mine');

  const key = (field: string) => hrFiltersKey('expenses', 'approvals', companyId, field);
  const [search, setSearch] = usePersistedFilterState(key('search'), '');
  const [kind, setKind] = usePersistedFilterState(key('kind'), 'all');
  const [groupId, setGroupId] = usePersistedFilterState(key('group'), 'all');
  const [createdBy, setCreatedBy] = usePersistedFilterState(key('createdBy'), 'all');
  const [period, setPeriod] = usePersistedFilterState<PeriodRange>(key('period'), { from: '', to: '' });

  const buckets = React.useMemo(() => {
    const out: Record<Tab, AnyTxn[]> = { mine: [], others: [], drafts: [] };
    if (!data) return out;
    for (const t of [...allTxns(data)].reverse()) {
      if (t.currency !== currency.code) continue;
      if (t.status === 'submitted') out[actorId && mayDecideNow(actorId, t, perms.approve) ? 'mine' : 'others'].push(t);
      else if (t.status === 'draft' && t.createdBy === actorId) out.drafts.push(t);
    }
    return out;
  }, [data, currency.code, actorId, perms.approve]);

  const groupName = React.useCallback((t: AnyTxn) => (data ? groupOf(data, txnGroupId(data, t))?.name ?? '—' : '—'), [data]);
  const violationsOf = React.useCallback((t: AnyTxn) => (data && t.kind === 'expense' ? checkPolicies(t, data, currency.format) : []), [data, currency.format]);

  const rows = React.useMemo(() => {
    const q = search.trim();
    return buckets[tab].filter(
      (t) =>
        (kind === 'all' || t.kind === kind) &&
        (createdBy === 'all' || t.createdBy === createdBy) &&
        (groupId === 'all' || (data ? txnGroupId(data, t) === groupId : false)) &&
        (!period.from || t.date >= period.from) &&
        (!period.to || t.date <= period.to) &&
        (!q || txnTitle(t, directory.nameOf).includes(q)),
    );
  }, [buckets, tab, search, kind, createdBy, groupId, period, data, directory]);

  const fields = React.useMemo<LocalListField<AnyTxn>[]>(() => [
    { key: 'date', label: 'التاريخ', kind: 'date', text: (t) => t.date, groupKey: (t) => t.date.slice(0, 7) },
    { key: 'title', label: 'البيان', kind: 'name', text: (t) => txnTitle(t, directory.nameOf) },
    { key: 'kind', label: 'النوع', text: (t) => TXN_KIND_LABELS[t.kind], groupKey: (t) => t.kind, groupLabel: (k) => TXN_KIND_LABELS[k as AnyTxn['kind']] ?? k },
    { key: 'createdBy', label: 'سجّلها', text: (t) => directory.nameOf(t.createdBy), groupKey: (t) => t.createdBy, groupLabel: (id) => directory.nameOf(id) },
    { key: 'group', label: 'المجموعة', optional: true, text: groupName, groupKey: groupName },
    { key: 'violations', label: 'مخالفات السياسة', optional: true, hiddenByDefault: true, sortable: false, text: (t) => violationsOf(t).map((v) => v.message).join('، ') },
    { key: 'amount', label: 'المبلغ', kind: 'number', text: (t) => currency.format(t.amount), sortValue: (t) => t.amount, sum: (t) => t.amount, formatSum: currency.format },
    { key: 'status', label: 'الحالة', kind: 'status', text: (t) => STATUS_LABELS_AR[t.status as TxnStatus] },
  ], [directory, groupName, violationsOf, currency]);
  const list = useLocalList({ section: 'expenses', page: 'approvals', fields, rows });

  const filterCount =
    (search.trim() ? 1 : 0) + [kind, groupId, createdBy].filter((v) => v !== 'all').length + (period.from || period.to ? 1 : 0);

  usePageHeaderActions(
    () => (
      <LocalListToolbar
        list={list}
        title={`الاعتمادات: ${TAB_LABELS[tab]}`}
        fileName={`approvals-${tab}`}
        before={<FilterToggleButton activeFilterCount={filterCount} />}
      />
    ),
    [tab, filterCount, list.rows, list.visibleFields, list.groups, list.sort.sortKey],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        optionalDateRange
        showStatusSection={false}
        showEmployeePicker={false}
        periodValue={period}
        onPeriodChange={setPeriod}
        periodFilterActive={filterCount > 0}
        onClearAll={() => {
          setSearch('');
          setKind('all');
          setGroupId('all');
          setCreatedBy('all');
          setPeriod({ from: '', to: '' });
        }}
        leadingFilters={<EntityFilterSearchField value={search} onChange={setSearch} placeholder="بحث في البيان" />}
        inlineSelects={[
          { id: 'kind', value: kind, onChange: setKind, placeholder: 'كل الأنواع', options: [{ value: 'all', label: 'كل الأنواع' }, ...(Object.keys(TXN_KIND_LABELS) as AnyTxn['kind'][]).map((k) => ({ value: k, label: TXN_KIND_LABELS[k] }))] },
          { id: 'group', value: groupId, onChange: setGroupId, placeholder: 'كل المجموعات', options: [{ value: 'all', label: 'كل المجموعات' }, ...(data?.groups ?? []).map((g) => ({ value: g.id, label: g.name }))] },
          { id: 'createdBy', value: createdBy, onChange: setCreatedBy, placeholder: 'كل من سجّل', options: [{ value: 'all', label: 'كل من سجّل' }, ...directory.choices.map((p) => ({ value: p.id, label: p.name }))] },
        ]}
      />
    ),
    [search, kind, groupId, createdBy, period, data?.groups, directory.choices, filterCount],
  );

  if (!data) return <LoadingBlock />;
  const noApproval = data.groups.every((g) => groupStatusOf(g) !== 'active' || g.policy.approval === 'none');

  return (
    <div className="space-y-3">
      <SetPageTitle titleAr="الاعتمادات" descriptionAr="العمليات المعلقة لا تؤثر على الأرصدة حتى تُعتمد" iconName="ClipboardList" />
      {noApproval ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">لا تطلب أي مجموعة اعتماداً حالياً: العمليات تُعتمد عند الإرسال. يُفعَّل الاعتماد من سياسة المجموعة.</p>
      ) : null}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="grid h-auto w-full grid-cols-3 sm:inline-flex sm:w-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="whitespace-normal px-1.5 text-xs sm:px-3 sm:text-sm">{TAB_LABELS[t]} ({buckets[t].length})</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tab === 'mine' ? <p className="text-xs text-muted-foreground">بصفتك {directory.nameOf(actorId)}</p> : null}
      <LocalListTable
        list={list}
        cardsOnly
        cardsClassName="grid gap-2 lg:grid-cols-2"
        rowKey={(t) => t.kind + t.id}
        empty={<EmptyState text={filterCount > 0 && buckets[tab].length > 0 ? 'لا نتائج لهذه الفلاتر' : TAB_EMPTY[tab]} />}
        card={(t) => {
          const violations = violationsOf(t);
          return (
            <div className="h-full space-y-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {t.kind === 'expense' ? (
                    <Link href={expensesRoutes.expenseDetail(t.id)} className="text-sm font-medium text-primary hover:underline">{t.description}</Link>
                  ) : (
                    <p className="text-sm font-medium">{txnTitle(t, directory.nameOf)}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{t.date} · سجّلها <PartyName id={t.createdBy} link={false} /> · {groupName(t)}</p>
                </div>
                <Money value={t.amount} className="shrink-0 font-semibold" />
              </div>
              {violations.length > 0 ? (
                <div className="flex flex-wrap gap-1">{violations.map((v) => <Badge key={v.code} variant="warning" className="text-[10px]">{v.message}</Badge>)}</div>
              ) : null}
              {t.status === 'submitted' ? <ApprovalTimeline txn={t} /> : null}
              <TxnActions txn={t} compact />
            </div>
          );
        }}
      />
    </div>
  );
}
