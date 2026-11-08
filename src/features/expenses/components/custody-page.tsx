'use client';

import * as React from 'react';
import Link from 'next/link';
import { Archive, ArrowDownToLine, ArrowRight, ArrowUpFromLine, Lock, Plus, RotateCcw } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LocalListTable, LocalListToolbar, useLocalList, type LocalListField } from '@/components/ui/local-list';
import { allTxns, partyBalance, type CustodyBalance } from '../domain/ledger';
import type { Minor } from '../domain/money';
import { STATUS_LABELS_AR } from '../domain/policy';
import type { Advance, AnyTxn, TxnStatus } from '../domain/types';
import { ImportLinkButton } from './import-page';
import { expensesRoutes } from '../constants/routes';
import { AmountInput, EmptyState, Field, FormDialog, KeyValue, LoadingBlock, Money, PartyName, PartySelect, ResponsiveTable, Section, StatusBadge, useRunCommand } from './common';
import { txnTitle } from './dashboard-page';
import { todayIso, useCurrency, useDirectory, useExpensesData, useExpensesPermissions, useLedger } from './expenses-provider';
import { GroupField, GroupPolicyHint } from './group-policy';
import { TxnActions } from './txn-actions';

function OpenCustodyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const exec = useRunCommand();
  const [holderId, setHolderId] = React.useState<string | null>(null);
  const [purpose, setPurpose] = React.useState('');
  const [amount, setAmount] = React.useState<{ t: string; m: Minor }>({ t: '', m: 0 });
  const [limit, setLimit] = React.useState<{ t: string; m: Minor }>({ t: '', m: 0 });
  const [date, setDate] = React.useState(todayIso());
  const [groupId, setGroupId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) { setHolderId(null); setPurpose(''); setAmount({ t: '', m: 0 }); setLimit({ t: '', m: 0 }); setDate(todayIso()); setGroupId(null); }
  }, [open]);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="فتح عهدة تشغيلية"
      description="مال المنشأة لدى شخص يصرف منه نيابة عنها — ليست سلفة عليه."
      footer={<>
        <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        <Button disabled={!holderId || amount.m <= 0} onClick={() => { if (holderId) void exec({ type: 'openCustody', holderId, purpose, limit: limit.m > 0 ? limit.m : null, amount: amount.m, date, groupId }, 'فُتحت العهدة').then((ok) => ok && onOpenChange(false)); }}>فتح وتسليم</Button>
      </>}
    >
      <Field label="حامل العهدة"><PartySelect value={holderId} onChange={setHolderId} /></Field>
      <Field label="الغرض"><Input className="h-10" placeholder="مثال: مصاريف الفرع والزيارات" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="مبلغ التسليم"><AmountInput value={amount.t} onChange={(t, m) => setAmount({ t, m })} /></Field>
        <Field label="سقف العهدة (اختياري)"><AmountInput value={limit.t} onChange={(t, m) => setLimit({ t, m })} /></Field>
      </div>
      <GroupField value={groupId} onChange={setGroupId} amount={amount.m} />
      <Field label="التاريخ"><Input type="date" className="h-10" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
    </FormDialog>
  );
}

