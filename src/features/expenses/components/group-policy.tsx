'use client';

import * as React from 'react';
import { CheckCircle2, Circle, MinusCircle, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/shared/utils';
import { useExpensesStore } from '../data/store';
import { formatMoney, minorToInput, type Minor } from '../domain/money';
import { APPROVAL_MODE_LABELS_AR, STAGE_MODE_LABELS_AR, approvalRequired, approvalStages, attachmentRequired, currentDeciders, defaultGroup, groupOf, groupStatusOf, OPEN_POLICY } from '../domain/policy';
import type { AnyTxn, ApprovalStage, ApprovalStep, ExpenseGroup, ExpensesData, GroupPolicy, GroupRule } from '../domain/types';
import { AmountInput, Field, PartyName, PickList } from './common';
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

const APPROVAL_TYPES: Array<{ value: ApprovalStage['mode']; label: string }> = [
  { value: 'sequential', label: 'تسلسلي — واحد بعد الآخر' },
  { value: 'parallel', label: 'متوازٍ — في آنٍ واحد' },
  { value: 'any_one', label: 'موافقة أحد المعتمدين' },
];
/** No longer offered; shown only for a group already saved with it. */
const OPTIONAL_TYPE = { value: 'optional' as const, label: 'اختياري — لا يوقف الاعتماد' };

const TYPE_HINTS: Record<ApprovalStage['mode'], string> = {
  sequential: 'يعتمدون بالترتيب الظاهر، واحداً بعد الآخر.',
  parallel: 'يعتمدون في آنٍ واحد، بأي ترتيب.',
  any_one: 'تكفي موافقة واحد منهم.',
  optional: 'لا يوقف العملية: الاعتماد يكمل بدونهم.',
};

/** Stages as saved, else the older manager and approver list. */
function stagesOf(policy: GroupPolicy): ApprovalStage[] {
  if (policy.stages && policy.stages.length > 0) return policy.stages;
  return approvalStages(policy).map(({ mode, approverIds, requiredCount }) => ({ mode, approverIds, requiredCount }));
}

/** The one list the form edits: one type for all of the group's approvers. */
export function approvalListOf(policy: GroupPolicy): ApprovalStage {
  const stages = stagesOf(policy);
  const deciding = stages.filter((s) => s.mode !== 'optional');
  const from = deciding.length > 0 ? deciding : stages;
  return {
    mode: from[0]?.mode ?? 'sequential',
    approverIds: [...new Set(from.flatMap((s) => s.approverIds))],
    requiredCount: from.length === 1 ? from[0]!.requiredCount : null,
  };
}

function ApproversField({ policy, onChange, disabled }: { policy: GroupPolicy; onChange: (stages: ApprovalStage[]) => void; disabled?: boolean }) {
  const users = useApproverChoices();
  const list = approvalListOf(policy);
  const savedStages = stagesOf(policy).filter((s) => s.approverIds.length > 0).length;
  const commit = (part: Partial<ApprovalStage>) => onChange([{ ...list, ...part }]);
  const types = list.mode === 'optional' ? [...APPROVAL_TYPES, OPTIONAL_TYPE] : APPROVAL_TYPES;
  return (
    <div className="space-y-3">
      <Field label="نوع الموافقة" hint={TYPE_HINTS[list.mode]}>
        <Select value={list.mode} disabled={disabled} onValueChange={(v) => commit({ mode: v as ApprovalStage['mode'], requiredCount: v === 'parallel' ? list.requiredCount : null })}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>{types.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label={`المعتمدون (${list.approverIds.length})`} hint={list.approverIds.length === 0 ? 'بلا معتمدين: يعتمد من يملك صلاحية الاعتماد. لا يعتمد أحد عملية سجّلها بنفسه.' : undefined}>
        <PickList
          options={users.map((u) => ({ id: u.id, name: u.name }))}
          value={list.approverIds}
          onChange={(approverIds) => commit({ approverIds })}
          placeholder="اختر معتمِداً"
          renderName={(id) => <PartyName id={id} link={false} />}
          ordered={list.mode === 'sequential'}
          disabled={disabled}
        />
      </Field>
      {list.mode === 'parallel' && list.approverIds.length > 1 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="كم موافقة تكفي">
            <Select value={list.requiredCount == null ? 'all' : 'count'} disabled={disabled} onValueChange={(v) => commit({ requiredCount: v === 'all' ? null : 1 })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميعهم</SelectItem>
                <SelectItem value="count">عدد محدد</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {list.requiredCount != null ? (
            <Field label="عدد المعتمدين">
              <Select value={String(Math.min(list.requiredCount, list.approverIds.length))} disabled={disabled} onValueChange={(v) => commit({ requiredCount: Number(v) })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {list.approverIds.map((_, n) => <SelectItem key={n + 1} value={String(n + 1)}>{n + 1}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </div>
      ) : null}
      {savedStages > 1 ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">لهذه المجموعة {savedStages} مراحل محفوظة، وتبقى كما هي ما لم تعدّل هنا. عند أي تعديل تصير قائمة واحدة بنوع واحد.</p> : null}
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
          <ApproversField policy={value} disabled={disabled} onChange={(stages) => set({ stages, managerId: null, approverIds: [], approvalMode: 'sequential' })} />
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
