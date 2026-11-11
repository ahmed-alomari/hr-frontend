import { branchDues, usableIn } from '../domain/branches';
import type { Custody, Expense, ExpensesData } from '../domain/types';

const custody = (id: string, branchId: string | null): Custody => ({
  id,
  branchId,
  holderId: 'u:holder',
  purpose: 'عهدة',
  currency: 'SAR',
  limit: null,
  status: 'open',
  openedAt: '2026-11-01',
  createdBy: 'u:boss',
});

const expense = (id: string, branchId: string | null, custodyId: string, amount: number, status: Expense['status'] = 'approved'): Expense => ({
  id,
  kind: 'expense',
  branchId,
  description: 'مصروف',
  amount,
  categoryId: 'c',
  payments: [{ source: 'custody', amount, custodyId, payerId: 'u:holder' }],
  bearing: { method: 'org', shares: [{ partyId: 'org', amount }] },
  allocation: [{ costCenterId: null, groupId: null, amount }],
  attachments: [],
  currency: 'SAR',
  date: '2026-11-02',
  status,
  createdBy: 'u:holder',
  createdAt: '2026-11-02T00:00:00Z',
});

const base = (over: Partial<ExpensesData>): ExpensesData =>
  ({
    version: 1,
    demoParticipants: [],
    categories: [],
    costCenters: [],
    groups: [],
    custodies: [custody('k1', 'B1'), custody('k0', null)],
    expenses: [],
    custodyMoves: [],
    advances: [],
    settlements: [],
    branchTransfers: [],
    settings: { mode: 'simple', fallbackCurrency: 'SAR', visibility: 'all', fullViewerIds: [] },
    ...over,
  }) as ExpensesData;

describe('what one branch owes another (decisions.md §29)', () => {
  it('an expense of branch 2 paid from a branch 1 custody: branch 2 owes branch 1', () => {
    const data = base({ expenses: [expense('e1', 'B2', 'k1', 1200)] });
    expect(branchDues(data, 'SAR')).toEqual([{ fromBranchId: 'B2', toBranchId: 'B1', amount: 1200 }]);
  });

  it('the same branch, a pending or another currency: nothing is owed', () => {
    const data = base({
      expenses: [expense('e1', 'B1', 'k1', 500), expense('e2', 'B2', 'k1', 300, 'submitted')],
    });
    expect(branchDues(data, 'SAR')).toEqual([]);
    expect(branchDues(base({ expenses: [expense('e3', 'B2', 'k1', 100)] }), 'YER')).toEqual([]);
  });

  it('dues both ways are netted, and the company is a side of its own', () => {
    const data = base({
      custodies: [custody('k1', 'B1'), custody('k2', 'B2'), custody('k0', null)],
      expenses: [expense('e1', 'B2', 'k1', 1000), expense('e2', 'B1', 'k2', 400), expense('e3', null, 'k1', 50)],
    });
    expect(branchDues(data, 'SAR')).toEqual(
      expect.arrayContaining([
        { fromBranchId: 'B2', toBranchId: 'B1', amount: 600 },
        { fromBranchId: null, toBranchId: 'B1', amount: 50 },
      ]),
    );
  });

  it('a transfer clears it; a voided one does not', () => {
    const transfer = { id: 't', fromBranchId: 'B2', toBranchId: 'B1', amount: 1200, currency: 'SAR', date: '2026-11-03', createdBy: 'u:boss', createdAt: '' };
    const paid = base({ expenses: [expense('e1', 'B2', 'k1', 1200)], branchTransfers: [transfer] });
    expect(branchDues(paid, 'SAR')).toEqual([]);
    const voided = base({ expenses: [expense('e1', 'B2', 'k1', 1200)], branchTransfers: [{ ...transfer, voidedAt: '2026-11-04T00:00:00Z' }] });
    expect(branchDues(voided, 'SAR')).toEqual([{ fromBranchId: 'B2', toBranchId: 'B1', amount: 1200 }]);
  });

  it('a group or cost center is usable when shared or of the same branch', () => {
    expect(usableIn('B1', { branchId: null })).toBe(true);
    expect(usableIn('B1', { branchId: 'B1' })).toBe(true);
    expect(usableIn('B2', { branchId: 'B1' })).toBe(false);
    expect(usableIn(null, { branchId: 'B1' })).toBe(false);
  });
});
