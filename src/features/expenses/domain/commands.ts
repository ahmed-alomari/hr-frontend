/**
 * Operations on the data, as pure functions (data in → new data out). The
 * store calls them and persists the result; tests call them directly. A future
 * backend implements the same operations on the server (with permissions
 * checked there, not in screens).
 */
import { CommandError } from './errors';
import { computeLedger } from './ledger';
import { assertPeriodOpen } from './periods';
import {
  applyDecision,
  approvalPlan,
  groupFilingBlock,
  groupStatusOf,
  canDecide,
  canVoid,
  groupOf,
  OPEN_POLICY,
  txnGroupId,
} from './policy';
import { ORG } from './types';
import type {
  Advance,
  AnyTxn,
  Category,
  CostCenter,
  Custody,
  CustodyMove,
  CustodyMoveType,
  Expense,
  ExpenseGroup,
  ExpensesData,
  ExpensesSettings,
  PartyId,
  Settlement,
} from './types';
import type { Minor } from './money';

export type Ctx = {
  actorId: string;
  currency: string;
  now: string;
  newId: (prefix: string) => string;
};

export { CommandError };

type Collection = 'expenses' | 'custodyMoves' | 'advances' | 'settlements';
const COLLECTION: Record<AnyTxn['kind'], Collection> = {
  expense: 'expenses',
  custody_move: 'custodyMoves',
  advance: 'advances',
  settlement: 'settlements',
};

export function findTxn(
  data: ExpensesData,
  kind: AnyTxn['kind'],
  id: string,
): AnyTxn | undefined {
  return (data[COLLECTION[kind]] as AnyTxn[]).find((t) => t.id === id);
}

function replaceTxn(data: ExpensesData, txn: AnyTxn): ExpensesData {
  const key = COLLECTION[txn.kind];
  const list = data[key] as AnyTxn[];
  const exists = list.some((t) => t.id === txn.id);
  return {
    ...data,
    [key]: exists
      ? list.map((t) => (t.id === txn.id ? txn : t))
      : [...list, txn],
  };
}

/**
 * The group a new record is filed under: the one chosen (open, of this
 * company), else the company's default group.
 */
export function resolveGroupId(
  data: ExpensesData,
  groupId: string | null | undefined,
  actorId?: string,
): string | null {
  const group = groupId
    ? data.groups.find((g) => g.id === groupId)
    : groupOf(data, null);
  if (groupId && !group) throw new CommandError('المجموعة غير موجودة');
  if (!group) return null;
  if (group.archived)
    throw new CommandError(`المجموعة «${group.name}» مؤرشفة: لا يُسجَّل فيها`);
  const block = groupFilingBlock(group, actorId);
  if (block) throw new CommandError(block);
  return group.id;
}

/**
 * Status, decision fields and approval path when a record is sent: from its
 * group's policy for this amount, fixed now.
 */
function submitted(
  data: ExpensesData,
  groupId: string | null,
  amount: Minor,
  authorId: string,
  ctx: Ctx,
) {
  const policy = groupOf(data, groupId)?.policy ?? OPEN_POLICY;
  const plan = approvalPlan(policy, amount, authorId);
  const auto = plan.status === 'approved';
  return {
    status: plan.status,
    approval: plan.approval,
    submittedAt: ctx.now,
    decidedBy: auto ? 'auto' : null,
    decidedAt: auto ? ctx.now : null,
    decisionNote:
      auto && policy.approval === 'above' ? 'اعتماد تلقائي (تحت الحد)' : null,
  } as const;
}

export type ExpenseDraft = Omit<
  Expense,
  | 'id'
  | 'kind'
  | 'currency'
  | 'status'
  | 'createdBy'
  | 'createdAt'
  | 'submittedAt'
  | 'decidedBy'
  | 'decidedAt'
  | 'decisionNote'
  | 'voidedBy'
  | 'voidedAt'
  | 'voidReason'
> & { id?: string | null };

/** Creates or edits (draft / rejected only) an expense; `submit` sends it for approval. */
export function saveExpense(
  data: ExpensesData,
  draft: ExpenseDraft,
  submit: boolean,
  ctx: Ctx,
) {
  const existing = draft.id
    ? (findTxn(data, 'expense', draft.id) as Expense | undefined)
    : undefined;
  if (
    existing &&
    existing.status !== 'draft' &&
    existing.status !== 'rejected'
  ) {
    throw new CommandError('لا يُعدَّل إلا المسودة أو المرفوض');
  }
  assertPeriodOpen(data, existing?.date);
  assertPeriodOpen(data, draft.date);
  const groupId =
    existing && draft.groupId === existing.groupId
      ? (existing.groupId ?? resolveGroupId(data, null, ctx.actorId))
      : resolveGroupId(data, draft.groupId, ctx.actorId);
  const base = {
    ...draft,
    groupId,
    id: existing?.id ?? ctx.newId('exp'),
    kind: 'expense' as const,
    currency: existing?.currency ?? ctx.currency,
    createdBy: existing?.createdBy ?? ctx.actorId,
    createdAt: existing?.createdAt ?? ctx.now,
    voidedBy: null,
    voidedAt: null,
    voidReason: null,
  };
  const expense: Expense = submit
    ? {
        ...base,
        ...submitted(data, groupId, draft.amount, base.createdBy, ctx),
      }
    : {
        ...base,
        status: 'draft',
        approval: null,
        submittedAt: null,
        decidedBy: null,
        decidedAt: null,
        decisionNote: null,
      };
  return { data: replaceTxn(data, expense), expense };
}

