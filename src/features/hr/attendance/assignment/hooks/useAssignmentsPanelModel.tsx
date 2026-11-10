'use client';

import * as React from 'react';
import type { AssignmentTargetType } from '@/features/hr/attendance/lib/types';
import type { MultiSelectOption } from '@/components/ui/multi-select';
import { useServerDirectoryPagination } from '@/components/ui/paged-list';
import { shiftTemplatesApi, type ShiftTemplateResponseDto } from '@/features/hr/attendance/lib/api/shift-templates';
import {
  hasShiftStarted,
  ksaTodayIso,
  shiftAssignmentsApi,
  type ShiftTemplateCorrectionPreview,
  type GroupedByTemplateItem,
  type UnassignedEmployeeResponseDto,
} from '@/features/hr/attendance/lib/api/shift-assignments';
import { fetchAllPaginatedItems } from '@/features/hr/lib/api/client';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { organizationActiveListStatusQuery } from '@/features/hr/organization/lib/archive-scope';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { toast } from 'sonner';
import { hrFiltersKey } from '@/features/hr/lib/use-persisted-filter-state';
import { employeeStatusQuery, useEmployeeStatusFilter } from '@/features/hr/lib/employee-status-filter';

type BatchRow = {
  id: string;
  batchId?: string;
  templateId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  targetType: AssignmentTargetType;
  targetId: string;
  targetLabel: string;
  employeeCode: string;
  isActive: boolean;
};

/** A started shift is ended by date, never deleted: its days stay computed. */
export type ShiftRowAction = {
  assignmentId: string;
  employeeId: string;
  employeeName: string;
  templateId: string;
  effectiveFrom: string;
};

type Batch = {
  batchId: string;
  rows: BatchRow[];
  templateId: string | undefined;
  templateName: string;
  colorHex: string;
  effectiveFrom: string | undefined;
  totalAssignments: number;
  activeAssignments: number;
};

function mapGroupedToBatch(group: GroupedByTemplateItem): Batch {
  return {
    batchId: group.shiftTemplate.id,
    templateId: group.shiftTemplate.id,
    templateName: group.shiftTemplate.nameAr,
    colorHex: group.shiftTemplate.colorHex,
    effectiveFrom: group.employees[0]?.effectiveFrom,
    totalAssignments: group.totalAssignments,
    activeAssignments: group.activeAssignments,
    rows: group.employees.map((emp) => ({
      id: emp.assignmentId,
      batchId: emp.batchId ?? undefined,
      templateId: group.shiftTemplate.id,
      effectiveFrom: emp.effectiveFrom,
      effectiveTo: emp.effectiveTo ?? null,
      targetType: 'employee' as AssignmentTargetType,
      targetId: emp.employeeId,
      targetLabel: emp.employeeNameAr,
      employeeCode: emp.employeeCode,
      isActive: emp.isActive,
    })),
  };
}

