/**
 * Policies (receipts, spending limits) and the approval workflow:
 * draft → submitted → approved | rejected; any approved record → void.
 * Only approved records change balances (see ledger). Each record follows the
 * policy of its group (the company's default group when none is chosen). The
 * mode (simple / advanced) only changes what the screens show.
 */
import type { Minor } from './money';
import type { AnyTxn, ApprovalStep, Category, Expense, ExpenseGroup, ExpensesData, GroupPolicy, TxnApproval, TxnStatus } from './types';

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
};

export const DEFAULT_GROUP_NAME = 'عام';

const RULES = ['none', 'always', 'above'] as const;
const MODES = ['sequential', 'parallel', 'any_one'] as const;
const STEP_STATUSES = ['pending', 'approved', 'rejected', 'skipped'] as const;

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
  };
}

/** A stored approval path (jsonb) read safely. */
export function readApproval(raw: unknown): TxnApproval | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const steps: unknown[] = Array.isArray(r.steps) ? r.steps : [];
  return {
    mode: oneOf(MODES, r.mode, 'sequential'),
    steps: steps
      .filter(
        (s): s is Record<string, unknown> => !!s && typeof s === 'object' && typeof (s as Record<string, unknown>).partyId === 'string',
      )
      .map((s) => ({
        partyId: s.partyId as string,
        role: s.role === 'manager' ? 'manager' : 'approver',
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

/**
 * The approval path of a record sent now: approved at once when its group
 * needs no approval for this amount; else the manager first, then the
 * approvers by the group's mode. The author never decides their own record:
 * their step is skipped (no step left: anyone with the approve permission).
 */
export function approvalPlan(policy: GroupPolicy, amount: Minor, authorId: string): { status: TxnStatus; approval: TxnApproval | null } {
  if (!approvalRequired(policy, amount)) {
    return { status: 'approved', approval: null };
  }
  const steps: ApprovalStep[] = [];
  const seen = new Set<string>();
  const add = (partyId: string, role: ApprovalStep['role']) => {
    if (seen.has(partyId)) return;
    seen.add(partyId);
    steps.push(
      partyId === authorId
        ? {
            partyId,
            role,
            status: 'skipped',
            note: 'هو من سجّل العملية',
          }
        : { partyId, role, status: 'pending' },
    );
  };
  if (policy.managerId) add(policy.managerId, 'manager');
  for (const id of policy.approverIds) add(id, 'approver');
  return {
    status: 'submitted',
    approval: { mode: policy.approvalMode, steps },
  };
}

/**
 * Who may decide a sent record now: null = anyone holding the approve
 * permission (no step waits); otherwise the manager while their step waits,
 * then the next approver (sequential) or every waiting one.
 */
export function currentDeciders(txn: AnyTxn): string[] | null {
  const steps = txn.approval?.steps ?? [];
  const pending = steps.filter((s) => s.status === 'pending');
  if (pending.length === 0) return null;
  const manager = pending.find((s) => s.role === 'manager');
  if (manager) return [manager.partyId];
  if (txn.approval?.mode === 'sequential') return [pending[0].partyId];
  return pending.map((s) => s.partyId);
}

/** Anyone but its author, and only whose turn it is when the path names people. */
export function canDecide(actorId: string, txn: AnyTxn): boolean {
  if (txn.status !== 'submitted' || txn.createdBy === actorId) return false;
  const deciders = currentDeciders(txn);
  return deciders === null || deciders.includes(actorId);
}

/**
 * One decision on the path. A rejection ends it; an approval completes it
 * when no step waits (any_one: the first approver after the manager).
 */
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
  const finish = (status: TxnStatus, finalSteps: ApprovalStep[]): T => ({
    ...txn,
    status,
    approval: approval ? { ...approval, steps: finalSteps } : null,
    decidedBy: actorId,
    decidedAt: now,
    decisionNote: note,
  });
  if (decision === 'rejected') {
    return finish(
      'rejected',
      steps.map((s) => (s.status === 'pending' ? { ...s, status: 'skipped' } : s)),
    );
  }
  const waiting = steps.filter((s) => s.status === 'pending');
  const managerWaits = waiting.some((s) => s.role === 'manager');
  const approverDecided = steps.some((s) => s.role === 'approver' && s.status === 'approved');
  const done = waiting.length === 0 || (!managerWaits && approval?.mode === 'any_one' && approverDecided);
  if (done) {
    return finish(
      'approved',
      steps.map((s) => (s.status === 'pending' ? { ...s, status: 'skipped' } : s)),
    );
  }
  return { ...txn, approval: approval ? { ...approval, steps } : null };
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
  parallel: 'متوازي — موافقة الجميع بأي ترتيب',
  any_one: 'موافقة أحدهم تكفي',
};
