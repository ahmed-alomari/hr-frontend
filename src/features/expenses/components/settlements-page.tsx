'use client';

import * as React from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { Button } from '@/components/ui/button';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListFilterBar, type PeriodRange } from '@/components/ui/list-filter-bar';
import { LocalListTable, LocalListToolbar, useLocalList, type LocalListField } from '@/components/ui/local-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUrlTab } from '@/components/ui/use-url-tab';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';
import { useExpensesStore } from '../data/store';
import { owedBetween } from '../domain/commands';
import { STATUS_LABELS_AR } from '../domain/policy';
import { settlementSuggestions, type SettlementSuggestion } from '../domain/ledger';
import { minorToInput, type Minor } from '../domain/money';
import type { PartyId, Settlement, TxnStatus } from '../domain/types';
import { AmountInput, EmptyState, Field, FormDialog, LoadingBlock, Money, PartyName, PartySelect, StatusBadge, useRunCommand, BranchSelect } from './common';
import { todayIso, useCurrency, useDirectory, useExpensesData, useExpensesPermissions, useLedger, useBranches, branchListFields } from './expenses-provider';
import { GroupField } from './group-policy';
import { TxnActions } from './txn-actions';
import { BranchTransferDialog, useBranchDues, useBranchTransfers, VoidBranchTransferDialog } from './branch-dues';

const METHOD_LABELS: Record<Settlement['method'], string> = { cash: 'نقداً', transfer: 'تحويل', payroll: 'خصم من الراتب (يدوي)', other: 'أخرى' };

export function SettlementDialog({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preset?: { fromId: PartyId; toId: PartyId; amount: Minor } | null;
}) {
  const data = useExpensesData();
  const currency = useCurrency();
  const run = useRunCommand();
  const [fromId, setFromId] = React.useState<PartyId | null>(null);
  const [toId, setToId] = React.useState<PartyId | null>(null);
  const [amount, setAmount] = React.useState<{ t: string; m: Minor }>({ t: '', m: 0 });
  const [method, setMethod] = React.useState<Settlement['method']>('cash');
  const [date, setDate] = React.useState(todayIso());
  const [note, setNote] = React.useState('');
  const [groupId, setGroupId] = React.useState<string | null>(null);
  const branches = useBranches();
  const [branchId, setBranchId] = React.useState('');
  React.useEffect(() => {
    if (!open) return;
    setGroupId(null);
    setBranchId(branches.defaultValue);
    setFromId(preset?.fromId ?? null);
    setToId(preset?.toId ?? null);
    setAmount(preset ? { t: minorToInput(preset.amount, currency.decimals), m: preset.amount } : { t: '', m: 0 });
    setMethod('cash');
    setDate(todayIso());
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when the dialog opens
  }, [open, preset, currency.decimals]);
  if (!data) return null;
  const owed = fromId && toId ? owedBetween(data, fromId, toId, currency.code) : 0;
  const save = () => {
    if (!fromId || !toId) return;
    const excess = amount.m > owed;
    if (excess && !window.confirm('المبلغ أكبر مما على الدافع لهذا الطرف؛ الزيادة تصبح مستحقة للدافع. متابعة؟')) return;
    void run({ type: 'addSettlement', fromId, toId, amount: amount.m, method, date, note: note.trim() || null, groupId, branchId: branchId || null, allowExcess: excess }, 'سُجّل السداد').then((ok) => ok && onOpenChange(false));
  };
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="تسجيل سداد"
      description="دفعة من طرف لآخر (أو مع المنشأة) تقلل ما بينهما."
      footer={<>
        <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        <Button disabled={!fromId || !toId || fromId === toId || amount.m <= 0} onClick={save}>تسجيل</Button>
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <Field label="الدافع"><PartySelect value={fromId} onChange={setFromId} includeOrg /></Field>
        <ArrowLeft className="mx-auto hidden h-5 w-5 text-muted-foreground sm:block" />
        <Field label="المستلم"><PartySelect value={toId} onChange={setToId} includeOrg exclude={fromId ? [fromId] : []} /></Field>
      </div>
      {fromId && toId ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs">
          على <PartyName id={fromId} link={false} /> لـ <PartyName id={toId} link={false} /> حالياً: <Money value={owed} className="font-semibold" />
          {owed > 0 ? <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={() => setAmount({ t: minorToInput(owed, currency.decimals), m: owed })}>سداد الكل</Button> : null}
        </p>
      ) : null}
      <Field label="المبلغ"><AmountInput value={amount.t} onChange={(t, m) => setAmount({ t, m })} /></Field>
      {branches.show ? <BranchSelect value={branchId} onChange={(v) => { setBranchId(v); setGroupId(null); }} options={branches.options} /> : null}
      <GroupField value={groupId} onChange={setGroupId} amount={amount.m} branchId={branchId || null} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الطريقة">
          <Select value={method} onValueChange={(v) => setMethod(v as Settlement['method'])}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(METHOD_LABELS) as Settlement['method'][]).map((m) => <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="التاريخ"><Input type="date" className="h-10" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="ملاحظة"><Input className="h-10" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </FormDialog>
  );
}

