'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Circle, MinusCircle, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/shared/utils';
import { useExpensesStore } from '../data/store';
import { formatMoney, minorToInput, type Minor } from '../domain/money';
import { APPROVAL_MODE_LABELS_AR, STAGE_MODE_LABELS_AR, approvalRequired, approvalStages, attachmentRequired, currentDeciders, defaultGroup, groupOf, groupStatusOf, OPEN_POLICY } from '../domain/policy';
import type { AnyTxn, ApprovalStage, ApprovalStep, ExpenseGroup, ExpensesData, GroupPolicy, GroupRule } from '../domain/types';
import { AmountInput, Field, PartyName } from './common';
import { useCurrency, useExpensesData } from './expenses-provider';

function OptionalAmount({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: Minor | null; onChange: (v: Minor | null) => void; disabled?: boolean }) {
  const currency = useCurrency();
  const [text, setText] = React.useState(value != null ? minorToInput(value, currency.decimals) : '');
  React.useEffect(() => setText(value != null ? minorToInput(value, currency.decimals) : ''), [value, currency.decimals]);
  return (
    <Field label={label} hint={hint ?? 'اتركه فارغاً: بلا حد.'}>
      <fieldset disabled={disabled}>
        <AmountInput value={text} placeholder="بلا حد" onChange={(t, m) => { setText(t); onChange(t.trim() ? m : null); }} />
      </fieldset>
    </Field>
  );
}

const RULE_LABELS: Record<'approval' | 'attachment', Record<GroupRule, string>> = {
  approval: { none: 'لا يلزم — تُعتمد عند الإرسال', always: 'يلزم لكل عملية', above: 'يلزم من مبلغ معيّن' },
  attachment: { none: 'لا يلزم', always: 'يلزم لكل مصروف', above: 'يلزم فوق مبلغ معيّن' },
};