export function useAssignmentsPanelModel() {
  const companyId = useDefaultCompanyId() ?? '';

  const [shiftTemplates, setShiftTemplates] = React.useState<ShiftTemplateResponseDto[]>([]);
  const [unassignedEmployees, setUnassignedEmployees] = React.useState<UnassignedEmployeeResponseDto[]>([]);
  const [loadingUnassigned, setLoadingUnassigned] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [templateId, setTemplateId] = React.useState('');
  const [effectiveFrom, setEffectiveFrom] = React.useState(() => ksaTodayIso());
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const [editOpen, setEditOpen] = React.useState(false);
  const [editBatchId, setEditBatchId] = React.useState<string | null>(null);
  const [editEffectiveFrom, setEditEffectiveFrom] = React.useState('');
  /** End (started shift) or delete (future shift) one employee's shift. */
  const [unlinkTarget, setUnlinkTarget] = React.useState<(ShiftRowAction & { started: boolean }) | null>(null);
  const [endDate, setEndDate] = React.useState(() => ksaTodayIso());
  const [unlinking, setUnlinking] = React.useState(false);
  /** «تغيير الدوام من تاريخ» for one employee. */
  const [changeTarget, setChangeTarget] = React.useState<ShiftRowAction | null>(null);
  const [changeTemplateId, setChangeTemplateId] = React.useState('');
  const [changeFrom, setChangeFrom] = React.useState(() => ksaTodayIso());
  const [changing, setChanging] = React.useState(false);
  /** «تصحيح الدوام بأثر رجعي»: wrong template from the first day. */
  const [correctTarget, setCorrectTarget] = React.useState<ShiftRowAction | null>(null);
  const [correctTemplateId, setCorrectTemplateId] = React.useState('');
  const [correctReason, setCorrectReason] = React.useState('');
  const [correctPreview, setCorrectPreview] = React.useState<ShiftTemplateCorrectionPreview | null>(null);
  const [correcting, setCorrecting] = React.useState(false);
  const [employeeStatus, setEmployeeStatus] = useEmployeeStatusFilter(
    hrFiltersKey('attendance', 'shift-assignments', companyId, 'employeeStatus'),
  );

  const loadPage = React.useCallback(async (page: number, pageSize: number) => {
    if (!companyId) return { items: [] as Batch[], total: 0 };
    try {
      const res = await shiftAssignmentsApi.getGroupedByTemplate({
        companyId,
        page,
        limit: pageSize,
        ...employeeStatusQuery(employeeStatus),
      });
      return { items: res.items.map(mapGroupedToBatch), total: res.pagination.total };
    } catch {
      return { items: [], total: 0 };
    }
  }, [companyId, employeeStatus]);

  const {
    items: batches,
    loading,
    pagination,
    reload: reloadAssignments,
  } = useServerDirectoryPagination<Batch>(loadPage, {
    enabled: !!companyId,
    resetDeps: [companyId, employeeStatus],
  });

  /** Every template group (all pages) with its employee assignments, for export. */
  const loadAllForExport = React.useCallback(async (): Promise<Batch[]> => {
    if (!companyId) return [];
    const { items } = await fetchAllPaginatedItems((page, limit) =>
      shiftAssignmentsApi.getGroupedByTemplate({ companyId, page, limit, ...employeeStatusQuery(employeeStatus) }),
    );
    return items.map(mapGroupedToBatch);
  }, [companyId, employeeStatus]);

  React.useEffect(() => {
    if (!companyId) return;
    void shiftTemplatesApi.getAll({ limit: 200, companyId, ...organizationActiveListStatusQuery() })
      .then((res) => setShiftTemplates(res.items))
      .catch(() => setShiftTemplates([]));
  }, [companyId]);

  const reloadUnassignedEmployees = React.useCallback(async (asOfDate: string) => {
    if (!companyId) {
      setUnassignedEmployees([]);
      return;
    }
    setLoadingUnassigned(true);
    try {
      const res = await fetchAllPaginatedItems((page, limit) =>
        shiftAssignmentsApi.getUnassignedEmployees({ companyId, asOfDate, page, limit }),
      );
      setUnassignedEmployees(res.items);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'shift-assignments.unassigned-employees');
      toast.error(displayMessage);
      setUnassignedEmployees([]);
    } finally {
      setLoadingUnassigned(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    if (!open || !companyId) return;
    void reloadUnassignedEmployees(effectiveFrom);
  }, [open, companyId, effectiveFrom, reloadUnassignedEmployees]);

  const activeTemplates = React.useMemo(() => shiftTemplates.filter((t) => t.isActive), [shiftTemplates]);

  const openNew = React.useCallback(() => {
    setTemplateId(activeTemplates[0]?.id ?? '');
    setEffectiveFrom(ksaTodayIso());
    setSelectedIds(new Set());
    setOpen(true);
  }, [activeTemplates]);

  const submit = React.useCallback(async () => {
    if (!templateId || selectedIds.size === 0 || !companyId) return;

    const employeeIds = [...selectedIds];
    if (employeeIds.length === 0) return;

    try {
      await shiftAssignmentsApi.bulkCreate({
        companyId,
        shiftTemplateId: templateId,
        employeeIds,
        effectiveFrom,
        isActive: true,
      });
      await reloadAssignments();
      toast.success('تم ربط الموظفين بالقالب');
      setOpen(false);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'shift-assignments.bulk-create');
      toast.error(displayMessage);
    }
  }, [templateId, selectedIds, companyId, effectiveFrom, reloadAssignments]);

  const editBatch = React.useMemo(
    () => (editBatchId ? batches.find((b) => b.batchId === editBatchId) ?? null : null),
    [batches, editBatchId],
  );

  const openEdit = React.useCallback((batchId: string) => {
    const batch = batches.find((b) => b.batchId === batchId);
    if (!batch) return;
    setEditBatchId(batchId);
    setEditEffectiveFrom(batch.effectiveFrom ?? ksaTodayIso());
    setEditOpen(true);
  }, [batches]);

  /**
   * Only shifts that have not started yet can move their start date here: a
   * started shift's start is history (change the shift from a date instead).
   */
  const editableRows = React.useMemo(
    () => (editBatch?.rows ?? []).filter((r) => !hasShiftStarted(r.effectiveFrom)),
    [editBatch],
  );

  const submitEdit = React.useCallback(async () => {
    if (!editBatchId || !editBatch) return;
    if (editableRows.length === 0) {
      setEditOpen(false);
      return;
    }
    try {
      await Promise.all(
        editableRows.map((row) =>
          shiftAssignmentsApi.update(row.id, { effectiveFrom: editEffectiveFrom }),
        ),
      );
      await reloadAssignments();
      toast.success('تم حفظ التعديلات');
      setEditOpen(false);
      setEditBatchId(null);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'shift-assignments.update');
      toast.error(displayMessage);
    }
  }, [editBatchId, editBatch, editableRows, editEffectiveFrom, reloadAssignments]);

  const requestUnlink = React.useCallback((row: ShiftRowAction) => {
    const today = ksaTodayIso();
    setUnlinkTarget({ ...row, started: hasShiftStarted(row.effectiveFrom, today) });
    setEndDate(today);
  }, []);

  const requestChange = React.useCallback((row: ShiftRowAction) => {
    setChangeTarget(row);
    setChangeTemplateId(activeTemplates.find((t) => t.id !== row.templateId)?.id ?? '');
    setChangeFrom(ksaTodayIso());
  }, [activeTemplates]);

  const submitChange = React.useCallback(async () => {
    if (!changeTarget || !changeTemplateId || !changeFrom || !companyId) return;
    setChanging(true);
    try {
      await shiftAssignmentsApi.changeShift({
        companyId,
        employeeId: changeTarget.employeeId,
        shiftTemplateId: changeTemplateId,
        effectiveFrom: changeFrom,
      });
      await reloadAssignments();
      toast.success(`تم تغيير دوام ${changeTarget.employeeName} من ${changeFrom}`);
      setChangeTarget(null);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'shift-assignments.change');
      toast.error(displayMessage);
    } finally {
      setChanging(false);
    }
  }, [changeTarget, changeTemplateId, changeFrom, companyId, reloadAssignments]);

  const requestCorrect = React.useCallback((row: ShiftRowAction) => {
    setCorrectTarget(row);
    setCorrectTemplateId(activeTemplates.find((t) => t.id !== row.templateId)?.id ?? '');
    setCorrectReason('');
    setCorrectPreview(null);
    void shiftAssignmentsApi
      .previewTemplateCorrection(row.assignmentId)
      .then(setCorrectPreview)
      .catch((err) => {
        const { displayMessage } = handleApiError(err, 'shift-assignments.template-correction');
        toast.error(displayMessage);
        setCorrectTarget(null);
      });
  }, [activeTemplates]);

  const submitCorrect = React.useCallback(async () => {
    if (!correctTarget || !correctTemplateId || !correctPreview) return;
    setCorrecting(true);
    try {
      await shiftAssignmentsApi.correctTemplate(correctTarget.assignmentId, {
        shiftTemplateId: correctTemplateId,
        reason: correctReason.trim(),
        expectedAffectedDays: correctPreview.affectedDays,
      });
      await reloadAssignments();
      toast.success(`تم تصحيح دوام ${correctTarget.employeeName} وإعادة حساب ${correctPreview.affectedDays} يوماً`);
      setCorrectTarget(null);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'shift-assignments.template-correction');
      toast.error(displayMessage);
    } finally {
      setCorrecting(false);
    }
  }, [correctTarget, correctTemplateId, correctPreview, correctReason, reloadAssignments]);

  const confirmUnlink = React.useCallback(async () => {
    if (!unlinkTarget) return;
    setUnlinking(true);
    try {
      if (unlinkTarget.started) {
        // The last working day on this shift; the days before stay computed.
        await shiftAssignmentsApi.update(unlinkTarget.assignmentId, { effectiveTo: endDate });
        toast.success(`انتهى دوام ${unlinkTarget.employeeName} في ${endDate}`);
      } else {
        await shiftAssignmentsApi.remove(unlinkTarget.assignmentId);
        toast.success(`تم حذف الدوام المستقبلي لـ ${unlinkTarget.employeeName}`);
      }
      await reloadAssignments();
      setUnlinkTarget(null);

      const remaining = editBatch?.rows.filter((r) => r.id !== unlinkTarget.assignmentId) ?? [];
      if (editOpen && remaining.length === 0) {
        setEditOpen(false);
        setEditBatchId(null);
      }
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'shift-assignments.remove');
      toast.error(displayMessage);
    } finally {
      setUnlinking(false);
    }
  }, [unlinkTarget, endDate, reloadAssignments, editBatch, editOpen]);

  /** Deletes a batch only while none of its shifts has started (the card hides it otherwise). */
  const removeAssignmentBatch = React.useCallback(async (batchId: string) => {
    const batch = batches.find((b) => b.batchId === batchId);
    if (!batch) return;
    if (batch.rows.some((row) => hasShiftStarted(row.effectiveFrom))) {
      toast.error('لا يمكن حذف دوام بدأ. أنهِ دوام كل موظف بتاريخ بدلاً من الحذف.');
      return;
    }
    try {
      await Promise.all(batch.rows.map((row) => shiftAssignmentsApi.remove(row.id)));
      await reloadAssignments();
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'shift-assignments.remove');
      toast.error(displayMessage);
    }
  }, [batches, reloadAssignments]);

  const multiOptions = React.useMemo((): MultiSelectOption[] =>
    unassignedEmployees.map((e) => ({
      value: e.id,
      label: e.nameAr,
      subtitle: e.employeeCode,
    })),
  [unassignedEmployees]);

  React.useEffect(() => {
    const allowedIds = new Set(unassignedEmployees.map((e) => e.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => allowedIds.has(id)));
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
      return next;
    });
  }, [unassignedEmployees]);

  return {
    batches,
    loading,
    pagination,
    loadAllForExport,
    employeeStatus,
    setEmployeeStatus,
    shiftTemplates,
    removeAssignmentBatch,
    editBatch,
    openEdit,
    submitEdit,
    requestUnlink,
    confirmUnlink,
    unlinkTarget,
    setUnlinkTarget,
    unlinking,
    endDate,
    setEndDate,
    requestChange,
    submitChange,
    changeTarget,
    setChangeTarget,
    changeTemplateId,
    setChangeTemplateId,
    changeFrom,
    setChangeFrom,
    changing,
    requestCorrect,
    submitCorrect,
    correctTarget,
    setCorrectTarget,
    correctTemplateId,
    setCorrectTemplateId,
    correctReason,
    setCorrectReason,
    correctPreview,
    correcting,
    editOpen,
    setEditOpen,
    editEffectiveFrom,
    setEditEffectiveFrom,
    editableRows,
    open,
    setOpen,
    templateId,
    setTemplateId,
    effectiveFrom,
    setEffectiveFrom,
    selectedIds,
    setSelectedIds,
    activeTemplates,
    multiOptions,
    loadingUnassigned,
    openNew,
    submit,
  };
}

export type AssignmentsPanelModel = ReturnType<typeof useAssignmentsPanelModel>;
