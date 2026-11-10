'use client';

import * as React from 'react';
import { CalendarDays, CalendarX, Clock, History, Plus, Repeat, Trash2, Users } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  addDaysIso,
  hasShiftStarted,
  ksaTodayIso,
} from '@/features/hr/attendance/lib/api/shift-assignments';
import type { ShiftRowAction } from '@/features/hr/attendance/assignment/hooks/useAssignmentsPanelModel';
import { cn } from '@/shared/utils';
import { shiftColorStyle } from '@/shared/shift-color';
import { Badge } from '@/components/ui/badge';
import { EmptyStateCard } from '@/components/shared/empty-state-card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
  dialogFormFooterClass,
} from '@/components/ui/dialog';
import { ConfirmationModal, FormField } from '@/components/ui/shared-dialogs';
import { useAssignmentsPanelModel } from '@/features/hr/attendance/assignment/hooks/useAssignmentsPanelModel';
import { DirectoryPagedViews } from '@/components/ui/paged-list';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { AssignmentsBatchCard } from '@/features/hr/attendance/assignment/components/assignments-batch-card';
import { AssignmentsBatchDialog } from '@/features/hr/attendance/assignment/components/assignments-batch-dialog';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import type { RegisterColumn } from '@/components/pdf/print/register-document';
import { exportDate } from '@/features/hr/attendance/lib/attendance-export-format';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import {
  employeeStatusFilterLabelAr,
  isEmployeeStatusFilterActive,
} from '@/features/hr/lib/employee-status-filter';

const ASSIGNMENT_EXPORT_COLUMNS: RegisterColumn[] = [
  { label: 'القالب', kind: 'text' },
  { label: 'الموظف', kind: 'name' },
  { label: 'الرقم الوظيفي', kind: 'code' },
  { label: 'ساري من', kind: 'date' },
  { label: 'الحالة', kind: 'status' },
];

type AssignmentRow = {
  id: string;
  templateId: string;
  targetId: string;
  targetLabel: string;
  employeeCode: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
};

function toRowAction(row: AssignmentRow): ShiftRowAction {
  return {
    assignmentId: row.id,
    employeeId: row.targetId,
    employeeName: row.targetLabel,
    templateId: row.templateId,
    effectiveFrom: row.effectiveFrom,
  };
}

/**
 * Per employee: a running shift is changed or ended by date; a future shift
 * can be deleted; an ended shift is history and has no action.
 */
