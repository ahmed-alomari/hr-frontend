'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, HandCoins } from 'lucide-react';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { PhoneStatsFold } from '@/components/layouts/phone-fold';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { ListFilterBar, type PeriodRange } from '@/components/ui/list-filter-bar';
import { LocalListTable, LocalListToolbar, useLocalList, type LocalListField } from '@/components/ui/local-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUrlTab } from '@/components/ui/use-url-tab';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';
import { useExpensesStore } from '../data/store';
import { partyBalance, statement, type CustodyBalance, type PairBalance, type PartyBalance, type StatementLine } from '../domain/ledger';
import { STATUS_LABELS_AR } from '../domain/policy';
import { ORG, type AnyTxn, type Participant, type TxnStatus } from '../domain/types';
import { expensesRoutes } from '../constants/routes';
import { EmptyState, LoadingBlock, Money, PartyName, Section, SourceBadge, StatusBadge } from './common';
import { TXN_KIND_LABELS, txnHref, txnTitle } from './dashboard-page';
import { useCurrency, useDirectory, useExpensesData, useExpensesPermissions, useLedger } from './expenses-provider';
import { SettlementDialog } from './settlements-page';

const KIND_LABELS: Record<Participant['kind'], string> = { user_contact: 'مستخدم وجهة اتصال', user: 'مستخدم', contact: 'جهة اتصال داخلية' };

type PersonRow = { p: Participant; b: PartyBalance };

const BALANCE_FILTERS: Record<string, { label: string; test: (b: PartyBalance) => boolean }> = {
  owed: { label: 'لهم مستحقات', test: (b) => b.entitlements > 0 },
  owes: { label: 'عليهم التزامات', test: (b) => b.liabilities > 0 },
  custody: { label: 'معهم عهدة', test: (b) => b.custodyActual > 0 },
  settled: { label: 'بلا أرصدة', test: (b) => b.entitlements === 0 && b.liabilities === 0 && b.custodyActual === 0 },
};