export function submitTxn(
  data: ExpensesData,
  kind: AnyTxn['kind'],
  id: string,
  ctx: Ctx,
): ExpensesData {
  const txn = findTxn(data, kind, id);
  if (!txn) throw new CommandError('العملية غير موجودة');
  if (txn.status !== 'draft' && txn.status !== 'rejected')
    throw new CommandError('أُرسلت مسبقاً');
  assertPeriodOpen(data, txn.date);
  return replaceTxn(data, {
    ...txn,
    ...submitted(data, txnGroupId(data, txn), txn.amount, txn.createdBy, ctx),
  });
}

export function decideTxn(
  data: ExpensesData,
  kind: AnyTxn['kind'],
  id: string,
  decision: 'approved' | 'rejected',
  note: string | null,
  ctx: Ctx,
): ExpensesData {
  const txn = findTxn(data, kind, id);
  if (!txn) throw new CommandError('العملية غير موجودة');
  assertPeriodOpen(data, txn.date);
  if (!canDecide(ctx.actorId, txn)) {
    throw new CommandError(
      txn.createdBy === ctx.actorId
        ? 'لا يعتمد أحد عملية سجّلها بنفسه'
        : 'ليس دورك في اعتماد هذه العملية',
    );
  }
  if (
    decision === 'approved' &&
    txn.kind === 'custody_move' &&
    txn.type === 'return'
  ) {
    const balance = computeLedger(data, txn.currency).custodies.get(
      txn.custodyId,
    );
    if (balance && txn.amount > balance.actual)
      throw new CommandError('المرتجع أكبر من رصيد العهدة');
  }
  return replaceTxn(
    data,
    applyDecision(txn, ctx.actorId, decision, note, ctx.now),
  );
}

/** Void keeps the record (and its history) but takes it out of balances and reports. */
export function voidTxn(
  data: ExpensesData,
  kind: AnyTxn['kind'],
  id: string,
  reason: string,
  ctx: Ctx,
): ExpensesData {
  const txn = findTxn(data, kind, id);
  if (!txn) throw new CommandError('العملية غير موجودة');
  if (!canVoid(txn)) throw new CommandError('لا يمكن إلغاء هذه العملية');
  assertPeriodOpen(data, txn.date);
  if (!reason.trim()) throw new CommandError('اكتب سبب الإلغاء');
  // A closed custody's balance is settled; voiding one of its records would
  // leave money in it that no move can take out any more.
  const custodyIds =
    txn.kind === 'custody_move'
      ? [txn.custodyId]
      : txn.kind === 'expense'
        ? txn.payments.flatMap((p) => (p.custodyId ? [p.custodyId] : []))
        : [];
  if (
    data.custodies.some(
      (c) => custodyIds.includes(c.id) && c.status === 'closed',
    )
  ) {
    throw new CommandError('العهدة مقفلة: لا تُلغى عملياتها بعد التسوية');
  }
  if (
    txn.kind === 'custody_move' &&
    txn.status === 'approved' &&
    txn.type !== 'return'
  ) {
    const balance = computeLedger(data, txn.currency).custodies.get(
      txn.custodyId,
    );
    if (balance && balance.actual - txn.amount < 0) {
      throw new CommandError(
        'إلغاء التسليم يجعل رصيد العهدة سالباً: ألغِ المصروفات منها أولاً',
      );
    }
  }
  return replaceTxn(data, {
    ...txn,
    status: 'void',
    voidedBy: ctx.actorId,
    voidedAt: ctx.now,
    voidReason: reason,
  });
}

function newMove(
  custodyId: string,
  type: CustodyMoveType,
  amount: Minor,
  date: string,
  note: string | null,
  data: ExpensesData,
  ctx: Ctx,
  groupId: string | null,
): CustodyMove {
  return {
    id: ctx.newId('mv'),
    kind: 'custody_move',
    custodyId,
    groupId,
    type,
    amount,
    date,
    note,
    currency: ctx.currency,
    createdBy: ctx.actorId,
    createdAt: ctx.now,
    ...submitted(data, groupId, amount, ctx.actorId, ctx),
  };
}