function MoveDialog({ balance, type, onClose }: { balance: CustodyBalance | null; type: 'topup' | 'return'; onClose: () => void }) {
  const exec = useRunCommand();
  const directory = useDirectory();
  const [amount, setAmount] = React.useState<{ t: string; m: Minor }>({ t: '', m: 0 });
  const [note, setNote] = React.useState('');
  const [date, setDate] = React.useState(todayIso());
  React.useEffect(() => { setAmount({ t: '', m: 0 }); setNote(''); setDate(todayIso()); }, [balance?.custody.id, type]);
  if (!balance) return null;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={type === 'topup' ? 'تغذية العهدة' : 'إرجاع من العهدة'}
      description={`${directory.nameOf(balance.custody.holderId)} — ${balance.custody.purpose}`}
      footer={<>
        <Button variant="outline" onClick={onClose}>إلغاء</Button>
        <Button disabled={amount.m <= 0} onClick={() => { void exec({ type: 'addCustodyMove', custodyId: balance.custody.id, moveType: type, amount: amount.m, date, note: note.trim() || null }, type === 'topup' ? 'سُجّلت التغذية' : 'سُجّل الإرجاع').then((ok) => ok && onClose()); }}>تسجيل</Button>
      </>}
    >
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-xl bg-muted p-2">الرصيد الفعلي<br /><Money value={balance.actual} className="font-semibold" /></div>
        <div className="rounded-xl bg-muted p-2">المتاح بعد المعلق<br /><Money value={balance.expected} className="font-semibold" /></div>
      </div>
      <Field label="المبلغ" hint={type === 'return' ? 'لا يتجاوز المتاح بعد المعلق.' : balance.custody.limit != null ? 'ضمن سقف العهدة.' : undefined}><AmountInput value={amount.t} onChange={(t, m) => setAmount({ t, m })} /></Field>
      {amount.m > 0 ? <GroupPolicyHint groupId={balance.custody.groupId ?? null} amount={amount.m} /> : null}
      <Field label="التاريخ"><Input type="date" className="h-10" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="ملاحظة"><Input className="h-10" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </FormDialog>
  );
}

function AdvanceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const exec = useRunCommand();
  const [personId, setPersonId] = React.useState<string | null>(null);
  const [purpose, setPurpose] = React.useState('');
  const [amount, setAmount] = React.useState<{ t: string; m: Minor }>({ t: '', m: 0 });
  const [date, setDate] = React.useState(todayIso());
  const [groupId, setGroupId] = React.useState<string | null>(null);
  React.useEffect(() => { if (open) { setPersonId(null); setPurpose(''); setAmount({ t: '', m: 0 }); setDate(todayIso()); setGroupId(null); } }, [open]);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="سلفة شخصية"
      description="مبلغ يصبح على الشخص للمنشأة، ويُسدَّد بالتسويات — منفصل عن العهد."
      footer={<>
        <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        <Button disabled={!personId || amount.m <= 0} onClick={() => { if (personId) void exec({ type: 'addAdvance', personId, amount: amount.m, purpose, date, groupId }, 'سُجّلت السلفة').then((ok) => ok && onOpenChange(false)); }}>تسجيل</Button>
      </>}
    >
      <Field label="الشخص"><PartySelect value={personId} onChange={setPersonId} /></Field>
      <Field label="المبلغ"><AmountInput value={amount.t} onChange={(t, m) => setAmount({ t, m })} /></Field>
      <Field label="الغرض"><Input className="h-10" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field>
      <GroupField value={groupId} onChange={setGroupId} amount={amount.m} />
      <Field label="التاريخ"><Input type="date" className="h-10" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
    </FormDialog>
  );
}

