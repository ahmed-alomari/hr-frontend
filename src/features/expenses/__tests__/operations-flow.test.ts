/**
 * End-to-end flows on the sample data through the operations (no UI): every
 * new record shows in balances, custody, statements and reports at once.
 */
import { buildDemoData, DEMO } from './fixtures/demo-seed';
import {
  addAdvance,
  addCustodyMove,
  addSettlement,
  CommandError,
  closeCustody,
  decideTxn,
  openCustody,
  owedBetween,
  saveExpense,
  submitTxn,
  voidTxn,
  type Ctx,
  type ExpenseDraft,
} from '../domain/commands';
import { buildBearing, custodyPayments, singleAllocation } from '../domain/expense-builder';
import { computeLedger, partyBalance, settlementSuggestions, statement } from '../domain/ledger';
import { expenseReport } from '../domain/reports';
import { ORG } from '../domain/types';

const TODAY = '2026-10-08';
const CUR = 'YER';
let seq = 0;
const ctx = (actorId: string): Ctx => ({
  actorId,
  currency: CUR,
  now: `${TODAY}T12:00:00.000Z`,
  newId: (p) => `${p}:t${(seq += 1)}`,
});

const draft = (amount: number, payments: ExpenseDraft['payments'], extra: Partial<ExpenseDraft> = {}): ExpenseDraft => ({
  description: 'وقود',
  amount,
  categoryId: 'cat:fuel',
  date: TODAY,
  payments,
  bearing: buildBearing('org', amount, []),
  allocation: singleAllocation(amount, 'cc:ops', null),
  attachments: [],
  ...extra,
});

describe('an expense from a custody, through approval', () => {
  it('pending lowers the expected balance only; approval moves balances and reports', () => {
    let data = buildDemoData(CUR, TODAY);
    const before = computeLedger(data, CUR).custodies.get('cus:khaled')!;
    const monthTotal = () => expenseReport(data, { currency: CUR, from: '2026-10-01' }, 'month').total;
    const totalBefore = monthTotal();

    const saved = saveExpense(data, draft(1_200_000, [{ source: 'custody', custodyId: 'cus:khaled', payerId: DEMO.khaled, amount: 1_200_000 }]), true, ctx(DEMO.khaled));
    data = saved.data;
    expect(saved.expense.status).toBe('submitted'); // ≥ auto-approve limit
    let custody = computeLedger(data, CUR).custodies.get('cus:khaled')!;
    expect(custody.actual).toBe(before.actual);
    expect(custody.expected).toBe(before.expected - 1_200_000);
    expect(monthTotal()).toBe(totalBefore);

    // Khaled cannot approve his own expense.
    expect(() => decideTxn(data, 'expense', saved.expense.id, 'approved', null, ctx(DEMO.khaled))).toThrow(CommandError);
    data = decideTxn(data, 'expense', saved.expense.id, 'approved', null, ctx(DEMO.ahmed));
    custody = computeLedger(data, CUR).custodies.get('cus:khaled')!;
    expect(custody.actual).toBe(before.actual - 1_200_000);
    expect(monthTotal()).toBe(totalBefore + 1_200_000);
    expect(statement(data, DEMO.khaled, CUR).some((l) => l.txn.id === saved.expense.id && l.custody === -1_200_000)).toBe(true);

    // Void takes it back out.
    data = voidTxn(data, 'expense', saved.expense.id, 'خطأ في الإدخال', ctx(DEMO.ahmed));
    expect(computeLedger(data, CUR).custodies.get('cus:khaled')!.actual).toBe(before.actual);
    expect(monthTotal()).toBe(totalBefore);
  });

  it('small amounts are approved at once (auto-approve below the limit)', () => {
    const data = buildDemoData(CUR, TODAY);
    const saved = saveExpense(data, draft(400_000, [{ source: 'org', amount: 400_000 }]), true, ctx(DEMO.sara));
    expect(saved.expense.status).toBe('approved');
    expect(saved.expense.decidedBy).toBe('auto');
  });

  it('when the custody is not enough, the holder pays the rest and the organization owes it', () => {
    let data = buildDemoData(CUR, TODAY);
    const custody = computeLedger(data, CUR).custodies.get('cus:khaled')!;
    const total = custody.expected + 750_000;
    const payments = custodyPayments(total, 'cus:khaled', DEMO.khaled, custody.expected);
    const owedBefore = partyBalance(computeLedger(data, CUR), DEMO.khaled).entitlements;
    const saved = saveExpense(data, draft(total, payments), true, ctx(DEMO.khaled));
    data = decideTxn(saved.data, 'expense', saved.expense.id, 'approved', null, ctx(DEMO.ahmed));
    // The pending expenses still hold part of the custody: actual minus pending stays ≥ 0.
    expect(partyBalance(computeLedger(data, CUR), DEMO.khaled).entitlements).toBe(owedBefore + 750_000);
  });
});