export function PeoplePage() {
  const data = useExpensesData();
  const ledger = useLedger();
  const directory = useDirectory();
  const currency = useCurrency();
  const router = useRouter();
  const companyId = useExpensesStore((s) => s.companyId);
  const key = (field: string) => hrFiltersKey('expenses', 'people', companyId, field);
  const [search, setSearch] = usePersistedFilterState(key('search'), '');
  const [balance, setBalance] = usePersistedFilterState(key('balance'), 'all');
  const [kind, setKind] = usePersistedFilterState(key('kind'), 'all');
  const fullAccess = useExpensesStore((s) => s.fullAccess);
  const actorId = useExpensesStore((s) => s.actorId);

  const rows = React.useMemo<PersonRow[]>(() => {
    if (!ledger) return [];
    const q = search.trim();
    return directory.all
      .map((p) => ({ p, b: partyBalance(ledger, p.id) }))
      .filter(({ p, b }) => (fullAccess || p.id === actorId) && (kind === 'all' || p.kind === kind) && (balance === 'all' || BALANCE_FILTERS[balance]?.test(b)) && (!q || p.name.includes(q)))
      .sort((a, b) => b.b.entitlements + b.b.liabilities + b.b.custodyActual - (a.b.entitlements + a.b.liabilities + a.b.custodyActual));
  }, [ledger, directory.all, search, balance, kind, fullAccess, actorId]);

  const fields = React.useMemo<LocalListField<PersonRow>[]>(() => [
    { key: 'name', label: 'المشارك', kind: 'name', text: ({ p }) => p.name, cell: ({ p }) => <span className="inline-flex flex-wrap items-center gap-1.5 font-medium">{p.name}<SourceBadge id={p.id} /></span> },
    { key: 'kind', label: 'النوع', optional: true, hiddenByDefault: true, text: ({ p }) => KIND_LABELS[p.kind], groupKey: ({ p }) => p.kind, groupLabel: (k) => KIND_LABELS[k as Participant['kind']] ?? k },
    { key: 'entitlements', label: 'له (مستحقات)', kind: 'number', text: ({ b }) => currency.format(b.entitlements), sortValue: ({ b }) => b.entitlements, sum: ({ b }) => b.entitlements, formatSum: currency.format, cell: ({ b }) => <Money value={b.entitlements} className="text-success" /> },
    { key: 'liabilities', label: 'عليه (التزامات)', kind: 'number', text: ({ b }) => currency.format(b.liabilities), sortValue: ({ b }) => b.liabilities, sum: ({ b }) => b.liabilities, formatSum: currency.format, cell: ({ b }) => <Money value={b.liabilities} className="text-destructive" /> },
    { key: 'custodyActual', label: 'العهدة الفعلية', kind: 'number', text: ({ b }) => currency.format(b.custodyActual), sortValue: ({ b }) => b.custodyActual, sum: ({ b }) => b.custodyActual, formatSum: currency.format, cell: ({ b }) => <Money value={b.custodyActual} /> },
    { key: 'custodyExpected', label: 'العهدة المتوقعة', kind: 'number', optional: true, text: ({ b }) => currency.format(b.custodyExpected), sortValue: ({ b }) => b.custodyExpected, sum: ({ b }) => b.custodyExpected, formatSum: currency.format, cell: ({ b }) => <Money value={b.custodyExpected} className={b.custodyExpected !== b.custodyActual ? 'text-warning' : ''} /> },
  ], [currency]);
  const list = useLocalList({ section: 'expenses', page: 'people', fields, rows });
  const filterCount = (search.trim() ? 1 : 0) + [balance, kind].filter((v) => v !== 'all').length;

  usePageHeaderActions(
    () => <LocalListToolbar list={list} title="حسابات الأشخاص" fileName="people-accounts" before={<FilterToggleButton activeFilterCount={filterCount} />} />,
    [filterCount, list.rows, list.visibleFields, list.groups, list.sort.sortKey],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        periodFilterActive={filterCount > 0}
        onClearAll={() => {
          setSearch('');
          setBalance('all');
          setKind('all');
        }}
        leadingFilters={<EntityFilterSearchField value={search} onChange={setSearch} placeholder="بحث بالاسم" />}
        inlineSelects={[
          { id: 'balance', value: balance, onChange: setBalance, placeholder: 'كل الأرصدة', options: [{ value: 'all', label: 'كل الأرصدة' }, ...Object.entries(BALANCE_FILTERS).map(([value, f]) => ({ value, label: f.label }))] },
          { id: 'kind', value: kind, onChange: setKind, placeholder: 'كل الأنواع', options: [{ value: 'all', label: 'كل الأنواع' }, ...(Object.keys(KIND_LABELS) as Participant['kind'][]).map((k) => ({ value: k, label: KIND_LABELS[k] }))] },
        ]}
      />
    ),
    [search, balance, kind, filterCount],
  );

  if (!data || !ledger) return <LoadingBlock />;
  const org = partyBalance(ledger, ORG);
  return (
    <div className="space-y-3">
      <SetPageTitle titleAr="حسابات الأشخاص" descriptionAr="لكل مشارك: ما له، وما عليه، وعهدته — منفصلة" iconName="Users" />
      {fullAccess ? <PhoneStatsFold summary={<Money value={org.liabilities} />}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-3 text-xs"><p className="text-muted-foreground">على المنشأة للأشخاص</p><Money value={org.liabilities} className="text-base font-bold text-destructive" /></div>
          <div className="rounded-2xl border border-border bg-card p-3 text-xs"><p className="text-muted-foreground">للمنشأة على الأشخاص</p><Money value={org.entitlements} className="text-base font-bold text-success" /></div>
          <div className="col-span-2 rounded-2xl border border-border bg-card p-3 text-xs sm:col-span-1"><p className="text-muted-foreground">عهد لدى الأشخاص</p><Money value={[...ledger.custodies.values()].reduce((t, c) => t + c.actual, 0)} className="text-base font-bold text-primary" /></div>
        </div>
      </PhoneStatsFold> : <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">تعرض هذه الصفحة حسابك أنت.</p>}
      <LocalListTable
        list={list}
        rowKey={(r) => r.p.id}
        onRowClick={(r) => router.push(expensesRoutes.personDetail(r.p.id))}
        empty={<EmptyState text={filterCount > 0 ? 'لا نتائج لهذه الفلاتر' : 'لا مشاركين'} />}
        card={({ p, b }) => (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5"><p className="text-sm font-medium">{p.name}</p><SourceBadge id={p.id} /></div>
            <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
              <div className="rounded-lg bg-success/10 p-1.5"><p className="text-muted-foreground">له</p><Money value={b.entitlements} className="font-semibold text-success" /></div>
              <div className="rounded-lg bg-destructive/10 p-1.5"><p className="text-muted-foreground">عليه</p><Money value={b.liabilities} className="font-semibold text-destructive" /></div>
              <div className="rounded-lg bg-primary/10 p-1.5"><p className="text-muted-foreground">عهدة</p><Money value={b.custodyActual} className="font-semibold text-primary" /></div>
            </div>
          </div>
        )}
      />
    </div>
  );
}

