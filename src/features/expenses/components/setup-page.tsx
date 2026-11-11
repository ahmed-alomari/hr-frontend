'use client';

import * as React from 'react';
import { Archive, Pencil, Plus, RotateCcw } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSearchParams } from 'next/navigation';
import { allTxns } from '../domain/ledger';
import { formatMoney, minorToInput, type Minor } from '../domain/money';
import { GROUP_STATUS_LABELS_AR, groupCostCenterIds, groupStatusOf, txnGroupId } from '../domain/policy';
import type { Category, CostCenter, ExpenseGroup, GroupPolicy, GroupStatus } from '../domain/types';
import { GroupPolicyFields, newGroupPolicy, openGroups, policySummary } from './group-policy';
import { AmountInput, BranchSelect, EmptyState, Field, FormDialog, LoadingBlock, Money, PartyName, PickList, Section, useRunCommand } from './common';
import { useBranches, useCurrency, useDirectory, useExpensesData, useExpensesPermissions } from './expenses-provider';
import { usableIn } from '../domain/branches';

const COLORS = ['#0ea5e9', '#f97316', '#a855f7', '#14b8a6', '#ef4444', '#6366f1', '#eab308', '#64748b', '#22c55e', '#ec4899'];
/** A new row: the server gives it its id. */
const NEW_ID = '';

function CategoryDialog({ value, onClose }: { value: Category | 'new' | null; onClose: () => void }) {
  const run = useRunCommand();
  const currency = useCurrency();
  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState(COLORS[0]!);
  const [limit, setLimit] = React.useState<{ t: string; m: Minor }>({ t: '', m: 0 });
  React.useEffect(() => {
    if (!value) return;
    const c = value === 'new' ? null : value;
    setName(c?.name ?? '');
    setColor(c?.color ?? COLORS[0]!);
    setLimit(c?.maxAmount ? { t: minorToInput(c.maxAmount, currency.decimals), m: c.maxAmount } : { t: '', m: 0 });
  }, [value, currency.decimals]);
  if (!value) return null;
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={value === 'new' ? 'فئة جديدة' : 'تعديل الفئة'} footer={<>
      <Button variant="outline" onClick={onClose}>إلغاء</Button>
      <Button disabled={!name.trim()} onClick={() => {
        const base: Category = value === 'new' ? { id: NEW_ID, name: '', color } : value;
        void run({ type: 'upsertCategory', category: { ...base, name: name.trim(), color, maxAmount: limit.m > 0 ? limit.m : null } }, 'حُفظت الفئة').then((ok) => ok && onClose());
      }}>حفظ</Button>
    </>}>
      <Field label="الاسم"><Input className="h-10" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="اللون">
        <div className="flex flex-wrap gap-2">{COLORS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className="h-8 w-8 rounded-full border-2" style={{ backgroundColor: c, borderColor: color === c ? '#000' : 'transparent' }} />)}</div>
      </Field>
      <Field label="حد المصروف الواحد (سياسة، اختياري)" hint="المصروف فوق الحد يظهر تنبيهاً أو يُمنع حسب الإعدادات."><AmountInput value={limit.t} onChange={(t, m) => setLimit({ t, m })} /></Field>
    </FormDialog>
  );
}

