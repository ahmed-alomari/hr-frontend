/**
 * The group form edits one approval list: one type for all of the group's
 * approvers. Whatever a group was saved with reads as that list, and a list of
 * one type drives the approval path as it says.
 */
import { approvalListOf } from '../components/group-policy';
import { applyDecision, approvalPlan, currentDeciders, groupCostCenterIds, OPEN_POLICY } from '../domain/policy';
import type { Expense, GroupPolicy } from '../domain/types';

const policy = (extra: Partial<GroupPolicy>): GroupPolicy => ({ ...OPEN_POLICY, approval: 'always', ...extra });

describe('approvalListOf', () => {
  it('a new group: sequential, nobody yet', () => {
    expect(approvalListOf(policy({}))).toEqual({ mode: 'sequential', approverIds: [], requiredCount: null });
  });

  it('one saved stage stays as it is', () => {
    const stage = { mode: 'parallel' as const, approverIds: ['a', 'b'], requiredCount: 1 };
    expect(approvalListOf(policy({ stages: [stage] }))).toEqual(stage);
  });

  it('several stages read as one list of the first type, each person once', () => {
    const list = approvalListOf(policy({
      stages: [
        { mode: 'any_one', approverIds: ['a', 'b'], requiredCount: null },
        { mode: 'parallel', approverIds: ['b', 'c'], requiredCount: 2 },
      ],
    }));
    expect(list).toEqual({ mode: 'any_one', approverIds: ['a', 'b', 'c'], requiredCount: null });
  });

  it('an optional stage never joins people who decide', () => {
    const list = approvalListOf(policy({
      stages: [
        { mode: 'optional', approverIds: ['x'], requiredCount: null },
        { mode: 'sequential', approverIds: ['a'], requiredCount: null },
      ],
    }));
    expect(list.approverIds).toEqual(['a']);
    expect(list.mode).toBe('sequential');
  });

  it('the older manager and approvers read as one list', () => {
    const list = approvalListOf(policy({ managerId: 'm', approverIds: ['a', 'b'], approvalMode: 'parallel' }));
    expect(list).toEqual({ mode: 'sequential', approverIds: ['m', 'a', 'b'], requiredCount: null });
  });
});

describe('one list drives the approval path', () => {
  const sent = (stage: GroupPolicy['stages']) => {
    const plan = approvalPlan(policy({ stages: stage }), 1000, 'author');
    return { id: 'e1', kind: 'expense', status: plan.status, approval: plan.approval, createdBy: 'author' } as unknown as Expense;
  };

  it('sequential: only the next person decides', () => {
    const e = sent([{ mode: 'sequential', approverIds: ['a', 'b'], requiredCount: null }]);
    expect(currentDeciders(e)).toEqual(['a']);
    const next = applyDecision(e, 'a', 'approved', null, '2026-11-09');
    expect(next.status).toBe('submitted');
    expect(currentDeciders(next)).toEqual(['b']);
    expect(applyDecision(next, 'b', 'approved', null, '2026-11-09').status).toBe('approved');
  });

  it('parallel: all of them, in any order', () => {
    const e = sent([{ mode: 'parallel', approverIds: ['a', 'b'], requiredCount: null }]);
    expect(currentDeciders(e)).toEqual(['a', 'b']);
    const next = applyDecision(e, 'b', 'approved', null, '2026-11-09');
    expect(next.status).toBe('submitted');
    expect(applyDecision(next, 'a', 'approved', null, '2026-11-09').status).toBe('approved');
  });

  it('any one: the first approval completes it', () => {
    const e = sent([{ mode: 'any_one', approverIds: ['a', 'b'], requiredCount: null }]);
    expect(applyDecision(e, 'b', 'approved', null, '2026-11-09').status).toBe('approved');
  });
});

describe('groupCostCenterIds', () => {
  it('the list wins; a group with one center has that one; none is empty', () => {
    expect(groupCostCenterIds({ costCenterId: 'a', costCenterIds: ['b', 'a'] })).toEqual(['b', 'a']);
    expect(groupCostCenterIds({ costCenterId: 'a' })).toEqual(['a']);
    expect(groupCostCenterIds({ costCenterId: null })).toEqual([]);
    expect(groupCostCenterIds({ costCenterId: 'a', costCenterIds: [] })).toEqual([]);
  });
});