const PERSON_TABS = ['statement', 'parties', 'custodies'] as const;
type PersonTab = (typeof PERSON_TABS)[number];

export function PersonDetailPage({ id }: { id: string }) {
  const data = useExpensesData();
  const ledger = useLedger();
  const currency = useCurrency();
  const directory = useDirectory();
  const perms = useExpensesPermissions();
  const router = useRouter();
  const companyId = useExpensesStore((s) => s.companyId);
  const seesAll = useExpensesStore((s) => s.fullAccess);
  const me = useExpensesStore((s) => s.actorId);
  const [tab, setTab] = useUrlTab<PersonTab>(PERSON_TABS, 'statement');
  const [settle, setSettle] = React.useState<{ fromId: string; toId: string; amount: number } | null>(null);

  const key = (field: string) => hrFiltersKey('expenses', 'person-statement', companyId, field);
  const [search, setSearch] = usePersistedFilterState(key('search'), '');
  const [kind, setKind] = usePersistedFilterState(key('kind'), 'all');
  const [state, setState] = usePersistedFilterState(key('state'), 'all');
  const [period, setPeriod] = usePersistedFilterState<PeriodRange>(key('period'), { from: '', to: '' });
  const [partySearch, setPartySearch] = usePersistedFilterState(hrFiltersKey('expenses', 'person-parties', companyId, 'search'), '');
  const [custodySearch, setCustodySearch] = usePersistedFilterState(hrFiltersKey('expenses', 'person-custodies', companyId, 'search'), '');

  // Oldest first, for the running balance; the screen reads newest first.
  const allLines = React.useMemo(() => (data ? statement(data, id, currency.code) : []), [data, id, currency.code]);
  const lines = React.useMemo(() => {
    const q = search.trim();
    return allLines
      .filter(
        (l) =>
          (kind === 'all' || l.txn.kind === kind) &&
          (state === 'all' || (state === 'pending' ? l.pending : !l.pending)) &&
          (!period.from || l.txn.date >= period.from) &&
          (!period.to || l.txn.date <= period.to) &&
          (!q || txnTitle(l.txn, directory.nameOf).includes(q)),
      )
      .reverse();
  }, [allLines, kind, state, period, search, directory]);

  const before = React.useMemo(() => (period.from ? allLines.filter((l) => !l.pending && l.txn.date < period.from) : []), [allLines, period.from]);
  const upTo = React.useMemo(() => allLines.filter((l) => !l.pending && (!period.to || l.txn.date <= period.to)), [allLines, period.to]);
  const opening = before.at(-1)?.balance ?? 0;
  const closing = upTo.at(-1)?.balance ?? 0;

  const lineFields = React.useMemo<LocalListField<StatementLine>[]>(() => [
    { key: 'date', label: 'التاريخ', kind: 'date', text: (l) => l.txn.date, cell: (l) => <span className="tabular-nums">{l.txn.date}</span>, groupKey: (l) => l.txn.date.slice(0, 7) },
    { key: 'title', label: 'البيان', kind: 'name', text: (l) => txnTitle(l.txn, directory.nameOf), cell: (l) => <span className="inline-flex items-center gap-1.5">{txnTitle(l.txn, directory.nameOf)}{l.pending ? <StatusBadge status={l.txn.status} /> : null}</span> },
    { key: 'kind', label: 'النوع', optional: true, hiddenByDefault: true, text: (l) => TXN_KIND_LABELS[l.txn.kind], groupKey: (l) => l.txn.kind, groupLabel: (k) => TXN_KIND_LABELS[k as AnyTxn['kind']] ?? k },
    { key: 'state', label: 'الحالة', optional: true, hiddenByDefault: true, kind: 'status', text: (l) => STATUS_LABELS_AR[l.txn.status as TxnStatus], groupKey: (l) => l.txn.status, groupLabel: (k) => STATUS_LABELS_AR[k as TxnStatus] ?? k },
    { key: 'credit', label: 'له', kind: 'number', text: (l) => (l.credit ? currency.format(l.credit) : '—'), sortValue: (l) => l.credit, sum: (l) => (l.pending ? 0 : l.credit), formatSum: currency.format, cell: (l) => (l.credit ? <Money value={l.credit} className="text-success" /> : '—') },
    { key: 'debit', label: 'عليه', kind: 'number', text: (l) => (l.debit ? currency.format(l.debit) : '—'), sortValue: (l) => l.debit, sum: (l) => (l.pending ? 0 : l.debit), formatSum: currency.format, cell: (l) => (l.debit ? <Money value={l.debit} className="text-destructive" /> : '—') },
    { key: 'custody', label: 'العهدة', kind: 'number', optional: true, text: (l) => (l.custody ? currency.format(l.custody) : '—'), sortValue: (l) => l.custody, cell: (l) => (l.custody ? <Money value={l.custody} signed /> : '—') },
    { key: 'balance', label: 'الصافي', kind: 'number', sortable: false, text: (l) => (l.pending ? 'معلق' : currency.format(l.balance)), cell: (l) => (l.pending ? <span className="text-xs text-muted-foreground">معلق</span> : <Money value={l.balance} className="font-medium" />) },
  ], [directory, currency]);
  const lineList = useLocalList({ section: 'expenses', page: 'person-statement', fields: lineFields, rows: lines });

  const pairs = React.useMemo<PairBalance[]>(() => {
    if (!ledger) return [];
    const q = partySearch.trim();
    return partyBalance(ledger, id).pairs.filter((p) => !q || directory.nameOf(p.counterparty).includes(q));
  }, [ledger, id, partySearch, directory]);
  const pairFields = React.useMemo<LocalListField<PairBalance>[]>(() => [
    { key: 'party', label: 'الطرف', kind: 'name', text: (p) => directory.nameOf(p.counterparty), cell: (p) => <PartyName id={p.counterparty} /> },
    { key: 'direction', label: 'الاتجاه', text: (p) => (p.net > 0 ? 'عليه له' : 'له عليه'), groupKey: (p) => (p.net > 0 ? 'owes' : 'owed'), groupLabel: (k) => (k === 'owes' ? 'عليه له' : 'له عليه') },
    { key: 'amount', label: 'المبلغ', kind: 'number', text: (p) => currency.format(Math.abs(p.net)), sortValue: (p) => Math.abs(p.net), cell: (p) => <Money value={Math.abs(p.net)} className={p.net > 0 ? 'font-semibold text-destructive' : 'font-semibold text-success'} /> },
    { key: 'actions', label: '', sortable: false, screenOnly: true, text: () => '', cell: (p) => (perms.settle ? (
      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="تسوية" onClick={(e) => { e.stopPropagation(); setSettle(p.net > 0 ? { fromId: id, toId: p.counterparty, amount: p.net } : { fromId: p.counterparty, toId: id, amount: -p.net }); }}>
        <HandCoins className="h-4 w-4" />
      </Button>
    ) : null) },
  ], [directory, currency, perms.settle, id]);
  const pairList = useLocalList({ section: 'expenses', page: 'person-parties', fields: pairFields, rows: pairs });

  const custodies = React.useMemo<CustodyBalance[]>(() => {
    if (!ledger) return [];
    const q = custodySearch.trim();
    return [...ledger.custodies.values()].filter((c) => c.custody.holderId === id && (!q || c.custody.purpose.includes(q)));
  }, [ledger, id, custodySearch]);
  const custodyFields = React.useMemo<LocalListField<CustodyBalance>[]>(() => [
    { key: 'purpose', label: 'الغرض', kind: 'name', text: (c) => c.custody.purpose },
    { key: 'status', label: 'الحالة', kind: 'status', text: (c) => (c.custody.status === 'open' ? 'مفتوحة' : 'مقفلة'), groupKey: (c) => c.custody.status, groupLabel: (s) => (s === 'open' ? 'مفتوحة' : 'مقفلة') },
    { key: 'spent', label: 'المصروف منها', kind: 'number', optional: true, text: (c) => currency.format(c.spent), sortValue: (c) => c.spent, sum: (c) => c.spent, formatSum: currency.format },
    { key: 'actual', label: 'الرصيد الفعلي', kind: 'number', text: (c) => currency.format(c.actual), sortValue: (c) => c.actual, sum: (c) => c.actual, formatSum: currency.format, cell: (c) => <Money value={c.actual} className="font-semibold" /> },
  ], [currency]);
  const custodyList = useLocalList({ section: 'expenses', page: 'person-custodies', fields: custodyFields, rows: custodies });

  const personName = directory.get(id)?.name ?? '';
  const filterCount = (search.trim() ? 1 : 0) + [kind, state].filter((v) => v !== 'all').length + (period.from || period.to ? 1 : 0);
  const periodLine = period.from || period.to ? `الفترة: ${period.from || '…'} إلى ${period.to || '…'}` : null;
  const balanceLine = period.from ? `رصيد أول المدة: ${currency.format(opening)} · رصيد آخر المدة: ${currency.format(closing)}` : `الصافي: ${currency.format(closing)}`;

  usePageHeaderActions(
    () => {
      if (tab === 'parties') {
        return <LocalListToolbar list={pairList} title={`مستحقات ${personName} مع الأطراف`} fileName="person-parties" before={<FilterToggleButton activeFilterCount={partySearch.trim() ? 1 : 0} />} />;
      }
      if (tab === 'custodies') {
        return <LocalListToolbar list={custodyList} title={`عهد ${personName}`} fileName="person-custodies" before={<FilterToggleButton activeFilterCount={custodySearch.trim() ? 1 : 0} />} />;
      }
      return (
        <LocalListToolbar
          list={lineList}
          title={`كشف حساب ${personName}`}
          fileName="person-statement"
          subtitleLines={[...(periodLine ? [periodLine] : []), balanceLine]}
          before={<FilterToggleButton activeFilterCount={filterCount} />}
        />
      );
    },
    [tab, personName, filterCount, partySearch, custodySearch, periodLine, balanceLine, lineList.rows, lineList.visibleFields, lineList.groups, lineList.sort.sortKey, pairList.rows, pairList.visibleFields, pairList.groups, pairList.sort.sortKey, custodyList.rows, custodyList.visibleFields, custodyList.groups, custodyList.sort.sortKey],
  );

  useEntityFilterSlot(
    () => {
      if (tab !== 'statement') {
        const value = tab === 'parties' ? partySearch : custodySearch;
        const onChange = tab === 'parties' ? setPartySearch : setCustodySearch;
        return (
          <ListFilterBar
            showDateSection={false}
            showStatusSection={false}
            showEmployeePicker={false}
            leadingFilters={<EntityFilterSearchField value={value} onChange={onChange} placeholder={tab === 'parties' ? 'بحث باسم الطرف' : 'بحث بالغرض'} />}
          />
        );
      }
      return (
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
            setState('all');
            setPeriod({ from: '', to: '' });
          }}
          leadingFilters={<EntityFilterSearchField value={search} onChange={setSearch} placeholder="بحث في البيان" />}
          inlineSelects={[
            { id: 'kind', value: kind, onChange: setKind, placeholder: 'كل الأنواع', options: [{ value: 'all', label: 'كل الأنواع' }, ...(Object.keys(TXN_KIND_LABELS) as AnyTxn['kind'][]).map((k) => ({ value: k, label: TXN_KIND_LABELS[k] }))] },
            { id: 'state', value: state, onChange: setState, placeholder: 'المعتمد والمعلق', options: [{ value: 'all', label: 'المعتمد والمعلق' }, { value: 'approved', label: 'المعتمد فقط' }, { value: 'pending', label: 'المعلق فقط' }] },
          ]}
        />
      );
    },
    [tab, search, kind, state, period, partySearch, custodySearch, filterCount],
  );

  if (!data || !ledger) return <LoadingBlock />;
  const person = directory.get(id);
  if (!person) return <EmptyState text="المشارك غير موجود" />;
  if (!seesAll && id !== me) return <EmptyState text="ليس لديك صلاحية لرؤية حساب هذا الشخص" />;
  const b = partyBalance(ledger, id);

  return (
    <div className="space-y-3">
      <SetPageTitle titleAr={person.name} descriptionAr="كشف حساب المشارك" iconName="Users" />
      <Button variant="ghost" size="sm" asChild><Link href={expensesRoutes.people}><ArrowRight className="me-1 h-4 w-4" />حسابات الأشخاص</Link></Button>
      <div className="flex flex-wrap items-center gap-1.5"><SourceBadge id={id} /><span className="text-xs text-muted-foreground">{KIND_LABELS[person.kind]}</span></div>

      <PhoneStatsFold summary={<>الصافي <Money value={closing} /></>}>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">له (مستحقات)</p><Money value={b.entitlements} className="text-sm font-bold text-success sm:text-lg" /></div>
          <div className="rounded-2xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">عليه (التزامات)</p><Money value={b.liabilities} className="text-sm font-bold text-destructive sm:text-lg" /></div>
          <div className="rounded-2xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">العهدة</p><Money value={b.custodyActual} className="text-sm font-bold text-primary sm:text-lg" />{b.custodyExpected !== b.custodyActual ? <p className="text-[10px] text-warning">متوقع <Money value={b.custodyExpected} /></p> : null}</div>
        </div>
      </PhoneStatsFold>

      <Tabs value={tab} onValueChange={(v) => setTab(v as PersonTab)}>
        <TabsList className="grid h-auto w-full grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="statement" className="px-1.5 text-xs sm:px-3 sm:text-sm">كشف الحساب ({allLines.length})</TabsTrigger>
          <TabsTrigger value="parties" className="px-1.5 text-xs sm:px-3 sm:text-sm">مع كل طرف ({b.pairs.length})</TabsTrigger>
          <TabsTrigger value="custodies" className="px-1.5 text-xs sm:px-3 sm:text-sm">العهد ({[...ledger.custodies.values()].filter((c) => c.custody.holderId === id).length})</TabsTrigger>
        </TabsList>
        <TabsContent value="statement" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">له يزيد ما يستحقه، عليه يزيد ما يلتزم به؛ المعلق لا يحرك الرصيد.</p>
          {period.from ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-xs">
              <span>رصيد أول المدة: <Money value={opening} className="font-semibold" /></span>
              <span>رصيد آخر المدة: <Money value={closing} className="font-semibold" /></span>
            </div>
          ) : null}
          <LocalListTable
            list={lineList}
            rowKey={(l) => l.txn.kind + l.txn.id}
            onRowClick={(l) => router.push(txnHref(l.txn))}
            empty={<EmptyState text={filterCount > 0 && allLines.length > 0 ? 'لا نتائج لهذه الفلاتر' : 'لا حركات'} />}
            card={(l) => (
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm">{txnTitle(l.txn, directory.nameOf)}</p>
                  {l.pending ? <StatusBadge status={l.txn.status} /> : null}
                </div>
                <div className="flex flex-wrap gap-x-3 text-xs">
                  <span className="text-muted-foreground">{l.txn.date}</span>
                  {l.credit ? <span className="text-success">له <Money value={l.credit} /></span> : null}
                  {l.debit ? <span className="text-destructive">عليه <Money value={l.debit} /></span> : null}
                  {l.custody ? <span className="text-primary">عهدة <Money value={l.custody} signed /></span> : null}
                </div>
                {!l.pending ? <p className="text-[11px] text-muted-foreground">الصافي بعدها <Money value={l.balance} /> · العهدة <Money value={l.custodyBalance} /></p> : null}
              </div>
            )}
          />
        </TabsContent>
        <TabsContent value="parties" className="mt-3 space-y-2">
          <Section title="مع كل طرف" description="بعد المقاصة بين الطرفين فقط">
            <LocalListTable
              list={pairList}
              rowKey={(p) => p.counterparty}
              empty={<EmptyState text={partySearch.trim() ? 'لا نتائج لهذا البحث' : 'لا مستحقات'} />}
              card={(p) => (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <PartyName id={p.counterparty} />
                    <p className="text-[11px] text-muted-foreground">{p.net > 0 ? 'عليه له' : 'له عليه'}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Money value={Math.abs(p.net)} className={p.net > 0 ? 'font-semibold text-destructive' : 'font-semibold text-success'} />
                    {perms.settle ? (
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="تسوية" onClick={() => setSettle(p.net > 0 ? { fromId: id, toId: p.counterparty, amount: p.net } : { fromId: p.counterparty, toId: id, amount: -p.net })}>
                        <HandCoins className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
            />
          </Section>
        </TabsContent>
        <TabsContent value="custodies" className="mt-3">
          <LocalListTable
            list={custodyList}
            rowKey={(c) => c.custody.id}
            onRowClick={(c) => router.push(expensesRoutes.custodyDetail(c.custody.id))}
            empty={<EmptyState text={custodySearch.trim() ? 'لا نتائج لهذا البحث' : 'لا عهد'} />}
            card={(c) => (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{c.custody.purpose}</span>
                <Money value={c.actual} className="font-semibold" />
              </div>
            )}
          />
        </TabsContent>
      </Tabs>
      <SettlementDialog open={settle !== null} onOpenChange={(o) => !o && setSettle(null)} preset={settle} />
    </div>
  );
}
