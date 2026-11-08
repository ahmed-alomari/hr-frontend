/**
 * Policies (receipts, spending limits) and the approval workflow:
 * draft → submitted → approved | rejected; any approved record → void.
 * Only approved records change balances (see ledger). Each record follows the
 * policy of its group (the company's default group when none is chosen). The
 * mode (simple / advanced) only changes what the screens show.
 */
import type { Minor } from './money';
import type { AnyTxn, ApprovalStage, ApprovalStep, Category, Expense, ExpenseGroup, ExpensesData, GroupPolicy, GroupStatus, TxnApproval, TxnStatus } from './types';

/** The policy of a company that never set one: nothing required. */
export const OPEN_POLICY: GroupPolicy = {
  attachment: 'none',
  attachmentAbove: null,
  approval: 'none',
  approvalAbove: null,
  monthlyLimit: null,
  monthlyLimitPerPerson: null,
  blockOnViolation: false,
  managerId: null,
  approverIds: [],
  approvalMode: 'sequential',
  stages: [],
};

export const DEFAULT_GROUP_NAME = 'عام';

const RULES = ['none', 'always', 'above'] as const;
const MODES = ['sequential', 'parallel', 'any_one'] as const;
const STAGE_MODES = ['sequential', 'parallel', 'any_one', 'optional'] as const;
const STEP_STATUSES = ['pending', 'approved', 'rejected', 'skipped'] as const;
const GROUP_STATUSES = ['active', 'maintenance', 'suspended', 'ended'] as const;

const oneOf = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  list.includes(value as T) ? (value as T) : fallback;

const amountOrNull = (value: unknown): Minor | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

const textOrNull = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** A stored policy (jsonb) read safely: unknown or missing fields are off. */
export function readPolicy(raw: unknown): GroupPolicy {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    attachment: oneOf(RULES, r.attachment, 'none'),
    attachmentAbove: amountOrNull(r.attachmentAbove),
    approval: oneOf(RULES, r.approval, 'none'),
    approvalAbove: amountOrNull(r.approvalAbove),
    monthlyLimit: amountOrNull(r.monthlyLimit),
    monthlyLimitPerPerson: amountOrNull(r.monthlyLimitPerPerson),
    blockOnViolation: r.blockOnViolation === true,
    managerId: textOrNull(r.managerId),
    approverIds: Array.isArray(r.approverIds) ? r.approverIds.filter((x): x is string => typeof x === 'string' && !!x) : [],
    approvalMode: oneOf(MODES, r.approvalMode, 'sequential'),
    stages: readStages(r.stages),
  };
}

function readStages(raw: unknown): ApprovalStage[] {
  if (!Array.isArray(raw)) return [];
  const stages: ApprovalStage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    const approverIds = Array.isArray(s.approverIds) ? s.approverIds.filter((x): x is string => typeof x === 'string' && !!x) : [];
    if (approverIds.length === 0) continue;
    const mode = oneOf(STAGE_MODES, s.mode, 'sequential');
    const count = s.requiredCount;
    stages.push({
      mode,
      approverIds,
      requiredCount: mode === 'parallel' && typeof count === 'number' && Number.isInteger(count) && count >= 1 ? count : null,
    });
  }
  return stages;
}

/** A stored approval path (jsonb) read safely. */
export function readApproval(raw: unknown): TxnApproval | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const steps: unknown[] = Array.isArray(r.steps) ? r.steps : [];
  const stageRows: unknown[] = Array.isArray(r.stages) ? r.stages : [];
  const stages = stageRows.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const s = item as Record<string, unknown>;
    const count = s.requiredCount;
    return [{ mode: oneOf(MODES, s.mode, 'sequential'), requiredCount: typeof count === 'number' && Number.isInteger(count) && count >= 1 ? count : null }];
  });
  return {
    mode: oneOf(MODES, r.mode, 'sequential'),
    stages: stages.length > 0 ? stages : undefined,
    steps: steps
      .filter(
        (s): s is Record<string, unknown> => !!s && typeof s === 'object' && typeof (s as Record<string, unknown>).partyId === 'string',
      )
      .map((s) => ({
        partyId: s.partyId as string,
        role: s.role === 'manager' ? 'manager' : 'approver',
        stage: typeof s.stage === 'number' ? s.stage : undefined,
        status: oneOf(STEP_STATUSES, s.status, 'pending'),
        decidedAt: textOrNull(s.decidedAt),
        note: textOrNull(s.note),
      })),
  };
}

