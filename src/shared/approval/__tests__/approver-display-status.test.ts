import {
  approvalWorkflowOutcome,
  approverDisplayStatus,
  approverDisplayStatusLabelAr,
} from '@/shared/approval/approver-states';
import type { ApprovalMode, ApproverEntryStatus, ApproverStatesSnapshot } from '@/shared/approval/types';

function states(mode: ApprovalMode, statuses: ApproverEntryStatus[]): ApproverStatesSnapshot {
  return {
    approvalMode: mode,
    approvers: statuses.map((status, i) => ({
      employeeId: `e${i + 1}`,
      employeeNameAr: `موافق ${i + 1}`,
      sortOrder: i,
      status,
      decidedAt: status === 'pending' ? null : '2026-11-13T19:05:00Z',
      decidedBy: null,
      notes: null,
    })),
  } as ApproverStatesSnapshot;
}

function shown(s: ApproverStatesSnapshot, requestStatus?: string) {
  return s.approvers.map((a) => approverDisplayStatusLabelAr(approverDisplayStatus(s, a, requestStatus)));
}

describe('approver display status', () => {
  it('ADV-2026-00010: the first of three rejects in sequence; the other two never got their turn', () => {
    const s = states('sequential', ['rejected', 'pending', 'pending']);
    expect(approvalWorkflowOutcome(s)).toBe('rejected');
    expect(shown(s, 'rejected')).toEqual(['مرفوض', 'لم يصل دوره', 'لم يصل دوره']);
  });

  it('still waiting in sequence: the next approvers stay «قيد الانتظار»', () => {
    const s = states('sequential', ['approved', 'pending', 'pending']);
    expect(approvalWorkflowOutcome(s)).toBe('pending');
    expect(shown(s, 'pending')[1]).toBe(approverDisplayStatusLabelAr('pending'));
  });

  it('parallel: one rejection ends it, the others are no longer needed', () => {
    const s = states('parallel', ['pending', 'rejected', 'pending']);
    expect(shown(s)).toEqual(['لم يعد مطلوباً', 'مرفوض', 'لم يعد مطلوباً']);
  });

  it('any one: the first approval ends it, the others are no longer needed', () => {
    const s = states('any_one', ['pending', 'approved']);
    expect(approvalWorkflowOutcome(s)).toBe('approved');
    expect(shown(s)[0]).toBe('لم يعد مطلوباً');
  });

  it('any one: one rejection out of two still waits for the other', () => {
    const s = states('any_one', ['rejected', 'pending']);
    expect(approvalWorkflowOutcome(s)).toBe('pending');
    expect(shown(s, 'pending')[1]).toBe(approverDisplayStatusLabelAr('pending'));
  });

  it('a cancelled request does not leave its approvers waiting', () => {
    const s = states('sequential', ['pending', 'pending']);
    expect(shown(s, 'cancelled')).toEqual(['لم يعد مطلوباً', 'لم يعد مطلوباً']);
  });

  it('an advance still pending approval keeps its approvers waiting', () => {
    const s = states('parallel', ['approved', 'pending']);
    expect(shown(s, 'pending_approval')[1]).toBe(approverDisplayStatusLabelAr('pending'));
  });
});
