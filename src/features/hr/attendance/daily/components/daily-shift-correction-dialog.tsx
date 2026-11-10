'use client';

import * as React from 'react';
import { ArrowDown, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ModernTimePicker } from '@/components/ui/time-picker';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormFooterClass,
  dialogShellBodyClass,
  dialogShellContentClass,
  dialogShellHeaderClass,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/shared-dialogs';
import { cn } from '@/shared/utils';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { attendanceEventsApi } from '@/features/hr/attendance/lib/api/attendance-events';
import type { DailyBreakdownResponseDto } from '@/features/hr/attendance/types/api/attendance-events';
import { ArabicClockTime } from '@/features/hr/requests/components/correction-period-times';
import {
  buildCorrectionFormPeriod,
  type CorrectionFormPeriod,
} from '@/features/hr/requests/attendance-corrections/lib/correction-from-daily-breakdown';
import {
  defaultTimezoneOffsetMinutes,
  timePickerToIso,
} from '@/features/hr/requests/attendance-corrections/lib/correction-period-time';

export type DailyShiftCorrectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  /** Which shift period (index into daily-breakdown `periods[]`) this correction targets. */
  periodIndex: number | undefined;
  onSuccess?: () => void;
};

type DialogPeriod = CorrectionFormPeriod & { useShiftTimes: boolean };