export function defaultGroup(data: ExpensesData): ExpenseGroup | undefined {
  return data.groups.find((g) => g.isDefault);
}

/** The group a record is filed under: its own, else the company's default. */
export function groupOf(data: ExpensesData, groupId: string | null | undefined): ExpenseGroup | undefined {
  return (groupId ? data.groups.find((g) => g.id === groupId) : undefined) ?? defaultGroup(data);
}

export function policyOf(data: ExpensesData, groupId: string | null | undefined): GroupPolicy {
  return groupOf(data, groupId)?.policy ?? OPEN_POLICY;
}

/** The group of a custody move is its custody's. */
export function txnGroupId(data: ExpensesData, txn: AnyTxn): string | null {
  if (txn.kind === 'custody_move') {
    return data.custodies.find((c) => c.id === txn.custodyId)?.groupId ?? txn.groupId ?? null;
  }
  return txn.groupId ?? null;
}

export type PolicyViolation = {
  code: 'category_limit' | 'attachment_required' | 'monthly_limit' | 'group_monthly_limit';
  message: string;
};

const counted = (e: Expense) => e.status === 'approved' || e.status === 'submitted';

/** Expenses (minor units) in the month of `date` in `groupId`, of one person when given. */
export function monthlySpendOf(
  data: ExpensesData,
  groupId: string | null,
  date: string,
  currency: string,
  options: { personId?: string; excludeId?: string } = {},
): Minor {
  const month = date.slice(0, 7);
  const target = groupOf(data, groupId)?.id ?? null;
  return data.expenses
    .filter(
      (e) =>
        e.id !== options.excludeId &&
        (options.personId == null || e.createdBy === options.personId) &&
        (groupOf(data, e.groupId)?.id ?? null) === target &&
        e.currency === currency &&
        e.date.startsWith(month) &&
        counted(e),
    )
    .reduce((t, e) => t + e.amount, 0);
}

function ruleApplies(rule: GroupPolicy['attachment'], above: Minor | null, amount: Minor, strict: boolean): boolean {
  if (rule === 'always') return true;
  if (rule !== 'above' || above == null) return false;
  return strict ? amount > above : amount >= above;
}

export function attachmentRequired(policy: GroupPolicy, amount: Minor) {
  return ruleApplies(policy.attachment, policy.attachmentAbove, amount, true);
}

export function approvalRequired(policy: GroupPolicy, amount: Minor) {
  return ruleApplies(policy.approval, policy.approvalAbove, amount, false);
}

export function checkPolicies(
  expense: Pick<Expense, 'id' | 'amount' | 'categoryId' | 'attachments' | 'createdBy' | 'date' | 'currency' | 'groupId'>,
  data: ExpensesData,
  formatAmount: (minor: Minor) => string,
): PolicyViolation[] {
  const group = groupOf(data, expense.groupId);
  const policy = group?.policy ?? OPEN_POLICY;
  const out: PolicyViolation[] = [];
  const category: Category | undefined = data.categories.find((c) => c.id === expense.categoryId);
  if (category?.maxAmount != null && expense.amount > category.maxAmount) {
    out.push({
      code: 'category_limit',
      message: `يتجاوز حد فئة «${category.name}» (${formatAmount(category.maxAmount)})`,
    });
  }
  if (attachmentRequired(policy, expense.amount) && expense.attachments.length === 0) {
    out.push({
      code: 'attachment_required',
      message:
        policy.attachment === 'always'
          ? `يلزم إرفاق إيصال لكل مصروف في «${group?.name ?? DEFAULT_GROUP_NAME}»`
          : `يلزم إرفاق إيصال للمبالغ فوق ${formatAmount(policy.attachmentAbove ?? 0)}`,
    });
  }
  const groupId = group?.id ?? null;
  if (policy.monthlyLimit != null) {
    const spent = monthlySpendOf(data, groupId, expense.date, expense.currency, { excludeId: expense.id });
    if (spent + expense.amount > policy.monthlyLimit) {
      out.push({
        code: 'group_monthly_limit',
        message: `يتجاوز الحد الشهري للمجموعة (${formatAmount(policy.monthlyLimit)})`,
      });
    }
  }
  if (policy.monthlyLimitPerPerson != null) {
    const spent = monthlySpendOf(data, groupId, expense.date, expense.currency, { personId: expense.createdBy, excludeId: expense.id });
    if (spent + expense.amount > policy.monthlyLimitPerPerson) {
      out.push({
        code: 'monthly_limit',
        message: `يتجاوز الحد الشهري للشخص في المجموعة (${formatAmount(policy.monthlyLimitPerPerson)})`,
      });
    }
  }
  return out;
}

