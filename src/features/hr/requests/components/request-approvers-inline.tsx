'use client';

import { cn } from '@/shared/utils';
import { approvalModeLabelAr } from '@/shared/i18n/ar';
import { STATUS_PILL } from '@/shared/status-pill-classes';
import {
  approverDisplayStatus,
  approverDisplayStatusLabelAr,
  type ApproverDisplayStatus,
} from '@/shared/approval/approver-states';
import type { ApproverStatesSnapshot } from '@/shared/approval/types';

function statusDotClass(status: ApproverDisplayStatus) {
  if (status === 'approved') return 'bg-emerald-500';
  if (status === 'rejected') return 'bg-destructive';
  if (status === 'pending') return 'bg-gold';
  return 'bg-muted-foreground/40';
}

function statusPillClass(status: ApproverDisplayStatus) {
  if (status === 'approved') return STATUS_PILL.approved;
  if (status === 'rejected') return STATUS_PILL.rejected;
  if (status === 'pending') return STATUS_PILL.pending;
  return STATUS_PILL.muted;
}

/** Compact approver chain for table cells and card headers. */
export function RequestApproversInline({
  states,
  requestStatus,
  className,
}: {
  states: ApproverStatesSnapshot | null | undefined;
  /** The request's own status, so approvers of a cancelled request are not shown as waiting. */
  requestStatus?: string | null;
  className?: string;
}) {
  if (!states?.approvers?.length) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const approvers = [...states.approvers].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {approvalModeLabelAr(states.approvalMode)}
      </span>
      {approvers.map((a, idx) => {
        const status = approverDisplayStatus(states, a, requestStatus);
        return (
          <span
            key={`${a.employeeId}-${a.sortOrder}`}
            title={`${a.employeeNameAr} — ${approverDisplayStatusLabelAr(status)}`}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium',
              statusPillClass(status),
            )}
          >
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDotClass(status))} />
            <span>
              {states.approvalMode === 'sequential' ? `${idx + 1}. ` : ''}
              {a.employeeNameAr}
            </span>
          </span>
        );
      })}
    </div>
  );
}