function CustodyCard({ b, onMove, onClose, onArchive }: { b: CustodyBalance; onMove: (t: 'topup' | 'return') => void; onClose: () => void; onArchive: () => void }) {
  const perms = useExpensesPermissions();
  const used = b.custody.limit ? Math.min(100, Math.round((b.actual / b.custody.limit) * 100)) : null;
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <Link href={expensesRoutes.custodyDetail(b.custody.id)} className="block">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0"><p className="truncate text-sm font-semibold"><PartyName id={b.custody.holderId} link={false} /></p><p className="truncate text-xs text-muted-foreground">{b.custody.purpose}</p></div>
          <Badge variant={b.custody.status === 'open' ? 'success' : 'subtle'}>{b.custody.archived ? 'مؤرشفة' : b.custody.status === 'open' ? 'مفتوحة' : 'مقفلة'}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div><p className="text-muted-foreground">الرصيد الفعلي</p><Money value={b.actual} className="text-base font-bold" /></div>
          <div><p className="text-muted-foreground">المتوقع بعد المعلق</p><Money value={b.expected} className={b.pendingOut > 0 ? 'text-base font-semibold text-warning' : 'text-base font-semibold'} /></div>
        </div>
        {used !== null ? (
          <div className="mt-2 space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${used}%` }} /></div>
            <p className="text-[11px] text-muted-foreground">السقف <Money value={b.custody.limit!} /></p>
          </div>
        ) : null}
        <p className="mt-2 text-[11px] text-muted-foreground">سُلّم <Money value={b.issued + b.toppedUp} /> · صُرف <Money value={b.spent} /> · أُرجع <Money value={b.returned} /></p>
      </Link>
      {b.custody.status === 'open' && perms.custody ? (
        <div className="grid grid-cols-3 gap-1.5">
          <Button size="sm" variant="outline" onClick={() => onMove('topup')}><ArrowDownToLine className="me-1 h-3.5 w-3.5" />تغذية</Button>
          <Button size="sm" variant="outline" onClick={() => onMove('return')}><ArrowUpFromLine className="me-1 h-3.5 w-3.5" />إرجاع</Button>
          <Button size="sm" variant="outline" onClick={onClose}><Lock className="me-1 h-3.5 w-3.5" />تسوية وإقفال</Button>
        </div>
      ) : null}
      {b.custody.status === 'closed' && perms.custody ? (
        <Button size="sm" variant="ghost" className="w-full" onClick={onArchive}>
          {b.custody.archived ? <><RotateCcw className="me-1 h-3.5 w-3.5" />استعادة</> : <><Archive className="me-1 h-3.5 w-3.5" />أرشفة</>}
        </Button>
      ) : null}
    </div>
  );
}