export function blocksSubmit(violations: readonly PolicyViolation[], policy: GroupPolicy): boolean {
  return policy.blockOnViolation && violations.length > 0;
}

/** Stages that decide, in order. A policy without stages keeps manager then approvers. */
export function approvalStages(policy: GroupPolicy): Array<ApprovalStage & { role: ApprovalStep['role'] }> {
  if (policy.stages && policy.stages.length > 0) return policy.stages.map((s) => ({ ...s, role: 'approver' as const }));
  const out: Array<ApprovalStage & { role: ApprovalStep['role'] }> = [];
  if (policy.managerId) out.push({ mode: 'sequential', approverIds: [policy.managerId], requiredCount: null, role: 'manager' });
  if (policy.approverIds.length > 0) out.push({ mode: policy.approvalMode, approverIds: policy.approverIds, requiredCount: null, role: 'approver' });
  return out;
}

/**
 * The approval path of a record sent now: approved at once when its group
 * needs no approval for this amount; else one stage after another. An
 * optional stage does not wait. The author never decides their own record.
 */
export function approvalPlan(policy: GroupPolicy, amount: Minor, authorId: string): { status: TxnStatus; approval: TxnApproval | null } {
  if (!approvalRequired(policy, amount)) return { status: 'approved', approval: null };
  const blocking = approvalStages(policy).filter((s) => s.mode !== 'optional' && s.approverIds.length > 0);
  const steps: ApprovalStep[] = [];
  const seen = new Set<string>();
  blocking.forEach((stage, stageIndex) => {
    for (const partyId of stage.approverIds) {
      if (seen.has(partyId)) continue;
      seen.add(partyId);
      steps.push(
        partyId === authorId
          ? { partyId, role: stage.role, stage: stageIndex, status: 'skipped', note: 'هو من سجّل العملية' }
          : { partyId, role: stage.role, stage: stageIndex, status: 'pending' },
      );
    }
  });
  const first = blocking[0]?.mode;
  return {
    status: 'submitted',
    approval: {
      mode: first === 'parallel' || first === 'any_one' ? first : 'sequential',
      stages: blocking.map((s) => ({ mode: s.mode === 'parallel' || s.mode === 'any_one' ? s.mode : 'sequential', requiredCount: s.requiredCount })),
      steps,
    },
  };
}

function stageNeed(meta: { mode: TxnApproval['mode']; requiredCount: number | null }, steps: ApprovalStep[]): number {
  const live = steps.filter((s) => s.status !== 'skipped').length;
  if (live === 0) return 0;
  if (meta.mode === 'any_one') return 1;
  if (meta.mode === 'parallel' && meta.requiredCount != null) return Math.min(meta.requiredCount, live);
  return live;
}

function stageComplete(meta: { mode: TxnApproval['mode']; requiredCount: number | null }, steps: ApprovalStep[]): boolean {
  const approved = steps.filter((s) => s.status === 'approved').length;
  const pending = steps.filter((s) => s.status === 'pending');
  return approved >= stageNeed(meta, steps) || pending.length === 0;
}

/** Who may decide now: null = anyone with the approve permission. */
export function currentDeciders(txn: AnyTxn): string[] | null {
  const approval = txn.approval;
  const steps = approval?.steps ?? [];
  const pending = steps.filter((s) => s.status === 'pending');
  if (pending.length === 0) return null;
  const staged = approval?.stages;
  if (staged && staged.length > 0) {
    for (let i = 0; i < staged.length; i++) {
      const meta = staged[i]!;
      const ofStage = steps.filter((s) => (s.stage ?? 0) === i);
      if (stageComplete(meta, ofStage)) continue;
      const waiting = ofStage.filter((s) => s.status === 'pending');
      if (waiting.length === 0) return null;
      if (meta.mode === 'sequential') return [waiting[0]!.partyId];
      return waiting.map((s) => s.partyId);
    }
    return null;
  }
  const manager = pending.find((s) => s.role === 'manager');
  if (manager) return [manager.partyId];
  if (approval?.mode === 'sequential') return [pending[0]!.partyId];
  return pending.map((s) => s.partyId);
}