function sameWallClock(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

function periodHasChanges(period: DialogPeriod): boolean {
  return (
    !sameWallClock(period.correctedCheckIn, period.recordedCheckIn) ||
    !sameWallClock(period.correctedCheckOut, period.recordedCheckOut)
  );
}

function periodIsValid(period: DialogPeriod): boolean {
  if (!period.correctedCheckIn.trim()) return false;
  if (!period.checkOutOptional && !period.correctedCheckOut.trim()) return false;
  return true;
}

function TimeField({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children ?? (
        <div className="flex h-10 items-center rounded-lg border border-border/50 bg-muted/20 px-3">
          {value ? (
            <ArabicClockTime value={value} className="text-sm font-semibold" />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      )}
    </div>
  );
}

export function DailyShiftCorrectionDialog({
  open,
  onOpenChange,
  companyId,
  employeeId,
  employeeName,
  workDate,
  periodIndex,
  onSuccess,
}: DailyShiftCorrectionDialogProps) {
  const [breakdown, setBreakdown] = React.useState<DailyBreakdownResponseDto | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [period, setPeriod] = React.useState<DialogPeriod | null>(null);
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const timezoneOffsetMinutes = breakdown?.timezoneOffsetMinutes ?? defaultTimezoneOffsetMinutes();

  React.useEffect(() => {
    if (!open) return;
    setReason('');
    if (periodIndex == null || !companyId || !employeeId || !workDate) {
      setBreakdown(null);
      setPeriod(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void attendanceEventsApi
      .getDailyBreakdown({
        employeeId,
        workDate,
        companyId,
        timezoneOffsetMinutes: defaultTimezoneOffsetMinutes(),
      })
      .then((data) => {
        if (cancelled) return;
        setBreakdown(data);
        const raw = data.periods[periodIndex];
        // Starts from the real punches; shift times only when HR switches to them.
        setPeriod(raw ? { ...buildCorrectionFormPeriod(raw, data, periodIndex), useShiftTimes: false } : null);
      })
      .catch((err) => {
        if (cancelled) return;
        setBreakdown(null);
        setPeriod(null);
        handleApiError(err, 'attendance/events/daily-breakdown');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, companyId, employeeId, workDate, periodIndex]);

  const updatePeriod = React.useCallback((patch: Partial<DialogPeriod>) => {
    setPeriod((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const handleShiftToggle = (useShiftTimes: boolean) => {
    if (!period) return;
    if (useShiftTimes) {
      updatePeriod({
        useShiftTimes: true,
        correctedCheckIn: period.shiftCheckIn,
        correctedCheckOut: period.shiftCheckOut,
      });
      return;
    }
    updatePeriod({
      useShiftTimes: false,
      correctedCheckIn: period.recordedCheckIn || period.shiftCheckIn,
      correctedCheckOut: period.recordedCheckOut || period.shiftCheckOut,
    });
  };

  const canSubmit =
    !!period && periodIsValid(period) && periodHasChanges(period) && reason.trim().length >= 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawPeriod = periodIndex != null ? breakdown?.periods[periodIndex] : undefined;
    if (!period || !rawPeriod || !breakdown) return;
    if (!periodHasChanges(period)) {
      toast.error('عدّل وقت الحضور أو الانصراف قبل الحفظ.');
      return;
    }
    if (reason.trim().length < 3) {
      toast.error('اكتب سبب التصحيح (٣ أحرف على الأقل).');
      return;
    }

    const shiftAssignmentId = breakdown.shiftAssignment?.id ?? null;
    const periodSortOrder = rawPeriod.expected.sortOrder;
    const reasonNote = reason.trim();

    const checkInChanged = !sameWallClock(period.correctedCheckIn, period.recordedCheckIn);
    const checkOutChanged = !sameWallClock(period.correctedCheckOut, period.recordedCheckOut);

    setSubmitting(true);
    try {
      // The new punch is saved first; the real one is voided only after, so a
      // refused or failed save never leaves the day without its punch.
      if (checkInChanged) {
        const occurredAt = timePickerToIso(workDate, period.correctedCheckIn, timezoneOffsetMinutes);
        if (occurredAt) {
          const created = await attendanceEventsApi.createConfirmingExcluded({
            companyId,
            employeeId,
            eventType: 'check_in',
            occurredAt,
            workDate,
            source: 'manual_hr',
            shiftAssignmentId,
            periodSortOrder,
            notes: reasonNote,
          });
          if (!created) return;
        }
        if (rawPeriod.actual.checkInEventId) {
          await attendanceEventsApi.void(rawPeriod.actual.checkInEventId, reasonNote);
        }
      }

      if (checkOutChanged) {
        const occurredAt = period.correctedCheckOut
          ? timePickerToIso(workDate, period.correctedCheckOut, timezoneOffsetMinutes)
          : null;
        if (occurredAt) {
          const created = await attendanceEventsApi.createConfirmingExcluded({
            companyId,
            employeeId,
            eventType: 'check_out',
            occurredAt,
            workDate,
            source: 'manual_hr',
            shiftAssignmentId,
            periodSortOrder,
            notes: reasonNote,
          });
          if (!created) return;
        }
        if (rawPeriod.actual.checkOutEventId) {
          await attendanceEventsApi.void(rawPeriod.actual.checkOutEventId, reasonNote);
        }
      }

      toast.success('تم تصحيح بصمات الوردية مباشرة.');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      handleApiError(err, 'attendance/events.shift-correction');
    } finally {
      setSubmitting(false);
    }
  };

  const periodLabel = period?.labelAr ?? 'الوردية';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogShellContentClass, 'sm:max-w-lg')} dir="rtl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className={dialogShellHeaderClass}>
            <DialogTitle>تصحيح {periodLabel}</DialogTitle>
            <DialogDescription>
              {employeeName}
              <span className="mx-2 text-border">·</span>
              <span dir="ltr">{workDate}</span>
              {period ? (
                <>
                  <span className="mx-2 text-border">·</span>
                  {period.expectedRangeAr}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className={cn(dialogShellBodyClass, 'grid gap-4')}>
            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري تحميل الوردية والبصمات…
              </div>
            ) : !period ? (
              <p className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs text-foreground">
                تعذّر تحميل بيانات هذه الوردية.
              </p>
            ) : (
              <>
                <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
                  <p className="mb-3 text-xs font-semibold text-muted-foreground">البصمة المسجّلة</p>
                  <div className="grid grid-cols-2 gap-3">
                    <TimeField label="حضور" value={period.recordedCheckIn} />
                    <TimeField label="انصراف" value={period.recordedCheckOut} />
                  </div>
                </div>

                <div className="flex justify-center text-muted-foreground/60">
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-primary">الأوقات الصحيحة</p>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="shift-mode" className="text-[11px] text-muted-foreground">
                        {period.useShiftTimes ? 'أوقات الوردية' : 'أوقات يدوية'}
                      </Label>
                      <Switch id="shift-mode" checked={period.useShiftTimes} onCheckedChange={handleShiftToggle} />
                    </div>
                  </div>

                  {period.useShiftTimes ? (
                    <div className="grid grid-cols-2 gap-3">
                      <TimeField label="حضور" value={period.correctedCheckIn} />
                      <TimeField label="انصراف" value={period.correctedCheckOut} />
                    </div>
                  ) : (
                    <>
                      <p className="mb-3 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                        <span className="font-medium text-primary">أوقات يدوية:</span>{' '}
                        اضغط على الحقل لاختيار وقت الحضور أو الانصراف الذي تريده.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <TimeField label="حضور" value={period.correctedCheckIn}>
                          <ModernTimePicker
                            value={period.correctedCheckIn}
                            onChange={(v) => updatePeriod({ correctedCheckIn: v })}
                            placeholder="اضغط لاختيار وقت الحضور"
                          />
                        </TimeField>
                        <TimeField
                          label={period.checkOutOptional ? 'انصراف (اختياري)' : 'انصراف'}
                          value={period.correctedCheckOut}
                        >
                          <ModernTimePicker
                            value={period.correctedCheckOut}
                            onChange={(v) => updatePeriod({ correctedCheckOut: v })}
                            placeholder="اضغط لاختيار وقت الانصراف"
                          />
                        </TimeField>
                      </div>
                    </>
                  )}
                </div>

                {period.needsCorrection ? (
                  <Badge variant="outline" className="w-fit border-primary/30 bg-primary/5 text-[10px] text-primary">
                    <Clock className="me-1 h-3 w-3" />
                    هذه الوردية تحتاج تصحيح
                  </Badge>
                ) : null}

                <FormField label="سبب التصحيح">
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    minLength={3}
                    required
                    placeholder="اشرح سبب تصحيح بصمات هذه الوردية (٣ أحرف على الأقل)…"
                  />
                </FormField>

                <p className="text-[11px] text-muted-foreground">
                  يُطبَّق هذا التصحيح فوراً على سجلات الحضور دون الحاجة لموافقة.
                </p>
              </>
            )}
          </DialogBody>

          <DialogFooter className={dialogFormFooterClass}>
            <Button type="submit" variant="luxe" disabled={submitting || loading || !canSubmit}>
              {submitting ? 'جاري الحفظ…' : 'حفظ التصحيح'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
