'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ChevronDown, Paperclip, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, randomUUID } from '@/shared/utils';
import { useExpensesStore } from '../data/store';
import { checkFile, uploadReceipt } from '../data/attachments';
import type { ExpenseDraft } from '../domain/commands';
import { buildBearing, custodyPayments, validateExpense } from '../domain/expense-builder';
import { expenseEffects } from '../domain/ledger';
import { minorToInput, sumMinor, toMinor, type Minor } from '../domain/money';
import { approvalRequired, blocksSubmit, checkPolicies, groupCostCenterIds, groupOf, groupStatusOf, policyOf } from '../domain/policy';
import { ORG } from '../domain/types';
import type { AllocationLine, AttachmentMeta, Expense, PartyId, SplitMethod } from '../domain/types';
import { usableIn } from '../domain/branches';
import { AmountInput, BranchSelect, Field, FormDialog, Money, PartyChecklist, PartyName, PartySelect } from './common';
import { todayIso, useBranches, useCurrency, useDirectory, useExpensesData, useLedger } from './expenses-provider';
import { GroupPolicyHint, GroupSelect, openGroups } from './group-policy';

type PayMode = 'org' | 'custody' | 'personal';

const segment = (active: boolean) =>
  cn(
    'min-h-10 flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors sm:text-sm',
    active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted',
  );