const TABS = ['due', 'history', 'branches', 'transfers'] as const;
type Tab = (typeof TABS)[number];

export function SettlementsPage() {
  const branches = useBranches();
  const data = useExpensesData();
  const ledger = useLedger();
  const currency = useCurrency();
  const perms = useExpensesPermissions();
  const directory = useDirectory();
  const companyId = useExpensesStore((s) => s.companyId);
  const [tab, setTab] = useUrlTab<Tab>(TABS, 'due');
  const [dialog, setDialog] = React.useState<SettlementSuggestion | null | 'new'>(null);

  const dueKey = (field: string) => hrFiltersKey('expenses', 'settlements-due', companyId, field);
  const historyKey = (field: string) => hrFiltersKey('expenses', 'settlements', companyId, field);
  const [dueSearch, setDueSearch] = usePersistedFilterState(dueKey('search'), '');
  const [duePerson, setDuePerson] = usePersistedFilterState(dueKey('person'), 'all');
  const [search, setSearch] = usePersistedFilterState(historyKey('search'), '');
  const [person, setPerson] = usePersistedFilterState(historyKey('person'), 'all');
  const [status, setStatus] = usePersistedFilterState(historyKey('status'), 'all');
  const [method, setMethod] = usePersistedFilterState(historyKey('method'), 'all');
  const [period, setPeriod] = usePersistedFilterState<PeriodRange>(historyKey('period'), { from: '', to: '' });
  const branchKey = (field: string) => hrFiltersKey('expenses', 'branch-dues', companyId, field);
  const [branchFilter, setBranchFilter] = usePersistedFilterState(branchKey('branch'), 'all');
  const [transferPeriod, setTransferPeriod] = usePersistedFilterState<PeriodRange>(branchKey('period'), { from: '', to: '' });
  const dues = useBranchDues(branchFilter);
  const transfers = useBranchTransfers(branchFilter, transferPeriod);

  const suggestions = React.useMemo(() => (ledger ? settlementSuggestions(ledger) : []), [ledger]);
  const dueRows = React.useMemo(() => {
    const q = dueSearch.trim();
    return suggestions.filter(
      (s) =>
        (duePerson === 'all' || s.fromId === duePerson || s.toId === duePerson) &&
        (!q || directory.nameOf(s.fromId).includes(q) || directory.nameOf(s.toId).includes(q)),
    );
  }, [suggestions, dueSearch, duePerson, directory]);
  const dueFields = React.useMemo<LocalListField<SettlementSuggestion>[]>(() => [
    { key: 'from', label: 'الدافع', kind: 'name', text: (s) => directory.nameOf(s.fromId), cell: (s) => <PartyName id={s.fromId} />, groupKey: (s) => s.fromId, groupLabel: (id) => directory.nameOf(id) },
    { key: 'to', label: 'المستلم', text: (s) => directory.nameOf(s.toId), cell: (s) => <PartyName id={s.toId} />, groupKey: (s) => s.toId, groupLabel: (id) => directory.nameOf(id) },
    { key: 'amount', label: 'المبلغ', kind: 'number', text: (s) => currency.format(s.amount), sortValue: (s) => s.amount, sum: (s) => s.amount, formatSum: currency.format, cell: (s) => <Money value={s.amount} className="font-bold" /> },
    { key: 'actions', label: '', sortable: false, screenOnly: true, text: () => '', cell: (s) => (perms.settle ? <Button size="sm" onClick={() => setDialog(s)}>سداد</Button> : null) },
  ], [directory, currency, perms.settle]);
  const due = useLocalList({ section: 'expenses', page: 'settlements-due', fields: dueFields, rows: dueRows });

  const history = React.useMemo(() => {
    if (!data) return [];
    const q = search.trim();
    return data.settlements
      .filter(
        (s) =>
          s.currency === currency.code &&
          (status === 'all' || s.status === status) &&
          (method === 'all' || s.method === method) &&
          (person === 'all' || s.fromId === person || s.toId === person) &&
          (!period.from || s.date >= period.from) &&
          (!period.to || s.date <= period.to) &&
          (!q || directory.nameOf(s.fromId).includes(q) || directory.nameOf(s.toId).includes(q) || (s.note ?? '').includes(q)),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, currency.code, status, method, person, period, search, directory]);
  const fields = React.useMemo<LocalListField<Settlement>[]>(() => [
    { key: 'date', label: 'التاريخ', kind: 'date', text: (s) => s.date, groupKey: (s) => s.date.slice(0, 7) },
    { key: 'from', label: 'الدافع', kind: 'name', text: (s) => directory.nameOf(s.fromId), cell: (s) => <PartyName id={s.fromId} />, groupKey: (s) => s.fromId, groupLabel: (id) => directory.nameOf(id) },
    { key: 'to', label: 'المستلم', text: (s) => directory.nameOf(s.toId), cell: (s) => <PartyName id={s.toId} />, groupKey: (s) => s.toId, groupLabel: (id) => directory.nameOf(id) },
    { key: 'method', label: 'الطريقة', text: (s) => METHOD_LABELS[s.method], groupKey: (s) => s.method, groupLabel: (m) => METHOD_LABELS[m as Settlement['method']] ?? m },
    ...branchListFields<Settlement>(branches, (s) => s.branchId),
    { key: 'note', label: 'ملاحظة', optional: true, hiddenByDefault: true, sortable: false, text: (s) => s.note ?? '' },
    { key: 'createdBy', label: 'سجّله', optional: true, hiddenByDefault: true, text: (s) => directory.nameOf(s.createdBy), groupKey: (s) => s.createdBy, groupLabel: (id) => directory.nameOf(id) },
    { key: 'amount', label: 'المبلغ', kind: 'number', text: (s) => currency.format(s.amount), sortValue: (s) => s.amount, sum: (s) => (s.status === 'approved' ? s.amount : 0), formatSum: currency.format, cell: (s) => <Money value={s.amount} className="font-semibold" /> },
    { key: 'status', label: 'الحالة', kind: 'status', text: (s) => STATUS_LABELS_AR[s.status], cell: (s) => <StatusBadge status={s.status} />, groupKey: (s) => s.status, groupLabel: (k) => STATUS_LABELS_AR[k as TxnStatus] ?? k },
    { key: 'actions', label: '', sortable: false, screenOnly: true, text: () => '', cell: (s) => <TxnActions txn={s} compact /> },
  ], [directory, currency, branches]);
  const list = useLocalList({ section: 'expenses', page: 'settlements', fields, rows: history });

  const dueFilterCount = (dueSearch.trim() ? 1 : 0) + (duePerson !== 'all' ? 1 : 0);
  const historyFilterCount =
    (search.trim() ? 1 : 0) + [person, status, method].filter((v) => v !== 'all').length + (period.from || period.to ? 1 : 0);
  const periodLine = period.from || period.to ? `الفترة: ${period.from || '…'} إلى ${period.to || '…'}` : null;
  const branchFilterCount = branchFilter !== 'all' ? 1 : 0;
  const transferFilterCount = branchFilterCount + (transferPeriod.from || transferPeriod.to ? 1 : 0);
  const transferPeriodLine = transferPeriod.from || transferPeriod.to ? `الفترة: ${transferPeriod.from || '…'} إلى ${transferPeriod.to || '…'}` : null;
  const branchFilterSelect = {
    id: 'branch',
    value: branchFilter === '' ? '__company__' : branchFilter,
    onChange: (v: string) => setBranchFilter(v === '__company__' ? '' : v),
    placeholder: 'كل الفروع',
    options: [{ value: 'all', label: 'كل الفروع' }, ...branches.options.map((o) => ({ value: o.value || '__company__', label: o.label }))],
  };

  usePageHeaderActions(
    () => {
      const primary = (
        <PageHeaderPrimaryButton icon={Plus} label="تسجيل سداد" disabled={!perms.settle} onClick={() => setDialog('new')}>
          تسجيل سداد
        </PageHeaderPrimaryButton>
      );
      const branchPrimary = (
        <PageHeaderPrimaryButton icon={Plus} label="تسوية بين فرعين" disabled={!perms.settle} onClick={() => dues.setTransfer('new')}>
          تسوية بين فرعين
        </PageHeaderPrimaryButton>
      );
      const branchLine = branchFilter === 'all' ? null : `الفرع: ${branches.nameOf(branchFilter || null)}`;
      if (tab === 'branches')
        return <LocalListToolbar list={dues.list} title="المستحقات بين الفروع" fileName="branch-dues" subtitleLines={branchLine ? [branchLine] : []} before={<FilterToggleButton activeFilterCount={branchFilterCount} />} primary={branchPrimary} />;
      if (tab === 'transfers')
        return <LocalListToolbar list={transfers.list} title="التسويات بين الفروع" fileName="branch-transfers" subtitleLines={[...(branchLine ? [branchLine] : []), ...(transferPeriodLine ? [transferPeriodLine] : [])]} before={<FilterToggleButton activeFilterCount={transferFilterCount} />} primary={branchPrimary} />;
      return tab === 'due'
        ? <LocalListToolbar list={due} title="مطلوب سداده" fileName="settlements-due" before={<FilterToggleButton activeFilterCount={dueFilterCount} />} primary={primary} />
        : <LocalListToolbar list={list} title="سجل السداد" fileName="settlements" subtitleLines={['المبالغ المجمّعة للمعتمد فقط', ...(periodLine ? [periodLine] : [])]} before={<FilterToggleButton activeFilterCount={historyFilterCount} />} primary={primary} />;
    },
    [tab, perms.settle, dueFilterCount, historyFilterCount, periodLine, due.rows, due.visibleFields, due.groups, due.sort.sortKey, list.rows, list.visibleFields, list.groups, list.sort.sortKey, branchFilter, branchFilterCount, transferFilterCount, transferPeriodLine, dues.list.rows, dues.list.visibleFields, dues.list.groups, dues.list.sort.sortKey, transfers.list.rows, transfers.list.visibleFields, transfers.list.groups, transfers.list.sort.sortKey],
  );

  const personOptions = [{ value: 'all', label: 'كل الأشخاص' }, ...directory.choices.map((p) => ({ value: p.id, label: p.name }))];
  useEntityFilterSlot(
    () =>
      tab === 'branches' ? (
        <ListFilterBar
          showDateSection={false}
          showStatusSection={false}
          showEmployeePicker={false}
          periodFilterActive={branchFilterCount > 0}
          onClearAll={() => setBranchFilter('all')}
          inlineSelects={[branchFilterSelect]}
        />
      ) : tab === 'transfers' ? (
        <ListFilterBar
          optionalDateRange
          showStatusSection={false}
          showEmployeePicker={false}
          periodValue={transferPeriod}
          onPeriodChange={setTransferPeriod}
          periodFilterActive={transferFilterCount > 0}
          onClearAll={() => {
            setBranchFilter('all');
            setTransferPeriod({ from: '', to: '' });
          }}
          inlineSelects={[branchFilterSelect]}
        />
      ) : tab === 'due' ? (
        <ListFilterBar
          showDateSection={false}
          showStatusSection={false}
          showEmployeePicker={false}
          periodFilterActive={dueFilterCount > 0}
          onClearAll={() => {
            setDueSearch('');
            setDuePerson('all');
          }}
          leadingFilters={<EntityFilterSearchField value={dueSearch} onChange={setDueSearch} placeholder="بحث بالاسم" />}
          inlineSelects={[{ id: 'person', value: duePerson, onChange: setDuePerson, placeholder: 'كل الأشخاص', options: personOptions }]}
        />
      ) : (
        <ListFilterBar
          optionalDateRange
          showStatusSection={false}
          showEmployeePicker={false}
          periodValue={period}
          onPeriodChange={setPeriod}
          periodFilterActive={historyFilterCount > 0}
          onClearAll={() => {
            setSearch('');
            setPerson('all');
            setStatus('all');
            setMethod('all');
            setPeriod({ from: '', to: '' });
          }}
          leadingFilters={<EntityFilterSearchField value={search} onChange={setSearch} placeholder="بحث بالاسم أو الملاحظة" />}
          inlineSelects={[
            { id: 'person', value: person, onChange: setPerson, placeholder: 'كل الأشخاص', options: personOptions },
            { id: 'status', value: status, onChange: setStatus, placeholder: 'كل الحالات', options: [{ value: 'all', label: 'كل الحالات' }, ...(Object.keys(STATUS_LABELS_AR) as TxnStatus[]).map((s) => ({ value: s, label: STATUS_LABELS_AR[s] }))] },
            { id: 'method', value: method, onChange: setMethod, placeholder: 'كل الطرق', options: [{ value: 'all', label: 'كل الطرق' }, ...(Object.keys(METHOD_LABELS) as Settlement['method'][]).map((m) => ({ value: m, label: METHOD_LABELS[m] }))] },
          ]}
        />
      ),
    [tab, dueSearch, duePerson, search, person, status, method, period, directory.choices, dueFilterCount, historyFilterCount, branchFilter, transferPeriod, branches.options],
  );

  if (!data || !ledger) return <LoadingBlock />;

  return (
    <div className="space-y-3">
      <SetPageTitle titleAr="التسويات والسداد" descriptionAr="ما يلزم سداده بين الأطراف ومع المنشأة" iconName="Banknote" />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className={branches.hasBranches ? 'grid w-full grid-cols-2 sm:inline-flex sm:w-auto' : 'grid w-full grid-cols-2 sm:inline-flex sm:w-auto'}>
          <TabsTrigger value="due">مطلوب سداده ({suggestions.length})</TabsTrigger>
          <TabsTrigger value="history">سجل السداد ({data.settlements.filter((s) => s.currency === currency.code).length})</TabsTrigger>
          {branches.hasBranches ? <TabsTrigger value="branches">بين الفروع ({dues.rows.length})</TabsTrigger> : null}
          {branches.hasBranches ? <TabsTrigger value="transfers">تسويات الفروع ({transfers.rows.length})</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="due" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">دفعة مباشرة لكل طرفين بينهما مستحق.</p>
          <LocalListTable
            list={due}
            rowKey={(s) => s.fromId + s.toId}
            empty={<EmptyState text={suggestions.length === 0 ? 'لا مستحقات قائمة — كل الحسابات مسوّاة' : 'لا نتائج لهذه الفلاتر'} />}
            card={(s) => (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-sm">
                  <p className="truncate"><PartyName id={s.fromId} /> <span className="text-muted-foreground">يدفع لـ</span> <PartyName id={s.toId} /></p>
                  <Money value={s.amount} className="font-bold" />
                </div>
                {perms.settle ? <Button size="sm" onClick={() => setDialog(s)}>سداد</Button> : null}
              </div>
            )}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-3">
          <LocalListTable
            list={list}
            rowKey={(s) => s.id}
            empty={<EmptyState text={historyFilterCount > 0 ? 'لا نتائج لهذه الفلاتر' : 'لا عمليات سداد'} />}
            card={(s) => (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2"><p className="min-w-0 text-sm"><PartyName id={s.fromId} /> ← <PartyName id={s.toId} /></p><Money value={s.amount} className="font-semibold" /></div>
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{s.date} · {METHOD_LABELS[s.method]}{s.note ? ` · ${s.note}` : ''}</span><StatusBadge status={s.status} /></div>
                <TxnActions txn={s} compact />
              </div>
            )}
          />
        </TabsContent>
        <TabsContent value="branches" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">مصروف فرع دُفع من عهدة فرع آخر يجعل الأول مديناً للثاني. إجمالي الشركة لا يتغير.</p>
          <LocalListTable
            list={dues.list}
            rowKey={(d) => d.key}
            empty={<EmptyState text={dues.rows.length === 0 ? 'لا مستحقات بين الفروع' : 'لا نتائج لهذه الفلاتر'} />}
            card={(d) => (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-sm">
                  <p className="truncate">{branches.nameOf(d.fromBranchId)} <span className="text-muted-foreground">مدين لـ</span> {branches.nameOf(d.toBranchId)}</p>
                  <Money value={d.amount} className="font-bold" />
                </div>
                {perms.settle ? <Button size="sm" onClick={() => dues.setTransfer(d)}>تسوية</Button> : null}
              </div>
            )}
          />
        </TabsContent>
        <TabsContent value="transfers" className="mt-3">
          <LocalListTable
            list={transfers.list}
            rowKey={(x) => x.id}
            empty={<EmptyState text={transferFilterCount > 0 ? 'لا نتائج لهذه الفلاتر' : 'لا تسويات بين الفروع'} />}
            card={(x) => (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm">{branches.nameOf(x.fromBranchId)} ← {branches.nameOf(x.toBranchId)}</p>
                  <Money value={x.amount} className={x.voidedAt ? 'line-through text-muted-foreground' : 'font-semibold'} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{x.date}{x.note ? ` · ${x.note}` : ''}{x.voidedAt ? ' · ملغاة' : ''}</span>
                  {perms.settle && !x.voidedAt ? <Button size="sm" variant="ghost" className="text-destructive" onClick={() => transfers.setVoiding(x)}>إلغاء</Button> : null}
                </div>
              </div>
            )}
          />
        </TabsContent>
      </Tabs>
      <BranchTransferDialog open={dues.transfer !== null} onOpenChange={(o) => !o && dues.setTransfer(null)} preset={dues.transfer === 'new' ? null : dues.transfer} />
      <VoidBranchTransferDialog transfer={transfers.voiding} onClose={() => transfers.setVoiding(null)} />
      <SettlementDialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)} preset={dialog === 'new' ? null : dialog} />
    </div>
  );
}