function AssignmentEmployeeRows({
  rows,
  onUnlink,
  onChange,
  onCorrect,
}: {
  rows: AssignmentRow[];
  onUnlink: (row: ShiftRowAction) => void;
  onChange: (row: ShiftRowAction) => void;
  onCorrect: (row: ShiftRowAction) => void;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">لا يوجد موظفون مرتبطون</p>;
  }
  const today = ksaTodayIso();

  return (
    <div className="space-y-1.5">
      {rows.map((row) => {
        const ended = !!row.effectiveTo && row.effectiveTo < today;
        const started = hasShiftStarted(row.effectiveFrom, today);
        return (
          <div
            key={row.id}
            className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5"
          >
            {/* Line 1: who and when — the full name is never cut by the buttons. */}
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {row.targetLabel.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium leading-snug">{row.targetLabel}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  <span className="font-mono" dir="ltr">{row.employeeCode}</span>
                  <span className="mx-1">·</span>
                  <span>من <span dir="ltr">{row.effectiveFrom}</span></span>
                  {row.effectiveTo && (
                    <span> إلى <span dir="ltr">{row.effectiveTo}</span></span>
                  )}
                </p>
              </div>
              <Badge
                variant={ended || !row.isActive ? 'secondary' : started ? 'success' : 'outline'}
                className="shrink-0 text-[10px]"
              >
                {!row.isActive ? 'غير نشط' : ended ? 'منتهٍ' : started ? 'جارٍ' : 'قادم'}
              </Badge>
            </div>
            {/* Line 2: actions. */}
            {row.isActive && (started || !ended) && (
            <div className="mt-2 flex flex-wrap items-center justify-end gap-1 border-t border-border/40 pt-2">
            {row.isActive && started && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 gap-1 px-2 text-xs"
                title="القالب كان خاطئاً من أول يوم: يُستبدل وتُعاد حسبة أيامه"
                onClick={() => onCorrect(toRowAction(row))}
              >
                <History className="h-3 w-3" />
                تصحيح القالب
              </Button>
            )}
            {row.isActive && !ended && (
              <div className="flex shrink-0 items-center gap-1">
                {started && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => onChange(toRowAction(row))}
                  >
                    <Repeat className="h-3 w-3" />
                    تغيير الدوام
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => onUnlink(toRowAction(row))}
                >
                  {started ? <CalendarX className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
                  {started ? 'إنهاء الدوام' : 'حذف'}
                </Button>
              </div>
            )}
            </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AssignmentsPanel() {
  const model = useAssignmentsPanelModel();
  const [viewBatchId, setViewBatchId] = React.useState<string | null>(null);

  const viewBatch = viewBatchId ? model.batches.find((b) => b.batchId === viewBatchId) : null;

  React.useEffect(() => {
    if (viewBatchId && !viewBatch) setViewBatchId(null);
  }, [viewBatchId, viewBatch]);

  React.useEffect(() => {
    if (model.editOpen && !model.editBatch) model.setEditOpen(false);
  }, [model.editOpen, model.editBatch, model.setEditOpen]);

  const handleUnlink = React.useCallback(
    (row: ShiftRowAction) => model.requestUnlink(row),
    [model],
  );
  const handleChange = React.useCallback(
    (row: ShiftRowAction) => model.requestChange(row),
    [model],
  );
  const handleCorrect = React.useCallback(
    (row: ShiftRowAction) => model.requestCorrect(row),
    [model],
  );

  const { loadAllForExport, employeeStatus, setEmployeeStatus } = model;
  const getExportRows = useLatestCallback(
    async () =>
      (await loadAllForExport()).flatMap((batch) =>
        batch.rows.map((row) => [
          batch.templateName,
          row.targetLabel,
          row.employeeCode || '—',
          exportDate(row.effectiveFrom),
          row.isActive ? 'نشط' : 'غير نشط',
        ]),
      ),
  );
  const openNew = useLatestCallback(model.openNew);

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={isEmployeeStatusFilterActive(employeeStatus) ? 1 : 0} />
        <RegisterExportMenu
          title="ربط قوالب الدوام بالموظفين"
          fileName="shift-assignments"
          columns={ASSIGNMENT_EXPORT_COLUMNS}
          getRows={getExportRows}
          subtitleLines={[`حالة الموظفين: ${employeeStatusFilterLabelAr(employeeStatus)}`]}
        />
        <Button variant="luxe" size="sm" className="h-8 gap-1.5 px-3 text-xs" type="button" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" />
          ربط قالب جديد
        </Button>
      </div>
    ),
    [employeeStatus, getExportRows, openNew],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        employeeStatus={employeeStatus}
        onEmployeeStatusChange={setEmployeeStatus}
      />
    ),
    [employeeStatus],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">

      {model.loading && model.batches.length === 0 ? null : model.batches.length === 0 && !model.loading ? (
        <EmptyStateCard icon={Users} title="لا توجد دفعات تعيين بعد" />
      ) : (
        <DirectoryPagedViews items={model.batches} serverPagination={model.pagination} loading={model.loading}>
          {(pageItems) => (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((batch) => (
            <AssignmentsBatchCard
              key={batch.batchId}
              batch={batch}
              onRemoveBatch={model.removeAssignmentBatch}
              onEditBatch={model.openEdit}
              onViewBatch={setViewBatchId}
            />
          ))}
        </div>
          )}
        </DirectoryPagedViews>
      )}

      <AssignmentsBatchDialog model={model} />

      {/* ── Detail dialog ── */}
      <Dialog open={!!viewBatch} onOpenChange={(o) => !o && setViewBatchId(null)}>
        <DialogContent className="max-w-2xl border-border" dir="rtl">
          {viewBatch && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground',
                      viewBatch.colorHex ? 'bg-shift-color' : 'bg-primary',
                    )}
                    style={shiftColorStyle(viewBatch.colorHex)}
                  >
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="font-display text-lg">{viewBatch.templateName}</DialogTitle>
                    <DialogDescription className="flex items-center gap-1 text-xs">
                      <CalendarDays className="h-3 w-3" />
                      <span dir="ltr">{viewBatch.effectiveFrom ?? '—'}</span>
                      <span className="mx-1">·</span>
                      <span>{viewBatch.activeAssignments} نشط من {viewBatch.totalAssignments}</span>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="max-h-[60vh] overflow-y-auto py-2">
                <AssignmentEmployeeRows rows={viewBatch.rows} onUnlink={handleUnlink} onChange={handleChange} onCorrect={handleCorrect} />
              </div>

              <DialogFooter>
                <Button variant="luxe" onClick={() => { setViewBatchId(null); model.openEdit(viewBatch.batchId); }}>
                  <Clock className="h-4 w-4" /> تعديل
                </Button>
                <Button variant="outline" onClick={() => setViewBatchId(null)}>إغلاق</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit batch dialog ── */}
      <Dialog open={model.editOpen} onOpenChange={model.setEditOpen}>
        <DialogContent className="max-w-2xl border-border" dir="rtl">
          {model.editBatch && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground',
                      model.editBatch.colorHex ? 'bg-shift-color' : 'bg-primary',
                    )}
                    style={shiftColorStyle(model.editBatch.colorHex)}
                  >
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="font-display text-lg">تعديل الربط — {model.editBatch.templateName}</DialogTitle>
                    <DialogDescription className="text-xs">
                      غيّر دوام موظف من تاريخ، أو أنهِه بتاريخ. الأيام السابقة تبقى محسوبة على دوامها.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {model.editableRows.length > 0 && (
                  <FormField
                    label={`تاريخ البدء (${model.editableRows.length} دوام لم يبدأ بعد)`}
                    required
                  >
                    <DatePickerInput
                      value={model.editEffectiveFrom}
                      onChange={model.setEditEffectiveFrom}
                      minDate={ksaTodayIso()}
                    />
                  </FormField>
                )}

                <div className="space-y-2">
                  <Label className="text-sm">الموظفون المرتبطون</Label>
                  <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-border/60 p-2">
                    <AssignmentEmployeeRows rows={model.editBatch.rows} onUnlink={handleUnlink} onChange={handleChange} onCorrect={handleCorrect} />
                  </div>
                </div>
              </div>

              <DialogFooter className={dialogFormFooterClass}>
                {model.editableRows.length > 0 && (
                  <Button
                    variant="luxe"
                    type="button"
                    onClick={() => void model.submitEdit()}
                  >
                    حفظ التعديلات
                  </Button>
                )}
                <Button variant="outline" type="button" onClick={() => model.setEditOpen(false)}>إلغاء</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Future shift: delete ── */}
      <ConfirmationModal
        open={!!model.unlinkTarget && !model.unlinkTarget.started}
        onOpenChange={(open) => { if (!open && !model.unlinking) model.setUnlinkTarget(null); }}
        title="حذف دوام لم يبدأ"
        description={
          model.unlinkTarget
            ? `سيُحذف دوام «${model.unlinkTarget.employeeName}» الذي يبدأ في ${model.unlinkTarget.effectiveFrom}. لم يبدأ بعد، فلا يتأثر أي يوم محسوب.`
            : ''
        }
        confirmLabel={model.unlinking ? 'جاري الحذف…' : 'حذف'}
        variant="destructive"
        onConfirm={() => void model.confirmUnlink()}
      />

      {/* ── Started shift: end on a date ── */}
      <Dialog
        open={!!model.unlinkTarget && model.unlinkTarget.started}
        onOpenChange={(open) => { if (!open && !model.unlinking) model.setUnlinkTarget(null); }}
      >
        <DialogContent className="max-w-sm border-border" dir="rtl">
          <DialogHeader>
            <DialogTitle>إنهاء الدوام — {model.unlinkTarget?.employeeName}</DialogTitle>
            <DialogDescription className="text-xs">
              اختر آخر يوم في هذا الدوام. الأيام حتى هذا التاريخ تبقى محسوبة عليه، وبعده يصبح الموظف بلا دوام حتى يُسند له دوام جديد.
              لنقله إلى دوام آخر استعمل «تغيير الدوام».
            </DialogDescription>
          </DialogHeader>
          <FormField label="آخر يوم في الدوام" required>
            <DatePickerInput
              value={model.endDate}
              onChange={model.setEndDate}
              minDate={model.unlinkTarget?.effectiveFrom}
            />
          </FormField>
          <DialogFooter className={dialogFormFooterClass}>
            <Button
              variant="destructive"
              type="button"
              disabled={!model.endDate || model.unlinking}
              onClick={() => void model.confirmUnlink()}
            >
              {model.unlinking ? 'جاري الحفظ…' : 'إنهاء الدوام'}
            </Button>
            <Button variant="outline" type="button" onClick={() => model.setUnlinkTarget(null)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Retroactive template correction ── */}
      <Dialog
        open={!!model.correctTarget}
        onOpenChange={(open) => { if (!open && !model.correcting) model.setCorrectTarget(null); }}
      >
        <DialogContent className="max-w-md border-border" dir="rtl">
          <DialogHeader>
            <DialogTitle>تصحيح الدوام بأثر رجعي — {model.correctTarget?.employeeName}</DialogTitle>
            <DialogDescription className="text-xs">
              استعمله فقط إذا كان القالب خاطئاً من أول يوم (مثلاً «صباحي» لموظفة تعمل مساءً).
              لنقل موظف إلى دوام آخر من تاريخ استعمل «تغيير الدوام».
            </DialogDescription>
          </DialogHeader>
          {!model.correctPreview ? (
            <p className="py-6 text-center text-sm text-muted-foreground">جاري حساب الأيام المتأثرة…</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs leading-6">
                {model.correctPreview.affectedDays > 0 ? (
                  <>
                    ستُعاد حسبة <b>{model.correctPreview.affectedDays}</b> يوماً
                    من <span dir="ltr">{model.correctPreview.from}</span> إلى{' '}
                    <span dir="ltr">{model.correctPreview.to}</span> على القالب الجديد.
                    {model.correctPreview.manualOverrideDays > 0 && (
                      <> منها {model.correctPreview.manualOverrideDays} يوماً بتعديل يدوي لن تتغير.</>
                    )}
                  </>
                ) : (
                  'هذا الدوام لم يبدأ بعد، فلا يتغير أي يوم.'
                )}
              </div>
              {model.correctPreview.lockedPeriods.length > 0 && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  لا يمكن التصحيح: الفترة تمس رواتب مقفلة ({model.correctPreview.lockedPeriods.join('، ')}). أعد فتحها أولاً.
                </p>
              )}
              <FormField label="القالب الصحيح" required>
                <Select value={model.correctTemplateId} onValueChange={model.setCorrectTemplateId}>
                  <SelectTrigger><SelectValue placeholder="اختر القالب" /></SelectTrigger>
                  <SelectContent>
                    {model.activeTemplates
                      .filter((t) => t.id !== model.correctTarget?.templateId)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.nameAr}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="سبب التصحيح" required>
                <Textarea
                  value={model.correctReason}
                  onChange={(e) => model.setCorrectReason(e.target.value)}
                  placeholder="مثال: الموظفة تعمل مساءً منذ مباشرتها، وأُسند لها الصباحي بالخطأ"
                  className="min-h-[64px] resize-none text-sm"
                />
              </FormField>
            </div>
          )}
          <DialogFooter className={dialogFormFooterClass}>
            <Button
              variant="destructive"
              type="button"
              disabled={
                !model.correctPreview ||
                model.correctPreview.lockedPeriods.length > 0 ||
                !model.correctTemplateId ||
                model.correctReason.trim().length < 3 ||
                model.correcting
              }
              onClick={() => void model.submitCorrect()}
            >
              {model.correcting ? 'جاري التصحيح…' : 'تصحيح وإعادة الحساب'}
            </Button>
            <Button variant="outline" type="button" onClick={() => model.setCorrectTarget(null)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Change shift from a date ── */}
      <Dialog
        open={!!model.changeTarget}
        onOpenChange={(open) => { if (!open && !model.changing) model.setChangeTarget(null); }}
      >
        <DialogContent className="max-w-sm border-border" dir="rtl">
          <DialogHeader>
            <DialogTitle>تغيير الدوام — {model.changeTarget?.employeeName}</DialogTitle>
            <DialogDescription className="text-xs">
              يبدأ الدوام الجديد من التاريخ المختار، ويُنهى الدوام الحالي في اليوم الذي قبله.
              الأيام السابقة تبقى محسوبة على الدوام القديم.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="الدوام الجديد" required>
              <Select value={model.changeTemplateId} onValueChange={model.setChangeTemplateId}>
                <SelectTrigger><SelectValue placeholder="اختر القالب" /></SelectTrigger>
                <SelectContent>
                  {model.activeTemplates
                    .filter((t) => t.id !== model.changeTarget?.templateId)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nameAr}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="أول يوم في الدوام الجديد" required>
              <DatePickerInput
                value={model.changeFrom}
                onChange={model.setChangeFrom}
                minDate={model.changeTarget ? addDaysIso(model.changeTarget.effectiveFrom, 1) : undefined}
              />
            </FormField>
            {model.changeFrom && model.changeFrom < ksaTodayIso() && (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                التاريخ في الماضي: ستُعاد حسبة الأيام من {model.changeFrom} إلى اليوم على الدوام الجديد.
              </p>
            )}
          </div>
          <DialogFooter className={dialogFormFooterClass}>
            <Button
              variant="luxe"
              type="button"
              disabled={!model.changeTemplateId || !model.changeFrom || model.changing}
              onClick={() => void model.submitChange()}
            >
              {model.changing ? 'جاري الحفظ…' : 'تغيير الدوام'}
            </Button>
            <Button variant="outline" type="button" onClick={() => model.setChangeTarget(null)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
