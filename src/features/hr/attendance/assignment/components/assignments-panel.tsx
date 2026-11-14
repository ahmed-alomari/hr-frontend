'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import { CalendarDays, Clock, Link2Off, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerInput } from '@/components/ui/date-picker-input';
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

type AssignmentBatch = ReturnType<typeof useAssignmentsPanelModel>['batches'][number];

type AssignmentRow = {
  id: string;
  targetLabel: string;
  employeeCode: string;
  isActive: boolean;
};

function AssignmentEmployeeRows({
  rows,
  onUnlink,
}: {
  rows: AssignmentRow[];
  onUnlink: (assignmentId: string, employeeName: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">لا يوجد موظفون مرتبطون</p>;
  }

  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {row.targetLabel.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{row.targetLabel}</p>
            <p className="font-mono text-[10px] text-muted-foreground" dir="ltr">{row.employeeCode}</p>
          </div>
          <Badge variant={row.isActive ? 'success' : 'secondary'} className="shrink-0 text-[10px]">
            {row.isActive ? 'نشط' : 'غير نشط'}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => onUnlink(row.id, row.targetLabel)}
          >
            <Link2Off className="h-3 w-3" />
            إلغاء الربط
          </Button>
        </div>
      ))}
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
    (assignmentId: string, employeeName: string) => {
      model.requestUnlink(assignmentId, employeeName);
    },
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
  const batchColumns: ColumnDef<AssignmentBatch>[] = [
    { key: 'template', title: 'قالب الدوام', render: (b) => b.templateName },
    { key: 'total', title: 'الموظفون', render: (b) => String(b.totalAssignments) },
    { key: 'active', title: 'النشطون', render: (b) => String(b.activeAssignments) },
    { key: 'from', title: 'يسري من', render: (b) => exportDate(b.effectiveFrom) },
  ];
  const tools = useListTools<AssignmentBatch>({
    section: 'attendance',
    page: 'shift-assignments',
    columns: batchColumns,
    rows: model.batches,
    fetchAll: loadAllForExport,
    resetKey: model.pagination.resetKey,
    fields: {
      template: { kind: 'name', text: (b) => b.templateName },
      total: { text: (b) => String(b.totalAssignments), sort: (b) => b.totalAssignments, sum: (b) => b.totalAssignments },
      active: { text: (b) => String(b.activeAssignments), sort: (b) => b.activeAssignments, sum: (b) => b.activeAssignments },
      from: { kind: 'date', text: (b) => exportDate(b.effectiveFrom), sort: (b) => b.effectiveFrom ?? '', group: (b) => (b.effectiveFrom ? b.effectiveFrom.slice(0, 7) : null) },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={isEmployeeStatusFilterActive(employeeStatus) ? 1 : 0} />
        {tools.buttons}
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
    [employeeStatus, getExportRows, openNew, tools.depsKey],
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
        <ListToolsTable tools={tools} keyExtractor={(b) => b.batchId} onRowClick={(b) => setViewBatchId(b.batchId)}>
        <DirectoryPagedViews items={tools.rows} serverPagination={tools.pagination(model.pagination)} loading={model.loading || tools.loading}>
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
        </ListToolsTable>
      )}

      <AssignmentsBatchDialog model={model} />

      {/* ── Detail dialog ── */}
      <Dialog open={!!viewBatch} onOpenChange={(o) => !o && setViewBatchId(null)}>
        <DialogContent className="max-w-lg border-border" dir="rtl">
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
                <AssignmentEmployeeRows rows={viewBatch.rows} onUnlink={handleUnlink} />
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
        <DialogContent className="max-w-lg border-border" dir="rtl">
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
                      عدّل تاريخ التطبيق والحالة، أو ألغِ ربط موظفين من هذا القالب.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <FormField label="تاريخ التطبيق" required>
                  <DatePickerInput
                    value={model.editEffectiveFrom}
                    onChange={model.setEditEffectiveFrom}
                  />
                </FormField>

                <label className="flex cursor-pointer items-center justify-between rounded-xl border-2 px-4 py-3 transition-all border-border hover:bg-muted/20">
                  <span className="text-sm font-medium">مفعّل</span>
                  <Checkbox
                    checked={model.editIsActive}
                    onCheckedChange={(v) => model.setEditIsActive(v === true)}
                  />
                </label>

                <div className="space-y-2">
                  <Label className="text-sm">الموظفون المرتبطون</Label>
                  <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-border/60 p-2">
                    <AssignmentEmployeeRows rows={model.editBatch.rows} onUnlink={handleUnlink} />
                  </div>
                </div>
              </div>

              <DialogFooter className={dialogFormFooterClass}>
                <Button
                  variant="luxe"
                  type="button"
                  onClick={() => void model.submitEdit()}
                  disabled={!model.editBatch.rows.length}
                >
                  حفظ التعديلات
                </Button>
                <Button variant="outline" type="button" onClick={() => model.setEditOpen(false)}>إلغاء</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={!!model.unlinkTarget}
        onOpenChange={(open) => { if (!open && !model.unlinking) model.setUnlinkTarget(null); }}
        title="إلغاء ربط الموظف"
        description={
          model.unlinkTarget
            ? `هل أنت متأكد من إلغاء ربط «${model.unlinkTarget.employeeName}» بهذا القالب؟ لا يمكن التراجع عن هذا الإجراء.`
            : ''
        }
        confirmLabel={model.unlinking ? 'جاري الإلغاء…' : 'إلغاء الربط'}
        variant="destructive"
        onConfirm={() => void model.confirmUnlink()}
      />
    </div>
  );
}