export function CustodyPage() {
  const data = useExpensesData();
  const ledger = useLedger();
  const perms = useExpensesPermissions();
  const currency = useCurrency();
  const exec = useRunCommand();
  const [opening, setOpening] = React.useState(false);
  const [advancing, setAdvancing] = React.useState(false);
  const [move, setMove] = React.useState<{ b: CustodyBalance; type: 'topup' | 'return' } | null>(null);
  const [tab, setTab] = React.useState('custody');
  const [showArchived, setShowArchived] = React.useState(false);
  const directory = useDirectory();

  const advanceRows = React.useMemo(
    () => (data ? data.advances.filter((a) => a.currency === currency.code).sort((a, b) => b.date.localeCompare(a.date)) : []),
    [data, currency.code],
  );
  const owedNow = React.useCallback((personId: string) => (ledger ? partyBalance(ledger, personId).pairs.find((p) => p.counterparty === 'org')?.net ?? 0 : 0), [ledger]);
  const advanceFields = React.useMemo<LocalListField<Advance>[]>(() => [
    { key: 'date', label: 'التاريخ', kind: 'date', text: (a) => a.date, groupKey: (a) => a.date.slice(0, 7) },
    { key: 'person', label: 'الشخص', kind: 'name', text: (a) => directory.nameOf(a.personId), cell: (a) => <PartyName id={a.personId} />, groupKey: (a) => a.personId, groupLabel: (id) => directory.nameOf(id) },
    { key: 'purpose', label: 'الغرض', text: (a) => a.purpose },
    { key: 'group', label: 'المجموعة', optional: true, hiddenByDefault: true, text: (a) => data?.groups.find((g) => g.id === a.groupId)?.name ?? '—', groupKey: (a) => a.groupId ?? null, groupLabel: (id) => data?.groups.find((g) => g.id === id)?.name ?? id },
    { key: 'owed', label: 'المتبقي عليه الآن', optional: true, kind: 'number', sortable: false, text: (a) => currency.format(owedNow(a.personId)) },
    { key: 'amount', label: 'المبلغ', kind: 'number', text: (a) => currency.format(a.amount), sortValue: (a) => a.amount, sum: (a) => (a.status === 'approved' ? a.amount : 0), formatSum: currency.format, cell: (a) => <Money value={a.amount} className="font-semibold" /> },
    { key: 'status', label: 'الحالة', kind: 'status', text: (a) => STATUS_LABELS_AR[a.status], cell: (a) => <StatusBadge status={a.status} />, groupKey: (a) => a.status, groupLabel: (k) => STATUS_LABELS_AR[k as TxnStatus] ?? k },
    { key: 'actions', label: '', sortable: false, screenOnly: true, text: () => '', cell: (a) => <TxnActions txn={a} compact /> },
  ], [data, directory, currency, owedNow]);
  const advances = useLocalList({ section: 'expenses', page: 'advances', fields: advanceFields, rows: advanceRows });

  usePageHeaderActions(
    () => {
      const primary = (
        <PageHeaderPrimaryButton icon={Plus} label={tab === 'custody' ? 'فتح عهدة' : 'سلفة جديدة'} disabled={!perms.custody} onClick={() => (tab === 'custody' ? setOpening(true) : setAdvancing(true))}>
          {tab === 'custody' ? 'فتح عهدة' : 'سلفة جديدة'}
        </PageHeaderPrimaryButton>
      );
      return tab === 'advances'
        ? <LocalListToolbar list={advances} title="سجل السلف الشخصية" fileName="advances" subtitleLines={['المبالغ المجمّعة للمعتمد فقط']} before={<ImportLinkButton />} primary={primary} />
        : <div className="flex items-center gap-1.5"><ImportLinkButton />{primary}</div>;
    },
    [tab, perms.custody, advances.rows, advances.visibleFields, advances.groups, advances.sort.sortKey],
  );

  if (!data || !ledger) return <LoadingBlock />;
  const archivedCount = data.custodies.filter((c) => c.archived).length;
  const balances = [...ledger.custodies.values()].filter((b) => showArchived || !b.custody.archived).sort((a, b) => (a.custody.status === b.custody.status ? b.actual - a.actual : a.custody.status === 'open' ? -1 : 1));
  return (
    <div className="space-y-3">
      <SetPageTitle titleAr="العهد والسلف" descriptionAr="العهد التشغيلية منفصلة عن السلف الشخصية" iconName="Wallet" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
          <TabsTrigger value="custody">العهد التشغيلية</TabsTrigger>
          <TabsTrigger value="advances">السلف الشخصية</TabsTrigger>
        </TabsList>
        <TabsContent value="custody" className="mt-3 space-y-3">
          {archivedCount > 0 ? (
            <div className="flex justify-end">
              <Button size="sm" variant={showArchived ? 'secondary' : 'outline'} onClick={() => setShowArchived((v) => !v)}>
                <Archive className="me-1 h-4 w-4" />
                {showArchived ? 'إخفاء المؤرشفة' : `المؤرشفة (${archivedCount})`}
              </Button>
            </div>
          ) : null}
          {balances.length === 0 ? <EmptyState text="لا عهد" action={perms.custody ? <Button size="sm" onClick={() => setOpening(true)}>فتح عهدة</Button> : undefined} /> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {balances.map((b) => (
                <CustodyCard key={b.custody.id} b={b} onMove={(type) => setMove({ b, type })} onArchive={() => void exec({ type: 'archiveCustody', custodyId: b.custody.id, archived: !b.custody.archived }, b.custody.archived ? 'استُعيدت العهدة' : 'أُرشفت العهدة')} onClose={() => {
                  if (window.confirm(b.actual > 0 ? 'سيُرجع الرصيد المتبقي للمنشأة وتُقفل العهدة. متابعة؟' : 'إقفال العهدة؟')) void exec({ type: 'closeCustody', custodyId: b.custody.id, date: todayIso() }, 'سُوّيت العهدة وأُقفلت');
                }} />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="advances" className="mt-3">
          {advanceRows.length === 0 ? <EmptyState text="لا سلف" /> : (
            <LocalListTable
              list={advances}
              rowKey={(a) => a.id}
              card={(a) => (
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium"><PartyName id={a.personId} /></p><Money value={a.amount} className="font-semibold" /></div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{a.date} · {a.purpose}</span><StatusBadge status={a.status} /></div>
                  <p className="text-xs">المتبقي عليه للمنشأة: <Money value={partyBalance(ledger, a.personId).pairs.find((p) => p.counterparty === 'org')?.net ?? 0} className="font-semibold" /></p>
                  <TxnActions txn={a} compact />
                </div>
              )}
            />
          )}
          <p className="mt-2 text-xs text-muted-foreground">السلفة تظهر في «عليه» بحساب الشخص، وتُسدَّد من صفحة التسويات.</p>
        </TabsContent>
      </Tabs>
      <OpenCustodyDialog open={opening} onOpenChange={setOpening} />
      <AdvanceDialog open={advancing} onOpenChange={setAdvancing} />
      {move ? <MoveDialog balance={move.b} type={move.type} onClose={() => setMove(null)} /> : null}
    </div>
  );
}

export function CustodyDetailPage({ id }: { id: string }) {
  const data = useExpensesData();
  const ledger = useLedger();
  const directory = useDirectory();
  if (!data || !ledger) return <LoadingBlock />;
  const b = ledger.custodies.get(id);
  if (!b) return <EmptyState text="العهدة غير موجودة" />;
  const rows: AnyTxn[] = allTxns(data)
    .filter((t) => (t.kind === 'custody_move' && t.custodyId === id) || (t.kind === 'expense' && t.payments.some((p) => p.custodyId === id)))
    .reverse();
  const custodyPart = (t: AnyTxn): Minor =>
    t.kind === 'custody_move' ? (t.type === 'return' ? -t.amount : t.amount) : t.kind === 'expense' ? -t.payments.filter((p) => p.custodyId === id).reduce((s, p) => s + p.amount, 0) : 0;
  return (
    <div className="space-y-4">
      <SetPageTitle titleAr={`عهدة ${directory.nameOf(b.custody.holderId)}`} descriptionAr={b.custody.purpose} iconName="Wallet" />
      <Button variant="ghost" size="sm" asChild><Link href={expensesRoutes.custody}><ArrowRight className="me-1 h-4 w-4" />العهد</Link></Button>
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="الملخص">
          <KeyValue label="الحامل"><PartyName id={b.custody.holderId} /></KeyValue>
          <KeyValue label="الحالة">{b.custody.status === 'open' ? 'مفتوحة' : `مقفلة ${b.custody.closedAt ?? ''}`}</KeyValue>
          <KeyValue label="المسلَّم"><Money value={b.issued} /></KeyValue>
          <KeyValue label="التغذية"><Money value={b.toppedUp} /></KeyValue>
          <KeyValue label="المصروف منها"><Money value={b.spent} /></KeyValue>
          <KeyValue label="المرتجع"><Money value={b.returned} /></KeyValue>
          <KeyValue label="الرصيد الفعلي"><Money value={b.actual} className="font-bold" /></KeyValue>
          <KeyValue label="معلق (غير معتمد)"><Money value={b.pendingOut} className="text-warning" /></KeyValue>
          <KeyValue label="المتوقع"><Money value={b.expected} className="font-semibold" /></KeyValue>
        </Section>
        <Section title="الحركات" className="lg:col-span-2">
          {rows.length === 0 ? <EmptyState text="لا حركات" /> : (
            <ul className="divide-y divide-border">
              {rows.map((t) => (
                <li key={t.kind + t.id} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    {t.kind === 'expense' ? <Link href={expensesRoutes.expenseDetail(t.id)} className="text-sm font-medium text-primary hover:underline">{t.description}</Link> : <p className="text-sm font-medium">{txnTitle(t, directory.nameOf)}</p>}
                    <p className="text-xs text-muted-foreground">{t.date} · <PartyName id={t.createdBy} link={false} /></p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Money value={custodyPart(t)} signed className="font-semibold" />
                    <StatusBadge status={t.status} />
                    {t.kind === 'custody_move' ? <TxnActions txn={t} compact /> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