/** Anyone but its author, and only whose turn it is when the path names people. */
export function canDecide(actorId: string, txn: AnyTxn): boolean {
  if (txn.status !== 'submitted' || txn.createdBy === actorId) return false;
  const deciders = currentDeciders(txn);
  return deciders === null || deciders.includes(actorId);
}

/** One decision. A rejection ends it. An approval ends it when every stage is complete. */
export function applyDecision<T extends AnyTxn>(
  txn: T,
  actorId: string,
  decision: 'approved' | 'rejected',
  note: string | null,
  now: string,
): T {
  const approval = txn.approval ?? null;
  const steps = (approval?.steps ?? []).map((s) =>
    s.partyId === actorId && s.status === 'pending' ? { ...s, status: decision, decidedAt: now, note } : s,
  );
  const next = { ...txn, approval: approval ? { ...approval, steps } : null } as T;
  const skipRest = (list: ApprovalStep[]) => list.map((s) => (s.status === 'pending' ? { ...s, status: 'skipped' as const } : s));
  const finish = (status: TxnStatus, finalSteps: ApprovalStep[]): T => ({
    ...txn,
    status,
    approval: approval ? { ...approval, steps: finalSteps } : null,
    decidedBy: actorId,
    decidedAt: now,
    decisionNote: note,
  });
  if (decision === 'rejected') return finish('rejected', skipRest(steps));
  const staged = approval?.stages;
  if (staged && staged.length > 0) {
    const done = staged.every((meta, i) => stageComplete(meta, steps.filter((s) => (s.stage ?? 0) === i)));
    return done ? finish('approved', skipRest(steps)) : next;
  }
  const waiting = steps.filter((s) => s.status === 'pending');
  const managerWaits = waiting.some((s) => s.role === 'manager');
  const approverDecided = steps.some((s) => s.role === 'approver' && s.status === 'approved');
  const done = waiting.length === 0 || (!managerWaits && approval?.mode === 'any_one' && approverDecided);
  return done ? finish('approved', skipRest(steps)) : next;
}

const GROUP_STATUS_LABEL: Record<Exclude<GroupStatus, 'active'>, string> = {
  maintenance: 'تحت الصيانة',
  suspended: 'موقوفة',
  ended: 'منتهية ومغلقة',
};

export function groupStatusOf(group: ExpenseGroup): GroupStatus {
  if (group.status && (GROUP_STATUSES as readonly string[]).includes(group.status)) return group.status;
  return group.closed ? 'ended' : 'active';
}

export const GROUP_STATUS_LABELS_AR: Record<GroupStatus, string> = {
  active: 'نشطة',
  maintenance: 'تحت الصيانة',
  suspended: 'موقوفة',
  ended: 'منتهية',
};

export function groupFilingBlock(group: ExpenseGroup, actorId: string | undefined): string | null {
  const status = groupStatusOf(group);
  if (status !== 'active') return `المجموعة «${group.name}» ${GROUP_STATUS_LABEL[status]}`;
  if (actorId && !group.isDefault && !group.memberIds.includes(actorId)) return `التسجيل في «${group.name}» لأعضائها فقط`;
  return null;
}

export function canVoid(txn: AnyTxn): boolean {
  return txn.status === 'approved' || txn.status === 'submitted';
}

export const STATUS_LABELS_AR: Record<TxnStatus, string> = {
  draft: 'مسودة',
  submitted: 'بانتظار الاعتماد',
  approved: 'معتمد',
  rejected: 'مرفوض',
  void: 'ملغى',
};

export const APPROVAL_MODE_LABELS_AR: Record<GroupPolicy['approvalMode'], string> = {
  sequential: 'تسلسلي — واحد بعد الآخر بالترتيب',
  parallel: 'متوازٍ — في آنٍ واحد',
  any_one: 'موافقة أحدهم تكفي',
};

export const STAGE_MODE_LABELS_AR: Record<ApprovalStage['mode'], string> = {
  sequential: 'تسلسلي',
  parallel: 'متوازٍ',
  any_one: 'موافقة أحد المعتمدين',
  optional: 'اختياري',
};
