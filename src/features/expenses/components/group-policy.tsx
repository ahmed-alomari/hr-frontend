'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Circle, MinusCircle, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/shared/utils';
import { useExpensesStore } from '../data/store';
import { formatMoney, minorToInput, type Minor } from '../domain/money';
import { APPROVAL_MODE_LABELS_AR, approvalRequired, attachmentRequired, currentDeciders, defaultGroup, groupOf, OPEN_POLICY } from '../domain/policy';
import type { AnyTxn, ApprovalStep, ExpenseGroup, ExpensesData, GroupPolicy, GroupRule } from '../domain/types';
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

function ApproversField({ value, managerId, onChange, disabled }: { value: string[]; managerId: string | null; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const users = useApproverChoices();
  const free = users.filter((u) => u.id !== managerId && !value.includes(u.id));
  const move = (i: number, by: number) => {
    const next = [...value];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x!);
    onChange(next);
  };
  return (
    <Field label="المعتمِدون" hint="بالترتيب. بلا معتمدين ولا مدير: يعتمد من يملك صلاحية الاعتماد. لا يعتمد أحد عملية سجّلها بنفسه.">
      <div className="space-y-1.5">
        {value.map((id, i) => (
          <div key={id} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
            <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm"><PartyName id={id} link={false} /></span>
            {!disabled ? (
              <>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="أعلى" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="أسفل" disabled={i === value.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="إزالة" onClick={() => onChange(value.filter((v) => v !== id))}><X className="h-4 w-4" /></Button>
              </>
            ) : null}
          </div>
        ))}
        {!disabled && free.length > 0 ? (
          <Select value="" onValueChange={(id) => onChange([...value, id])}>
            <SelectTrigger className="h-10"><SelectValue placeholder="إضافة معتمِد" /></SelectTrigger>
            <SelectContent>{free.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
          </Select>
        ) : null}
      </div>
    </Field>
  );
}

/** Everything a group requires of its records. */
export function GroupPolicyFields({ value, onChange, disabled }: { value: GroupPolicy; onChange: (p: GroupPolicy) => void; disabled?: boolean }) {
  const users = useApproverChoices();
  const set = (patch: Partial<GroupPolicy>) => onChange({ ...value, ...patch });
  const approval = value.approval !== 'none';
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border p-3">
        <p className="text-sm font-semibold">الاعتماد</p>
        <RuleField kind="approval" rule={value.approval} amount={value.approvalAbove} disabled={disabled} onChange={(rule, amount) => set({ approval: rule, approvalAbove: amount })} />
        {approval ? (
          <>
            <Field label="مدير المجموعة (اختياري)" hint="يعتمد أولاً، قبل المعتمدين.">
              <Select value={value.managerId ?? 'none'} disabled={disabled} onValueChange={(v) => { const managerId = v === 'none' ? null : v; set({ managerId, approverIds: value.approverIds.filter((id) => id !== managerId) }); }}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بلا مدير</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <ApproversField value={value.approverIds} managerId={value.managerId} disabled={disabled} onChange={(approverIds) => set({ approverIds })} />
            {value.approverIds.length > 1 ? (
              <Field label="طريقة الاعتماد">
                <Select value={value.approvalMode} disabled={disabled} onValueChange={(v) => set({ approvalMode: v as GroupPolicy['approvalMode'] })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['sequential', 'parallel', 'any_one'] as const).map((m) => <SelectItem key={m} value={m}>{APPROVAL_MODE_LABELS_AR[m]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </>
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
    const who = policy.managerId || policy.approverIds.length ? `${policy.managerId ? 'المدير' : ''}${policy.managerId && policy.approverIds.length ? ' ثم ' : ''}${policy.approverIds.length ? `${policy.approverIds.length} معتمِد` : ''}` : 'من يملك الصلاحية';
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
  return [...data.groups.filter((g) => !g.closed)].sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));
}

/** The group picker of the forms; empty value = the default group. */
export function GroupSelect({ value, onChange, keep }: { value: string | null; onChange: (id: string | null) => void; keep?: string | null }) {
  const data = useExpensesData();
  if (!data) return null;
  const home = defaultGroup(data);
  const list = openGroups(data);
  const kept = keep ? data.groups.find((g) => g.id === keep && g.closed) : undefined;
  const current = value ?? home?.id ?? '';
  return (
    <Field label="المجموعة" hint="تحدد سياسة العملية: من يعتمدها وما يلزمها.">
      <Select value={current} onValueChange={(v) => onChange(v === home?.id ? home.id : v)}>
        <SelectTrigger className="h-10"><SelectValue placeholder="المجموعة" /></SelectTrigger>
        <SelectContent>
          {[...list, ...(kept ? [kept] : [])].map((g) => <SelectItem key={g.id} value={g.id}>{g.name}{g.isDefault ? ' (افتراضية)' : ''}{g.closed ? ' · مغلقة' : ''}</SelectItem>)}
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