function CostCenterDialog({ value, onClose }: { value: CostCenter | 'new' | null; onClose: () => void }) {
  const run = useRunCommand();
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const branches = useBranches();
  /** '' is every branch. */
  const [branchId, setBranchId] = React.useState('');
  React.useEffect(() => {
    if (!value) return;
    setCode(value === 'new' ? '' : value.code);
    setName(value === 'new' ? '' : value.name);
    setBranchId(value === 'new' ? (branches.referenceOptions[0]?.value ?? '') : (value.branchId ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when the dialog opens
  }, [value]);
  if (!value) return null;
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={value === 'new' ? 'مركز تكلفة جديد' : 'تعديل مركز التكلفة'} footer={<>
      <Button variant="outline" onClick={onClose}>إلغاء</Button>
      <Button disabled={!code.trim() || !name.trim()} onClick={() => {
        const base: CostCenter = value === 'new' ? { id: NEW_ID, code: '', name: '' } : value;
        void run({ type: 'upsertCostCenter', center: { ...base, code: code.trim(), name: name.trim(), branchId: branchId || null } }, 'حُفظ المركز').then((ok) => ok && onClose());
      }}>حفظ</Button>
    </>}>
      <Field label="الرمز"><Input className="h-10" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CC-400" /></Field>
      <Field label="الاسم"><Input className="h-10" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      {branches.referenceOptions.length > 1 ? <BranchSelect id="cc-branch" value={branchId} onChange={setBranchId} options={branches.referenceOptions} /> : null}
    </FormDialog>
  );
}

function GroupDialog({ value, onClose }: { value: ExpenseGroup | 'new' | null; onClose: () => void }) {
  const run = useRunCommand();
  const data = useExpensesData();
  const directory = useDirectory();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [members, setMembers] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<GroupStatus>('active');
  const [costCenterIds, setCostCenterIds] = React.useState<string[]>([]);
  const [policy, setPolicy] = React.useState<GroupPolicy>(newGroupPolicy);
  const branches = useBranches();
  /** '' is every branch. */
  const [branchId, setBranchId] = React.useState('');
  React.useEffect(() => {
    if (!value) return;
    const g = value === 'new' ? null : value;
    setBranchId(g ? (g.branchId ?? '') : (branches.referenceOptions[0]?.value ?? ''));
    setName(g?.name ?? '');
    setDescription(g?.description ?? '');
    setMembers(g?.memberIds ?? []);
    setStatus(g ? groupStatusOf(g) : 'active');
    setCostCenterIds(g ? groupCostCenterIds(g) : []);
    setPolicy(g?.policy ?? newGroupPolicy());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when the dialog opens
  }, [value]);
  if (!value || !data) return null;
  const isDefault = value !== 'new' && value.isDefault;
  const missingAmount = (policy.approval === 'above' && policy.approvalAbove == null) || (policy.attachment === 'above' && policy.attachmentAbove == null);
  const missingMembers = !isDefault && members.length === 0;
  const savedPolicy: GroupPolicy = { ...policy, stages: (policy.stages ?? []).filter((s) => s.approverIds.length > 0) };
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={value === 'new' ? 'مجموعة جديدة' : isDefault ? 'المجموعة الافتراضية' : 'تعديل المجموعة'} description={isDefault ? 'كل عملية بلا مجموعة تُسجَّل هنا. هي لكل من يملك صلاحية التطبيق.' : 'قسم أو مشروع أو رحلة. لا يرفع فيها مصروفاً إلا أعضاؤها.'} footer={<>
      <Button variant="outline" onClick={onClose}>إلغاء</Button>
      <Button disabled={!name.trim() || missingAmount || missingMembers} onClick={() => {
        const base: ExpenseGroup = value === 'new' ? { id: NEW_ID, name: '', memberIds: [], policy: savedPolicy } : value;
        void run({ type: 'upsertGroup', group: { ...base, name: name.trim(), description: description.trim() || null, memberIds: members, costCenterId: costCenterIds[0] ?? null, costCenterIds, status: isDefault ? 'active' : status, closed: !isDefault && status !== 'active', branchId: isDefault ? null : branchId || null, policy: savedPolicy } }, 'حُفظت المجموعة').then((ok) => ok && onClose());
      }}>حفظ</Button>
    </>}>
      <Field label="الاسم"><Input className="h-10" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="الوصف"><Input className="h-10" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      {!isDefault && branches.referenceOptions.length > 1 ? (
        <BranchSelect
          id="grp-branch"
          value={branchId}
          onChange={(v) => {
            setBranchId(v);
            setCostCenterIds((ids) => ids.filter((id) => { const c = data.costCenters.find((x) => x.id === id); return !c || usableIn(v || null, c); }));
          }}
          options={branches.referenceOptions}
        />
      ) : null}
      {isDefault ? null : (
        <Field label="حالة المجموعة" hint="غير النشطة لا تقبل مصروفاً جديداً. ما سُجّل يبقى كما هو.">
          <Select value={status} onValueChange={(v) => setStatus(v as GroupStatus)}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['active', 'maintenance', 'suspended', 'ended'] as const).map((s) => <SelectItem key={s} value={s}>{GROUP_STATUS_LABELS_AR[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}
      <GroupPolicyFields value={policy} onChange={setPolicy} />
      <Field label="الأعضاء" hint={isDefault ? 'المجموعة الافتراضية لكل من يملك صلاحية التطبيق. الأعضاء هنا يُقترحون عند التقسيم فقط.' : 'حدّد الأعضاء. لا يستطيع أحد رفع مصروف في هذه المجموعة سواهم.'}><PickList options={directory.choices.map((p) => ({ id: p.id, name: p.name }))} value={members} onChange={setMembers} placeholder="اختر عضواً" renderName={(id) => <PartyName id={id} link={false} />} /></Field>
      {data.settings.mode === 'advanced' ? (
        <Field label="مراكز التكلفة" hint="عند تسجيل مصروف في هذه المجموعة تظهر هذه المراكز، وإن كان واحداً يُختار تلقائياً. بلا مراكز: تظهر كل المراكز.">
          <PickList
            options={data.costCenters.filter((c) => !c.archived && usableIn(branchId || null, c)).map((c) => ({ id: c.id, name: `${c.code} — ${c.name}` }))}
            value={costCenterIds}
            onChange={setCostCenterIds}
            placeholder="اختر مركز تكلفة"
            renderName={(id) => {
              const center = data.costCenters.find((c) => c.id === id);
              return center ? `${center.code} — ${center.name}` : id;
            }}
          />
        </Field>
      ) : null}
    </FormDialog>
  );
}

export function SetupPage() {
  const data = useExpensesData();
  const branches = useBranches();
  const run = useRunCommand();
  const perms = useExpensesPermissions();
  const [cat, setCat] = React.useState<Category | 'new' | null>(null);
  const [cc, setCc] = React.useState<CostCenter | 'new' | null>(null);
  const [grp, setGrp] = React.useState<ExpenseGroup | 'new' | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const currency = useCurrency();
  const tabParam = useSearchParams()?.get('tab');
  if (!data) return <LoadingBlock />;
  const advanced = data.settings.mode === 'advanced';
  const expenses = data.expenses;
  const used = (pred: (e: (typeof expenses)[number]) => boolean) => expenses.filter(pred).length;
  const home = data.groups.find((g) => g.isDefault)?.id;
  const filedIn = (g: ExpenseGroup) => allTxns(data).filter((x) => (txnGroupId(data, x) ?? home) === g.id).length;
  const tab = tabParam === 'groups' || (tabParam === 'centers' && advanced) ? tabParam : 'categories';
  const editBtn = (onClick: () => void) => perms.setup ? <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="تعديل" onClick={onClick}><Pencil className="h-4 w-4" /></Button> : null;
  const archiveBtn = (archived: boolean | undefined, onClick: () => void) => perms.setup ? <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={archived ? 'استعادة' : 'أرشفة'} title={archived ? 'استعادة' : 'أرشفة'} onClick={onClick}>{archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</Button> : null;
  const visible = <T extends { archived?: boolean }>(rows: T[]) => rows.filter((r) => showArchived || !r.archived);
  const archivedCount = data.categories.filter((c) => c.archived).length + data.groups.filter((g) => g.archived).length + (advanced ? data.costCenters.filter((c) => c.archived).length : 0);
  const groupRows = visible([...openGroups(data), ...data.groups.filter((g) => groupStatusOf(g) !== 'active' || g.archived)].filter((g, i, all) => all.findIndex((x) => x.id === g.id) === i));

  return (
    <div className="space-y-3">
      <SetPageTitle titleAr="الفئات والمجموعات ومراكز التكلفة" descriptionAr="تصنيف المصروفات وتوزيعها" iconName="LayoutGrid" />
      <Tabs key={tab} defaultValue={tab}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className={advanced ? 'grid w-full grid-cols-3 sm:inline-flex sm:w-auto' : 'grid w-full grid-cols-2 sm:inline-flex sm:w-auto'}>
            <TabsTrigger value="categories">الفئات</TabsTrigger>
            <TabsTrigger value="groups">المجموعات</TabsTrigger>
            {advanced ? <TabsTrigger value="centers">مراكز التكلفة</TabsTrigger> : null}
          </TabsList>
          {archivedCount > 0 ? (
            <Button size="sm" variant={showArchived ? 'secondary' : 'outline'} onClick={() => setShowArchived((v) => !v)}>
              <Archive className="me-1 h-4 w-4" />
              {showArchived ? 'إخفاء المؤرشف' : `المؤرشف (${archivedCount})`}
            </Button>
          ) : null}
        </div>
        <TabsContent value="categories" className="mt-3">
          <Section title="الفئات" actions={perms.setup ? <Button size="sm" onClick={() => setCat('new')}><Plus className="me-1 h-4 w-4" />فئة</Button> : undefined}>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visible(data.categories).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                    <div className="min-w-0">
                      <p className={c.archived ? 'truncate text-sm text-muted-foreground line-through' : 'truncate text-sm font-medium'}>{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{used((e) => e.categoryId === c.id)} مصروف{c.maxAmount ? <> · حد <Money value={c.maxAmount} /></> : null}</p>
                    </div>
                  </div>
                  <div className="flex">{editBtn(() => setCat(c))}{archiveBtn(c.archived, () => void run({ type: 'upsertCategory', category: { ...c, archived: !c.archived } }))}</div>
                </li>
              ))}
            </ul>
          </Section>
        </TabsContent>
        <TabsContent value="groups" className="mt-3">
          <Section title="المجموعات" actions={perms.setup ? <Button size="sm" onClick={() => setGrp('new')}><Plus className="me-1 h-4 w-4" />مجموعة</Button> : undefined}>
            {groupRows.length === 0 ? <EmptyState text="لا مجموعات" /> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {groupRows.map((g) => (
                  <li key={g.id} className="space-y-1.5 rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><div className={g.archived ? 'truncate text-sm text-muted-foreground line-through' : 'truncate text-sm font-medium'}>{g.name}{g.isDefault ? <Badge variant="subtle" className="ms-1.5 text-[10px]">افتراضية</Badge> : null}{branches.hasBranches ? <Badge variant="outline" className="ms-1.5 text-[10px]">{branches.referenceName(g.branchId)}</Badge> : null}{groupStatusOf(g) === 'active' ? null : <Badge variant="subtle" className="ms-1.5 text-[10px]">{GROUP_STATUS_LABELS_AR[groupStatusOf(g)]}</Badge>}{g.archived ? <Badge variant="subtle" className="ms-1.5 text-[10px]">مؤرشفة</Badge> : null}</div>{g.description ? <p className="text-xs text-muted-foreground">{g.description}</p> : null}</div>
                      <div className="flex">{editBtn(() => setGrp(g))}{g.isDefault ? null : archiveBtn(g.archived, () => void run({ type: 'upsertGroup', group: { ...g, archived: !g.archived } }, g.archived ? 'استُعيدت المجموعة' : 'أُرشفت المجموعة'))}</div>
                    </div>
                    <p className="text-xs text-foreground/80">{policySummary(g.policy, (m) => formatMoney(m, currency))}</p>
                    <p className="text-xs">{g.isDefault && g.memberIds.length === 0 ? 'لكل من يملك صلاحية التطبيق' : g.memberIds.length === 0 ? 'بلا أعضاء' : g.memberIds.map((m, i) => <React.Fragment key={m}>{i > 0 ? '، ' : ''}<PartyName id={m} /></React.Fragment>)}</p>
                    <p className="text-[11px] text-muted-foreground">{filedIn(g)} عملية</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </TabsContent>
        {advanced ? (
          <TabsContent value="centers" className="mt-3">
            <Section title="مراكز التكلفة" description="للتوزيع التحليلي والتقارير — لا تنشئ ديوناً" actions={perms.setup ? <Button size="sm" onClick={() => setCc('new')}><Plus className="me-1 h-4 w-4" />مركز</Button> : undefined}>
              {data.costCenters.length === 0 ? <EmptyState text="لا مراكز تكلفة" /> : (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {visible(data.costCenters).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
                      <div className="min-w-0"><p className={c.archived ? 'text-sm text-muted-foreground line-through' : 'text-sm font-medium'}><span dir="ltr" className="text-muted-foreground">{c.code}</span> {c.name}</p>{branches.hasBranches ? <p className="text-[11px] text-muted-foreground">{branches.referenceName(c.branchId)}</p> : null}<p className="text-[11px] text-muted-foreground">{used((e) => e.allocation.some((a) => a.costCenterId === c.id))} مصروف</p></div>
                      <div className="flex">{editBtn(() => setCc(c))}{archiveBtn(c.archived, () => void run({ type: 'upsertCostCenter', center: { ...c, archived: !c.archived } }))}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </TabsContent>
        ) : null}
      </Tabs>
      <CategoryDialog value={cat} onClose={() => setCat(null)} />
      <CostCenterDialog value={cc} onClose={() => setCc(null)} />
      <GroupDialog value={grp} onClose={() => setGrp(null)} />
    </div>
  );
}