/** Opens an operational custody and hands over its first amount. */
export function openCustody(
  data: ExpensesData,
  input: {
    holderId: string;
    purpose: string;
    limit: Minor | null;
    amount: Minor;
    date: string;
    groupId?: string | null;
  },
  ctx: Ctx,
) {
  if (!input.holderId) throw new CommandError('اختر حامل العهدة');
  if (!(input.amount > 0)) throw new CommandError('أدخل مبلغ التسليم');
  if (input.limit != null && input.amount > input.limit)
    throw new CommandError('مبلغ التسليم يتجاوز سقف العهدة');
  assertPeriodOpen(data, input.date);
  const groupId = resolveGroupId(data, input.groupId, ctx.actorId);
  const custody: Custody = {
    id: ctx.newId('cus'),
    groupId,
    holderId: input.holderId,
    purpose: input.purpose.trim() || 'عهدة تشغيلية',
    currency: ctx.currency,
    limit: input.limit,
    status: 'open',
    openedAt: input.date,
    createdBy: ctx.actorId,
  };
  const move = newMove(
    custody.id,
    'issue',
    input.amount,
    input.date,
    null,
    data,
    ctx,
    groupId,
  );
  return {
    data: {
      ...data,
      custodies: [...data.custodies, custody],
      custodyMoves: [...data.custodyMoves, move],
    },
    custody,
  };
}

/** Refill or return (return cannot exceed what the custody can still spend). */
export function addCustodyMove(
  data: ExpensesData,
  input: {
    custodyId: string;
    type: Exclude<CustodyMoveType, 'issue'>;
    amount: Minor;
    date: string;
    note: string | null;
  },
  ctx: Ctx,
): ExpensesData {
  const custody = data.custodies.find((c) => c.id === input.custodyId);
  if (!custody || custody.status !== 'open')
    throw new CommandError('العهدة غير مفتوحة');
  if (!(input.amount > 0)) throw new CommandError('أدخل المبلغ');
  assertPeriodOpen(data, input.date);
  const balance = computeLedger(data, custody.currency).custodies.get(
    custody.id,
  );
  if (input.type === 'return' && balance && input.amount > balance.expected) {
    throw new CommandError('المرتجع أكبر من الرصيد المتاح للعهدة (بعد المعلق)');
  }
  if (
    input.type === 'topup' &&
    custody.limit != null &&
    balance &&
    balance.actual + input.amount > custody.limit
  ) {
    throw new CommandError('التغذية تتجاوز سقف العهدة');
  }
  return {
    ...data,
    custodyMoves: [
      ...data.custodyMoves,
      newMove(
        custody.id,
        input.type,
        input.amount,
        input.date,
        input.note,
        data,
        ctx,
        resolveGroupId(data, custody.groupId, ctx.actorId),
      ),
    ],
  };
}

/**
 * Closing (تسوية وإقفال): no pending spending may remain; what is left is
 * returned to the organization (approved, as part of the closing) and the
 * custody is closed.
 */
export function closeCustody(
  data: ExpensesData,
  custodyId: string,
  date: string,
  ctx: Ctx,
): ExpensesData {
  const custody = data.custodies.find((c) => c.id === custodyId);
  if (!custody || custody.status !== 'open')
    throw new CommandError('العهدة غير مفتوحة');
  assertPeriodOpen(data, date);
  const balance = computeLedger(data, custody.currency).custodies.get(
    custodyId,
  );
  if (balance && balance.pendingOut > 0)
    throw new CommandError(
      'توجد مصروفات معلقة من هذه العهدة: اعتمدها أو ارفضها أولاً',
    );
  let next = data;
  if (balance && balance.actual > 0) {
    const move: CustodyMove = {
      ...newMove(
        custodyId,
        'return',
        balance.actual,
        date,
        'إرجاع الرصيد عند الإقفال',
        data,
        ctx,
        resolveGroupId(data, custody.groupId, ctx.actorId),
      ),
      status: 'approved',
      approval: null,
      decidedBy: ctx.actorId,
      decidedAt: ctx.now,
    };
    next = { ...next, custodyMoves: [...next.custodyMoves, move] };
  }
  return {
    ...next,
    custodies: next.custodies.map((c) =>
      c.id === custodyId ? { ...c, status: 'closed', closedAt: date } : c,
    ),
  };
}

