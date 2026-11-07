/**
 * Functional scenarios of the expenses & custody domain (no UI): splitting,
 * custody lifecycle and shortfall, shared expenses, settlements, advances,
 * approval, reports without double counting, policies and participants.
 */
import { buildDemoData, DEMO, emptyData, homeGroup } from './fixtures/demo-seed';
import { buildBearing, custodyPayments, singleAllocation, validateExpense } from '../domain/expense-builder';
import { computeLedger, partyBalance, settlementSuggestions, statement } from '../domain/ledger';
import { splitByWeights, splitEqual, sumMinor, toMinor } from '../domain/money';
import { mergeParticipants } from '../domain/participants';
import { applyDecision, approvalPlan, canDecide, checkPolicies, currentDeciders } from '../domain/policy';
import { bucketOf, cashReport, expenseReport, weekStart } from '../domain/reports';
import { ORG } from '../domain/types';
import type { Advance, CustodyMove, Expense, ExpensesData, PaymentPart, Settlement, TxnStatus } from '../domain/types';

const CUR = 'YER';
let n = 0;
const meta = (date: string, status: TxnStatus = 'approved', createdBy = 'A') => {
  n += 1;
  return { currency: CUR, date, status, createdBy, createdAt: `${date}T08:00:${String(n % 60).padStart(2, '0')}.000Z` };
};

function data(partial: Partial<ExpensesData> = {}): ExpensesData {
  const d = emptyData(CUR);
  d.custodies = [{ id: 'C1', holderId: 'K', purpose: 'عهدة', currency: CUR, status: 'open', openedAt: '2026-10-01', createdBy: 'A' }];
  return { ...d, ...partial };
}

function exp(id: string, amount: number, payments: PaymentPart[], bearing = buildBearing('org', amount, []), opts: Partial<Expense> = {}): Expense {
  return {
    id,
    kind: 'expense',
    description: id,
    amount,
    categoryId: 'cat:fuel',
    payments,
    bearing,
    allocation: singleAllocation(amount, opts.costCenterId ?? null, opts.groupId ?? null),
    attachments: [],
    ...meta(opts.date ?? '2026-10-05', opts.status ?? 'approved', opts.createdBy ?? 'A'),
    ...opts,
  };
}
const move = (id: string, type: CustodyMove['type'], amount: number, date = '2026-10-02', status: TxnStatus = 'approved'): CustodyMove => ({
  id, kind: 'custody_move', custodyId: 'C1', type, amount, ...meta(date, status),
});
const settle = (id: string, fromId: string, toId: string, amount: number): Settlement => ({
  id, kind: 'settlement', fromId, toId, amount, method: 'cash', ...meta('2026-10-09'),
});

