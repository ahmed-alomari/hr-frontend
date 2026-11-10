'use client';

import * as React from 'react';
import { CalendarDays, Clock, Pencil, Trash2, Users } from 'lucide-react';
import { shiftColorStyle } from '@/shared/shift-color';
import { cn } from '@/shared/utils';
import { Button } from '@/components/ui/button';
import { ConfirmationModal } from '@/components/ui/shared-dialogs';
import { hasShiftStarted } from '@/features/hr/attendance/lib/api/shift-assignments';

type BatchRow = {
  id: string;
  targetLabel: string;
  employeeCode: string;
  isActive: boolean;
  effectiveFrom: string;
};

type Batch = {
  batchId: string;
  templateName: string;
  colorHex: string;
  effectiveFrom: string | undefined;
  totalAssignments: number;
  activeAssignments: number;
  rows: BatchRow[];
};

export function AssignmentsBatchCard({
  batch,
  onRemoveBatch,
  onEditBatch,
  onViewBatch,
}: {
  batch: Batch;
  onRemoveBatch: (batchId: string) => void;
  onEditBatch: (batchId: string) => void;
  onViewBatch: (batchId: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const { batchId, templateName, colorHex, effectiveFrom: ef, rows, activeAssignments, totalAssignments } = batch;

  // A batch can be deleted only while none of its shifts has started.
  const canDelete = rows.every((r) => !hasShiftStarted(r.effectiveFrom));
  const visibleNames = rows.slice(0, 3).map((r) => r.targetLabel);
  const remaining = rows.length - visibleNames.length;

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
      onClick={() => onViewBatch(batchId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onViewBatch(batchId)}
    >
      {/* coloured top strip */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-1 rounded-t-xl',
          colorHex ? 'bg-shift-color' : 'bg-primary',
        )}
        style={shiftColorStyle(colorHex)}
      />

      <div className="p-5 pt-6">
        <div className="mb-3 flex items-start justify-between">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground',
              colorHex ? 'bg-shift-color' : 'bg-primary',
            )}
            style={shiftColorStyle(colorHex)}
          >
            <Clock className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {activeAssignments}/{totalAssignments} موظف
            </span>
          </div>
        </div>

        <h3 className="mb-0.5 truncate font-display text-base font-bold leading-snug transition-colors group-hover:text-primary">
          {templateName}
        </h3>
        <div className="mb-3 flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarDays className="h-3 w-3 shrink-0" />
          <span dir="ltr">{ef ?? '—'}</span>
        </div>

        <div className="mb-4 flex flex-wrap gap-1">
          {visibleNames.map((name, i) => (
            <span
              key={i}
              className="inline-flex max-w-[140px] items-center truncate rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {name}
            </span>
          ))}
          {remaining > 0 && (
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              +{remaining} آخرين
            </span>
          )}
        </div>

        <div
          className="flex items-center justify-between border-t border-border/60 pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => onEditBatch(batchId)}
          >
            <Pencil className="h-3 w-3" /> تعديل
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-3 w-3" /> حذف الربط
            </Button>
          )}
        </div>
      </div>

      <ConfirmationModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="حذف الدفعة"
        description="هل أنت متأكد من حذف كل عناصر هذه الدفعة؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={() => onRemoveBatch(batchId)}
      />
    </div>
  );
}