describe('custody operations (approver is not the creator)', () => {
  it('open, refill, return within the available balance, then close', () => {
    let data = buildDemoData(CUR, TODAY);
    const opened = openCustody(data, { holderId: DEMO.mona, purpose: 'عهدة فعالية', limit: 5_000_000, amount: 3_000_000, date: TODAY }, ctx(DEMO.sara));
    data = opened.data;
    const id = opened.custody.id;
    const approve = (moveId: string) => (data = decideTxn(data, 'custody_move', moveId, 'approved', null, ctx(DEMO.ahmed)));
    approve(data.custodyMoves.find((m) => m.custodyId === id)!.id);
    expect(computeLedger(data, CUR).custodies.get(id)!.actual).toBe(3_000_000);

    expect(() => addCustodyMove(data, { custodyId: id, type: 'topup', amount: 2_500_000, date: TODAY, note: null }, ctx(DEMO.sara))).toThrow('سقف');
    data = addCustodyMove(data, { custodyId: id, type: 'topup', amount: 1_000_000, date: TODAY, note: null }, ctx(DEMO.sara));
    approve(data.custodyMoves.filter((m) => m.custodyId === id).at(-1)!.id);

    const spent = saveExpense(data, draft(1_500_000, [{ source: 'custody', custodyId: id, payerId: DEMO.mona, amount: 1_500_000 }]), true, ctx(DEMO.mona));
    data = spent.data;
    expect(() => addCustodyMove(data, { custodyId: id, type: 'return', amount: 3_000_000, date: TODAY, note: null }, ctx(DEMO.mona))).toThrow('المتاح');
    expect(() => closeCustody(data, id, TODAY, ctx(DEMO.ahmed))).toThrow('معلقة');

    data = decideTxn(data, 'expense', spent.expense.id, 'approved', null, ctx(DEMO.ahmed));
    data = closeCustody(data, id, TODAY, ctx(DEMO.ahmed));
    const closed = computeLedger(data, CUR).custodies.get(id)!;
    expect(closed.actual).toBe(0);
    expect(closed.returned).toBe(2_500_000);
    expect(data.custodies.find((c) => c.id === id)!.status).toBe('closed');
    // The handover and return are not expenses: only the 1,500,000 spent counts.
    expect(expenseReport(data, { currency: CUR, from: TODAY, to: TODAY }, 'day').total).toBe(1_500_000);
  });
});

describe('advances and settlements', () => {
  it('an advance is a liability (not custody); a settlement clears a pair and its suggestion', () => {
    let data = buildDemoData(CUR, TODAY);
    data = { ...data, groups: data.groups.map((g) => (g.isDefault ? { ...g, policy: { ...g.policy, approval: 'none' as const } } : g)) };
    const monaBefore = partyBalance(computeLedger(data, CUR), DEMO.mona);
    data = addAdvance(data, { personId: DEMO.mona, amount: 1_000_000, purpose: 'سلفة', date: TODAY }, ctx(DEMO.ahmed));
    const monaAfter = partyBalance(computeLedger(data, CUR), DEMO.mona);
    expect(monaAfter.liabilities).toBe(monaBefore.liabilities + 1_000_000);
    expect(monaAfter.custodyActual).toBe(monaBefore.custodyActual);

    const owed = owedBetween(data, DEMO.sara, DEMO.ahmed, CUR);
    expect(owed).toBe(900_000); // her share of the trip dinner
    data = addSettlement(data, { fromId: DEMO.sara, toId: DEMO.ahmed, amount: owed, method: 'cash', date: TODAY, note: null }, ctx(DEMO.sara));
    expect(owedBetween(data, DEMO.sara, DEMO.ahmed, CUR)).toBe(0);
    expect(settlementSuggestions(computeLedger(data, CUR)).some((s) => s.fromId === DEMO.sara && s.toId === DEMO.ahmed)).toBe(false);
    expect(() => addSettlement(data, { fromId: ORG, toId: ORG, amount: 1, method: 'cash', date: TODAY, note: null }, ctx(DEMO.sara))).toThrow(CommandError);
  });
});

describe('drafts', () => {
  it('only drafts and rejected records can be edited; a draft can be submitted later', () => {
    let data = buildDemoData(CUR, TODAY);
    const saved = saveExpense(data, draft(900_000, [{ source: 'org', amount: 900_000 }]), false, ctx(DEMO.sara));
    data = saved.data;
    expect(saved.expense.status).toBe('draft');
    expect(computeLedger(data, CUR).pending.count).toBe(computeLedger(buildDemoData(CUR, TODAY), CUR).pending.count);
    const edited = saveExpense(data, { ...draft(950_000, [{ source: 'org', amount: 950_000 }]), id: saved.expense.id }, false, ctx(DEMO.sara));
    data = submitTxn(edited.data, 'expense', saved.expense.id, ctx(DEMO.sara));
    expect(data.expenses.find((e) => e.id === saved.expense.id)!.status).toBe('submitted');
    expect(() => saveExpense(data, { ...draft(1, [{ source: 'org', amount: 1 }]), id: saved.expense.id }, false, ctx(DEMO.sara))).toThrow('المسودة');
  });

  it('a group split charges members, not the organization', () => {
    let data = buildDemoData(CUR, TODAY);
    data = { ...data, groups: data.groups.map((g) => (g.isDefault ? { ...g, policy: { ...g.policy, approval: 'none' as const } } : g)) };
    const members = data.groups.find((g) => g.id === 'grp:housing')!.memberIds;
    const amount = 1_000_001; // not divisible by 3
    const saved = saveExpense(
      data,
      draft(amount, [{ source: 'personal', payerId: DEMO.mona, amount }], { groupId: 'grp:housing', bearing: buildBearing('equal', amount, members) }),
      true,
      ctx(DEMO.mona),
    );
    const shares = saved.expense.bearing.shares.map((s) => s.amount);
    expect(shares).toEqual([333_334, 333_334, 333_333]);
    const ledger = computeLedger(saved.data, CUR);
    expect(partyBalance(ledger, ORG).liabilities).toBe(partyBalance(computeLedger(data, CUR), ORG).liabilities);
  });
});