function RuleField({ kind, rule, amount, onChange, disabled }: { kind: 'approval' | 'attachment'; rule: GroupRule; amount: Minor | null; onChange: (rule: GroupRule, amount: Minor | null) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={kind === 'approval' ? 'الاعتماد' : 'إيصال المصروف'}>
        <Select value={rule} disabled={disabled} onValueChange={(v) => onChange(v as GroupRule, v === 'above' ? amount : null)}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(['none', 'always', 'above'] as const).map((r) => <SelectItem key={r} value={r}>{RULE_LABELS[kind][r]}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      {rule === 'above' ? (
        <OptionalAmount
          disabled={disabled}
          label={kind === 'approval' ? 'يلزم الاعتماد من مبلغ' : 'يلزم الإيصال فوق مبلغ'}
          hint={kind === 'approval' ? 'ما دونه يُعتمد تلقائياً عند الإرسال.' : 'المبلغ نفسه لا يحتاج إيصالاً.'}
          value={amount}
          onChange={(v) => onChange('above', v)}
        />
      ) : null}
    </div>
  );
}

/** Company users who sign in: the only ones who manage or approve. */
function useApproverChoices() {
  const live = useExpensesStore((s) => s.liveParticipants);
  return React.useMemo(() => live.filter((p) => p.userId), [live]);
}

const STAGE_OPTIONS: Array<{ value: ApprovalStage['mode']; label: string }> = [
  { value: 'sequential', label: 'تسلسلي — واحد بعد الآخر' },
  { value: 'parallel', label: 'متوازٍ — في آنٍ واحد' },
  { value: 'any_one', label: 'موافقة أحد المعتمدين' },
  { value: 'optional', label: 'اختياري — لا يوقف الاعتماد' },
];

/** Stages as the form edits them: saved stages, else the older manager and approver list. */
function stagesOf(policy: GroupPolicy): ApprovalStage[] {
  if (policy.stages && policy.stages.length > 0) return policy.stages;
  return approvalStages(policy).map(({ mode, approverIds, requiredCount }) => ({ mode, approverIds, requiredCount }));
}

function StagesField({ policy, onChange, disabled }: { policy: GroupPolicy; onChange: (stages: ApprovalStage[]) => void; disabled?: boolean }) {
  const users = useApproverChoices();
  const stages = stagesOf(policy);
  const commit = (next: ApprovalStage[]) => onChange(next);
  const patch = (index: number, part: Partial<ApprovalStage>) => commit(stages.map((s, i) => (i === index ? { ...s, ...part } : s)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">مراحل الموافقة <span className="font-normal text-muted-foreground">({stages.length})</span></p>
        {!disabled ? (
          <Button type="button" size="sm" variant="outline" onClick={() => commit([...stages, { mode: 'sequential', approverIds: [], requiredCount: null }])}>إضافة مرحلة</Button>
        ) : null}
      </div>
      {stages.length === 0 ? <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">بلا مراحل: يعتمد من يملك صلاحية الاعتماد. لا يعتمد أحد عملية سجّلها بنفسه.</p> : null}
      {stages.map((stage, index) => {
        const taken = new Set(stages.flatMap((s) => s.approverIds));
        const free = users.filter((u) => !taken.has(u.id));
        return (
          <div key={index} className="space-y-2 rounded-lg border border-border p-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{index + 1}</span>
              <Select value={stage.mode} disabled={disabled} onValueChange={(v) => patch(index, { mode: v as ApprovalStage['mode'], requiredCount: v === 'parallel' ? stage.requiredCount : null })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{STAGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              {!disabled ? <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="حذف المرحلة" onClick={() => commit(stages.filter((_, i) => i !== index))}><X className="h-4 w-4" /></Button> : null}
            </div>
            <div className="space-y-1">
              {stage.approverIds.map((id, i) => (
                <div key={id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1">
                  <span className="w-4 text-center text-xs text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm"><PartyName id={id} link={false} /></span>
                  {!disabled ? (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="أعلى" disabled={i === 0} onClick={() => { const ids = [...stage.approverIds]; const [x] = ids.splice(i, 1); ids.splice(i - 1, 0, x!); patch(index, { approverIds: ids }); }}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="أسفل" disabled={i === stage.approverIds.length - 1} onClick={() => { const ids = [...stage.approverIds]; const [x] = ids.splice(i, 1); ids.splice(i + 1, 0, x!); patch(index, { approverIds: ids }); }}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="إزالة" onClick={() => patch(index, { approverIds: stage.approverIds.filter((v) => v !== id) })}><X className="h-3.5 w-3.5" /></Button>
                    </>
                  ) : null}
                </div>
              ))}
              {!disabled && free.length > 0 ? (
                <Select value="" onValueChange={(id) => patch(index, { approverIds: [...stage.approverIds, id] })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="إضافة معتمِد" /></SelectTrigger>
                  <SelectContent>{free.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              ) : null}
            </div>
            {stage.mode === 'parallel' && stage.approverIds.length > 1 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="كم موافقة تكفي">
                  <Select value={stage.requiredCount == null ? 'all' : 'count'} disabled={disabled} onValueChange={(v) => patch(index, { requiredCount: v === 'all' ? null : 1 })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميعهم</SelectItem>
                      <SelectItem value="count">عدد محدد</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {stage.requiredCount != null ? (
                  <Field label="عدد المعتمدين">
                    <Select value={String(Math.min(stage.requiredCount, stage.approverIds.length))} disabled={disabled} onValueChange={(v) => patch(index, { requiredCount: Number(v) })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {stage.approverIds.map((_, n) => <SelectItem key={n + 1} value={String(n + 1)}>{n + 1}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
              </div>
            ) : null}
            <p className="text-[11px] text-muted-foreground">{stage.mode === 'optional' ? 'لا توقف العملية: الاعتماد يكمل بدونها.' : STAGE_MODE_LABELS_AR[stage.mode]}</p>
          </div>
        );
      })}
    </div>
  );
}

/** Everything a group requires of its records. */
export function GroupPolicyFields({ value, onChange, disabled }: { value: GroupPolicy; onChange: (p: GroupPolicy) => void; disabled?: boolean }) {
  const set = (patch: Partial<GroupPolicy>) => onChange({ ...value, ...patch });
  const approval = value.approval !== 'none';
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border p-3">
        <p className="text-sm font-semibold">الاعتماد</p>
        <RuleField kind="approval" rule={value.approval} amount={value.approvalAbove} disabled={disabled} onChange={(rule, amount) => set({ approval: rule, approvalAbove: amount })} />
        {approval ? (
          <StagesField policy={value} disabled={disabled} onChange={(stages) => set({ stages, managerId: null, approverIds: [], approvalMode: 'sequential' })} />
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl border border-border p-3">
        <p className="text-sm font-semibold">سياسات المصروفات</p>
        <RuleField kind="attachment" rule={value.attachment} amount={value.attachmentAbove} disabled={disabled} onChange={(rule, amount) => set({ attachment: rule, attachmentAbove: amount })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionalAmount disabled={disabled} label="الحد الشهري للمجموعة" hint="مجموع مصروفات المجموعة في الشهر." value={value.monthlyLimit} onChange={(v) => set({ monthlyLimit: v })} />
          <OptionalAmount disabled={disabled} label="الحد الشهري للشخص" hint="ما يسجّله الشخص الواحد في المجموعة في الشهر." value={value.monthlyLimitPerPerson} onChange={(v) => set({ monthlyLimitPerPerson: v })} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <div><p className="text-sm font-medium">منع الإرسال عند المخالفة</p><p className="text-xs text-muted-foreground">عند الإيقاف تظهر تنبيهات فقط.</p></div>
          <Switch checked={value.blockOnViolation} disabled={disabled} onCheckedChange={(v) => set({ blockOnViolation: v })} />
        </div>
      </div>
    </div>
  );
}

/** One line describing a group's policy (lists and pickers). */
export function policySummary(policy: GroupPolicy, format: (m: Minor) => string): string {
  const parts: string[] = [];
  if (policy.approval === 'none') parts.push('بلا اعتماد');
  else {
    const stages = stagesOf(policy);
    const who = stages.length === 0 ? 'من يملك الصلاحية' : stages.map((s) => `${STAGE_MODE_LABELS_AR[s.mode]} (${s.approverIds.length}${s.mode === 'parallel' && s.requiredCount != null ? ` يكفي ${s.requiredCount}` : ''})`).join(' ثم ');
    parts.push(policy.approval === 'always' ? `اعتماد: ${who}` : `اعتماد من ${format(policy.approvalAbove ?? 0)}: ${who}`);
  }
  if (policy.attachment === 'always') parts.push('إيصال دائماً');
  if (policy.attachment === 'above') parts.push(`إيصال فوق ${format(policy.attachmentAbove ?? 0)}`);
  if (policy.monthlyLimit != null) parts.push(`حد شهري ${format(policy.monthlyLimit)}`);
  if (policy.monthlyLimitPerPerson != null) parts.push(`للشخص ${format(policy.monthlyLimitPerPerson)}`);
  return parts.join(' · ');
}

export function newGroupPolicy(): GroupPolicy {
  return { ...OPEN_POLICY, approverIds: [] };
}

/** Open groups a new record can be filed under (the default first). */
export function openGroups(data: ExpensesData): ExpenseGroup[] {
  return [...data.groups.filter((g) => groupStatusOf(g) === 'active' && !g.archived)].sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));
}

/** The group picker of the forms; empty value = the default group. */
export function GroupSelect({ value, onChange, keep }: { value: string | null; onChange: (id: string | null) => void; keep?: string | null }) {
  const data = useExpensesData();
  if (!data) return null;
  const home = defaultGroup(data);
  const list = openGroups(data);
  const kept = keep ? data.groups.find((g) => g.id === keep && (groupStatusOf(g) !== 'active' || g.archived)) : undefined;
  const current = value ?? home?.id ?? '';
  return (
    <Field label="المجموعة" hint="تحدد سياسة العملية: من يعتمدها وما يلزمها.">
      <Select value={current} onValueChange={(v) => onChange(v === home?.id ? home.id : v)}>
        <SelectTrigger className="h-10"><SelectValue placeholder="المجموعة" /></SelectTrigger>
        <SelectContent>
          {[...list, ...(kept ? [kept] : [])].map((g) => <SelectItem key={g.id} value={g.id}>{g.name}{g.isDefault ? ' (افتراضية)' : ''}{groupStatusOf(g) === 'active' ? '' : ` · ${groupStatusOf(g) === 'maintenance' ? 'تحت الصيانة' : groupStatusOf(g) === 'suspended' ? 'موقوفة' : 'منتهية'}`}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** Picker and policy hint of a new record; hidden while the default is the only open group. */
export function GroupField({ value, onChange, amount }: { value: string | null; onChange: (id: string | null) => void; amount: Minor }) {
  const data = useExpensesData();
  if (!data || openGroups(data).length < 2) return amount > 0 ? <GroupPolicyHint groupId={value} amount={amount} /> : null;
  return (
    <div className="space-y-1">
      <GroupSelect value={value} onChange={onChange} />
      {amount > 0 ? <GroupPolicyHint groupId={value} amount={amount} /> : null}
    </div>
  );
}

/** What sending this amount in this group will do (shown under the amount). */
export function GroupPolicyHint({ groupId, amount, expense }: { groupId: string | null; amount: Minor; expense?: boolean }) {
  const data = useExpensesData();
  const currency = useCurrency();
  if (!data) return null;
  const policy = groupOf(data, groupId)?.policy ?? OPEN_POLICY;
  const lines: string[] = [];
  lines.push(approvalRequired(policy, amount) ? 'تحتاج اعتماداً بعد الإرسال' : 'تُعتمد عند الإرسال');
  if (expense && attachmentRequired(policy, amount)) lines.push('يلزم إرفاق إيصال');
  if (policy.attachment === 'above' && expense && !attachmentRequired(policy, amount)) lines.push(`الإيصال يلزم فوق ${formatMoney(policy.attachmentAbove ?? 0, currency)}`);
  return <p className="text-xs text-muted-foreground">{lines.join(' · ')}</p>;
}

const STEP_ICON: Record<ApprovalStep['status'], React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-amber-500" />,
  approved: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  rejected: <XCircle className="h-4 w-4 text-destructive" />,
  skipped: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
};
const STEP_LABEL: Record<ApprovalStep['status'], string> = { pending: 'بانتظار', approved: 'اعتمد', rejected: 'رفض', skipped: 'تُخطّي' };

/** The approval path of a sent record: who decided, whose turn it is. */
export function ApprovalTimeline({ txn }: { txn: AnyTxn }) {
  const approval = txn.approval;
  if (!approval) return null;
  const turn = txn.status === 'submitted' ? currentDeciders(txn) : [];
  if (approval.steps.length === 0) {
    return <p className="text-xs text-muted-foreground">{txn.status === 'submitted' ? 'بانتظار من يملك صلاحية الاعتماد (غير من سجّلها).' : null}</p>;
  }
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">مسار الاعتماد — {APPROVAL_MODE_LABELS_AR[approval.mode]}</p>
      <ol className="space-y-1">
        {approval.steps.map((s) => (
          <li key={s.partyId} className={cn('flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm', turn?.includes(s.partyId) && 'bg-amber-50 dark:bg-amber-950/30')}>
            <span className="mt-0.5">{STEP_ICON[s.status]}</span>
            <div className="min-w-0 flex-1">
              <p><PartyName id={s.partyId} /> <span className="text-xs text-muted-foreground">· {s.role === 'manager' ? 'مدير المجموعة' : 'معتمِد'} · {turn?.includes(s.partyId) ? 'دوره الآن' : STEP_LABEL[s.status]}</span></p>
              {s.note ? <p className="text-xs text-muted-foreground">{s.note}</p> : null}
            </div>
            {s.decidedAt ? <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground" dir="ltr">{s.decidedAt.slice(0, 16).replace('T', ' ')}</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