describe('splitting in minor units', () => {
  it('equal split gives the leftover units to the first parts and always sums to the total', () => {
    expect(splitEqual(10000, 3)).toEqual([3334, 3333, 3333]); // 100.00 YER
    expect(splitEqual(1000, 3)).toEqual([334, 333, 333]); // 1.000 KWD (3 decimals)
    expect(splitEqual(100, 3)).toEqual([34, 33, 33]); // a 0-decimal currency
    for (let total = 1; total < 400; total += 7) {
      for (let parts = 1; parts <= 9; parts += 1) expect(sumMinor(splitEqual(total, parts))).toBe(total);
    }
  });

  it('percent split uses the largest remainder and sums to the total', () => {
    expect(splitByWeights(3000000, [40, 40, 20])).toEqual([1200000, 1200000, 600000]);
    expect(splitByWeights(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(sumMinor(splitByWeights(9999, [33.3, 33.3, 33.4]))).toBe(9999);
  });

  it('converts to minor units by the currency precision', () => {
    expect(toMinor('12.345', 3)).toBe(12345);
    expect(toMinor('12.345', 2)).toBe(1235);
    expect(toMinor('1,500', 2)).toBe(150000);
  });
});

describe('custody', () => {
  it('handover, spending, refill and return; pending spending lowers only the expected balance', () => {
    const d = data({
      custodyMoves: [move('m1', 'issue', 100000), move('m2', 'topup', 50000, '2026-10-06'), move('m3', 'return', 20000, '2026-10-08')],
      expenses: [
        exp('e1', 30000, [{ source: 'custody', custodyId: 'C1', payerId: 'K', amount: 30000 }]),
        exp('e2', 10000, [{ source: 'custody', custodyId: 'C1', payerId: 'K', amount: 10000 }], undefined, { status: 'submitted', date: '2026-10-09' }),
      ],
    });
    const ledger = computeLedger(d, CUR);
    const c = ledger.custodies.get('C1')!;
    expect([c.issued, c.toppedUp, c.spent, c.returned]).toEqual([100000, 50000, 30000, 20000]);
    expect(c.actual).toBe(100000); // 100 + 50 − 30 − 20
    expect(c.pendingOut).toBe(10000);
    expect(c.expected).toBe(90000);
    // Custody is not a debt of the holder.
    expect(partyBalance(ledger, 'K')).toMatchObject({ liabilities: 0, entitlements: 0, custodyActual: 100000, custodyExpected: 90000 });
  });

  it('a custody that runs out: the rest is paid personally and owed to the holder', () => {
    const payments = custodyPayments(48000, 'C1', 'K', 26000);
    expect(payments).toEqual([
      { source: 'custody', custodyId: 'C1', payerId: 'K', amount: 26000 },
      { source: 'personal', payerId: 'K', amount: 22000 },
    ]);
    const d = data({ custodyMoves: [move('m1', 'issue', 26000)], expenses: [exp('e1', 48000, payments)] });
    const ledger = computeLedger(d, CUR);
    expect(ledger.custodies.get('C1')!.actual).toBe(0);
    expect(partyBalance(ledger, 'K')).toMatchObject({ entitlements: 22000, liabilities: 0 });
    expect(partyBalance(ledger, ORG).liabilities).toBe(22000);
  });

  it('reports count the expense once: custody handover and return are not expenses', () => {
    const d = data({
      custodyMoves: [move('m1', 'issue', 100000), move('m2', 'return', 70000, '2026-10-08')],
      expenses: [exp('e1', 30000, [{ source: 'custody', custodyId: 'C1', payerId: 'K', amount: 30000 }])],
    });
    expect(expenseReport(d, { currency: CUR }, 'month').total).toBe(30000);
    const cash = cashReport(d, { currency: CUR });
    expect(cash).toMatchObject({ expensesPaidDirect: 0, custodyFunding: 100000, custodyReturns: 70000, netOutflow: 30000 });
  });
});

describe('cost allocation vs obligations', () => {
  it('a shared dinner paid by one person: each other bearer owes the payer', () => {
    const bearing = buildBearing('equal', 27000, ['A', 'K', 'S']);
    const d = data({ expenses: [exp('e1', 27000, [{ source: 'personal', payerId: 'A', amount: 27000 }], bearing)] });
    const ledger = computeLedger(d, CUR);
    expect(partyBalance(ledger, 'A')).toMatchObject({ entitlements: 18000, liabilities: 0 });
    expect(partyBalance(ledger, 'K').liabilities).toBe(9000);
    expect(partyBalance(ledger, 'S').liabilities).toBe(9000);
    expect(partyBalance(ledger, ORG)).toMatchObject({ entitlements: 0, liabilities: 0 });
    expect(settlementSuggestions(ledger)).toEqual(
      expect.arrayContaining([
        { fromId: 'K', toId: 'A', amount: 9000 },
        { fromId: 'S', toId: 'A', amount: 9000 },
      ]),
    );
  });

  it('filing a cost under cost centers creates no debt; charging a share to a person does', () => {
    const allocation = [
      { costCenterId: 'cc1', groupId: null, amount: 18000 },
      { costCenterId: 'cc2', groupId: null, amount: 6000 },
    ];
    const orgOnly = exp('e1', 24000, [{ source: 'org', amount: 24000 }], buildBearing('org', 24000, []), { allocation });
    const noDebts = [...computeLedger(data({ expenses: [orgOnly] }), CUR).parties.values()];
    expect(noDebts.every((p) => p.entitlements === 0 && p.liabilities === 0)).toBe(true);
    expect(expenseReport(data({ expenses: [orgOnly] }), { currency: CUR, costCenterIds: ['cc2'] }, 'month').total).toBe(6000);

    const charged = exp('e2', 24000, [{ source: 'org', amount: 24000 }], buildBearing('amounts', 24000, [ORG, 'M'], { [ORG]: 18000, M: 6000 }));
    const ledger = computeLedger(data({ expenses: [charged] }), CUR);
    expect(partyBalance(ledger, 'M').liabilities).toBe(6000);
    expect(partyBalance(ledger, ORG).entitlements).toBe(6000);
  });

  it('a company expense paid from own money is owed by the organization (reimbursement)', () => {
    const d = data({ expenses: [exp('e1', 180000, [{ source: 'personal', payerId: 'A', amount: 180000 }])] });
    expect(partyBalance(computeLedger(d, CUR), 'A').entitlements).toBe(180000);
  });
});

describe('settlements and advances', () => {
  it('a settlement reduces what is owed between the two parties only', () => {
    const bearing = buildBearing('equal', 27000, ['A', 'K', 'S']);
    const d = data({
      expenses: [exp('e1', 27000, [{ source: 'personal', payerId: 'A', amount: 27000 }], bearing)],
      settlements: [settle('s1', 'K', 'A', 9000)],
    });
    const ledger = computeLedger(d, CUR);
    expect(partyBalance(ledger, 'K').liabilities).toBe(0);
    expect(partyBalance(ledger, 'S').liabilities).toBe(9000);
    expect(partyBalance(ledger, 'A').entitlements).toBe(9000);
  });

  it('a personal advance is a liability, kept apart from custody', () => {
    const advance: Advance = { id: 'a1', kind: 'advance', personId: 'M', amount: 50000, purpose: 'سلفة', ...meta('2026-10-03') };
    const d = data({ advances: [advance], settlements: [settle('s1', 'M', ORG, 20000)] });
    const ledger = computeLedger(d, CUR);
    expect(partyBalance(ledger, 'M')).toMatchObject({ liabilities: 30000, custodyActual: 0 });
    expect(ledger.orgCash).toBe(-50000 + 20000);
  });

  it('the statement runs the balance and lists pending records without moving it', () => {
    const d = data({
      expenses: [
        exp('e1', 10000, [{ source: 'personal', payerId: 'A', amount: 10000 }], undefined, { date: '2026-10-03' }),
        exp('e2', 5000, [{ source: 'personal', payerId: 'A', amount: 5000 }], undefined, { date: '2026-10-04', status: 'submitted' }),
      ],
      settlements: [settle('s1', ORG, 'A', 10000)],
    });
    const lines = statement(d, 'A', CUR);
    expect(lines.map((l) => [l.txn.id, l.credit, l.debit, l.balance, l.pending])).toEqual([
      ['e1', 10000, 0, 10000, false],
      ['e2', 5000, 0, 10000, true],
      ['s1', 0, 10000, 0, false],
    ]);
  });
});

describe('approval', () => {
  it('only approved records change balances; void takes a record out', () => {
    const e = exp('e1', 10000, [{ source: 'personal', payerId: 'A', amount: 10000 }], undefined, { status: 'submitted' });
    expect(computeLedger(data({ expenses: [e] }), CUR).pending).toEqual({ count: 1, amount: 10000 });
    expect(partyBalance(computeLedger(data({ expenses: [e] }), CUR), 'A').entitlements).toBe(0);
    expect(partyBalance(computeLedger(data({ expenses: [{ ...e, status: 'approved' }] }), CUR), 'A').entitlements).toBe(10000);
    expect(partyBalance(computeLedger(data({ expenses: [{ ...e, status: 'void' }] }), CUR), 'A').entitlements).toBe(0);
    expect(partyBalance(computeLedger(data({ expenses: [{ ...e, status: 'rejected' }] }), CUR), 'A').entitlements).toBe(0);
  });

  it('the group policy decides the status on submit, and nobody approves their own record', () => {
    const policy = { ...homeGroup().policy, approval: 'above' as const, approvalAbove: 5000, approverIds: ['A'] };
    expect(approvalPlan(policy, 4999, 'K').status).toBe('approved');
    expect(approvalPlan(policy, 5000, 'K').status).toBe('submitted');
    expect(approvalPlan({ ...policy, approval: 'none' }, 5000, 'K').status).toBe('approved');
    const sent = (createdBy: string) => ({
      ...exp('e1', 9000, [{ source: 'org', amount: 9000 }], undefined, { status: 'submitted', createdBy }),
      approval: approvalPlan(policy, 9000, createdBy).approval,
    });
    expect(canDecide('A', sent('A'))).toBe(false);
    expect(sent('A').approval?.steps[0]?.status).toBe('skipped');
    expect(canDecide('B', sent('A'))).toBe(true); // no one left on the path: the approve permission decides
    expect(canDecide('A', sent('K'))).toBe(true);
    expect(canDecide('K', sent('S'))).toBe(false);
  });

  it('sequential path: manager, then approvers in order; any_one ends at the first', () => {
    const policy = { ...homeGroup().policy, approval: 'always' as const, managerId: 'M', approverIds: ['A', 'B'], approvalMode: 'sequential' as const };
    let txn = { ...exp('e1', 100, [{ source: 'org', amount: 100 }], undefined, { status: 'submitted', createdBy: 'K' }), approval: approvalPlan(policy, 100, 'K').approval };
    expect(currentDeciders(txn)).toEqual(['M']);
    txn = applyDecision(txn, 'M', 'approved', null, 'now');
    expect(currentDeciders(txn)).toEqual(['A']);
    txn = applyDecision(txn, 'A', 'approved', null, 'now');
    expect(txn.status).toBe('submitted');
    txn = applyDecision(txn, 'B', 'approved', null, 'now');
    expect(txn.status).toBe('approved');

    let any = { ...txn, status: 'submitted' as const, approval: approvalPlan({ ...policy, managerId: null, approvalMode: 'any_one' }, 100, 'K').approval };
    expect(currentDeciders(any)).toEqual(['A', 'B']);
    any = applyDecision(any, 'B', 'approved', null, 'now');
    expect(any.status).toBe('approved');
    expect(any.approval?.steps.map((s) => s.status)).toEqual(['skipped', 'approved']);
  });

  it('switching the mode changes no balance', () => {
    const demo = buildDemoData(CUR, '2026-10-08');
    const simple = { ...demo, settings: { ...demo.settings, mode: 'simple' as const } };
    const a = computeLedger(demo, CUR);
    const b = computeLedger(simple, CUR);
    expect([...b.parties.entries()]).toEqual([...a.parties.entries()]);
    expect(b.orgCash).toBe(a.orgCash);
  });
});

describe('policies', () => {
  it('category limit, attachment and the group monthly limits', () => {
    const d = data({
      categories: [{ id: 'cat:fuel', name: 'وقود', color: '#000', maxAmount: 20000 }],
      groups: [homeGroup({ attachment: 'above', attachmentAbove: 15000, monthlyLimit: 60000, monthlyLimitPerPerson: 50000 })],
      expenses: [
        exp('old', 40000, [{ source: 'org', amount: 40000 }], undefined, { date: '2026-10-02', createdBy: 'K' }),
        exp('other', 10000, [{ source: 'org', amount: 10000 }], undefined, { date: '2026-10-03', createdBy: 'S' }),
      ],
    });
    const codes = checkPolicies(
      { id: 'new', amount: 25000, categoryId: 'cat:fuel', attachments: [], createdBy: 'K', date: '2026-10-20', currency: CUR, groupId: null },
      d,
      String,
    ).map((v) => v.code);
    // K: 40,000 + 25,000 > 50,000; the group: 50,000 + 25,000 > 60,000.
    expect(codes).toEqual(['category_limit', 'attachment_required', 'group_monthly_limit', 'monthly_limit']);
    const elsewhere = checkPolicies(
      { id: 'new', amount: 15000, categoryId: 'cat:fuel', attachments: [], createdBy: 'K', date: '2026-10-20', currency: CUR, groupId: 'grp:x' },
      { ...d, groups: [...d.groups, { id: 'grp:x', name: 'x', memberIds: [], policy: homeGroup().policy }] },
      String,
    );
    expect(elsewhere).toEqual([]);
  });
});

describe('reports', () => {
  it('buckets by day, week (from Saturday) and month', () => {
    expect(weekStart('2026-10-08')).toBe('2026-10-03'); // Thu → Sat
    expect(weekStart('2026-10-03')).toBe('2026-10-03');
    expect(bucketOf('2026-10-08', 'month')).toBe('2026-10');
    const d = data({
      expenses: [
        exp('e1', 100, [{ source: 'org', amount: 100 }], undefined, { date: '2026-10-03' }),
        exp('e2', 200, [{ source: 'org', amount: 200 }], undefined, { date: '2026-10-09' }),
        exp('e3', 300, [{ source: 'org', amount: 300 }], undefined, { date: '2026-10-11' }),
      ],
    });
    expect(expenseReport(d, { currency: CUR }, 'week').series.map((r) => [r.key, r.amount])).toEqual([
      ['2026-10-03', 300],
      ['2026-10-10', 300],
    ]);
  });

  it('filters by participant and keeps pending apart', () => {
    const d = data({
      expenses: [
        exp('e1', 100, [{ source: 'personal', payerId: 'K', amount: 100 }]),
        exp('e2', 200, [{ source: 'org', amount: 200 }]),
        exp('e3', 50, [{ source: 'personal', payerId: 'K', amount: 50 }], undefined, { status: 'submitted' }),
      ],
    });
    const r = expenseReport(d, { currency: CUR, participantIds: ['K'] }, 'month');
    expect([r.total, r.pendingTotal]).toEqual([100, 50]);
    expect(expenseReport(d, { currency: CUR, participantIds: ['K'], includePending: true }, 'month').total).toBe(150);
  });
});

describe('participants', () => {
  it('only the active company: other companies’ users are never offered; contacts without accounts are', () => {
    const list = mergeParticipants({
      companyId: 'co1',
      users: [
        { id: 'u1', name: 'أ', email: null, isActive: true, companyIds: ['co1'] },
        { id: 'u2', name: 'ب', email: null, isActive: true, companyIds: ['co2'] },
        { id: 'u3', name: 'ج', email: null, isActive: false, companyIds: ['co1'] },
      ],
      contacts: [
        { id: 'c1', name: 'أ (جهة)', email: null, userId: 'u1', companyId: 'co1', isInternal: true, archived: false },
        { id: 'c2', name: 'سائق', email: null, userId: null, companyId: 'co1', isInternal: true, archived: false },
        { id: 'c3', name: 'جهة أخرى', email: null, userId: null, companyId: 'co2', isInternal: true, archived: false },
        { id: 'c4', name: 'عميل', email: null, userId: null, companyId: 'co1', isInternal: false, archived: false },
        { id: 'c5', name: 'مستخدم شركة أخرى', email: null, userId: 'u2', companyId: 'co1', isInternal: true, archived: false },
      ],
      currentUser: { id: 'me', name: 'أنا', email: null },
    });
    const byId = Object.fromEntries(list.map((p) => [p.id, p.kind]));
    expect(byId).toEqual({ 'u:u1': 'user_contact', 'c:c2': 'contact', 'u:me': 'user', 'c:c5': 'contact' });
  });
});

describe('demo data', () => {
  it.each(['YER', 'KWD', 'USD'])('is consistent in %s', (code) => {
    const d = buildDemoData(code, '2026-10-08');
    for (const e of d.expenses) expect(validateExpense(e)).toEqual([]);
    const ledger = computeLedger(d, code);
    // Pairwise: what everyone is owed equals what everyone owes.
    const totals = [...ledger.parties.values()].reduce(
      (t, p) => ({ in: t.in + p.entitlements, out: t.out + p.liabilities }),
      { in: 0, out: 0 },
    );
    expect(totals.in).toBe(totals.out);
    expect(ledger.custodies.get('cus:sara')!.actual).toBe(0); // closed: spent + returned
    expect(ledger.custodies.get('cus:khaled')!.actual).toBeGreaterThan(0);
    expect(ledger.custodies.get('cus:khaled')!.expected).toBeLessThan(ledger.custodies.get('cus:khaled')!.actual);
    // Khaled is owed the custody shortfall and the housing shares.
    expect(partyBalance(ledger, DEMO.khaled).entitlements).toBeGreaterThan(0);
    // Mona owes the rest of her advance and her personal share.
    expect(partyBalance(ledger, DEMO.mona).liabilities).toBeGreaterThan(0);
  });
});