export function addAdvance(
  data: ExpensesData,
  input: {
    personId: string;
    amount: Minor;
    purpose: string;
    date: string;
    groupId?: string | null;
  },
  ctx: Ctx,
): ExpensesData {
  if (!input.personId) throw new CommandError('اختر الشخص');
  if (!(input.amount > 0)) throw new CommandError('أدخل مبلغ السلفة');
  assertPeriodOpen(data, input.date);
  const groupId = resolveGroupId(data, input.groupId, ctx.actorId);
  const advance: Advance = {
    id: ctx.newId('adv'),
    kind: 'advance',
    groupId,
    personId: input.personId,
    amount: input.amount,
    purpose: input.purpose.trim() || 'سلفة شخصية',
    date: input.date,
    currency: ctx.currency,
    createdBy: ctx.actorId,
    createdAt: ctx.now,
    ...submitted(data, groupId, input.amount, ctx.actorId, ctx),
  };
  return { ...data, advances: [...data.advances, advance] };
}

export function addSettlement(
  data: ExpensesData,
  input: {
    fromId: PartyId;
    toId: PartyId;
    amount: Minor;
    method: Settlement['method'];
    date: string;
    note: string | null;
    groupId?: string | null;
  },
  ctx: Ctx,
): ExpensesData {
  if (!input.fromId || !input.toId || input.fromId === input.toId)
    throw new CommandError('اختر طرفين مختلفين');
  if (!(input.amount > 0)) throw new CommandError('أدخل مبلغ السداد');
  assertPeriodOpen(data, input.date);
  const groupId = resolveGroupId(data, input.groupId, ctx.actorId);
  const settlement: Settlement = {
    id: ctx.newId('set'),
    kind: 'settlement',
    groupId,
    fromId: input.fromId,
    toId: input.toId,
    amount: input.amount,
    method: input.method,
    date: input.date,
    note: input.note,
    currency: ctx.currency,
    createdBy: ctx.actorId,
    createdAt: ctx.now,
    ...submitted(data, groupId, input.amount, ctx.actorId, ctx),
  };
  return { ...data, settlements: [...data.settlements, settlement] };
}

/** What `fromId` owes `toId` now (approved records), for settlement checks. */
export function owedBetween(
  data: ExpensesData,
  fromId: PartyId,
  toId: PartyId,
  currency: string,
): Minor {
  const party = computeLedger(data, currency).parties.get(fromId);
  const pair = party?.pairs.find((p) => p.counterparty === toId);
  return pair && pair.net > 0 ? pair.net : 0;
}

export function upsertCategory(
  data: ExpensesData,
  category: Category,
): ExpensesData {
  const exists = data.categories.some((c) => c.id === category.id);
  return {
    ...data,
    categories: exists
      ? data.categories.map((c) => (c.id === category.id ? category : c))
      : [...data.categories, category],
  };
}

export function upsertCostCenter(
  data: ExpensesData,
  center: CostCenter,
): ExpensesData {
  const exists = data.costCenters.some((c) => c.id === center.id);
  return {
    ...data,
    costCenters: exists
      ? data.costCenters.map((c) => (c.id === center.id ? center : c))
      : [...data.costCenters, center],
  };
}

/**
 * Adds or edits a group. The default group stays the default and is never
 * closed; another group never becomes the default.
 */
export function upsertGroup(
  data: ExpensesData,
  group: ExpenseGroup,
): ExpensesData {
  const existing = data.groups.find((g) => g.id === group.id);
  const isDefault = Boolean(existing?.isDefault);
  const status = isDefault ? 'active' : groupStatusOf(group);
  if (isDefault && groupStatusOf(group) !== 'active') {
    throw new CommandError('المجموعة الافتراضية تبقى نشطة');
  }
  if (isDefault && group.archived) {
    throw new CommandError('المجموعة الافتراضية لا تُؤرشف');
  }
  if (!isDefault && group.memberIds.length === 0) {
    throw new CommandError(
      'حدّد أعضاء المجموعة: لا يرفع فيها مصروفاً إلا أعضاؤها',
    );
  }
  const next: ExpenseGroup = {
    ...group,
    isDefault,
    status,
    closed: status !== 'active',
  };
  return {
    ...data,
    groups: existing
      ? data.groups.map((g) => (g.id === group.id ? next : g))
      : [...data.groups, next],
  };
}

/** Archives (or restores) a closed custody; its records stay as they are. */
export function archiveCustody(
  data: ExpensesData,
  custodyId: string,
  archived: boolean,
): ExpensesData {
  const custody = data.custodies.find((c) => c.id === custodyId);
  if (!custody) throw new CommandError('العهدة غير موجودة');
  if (archived && custody.status !== 'closed')
    throw new CommandError('لا تُؤرشف إلا العهدة المقفلة');
  return {
    ...data,
    custodies: data.custodies.map((c) =>
      c.id === custodyId ? { ...c, archived } : c,
    ),
  };
}

export function updateSettings(
  data: ExpensesData,
  patch: Partial<ExpensesSettings>,
): ExpensesData {
  return { ...data, settings: { ...data.settings, ...patch } };
}

export const PARTY_ORG_LABEL = 'المنشأة';
export const isOrg = (id: PartyId) => id === ORG;