export function ExpenseFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Expense | null;
  onSaved?: (expense: Expense) => void;
}) {
  const data = useExpensesData();
  const ledger = useLedger();
  const directory = useDirectory();
  const currency = useCurrency();
  const actorId = useExpensesStore((s) => s.actorId);
  const companyId = useExpensesStore((s) => s.companyId);
  const exec = useExpensesStore((s) => s.exec);
  // One new expense per dialog opening: saving again after a lost answer
  // sends the same requestId, so the server records it once.
  const requestId = React.useRef(randomUUID());
  const busy = useExpensesStore((s) => s.busy);
  const [uploading, setUploading] = React.useState(false);
  const advanced = data?.settings.mode === 'advanced';

  const [amountText, setAmountText] = React.useState('');
  const [amount, setAmount] = React.useState<Minor>(0);
  const [description, setDescription] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [date, setDate] = React.useState(todayIso());
  const branches = useBranches();
  /** '' is the company's own record (head office). */
  const [branchId, setBranchId] = React.useState('');
  const [groupId, setGroupId] = React.useState<string | null>(null);
  const [costCenterId, setCostCenterId] = React.useState<string | null>(null);
  const [payMode, setPayMode] = React.useState<PayMode>('org');
  const [custodyId, setCustodyId] = React.useState<string | null>(null);
  const [payerId, setPayerId] = React.useState<PartyId | null>(null);
  const [splitOn, setSplitOn] = React.useState(false);
  const [method, setMethod] = React.useState<Exclude<SplitMethod, 'org'>>('equal');
  const [parties, setParties] = React.useState<PartyId[]>([]);
  const [entered, setEntered] = React.useState<Record<string, string>>({});
  const [multiAlloc, setMultiAlloc] = React.useState(false);
  const [allocLines, setAllocLines] = React.useState<Array<{ costCenterId: string | null; text: string }>>([]);
  const [note, setNote] = React.useState('');
  const [attachments, setAttachments] = React.useState<AttachmentMeta[]>([]);
  const [more, setMore] = React.useState(false);

  const openCustodies = React.useMemo(() => (data?.custodies ?? []).filter((c) => c.status === 'open' && c.currency === currency.code), [data, currency.code]);

  React.useEffect(() => {
    if (!open || !data) return;
    requestId.current = randomUUID();
    if (editing) {
      setAmountText(minorToInput(editing.amount, currency.decimals));
      setAmount(editing.amount);
      setDescription(editing.description);
      setCategoryId(editing.categoryId);
      setDate(editing.date);
      setBranchId(editing.branchId ?? '');
      setGroupId(editing.groupId ?? null);
      setCostCenterId(editing.costCenterId ?? null);
      const first = editing.payments[0];
      setPayMode(editing.payments.some((p) => p.source === 'custody') ? 'custody' : (first?.source ?? 'org'));
      setCustodyId(editing.payments.find((p) => p.source === 'custody')?.custodyId ?? null);
      setPayerId(editing.payments.find((p) => p.source === 'personal')?.payerId ?? actorId);
      const split = editing.bearing.method !== 'org';
      setSplitOn(split);
      setMethod(split ? (editing.bearing.method as Exclude<SplitMethod, 'org'>) : 'equal');
      setParties(split ? editing.bearing.shares.map((s) => s.partyId) : []);
      setEntered(
        Object.fromEntries(
          editing.bearing.shares.map((s) => [
            s.partyId,
            editing.bearing.method === 'percent' ? String(s.percent ?? '') : minorToInput(s.amount, currency.decimals),
          ]),
        ),
      );
      setMultiAlloc(editing.allocation.length > 1);
      setAllocLines(editing.allocation.map((a) => ({ costCenterId: a.costCenterId, text: minorToInput(a.amount, currency.decimals) })));
      setNote(editing.note ?? '');
      setAttachments(editing.attachments);
      setMore(Boolean(editing.groupId || editing.costCenterId || editing.note || editing.allocation.length > 1));
    } else {
      setAmountText('');
      setAmount(0);
      setDescription('');
      setCategoryId(data.categories.find((c) => !c.archived)?.id ?? '');
      setDate(todayIso());
      setBranchId(branches.defaultValue);
      setGroupId(null);
      setCostCenterId(null);
      const mine = openCustodies.find((c) => c.holderId === actorId);
      setPayMode(mine ? 'custody' : 'org');
      setCustodyId(mine?.id ?? openCustodies[0]?.id ?? null);
      setPayerId(actorId);
      setSplitOn(false);
      setMethod('equal');
      setParties([]);
      setEntered({});
      setMultiAlloc(false);
      setAllocLines([]);
      setNote('');
      setAttachments([]);
      setMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when the dialog opens
  }, [open, editing?.id]);

  if (!data || !ledger) return null;

  const custody = custodyId ? data.custodies.find((c) => c.id === custodyId) : undefined;
  const available = custodyId ? (ledger.custodies.get(custodyId)?.expected ?? 0) : 0;
  // Editing a pending custody expense: its own amount is already held.
  const ownHeld = editing?.status === 'submitted' ? sumMinor(editing.payments.filter((p) => p.custodyId === custodyId).map((p) => p.amount)) : 0;

  const payments =
    payMode === 'org'
      ? [{ source: 'org' as const, amount }]
      : payMode === 'custody' && custody
        ? custodyPayments(amount, custody.id, custody.holderId, available + ownHeld)
        : [{ source: 'personal' as const, payerId: payerId ?? actorId ?? null, amount }];

  const enteredMinor: Record<string, number> = Object.fromEntries(
    parties.map((p) => [p, method === 'percent' ? Number(entered[p] || 0) : toMinor(entered[p] || '0', currency.decimals)]),
  );
  const bearing = splitOn && parties.length > 0 ? buildBearing(method, amount, parties, enteredMinor) : buildBearing('org', amount, []);

  const allocation: AllocationLine[] =
    multiAlloc && allocLines.length > 0
      ? allocLines.map((l) => ({ costCenterId: l.costCenterId, groupId, amount: toMinor(l.text || '0', currency.decimals) }))
      : [{ costCenterId, groupId, amount }];

  const draft: ExpenseDraft = {
    id: editing?.id ?? null,
    description,
    amount,
    categoryId,
    date,
    branchId: branchId || null,
    groupId,
    costCenterId,
    payments,
    bearing,
    allocation,
    attachments,
    note: note.trim() || null,
  };
  const issues = amount > 0 ? validateExpense(draft) : [];
  const violations = amount > 0 && actorId
    ? checkPolicies({ id: editing?.id ?? '', amount, categoryId, attachments, createdBy: editing?.createdBy ?? actorId, date, currency: currency.code, groupId }, data, currency.format)
    : [];
  const policy = policyOf(data, groupId);
  const blocked = blocksSubmit(violations, policy);
  const effects = amount > 0 && issues.length === 0 ? expenseEffects({ ...draft, id: 'preview', kind: 'expense', currency: currency.code, status: 'approved', createdBy: actorId ?? '', createdAt: '', attachments } as Expense) : [];
  const group = groupId ? data.groups.find((g) => g.id === groupId) : undefined;
  const submitLabel = policy.approval === 'none' ? 'حفظ' : !approvalRequired(policy, amount) ? 'حفظ (اعتماد تلقائي)' : 'إرسال للاعتماد';
  const pickable = openGroups(data).filter((g) => usableIn(branchId || null, g)).length > 1 || (group != null && groupStatusOf(group) !== 'active');

  // The group's centers when it has some; a center already on the record stays listed.
  const fileUnder = groupOf(data, groupId);
  const groupCenters = fileUnder ? groupCostCenterIds(fileUnder) : [];
  const centerChoices = (current: string | null) =>
    data.costCenters.filter(
      (c) => c.id === current || (!c.archived && usableIn(branchId || null, c) && (groupCenters.length === 0 || groupCenters.includes(c.id))),
    );

  // Another branch: the group and cost center must be shared or of that branch.
  const pickBranch = (next: string) => {
    setBranchId(next);
    const g = groupId ? data.groups.find((x) => x.id === groupId) : undefined;
    if (g && !usableIn(next || null, g)) setGroupId(null);
    const c = costCenterId ? data.costCenters.find((x) => x.id === costCenterId) : undefined;
    if (c && !usableIn(next || null, c)) setCostCenterId(null);
    setAllocLines((lines) =>
      lines.map((l) => {
        const lc = l.costCenterId ? data.costCenters.find((x) => x.id === l.costCenterId) : undefined;
        return lc && !usableIn(next || null, lc) ? { ...l, costCenterId: null } : l;
      }),
    );
  };
  const custodyBranch = custody ? (custody.branchId ?? null) : null;
  const crossBranch = payMode === 'custody' && custody != null && custodyBranch !== (branchId || null);

  const pickGroup = (id: string | null) => {
    setGroupId(id);
    const g = id ? data.groups.find((x) => x.id === id) : undefined;
    const centers = g ? groupCostCenterIds(g) : [];
    if (centers.length === 1) setCostCenterId(centers[0]!);
    else if (centers.length > 1) setCostCenterId((current) => (current && centers.includes(current) ? current : null));
    if (g && splitOn && parties.length === 0) setParties(g.memberIds);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || !companyId) return;
    let count = attachments.length;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const refusal = checkFile(file, count);
        if (refusal) {
          toast.error(`${file.name}: ${refusal}`);
          continue;
        }
        try {
          const meta = await uploadReceipt(companyId, file);
          setAttachments((prev) => [...prev, meta]);
          count += 1;
        } catch {
          // The upload already showed the server's reason.
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const close = () => onOpenChange(false);

  const save = async (submit: boolean) => {
    if (issues.length > 0) {
      toast.error(issues[0]!.message);
      return;
    }
    if (submit && blocked) {
      toast.error('السياسات تمنع الإرسال: عدّل المصروف أو احفظه مسودة');
      return;
    }
    try {
      const result = await exec<{ id: string; status: Expense['status'] }>({
        type: 'saveExpense',
        draft,
        submit,
        requestId: draft.id ? undefined : requestId.current,
      });
      toast.success(result.status === 'draft' ? 'حُفظ مسودة' : result.status === 'approved' ? 'سُجّل المصروف واعتُمد' : 'أُرسل للاعتماد');
      onOpenChange(false);
      const saved = useExpensesStore.getState().data?.expenses.find((e) => e.id === result.id);
      if (saved) onSaved?.(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر الحفظ');
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title={editing ? 'تعديل مصروف' : 'مصروف جديد'}
      wide
      footer={
        <>
          <Button variant="outline" onClick={close}>
            إلغاء
          </Button>
          <Button variant="secondary" onClick={() => void save(false)} disabled={amount <= 0 || busy || uploading}>
            حفظ كمسودة
          </Button>
          <Button onClick={() => void save(true)} disabled={amount <= 0 || busy || uploading || (blocked && violations.length > 0)}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="المبلغ" htmlFor="exp-amount">
          <AmountInput id="exp-amount" autoFocus value={amountText} onChange={(t, m) => { setAmountText(t); setAmount(m); }} />
        </Field>
        <Field label="التاريخ" htmlFor="exp-date">
          <Input id="exp-date" type="date" className="h-11" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {branches.show ? (
          <div className="space-y-1 sm:col-span-2">
            <BranchSelect id="exp-branch" value={branchId} onChange={pickBranch} options={branches.options} />
            {crossBranch ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                العهدة من {branches.nameOf(custodyBranch)}: يُسجَّل المصروف على {branches.nameOf(branchId || null)}، ويصير عليه مستحق لـ{branches.nameOf(custodyBranch)} بقدر ما يُدفع منها.
              </p>
            ) : null}
          </div>
        ) : null}
        {pickable ? (
          <div className="space-y-1 sm:col-span-2">
            <GroupSelect value={groupId} keep={editing?.groupId} onChange={pickGroup} branchId={branchId || null} />
            {amount > 0 ? <GroupPolicyHint groupId={groupId} amount={amount} expense /> : null}
          </div>
        ) : null}
        <Field label="الوصف" htmlFor="exp-desc" className="sm:col-span-2">
          <Input id="exp-desc" className="h-10" placeholder="مثال: وقود سيارة التوزيع" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="الفئة" className="sm:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {data.categories.filter((c) => !c.archived).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={cn('min-h-9 rounded-full border px-3 text-xs font-medium', categoryId === c.id ? 'border-transparent text-white' : 'border-border bg-card hover:bg-muted')}
                style={categoryId === c.id ? { backgroundColor: c.color } : undefined}
              >
                {c.name}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="من دفع؟">
        <div className="flex gap-1.5">
          <button type="button" className={segment(payMode === 'org')} onClick={() => setPayMode('org')}>صندوق المنشأة</button>
          <button type="button" className={segment(payMode === 'custody')} onClick={() => setPayMode('custody')} disabled={openCustodies.length === 0}>من عهدة</button>
          <button type="button" className={segment(payMode === 'personal')} onClick={() => setPayMode('personal')}>من مال شخص</button>
        </div>
      </Field>
      {payMode === 'custody' ? (
        <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
          <Select value={custodyId ?? undefined} onValueChange={setCustodyId}>
            <SelectTrigger className="h-10"><SelectValue placeholder="اختر العهدة" /></SelectTrigger>
            <SelectContent>
              {openCustodies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{directory.nameOf(c.holderId)} — {c.purpose}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {custody ? (
            <p className="text-xs text-muted-foreground">
              المتاح للصرف (بعد المعلق): <Money value={available + ownHeld} className="font-semibold text-foreground" />
            </p>
          ) : null}
          {payments.length > 1 ? (
            <p className="rounded-lg bg-warning/10 px-2.5 py-2 text-xs text-warning">
              العهدة لا تكفي: <Money value={payments[0]!.amount} /> من العهدة و<Money value={payments[1]!.amount} /> من مال {directory.nameOf(custody?.holderId)} — تصبح مستحقة له.
            </p>
          ) : null}
        </div>
      ) : null}
      {payMode === 'personal' ? (
        <Field label="من دفع من ماله؟" hint="ما يتحمله غيره يصبح مستحقاً له (المنشأة أو المشاركون).">
          <PartySelect value={payerId} onChange={setPayerId} />
        </Field>
      ) : null}

      <Field label="على من التكلفة؟" hint="التحميل ينشئ مديونيات فعلية بين الأطراف؛ توزيع التكلفة على المراكز للتقارير فقط.">
        <div className="flex gap-1.5">
          <button type="button" className={segment(!splitOn)} onClick={() => setSplitOn(false)}>على المنشأة</button>
          <button type="button" className={segment(splitOn)} onClick={() => { setSplitOn(true); if (parties.length === 0 && group) setParties(group.memberIds); }}>تقسيم على أشخاص</button>
        </div>
      </Field>
      {splitOn ? (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
          <div className="flex gap-1.5">
            {(['equal', 'amounts', 'percent'] as const).map((m) => (
              <button key={m} type="button" className={segment(method === m)} onClick={() => setMethod(m)}>
                {m === 'equal' ? 'بالتساوي' : m === 'amounts' ? 'بمبالغ' : 'بنسب'}
              </button>
            ))}
          </div>
          <PartyChecklist value={parties} onChange={setParties} includeOrg limitTo={null} />
          {parties.length > 0 ? (
            <ul className="space-y-1.5">
              {bearing.shares.map((s) => (
                <li key={s.partyId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{s.partyId === ORG ? 'المنشأة' : directory.nameOf(s.partyId)}</span>
                  {method === 'equal' ? (
                    <Money value={s.amount} className="font-medium" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        inputMode="decimal"
                        dir="ltr"
                        className="h-9 w-28 text-start tabular-nums"
                        value={entered[s.partyId] ?? ''}
                        placeholder={method === 'percent' ? '%' : '0'}
                        onChange={(e) => setEntered((prev) => ({ ...prev, [s.partyId]: e.target.value.replace(/[^\d.,]/g, '') }))}
                      />
                      {method === 'percent' ? <Money value={s.amount} className="w-24 text-xs text-muted-foreground" /> : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">اختر من يتحمل المصروف (يمكن إشراك المنشأة).</p>
          )}
          {method === 'equal' && parties.length > 1 && amount % parties.length !== 0 ? (
            <p className="text-[11px] text-muted-foreground">
              الباقي ({amount % parties.length} من أصغر وحدة) يُضاف بالترتيب لأول المشاركين ليطابق المجموع المصروف.
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <button type="button" className="flex items-center gap-1 text-xs font-medium text-primary" onClick={() => setMore((v) => !v)}>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', more && 'rotate-180')} />
          خيارات إضافية: {advanced ? 'مركز التكلفة، توزيع التكلفة، ' : ''}الملاحظة
        </button>
        {more ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {advanced ? (
              <Field label="مركز التكلفة">
                <Select value={costCenterId ?? 'none'} onValueChange={(v) => setCostCenterId(v === 'none' ? null : v)} disabled={multiAlloc}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بلا مركز</SelectItem>
                    {centerChoices(costCenterId).map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {advanced ? (
              <div className="space-y-2 sm:col-span-2">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input type="checkbox" checked={multiAlloc} onChange={(e) => { setMultiAlloc(e.target.checked); if (e.target.checked && allocLines.length === 0) setAllocLines([{ costCenterId, text: amountText }]); }} />
                  توزيع التكلفة على عدة مراكز (تحليلي — لا ينشئ ديوناً)
                </label>
                {multiAlloc ? (
                  <div className="space-y-2">
                    {allocLines.map((line, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <Select value={line.costCenterId ?? 'none'} onValueChange={(v) => setAllocLines((prev) => prev.map((l, j) => (j === i ? { ...l, costCenterId: v === 'none' ? null : v } : l)))}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">بلا مركز</SelectItem>
                              {centerChoices(line.costCenterId).map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input inputMode="decimal" dir="ltr" className="h-9 w-28 text-start tabular-nums" value={line.text} onChange={(e) => setAllocLines((prev) => prev.map((l, j) => (j === i ? { ...l, text: e.target.value.replace(/[^\d.,]/g, '') } : l)))} />
                        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setAllocLines((prev) => prev.filter((_, j) => j !== i))} aria-label="حذف السطر"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs">
                      <Button size="sm" variant="outline" onClick={() => setAllocLines((prev) => [...prev, { costCenterId: null, text: '' }])}><Plus className="me-1 h-3.5 w-3.5" />سطر</Button>
                      <span className={cn(sumMinor(allocation.map((a) => a.amount)) === amount ? 'text-muted-foreground' : 'text-destructive')}>
                        الموزع <Money value={sumMinor(allocation.map((a) => a.amount))} /> من <Money value={amount} />
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <Field label="ملاحظة" className="sm:col-span-2">
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        ) : null}
      </div>

      <Field label="المرفقات" hint="صور أو PDF، حتى 5 ميغابايت للملف و5 ملفات للمصروف. تُرفع إلى ملفات الشركة.">
        <div className="space-y-2">
          <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground hover:bg-muted">
            <Paperclip className="h-4 w-4" />
            {uploading ? 'جارٍ الرفع…' : 'إرفاق إيصال'}
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} />
          </label>
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5 text-xs">
              <span className="truncate">{a.name}</span>
              <button type="button" aria-label="إزالة" onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </Field>

      {issues.length > 0 ? (
        <ul className="space-y-1 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
          {issues.map((i) => <li key={i.field + i.message}>{i.message}</li>)}
        </ul>
      ) : null}
      {violations.length > 0 ? (
        <ul className={cn('space-y-1 rounded-xl p-3 text-xs', blocked ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning')}>
          {violations.map((v) => <li key={v.code}>{blocked ? 'يمنع الإرسال: ' : 'تنبيه سياسة: '}{v.message}</li>)}
        </ul>
      ) : null}
      {effects.length > 0 ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
          <p className="mb-1.5 font-semibold text-foreground">أثر المصروف بعد اعتماده</p>
          <ul className="space-y-1">
            {effects.map((e, i) => (
              <li key={i}>
                {e.type === 'debt' ? (
                  <><PartyName id={e.debtor} link={false} /> مدين لـ <PartyName id={e.creditor} link={false} /> بمبلغ <Money value={e.amount} className="font-semibold" /></>
                ) : e.type === 'custody' ? (
                  <>ينقص رصيد العهدة <Money value={-e.amount} className="font-semibold" /></>
                ) : (
                  <>يخرج من صندوق المنشأة <Money value={-e.amount} className="font-semibold" /></>
                )}
              </li>
            ))}
            {effects.every((e) => e.type !== 'debt') ? <li className="text-muted-foreground">لا ينشئ ديوناً على أحد.</li> : null}
          </ul>
        </div>
      ) : null}
    </FormDialog>
  );
}
