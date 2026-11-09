'use client';

import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import { Trash2, CalendarDays, Edit3, Plus, AlertTriangle, Scale, Search } from 'lucide-react';
import { EntityActionCard, EntityActionCardChip, EntityActionCardGrid, EntityActionCardGridSkeleton, type WorkflowStatusTone } from '@/components/ui/entity-action-card';
import { toast } from 'sonner';
import { cn, formatDisplayDateTime } from '@/shared/utils';
import { AR_VIOLATION_RECORD_STATUS_LABELS } from '@/shared/i18n/ar';
import { STATUS_PILL, VIOLATION_RECORD_STATUS_PILL } from '@/shared/status-pill-classes';
import { Button } from '@/components/ui/button';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, dialogFormFooterClass } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmationModal, HRSettingsFormDrawer, FormField, EmptyState, SearchableDropdown } from '@/components/ui/shared-dialogs';
import { useViolationCasesDirectoryModel } from '@/features/hr/discipline/violation-cases/hooks/useViolationCasesDirectoryModel';
import type { ViolationCaseRecord } from '@/features/hr/discipline/violation-cases/hooks/useViolationCasesDirectoryModel';
import { type ViolationRecordStatus } from '@/features/hr/discipline/lib/api/violation-records';
import { INVESTIGATION_DEDUCTION_TYPE_LABELS, INVESTIGATION_RECOMMENDATION_LABELS, INVESTIGATION_RESULT_LABELS } from '@/features/hr/discipline/lib/types';
import { ListFilterBar, type ListFilterBarHandle, type ListFilterInlineSelect } from '@/components/ui/list-filter-bar';
import { useDisciplineDateFilterState } from '@/features/hr/discipline/lib/use-discipline-date-filter-state';
import { PdfPreviewExportDialog } from '@/components/pdf/pdf-preview-export-dialog';
import { PdfPreviewDownloadButton } from '@/components/pdf/pdf-preview-download-button';
import { DisciplineLetterPrintHtml } from '@/components/pdf/print/discipline-letter-print-html';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { disciplineNoticesApi } from '@/features/hr/discipline/lib/api/discipline-notices';
import { ViolationInvestigationDrawer } from '@/features/hr/discipline/investigations/dialogs/violation-investigation-drawer';
import { disciplineAppealsApi } from '@/features/hr/discipline/lib/api/discipline-appeals';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { useCurrentEmployee } from '@/features/hr/organization/employees/hooks/useCurrentEmployee';
import { checkViolationApprovalAccess } from '@/features/hr/discipline/lib/violation-approval-access';
import { applyViolationApproverDecision, buildViolationDecisionPayload, getViolationApprovalUiState, isEmployeeInViolationApproverStates, isViolationFullyApproved } from '@/features/hr/discipline/lib/violation-approver-states';
import { ViolationApproverStatesPanel } from '@/features/hr/discipline/violation-cases/components/violation-approver-states-panel';
import { ViolationApprovalActionButtons, ViolationApprovalActionCell } from '@/features/hr/discipline/violation-cases/components/violation-approval-actions';
import { RequestApproversInline } from '@/features/hr/requests/components/request-approvers-inline';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { RelatedEmployeeAttachments } from '@/features/hr/organization/employees/components/related-employee-attachments';
import { useDefaultCompany } from '@/features/hr/organization/hooks/useActiveCompany';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { TableDateCell, TableRowActions } from '@/components/ui/table-cells';
import { DisciplineListViewport, DisciplinePaginatedList } from '@/features/hr/discipline/components/discipline-paginated-list';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ViolationRecordStatus, string> = AR_VIOLATION_RECORD_STATUS_LABELS;

const STATUS_COLORS: Record<ViolationRecordStatus, string> = VIOLATION_RECORD_STATUS_PILL;

const VIOLATION_STATUS_TONE: Record<ViolationRecordStatus, WorkflowStatusTone> = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  needs_edit: 'warning',
};

const STATUS_ORDER: readonly ViolationRecordStatus[] = ['pending', 'approved', 'rejected', 'needs_edit'];
type StatusFilter = 'all' | ViolationRecordStatus;
type ViolationViewMode = 'cards' | 'list';

function canMutateViolationCase(status: ViolationRecordStatus) {
  return status === 'pending' || status === 'needs_edit';
}

function canAddDisciplineFollowUp(status: ViolationRecordStatus) {
  return status !== 'approved';
}

// ─── Notice dialog (إنذار) ────────────────────────────────────────────────────

type NoticeKind = 'verbal' | 'first' | 'second' | 'final';
const NOTICE_KIND_LABELS: Record<NoticeKind, string> = {
  verbal: 'شفهي', first: 'إنذار أول', second: 'إنذار ثاني', final: 'إنذار نهائي',
};

function NoticeDialog({
  open, onClose, violationCase, companyId,
}: {
  open: boolean; onClose: () => void;
  violationCase: ViolationCaseRecord | null;
  companyId: string;
}) {
  const [kind, setKind] = React.useState<NoticeKind>('first');
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setKind('first');
      setDate(new Date().toISOString().slice(0, 10));
      setReason(violationCase ? `مخالفة: ${violationCase.typeNameAr} — ${violationCase.caseNumber}` : '');
    }
  }, [open, violationCase]);

  const handleSave = async () => {
    if (!violationCase || !companyId) return;
    setSaving(true);
    try {
      await disciplineNoticesApi.create({
        companyId,
        employeeId: violationCase.employeeId,
        noticeKind: kind,
        reasonAr: reason.trim() || `مخالفة: ${violationCase.typeNameAr}`,
        noticeDate: date,
        violationRecordId: violationCase.id,
      });
      toast.success('تم إنشاء الإنذار');
      onClose();
    } catch { toast.error('فشل إنشاء الإنذار'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right text-base">
            <AlertTriangle className="h-4 w-4 text-warning" />
            إصدار إنذار
          </DialogTitle>
          <DialogDescription className="text-right text-xs text-muted-foreground">
            {violationCase?.caseNumber} · {violationCase?.employeeNameAr}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <FormField label="نوع الإنذار" required>
            <Select value={kind} onValueChange={(v) => setKind(v as NoticeKind)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(NOTICE_KIND_LABELS) as [NoticeKind, string][]).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="تاريخ الإنذار" required>
            <DatePickerInput value={date} onChange={setDate} />
          </FormField>
          <FormField label="سبب الإنذار" required>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </FormField>
        </div>
        <DialogFooter className={dialogFormFooterClass}>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            إصدار الإنذار
          </Button>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Appeal dialog (تظلم) ─────────────────────────────────────────────────────

function AppealDialog({
  open, onClose, violationCase, companyId,
}: {
  open: boolean; onClose: () => void;
  violationCase: ViolationCaseRecord | null;
  companyId: string;
}) {
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [grounds, setGrounds] = React.useState('');
  const [channel, setChannel] = React.useState<string>('written');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) { setDate(new Date().toISOString().slice(0, 10)); setGrounds(''); setChannel('written'); }
  }, [open]);

  const handleSave = async () => {
    if (!violationCase || !companyId) return;
    if (!grounds.trim()) { toast.error('أسباب التظلم مطلوبة'); return; }
    setSaving(true);
    try {
      await disciplineAppealsApi.create({
        companyId,
        violationRecordId: violationCase.id,
        appealDate: date,
        groundsAr: grounds.trim(),
        channel: channel as 'in_person' | 'written' | 'email' | 'phone' | 'system',
        status: 'pending',
      });
      toast.success('تم تقديم التظلم');
      onClose();
    } catch { toast.error('فشل تقديم التظلم'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right text-base">
            <Scale className="h-4 w-4 text-primary" />
            تقديم تظلم
          </DialogTitle>
          <DialogDescription className="text-right text-xs text-muted-foreground">
            {violationCase?.caseNumber} · {violationCase?.employeeNameAr}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <FormField label="تاريخ التظلم" required>
            <DatePickerInput value={date} onChange={setDate} />
          </FormField>
          <FormField label="قناة التظلم">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="written">خطي</SelectItem>
                <SelectItem value="in_person">شخصي</SelectItem>
                <SelectItem value="email">بريد إلكتروني</SelectItem>
                <SelectItem value="phone">هاتف</SelectItem>
                <SelectItem value="system">النظام</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="أسباب التظلم" required>
            <textarea
              value={grounds}
              onChange={(e) => setGrounds(e.target.value)}
              placeholder="اكتب أسباب التظلم…"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </FormField>
        </div>
        <DialogFooter className={dialogFormFooterClass}>
          <Button variant="luxe" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            تقديم التظلم
          </Button>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Type requirement badges ──────────────────────────────────────────────────

function TypeRequirementBadges({ needsWarning, needsInvestigation }: { needsWarning: boolean; needsInvestigation: boolean }) {
  if (!needsWarning && !needsInvestigation) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {needsInvestigation ? (
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', STATUS_PILL.info)}>
          <Search className="h-3 w-3" />
          يحتاج تحقيق
        </span>
      ) : null}
      {needsWarning ? (
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', STATUS_PILL.warning)}>
          <AlertTriangle className="h-3 w-3" />
          يحتاج إنذار
        </span>
      ) : null}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CreateForm {
  employeeId: string; date: string; violationTypeId: string;
  description: string; notes: string; attachmentsNote: string;
}
const CREATE_EMPTY: CreateForm = { employeeId: '', date: '', violationTypeId: '', description: '', notes: '', attachmentsNote: '' };

interface EditForm { date: string; description: string; notes: string; attachmentsNote: string; }

export function ViolationCasesClient() {
  const hook = useViolationCasesDirectoryModel();
  const { employees, violationTypes, loading, listError, accessDenied, createCase, updateCase, decideCase, deleteCase, reload, setListFilters, items, pagination, filteredItems, sourceCases } = hook;
  const companyId = useDefaultCompanyId() ?? '';
  const { data: defaultCompany } = useDefaultCompany();
  const { data: currentEmployee } = useCurrentEmployee();
  const currentEmployeeId = currentEmployee?.id ?? null;
  const authUser = useAuthStore((s) => s.user);
  const decidedByActor = authUser?.email ?? authUser?.id ?? null;
  const companyNameAr = defaultCompany?.nameAr ?? '';
  const companyNameEn = defaultCompany?.nameEn ?? '';

  const [selectedEmpIds, setSelectedEmpIds] = React.useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = React.useState<ViolationViewMode>('cards');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [violationTypeFilter, setViolationTypeFilter] = React.useState('all');
  const { dateBounds, dateMeta, onDateBoundsChange, onDateFilterMetaChange } = useDisciplineDateFilterState();
  const filterToolbarRef = React.useRef<ListFilterBarHandle>(null);

  const [casePrintOpen, setCasePrintOpen] = React.useState(false);
  const [casePrintRecord, setCasePrintRecord] = React.useState<ViolationCaseRecord | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<CreateForm>(CREATE_EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [viewCase, setViewCase] = React.useState<ViolationCaseRecord | null>(null);
  const [editCase, setEditCase] = React.useState<ViolationCaseRecord | null>(null);
  const [editForm, setEditForm] = React.useState<EditForm>({ date: '', description: '', notes: '', attachmentsNote: '' });
  const [editSaving, setEditSaving] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const [rejectCase, setRejectCase] = React.useState<ViolationCaseRecord | null>(null);
  const [rejectNote, setRejectNote] = React.useState('');
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  // Post-create action dialogs
  const [noticeCase, setNoticeCase] = React.useState<ViolationCaseRecord | null>(null);
  const [investigationCase, setInvestigationCase] = React.useState<ViolationCaseRecord | null>(null);
  const [appealCase, setAppealCase] = React.useState<ViolationCaseRecord | null>(null);

  // Sync toolbar filters to list model
  React.useEffect(() => {
    setListFilters({
      selectedEmpIds: [...selectedEmpIds],
      statusFilter,
      violationTypeFilter,
      dateFrom: dateBounds.from,
      dateTo: dateBounds.to,
    });
  }, [selectedEmpIds, statusFilter, violationTypeFilter, dateBounds.from, dateBounds.to, setListFilters]);
  const selectedType = React.useMemo(
    () => violationTypes.find((t) => t.id === draft.violationTypeId) ?? null,
    [violationTypes, draft.violationTypeId],
  );

  const listFiltered = filteredItems;

  const typeInlineOptions = React.useMemo(
    () => [
      { value: 'all', label: 'جميع الأنواع' },
      ...violationTypes.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.nameAr })),
    ],
    [violationTypes],
  );

  const inlineSelects = React.useMemo((): ListFilterInlineSelect[] => [
    {
      id: 'violationType',
      value: violationTypeFilter,
      onChange: setViolationTypeFilter,
      placeholder: 'نوع المخالفة',
      className: 'w-[10rem]',
      options: typeInlineOptions,
    },
  ], [violationTypeFilter, typeInlineOptions]);

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: sourceCases.length };
    for (const s of STATUS_ORDER) counts[s] = 0;
    for (const c of sourceCases) counts[c.status] = (counts[c.status] ?? 0) + 1;
    return counts;
  }, [sourceCases]);

  const dateRangeActive = dateMeta.hasRestriction;
  const activeFilterCount =
    (selectedEmpIds.size > 0 ? 1 : 0)
    + (statusFilter !== 'all' ? 1 : 0)
    + (violationTypeFilter !== 'all' ? 1 : 0)
    + (dateRangeActive ? 1 : 0);


  const casePrintable = React.useMemo(
    () =>
      casePrintRecord ? (
        <DisciplineLetterPrintHtml
          companyNameAr={companyNameAr}
          companyNameEn={companyNameEn}
          titleAr={`محضر مخالفة ${casePrintRecord.caseNumber}`}
          rows={[
            { label: 'رقم المخالفة', value: casePrintRecord.caseNumber },
            { label: 'الموظف', value: casePrintRecord.employeeNameAr },
            { label: 'نوع المخالفة', value: casePrintRecord.typeNameAr },
            { label: 'التاريخ', value: casePrintRecord.date },
            { label: 'الحالة', value: STATUS_LABELS[casePrintRecord.status] },
          ]}
          bodyAr={[
            casePrintRecord.description.trim() ? `الوصف:\n${casePrintRecord.description.trim()}` : '',
            casePrintRecord.notes?.trim() ? `ملاحظات:\n${casePrintRecord.notes.trim()}` : '',
          ].filter(Boolean).join('\n\n')}
        />
      ) : null,
    [casePrintRecord, companyNameAr, companyNameEn],
  );

  const empOptions = employees.map(e => ({ value: e.id, label: e.nameAr }));
  const typeOptions = violationTypes.filter(t => t.isActive).map(t => ({ value: t.id, label: t.nameAr, sub: t.code }));
  const setD = (patch: Partial<CreateForm>) => setDraft(d => ({ ...d, ...patch }));

  // After creating a violation, check if type needs notice/investigation and prompt
  const handleCreate = async () => {
    setFormError(null);
    if (!draft.employeeId)         { setFormError('الموظف مطلوب'); return; }
    if (!draft.violationTypeId)    { setFormError('نوع المخالفة مطلوب'); return; }
    if (!draft.date)               { setFormError('التاريخ مطلوب'); return; }
    if (!draft.description.trim()) { setFormError('الوصف مطلوب'); return; }
    setSaving(true);
    try {
      await createCase({
        employeeId: draft.employeeId,
        violationTypeId: draft.violationTypeId,
        date: draft.date,
        description: draft.description,
        notes: draft.notes || null,
        attachmentsNote: draft.attachmentsNote || null,
      });
      toast.success('تم حفظ المخالفة');
      setCreateOpen(false);

      // After save, reload gives us the new case — find it from the updated list
      // We use a small delay then open the contextual dialog
      const type = violationTypes.find((t) => t.id === draft.violationTypeId);
      if (type?.needsInvestigation || type?.needsWarning) {
        toast.info(
          type.needsInvestigation && type.needsWarning
            ? 'هذا النوع يتطلب تحقيقاً وإنذاراً — يمكنك إضافتهما من البطاقة'
            : type.needsInvestigation
              ? 'هذا النوع يتطلب فتح تحقيق — يمكنك إضافته من البطاقة'
              : 'هذا النوع يتطلب إصدار إنذار — يمكنك إضافته من البطاقة',
          { duration: 5000 },
        );
      }
      setDraft(CREATE_EMPTY);
    } catch {
      setFormError('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c: ViolationCaseRecord) => {
    setEditCase(c);
    setEditForm({ date: c.date, description: c.description, notes: c.notes ?? '', attachmentsNote: c.attachmentsNote ?? '' });
    setEditError(null);
  };

  const handleEdit = async () => {
    if (!editCase) return;
    setEditError(null);
    if (!editForm.description.trim()) { setEditError('الوصف مطلوب'); return; }
    setEditSaving(true);
    try {
      await updateCase(editCase.id, {
        violationDate: editForm.date,
        description: editForm.description,
        notes: editForm.notes || null,
        attachmentsNote: editForm.attachmentsNote || null,
      });
      toast.success('تم تحديث المخالفة');
      setEditCase(null);
    } catch {
      setEditError('حدث خطأ أثناء الحفظ');
    } finally {
      setEditSaving(false);
    }
  };

  const requestViolationApprovalAccess = React.useCallback(async (c: ViolationCaseRecord) => {
    const access = await checkViolationApprovalAccess(
      c.violationTypeId,
      currentEmployeeId,
      c.approverStates,
    );
    if (!access.ok) {
      toast.warning(access.message);
      return null;
    }
    return access;
  }, [currentEmployeeId]);

  const handleApprove = React.useCallback(async (c: ViolationCaseRecord) => {
    if (!currentEmployeeId) return;
    try {
      const access = await requestViolationApprovalAccess(c);
      if (!access) return;
      const payload = buildViolationDecisionPayload(
        access.states,
        currentEmployeeId,
        'approve',
        { decidedBy: decidedByActor },
      );
      await decideCase(c.id, payload);
      const updatedStates = applyViolationApproverDecision(
        access.states,
        currentEmployeeId,
        'approve',
        { decidedBy: decidedByActor, notes: null },
      );
      if (isViolationFullyApproved(updatedStates)) {
        toast.success(`تمت الموافقة النهائية على ${c.caseNumber}`);
      } else {
        toast.success('تم تسجيل موافقتك — بانتظار بقية المعتمدين');
      }
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'violation-records.decide.approve');
      toast.error(displayMessage);
    }
  }, [currentEmployeeId, decideCase, decidedByActor, requestViolationApprovalAccess]);

  const openRejectDialog = React.useCallback(async (c: ViolationCaseRecord) => {
    try {
      if (!(await requestViolationApprovalAccess(c))) return;
      setRejectNote('');
      setRejectCase(c);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'discipline-approval-assignments.by-violation-type');
      toast.error(displayMessage);
    }
  }, [requestViolationApprovalAccess]);

  const handleReject = async () => {
    if (!rejectCase || !currentEmployeeId) return;
    try {
      const access = await checkViolationApprovalAccess(
        rejectCase.violationTypeId,
        currentEmployeeId,
        rejectCase.approverStates,
      );
      if (!access.ok) {
        toast.warning(access.message);
        return;
      }
      const payload = buildViolationDecisionPayload(
        access.states,
        currentEmployeeId,
        'reject',
        { notes: rejectNote, decidedBy: decidedByActor },
      );
      await decideCase(rejectCase.id, payload);
      toast.success('تم رفض المخالفة');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'violation-records.decide.reject');
      toast.error(displayMessage);
    }
    setRejectCase(null);
    setRejectNote('');
  };

  const columns = React.useMemo((): ColumnDef<ViolationCaseRecord>[] => [
    {
      key: 'caseNumber',
      title: 'الرقم',
      headerClassName: 'whitespace-nowrap',
      className: 'font-mono text-xs font-medium tabular-nums text-muted-foreground',
      render: (c) => <span >{c.caseNumber}</span>,
    },
    {
      key: 'employee',
      title: 'الموظف',
      headerClassName: 'whitespace-nowrap',
      className: 'max-w-[10rem] truncate font-medium',
      render: (c) => c.employeeNameAr,
    },
    {
      key: 'type',
      title: 'نوع المخالفة',
      headerClassName: 'whitespace-nowrap',
      className: 'max-w-[9rem] truncate text-xs text-muted-foreground',
      render: (c) => c.typeNameAr,
    },
    {
      key: 'date',
      title: 'التاريخ',
      headerClassName: 'whitespace-nowrap',
      className: 'whitespace-nowrap font-mono text-xs tabular-nums',
      render: (c) => <TableDateCell value={c.date} />,
    },
    {
      key: 'description',
      title: 'الوصف',
      className: 'max-w-[14rem] truncate text-xs text-muted-foreground',
      render: (c) => (
        <span className=" " title={c.description || undefined}>{c.description || '—'}</span>
      ),
    },
    {
      key: 'status',
      title: 'الحالة',
      headerClassName: 'whitespace-nowrap',
      render: (c) => (
        <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium', STATUS_COLORS[c.status])}>
          {STATUS_LABELS[c.status]}
        </span>
      ),
    },
    {
      key: 'requirements',
      title: 'المتطلبات',
      headerClassName: 'whitespace-nowrap',
      render: (c) => {
        return (
          <div className="flex flex-wrap gap-1">
            {c.typeNeedsApproval ? (
              <Badge variant="outline" className={cn('text-[9px]', STATUS_PILL.pending)}>موافقة</Badge>
            ) : null}
            {c.typeNeedsInvestigation ? (
              <Badge variant="outline" className={cn('text-[9px]', STATUS_PILL.info)}>تحقيق</Badge>
            ) : null}
            {c.hasInvestigations ? (
              <Badge variant="outline" className={cn('text-[9px]', STATUS_PILL.calculated)}>
                {c.investigationCount > 1 ? `${c.investigationCount} تحقيقات` : 'يوجد تحقيق'}
              </Badge>
            ) : null}
            {c.typeNeedsWarning ? (
              <Badge variant="outline" className={cn('text-[9px]', STATUS_PILL.warning)}>إنذار</Badge>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'investigation',
      title: 'آخر تحقيق',
      headerClassName: 'whitespace-nowrap',
      className: 'max-w-[10rem] text-xs text-muted-foreground',
      render: (c) => {
        if (!c.hasInvestigations) return '—';
        const parts = [
          c.latestInvestigationResult ? INVESTIGATION_RESULT_LABELS[c.latestInvestigationResult] : null,
          c.latestInvestigationRecommendation
            ? INVESTIGATION_RECOMMENDATION_LABELS[c.latestInvestigationRecommendation]
            : null,
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(' · ') : `${c.investigationCount} تحقيق`;
      },
    },
    {
      key: 'approvers',
      title: 'مسار الموافقة',
      hideOnMobile: true,
      render: (c) => <RequestApproversInline states={c.approverStates} />,
    },
    {
      key: 'decisionNotes',
      title: 'ملاحظات القرار',
      hideOnMobile: true,
      render: (c) => (
        <span className="line-clamp-2 max-w-[12rem] text-xs text-muted-foreground" title={c.decisionNotes || undefined}>
          {c.decisionNotes || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: 'إجراءات',
      isActions: true,
      headerClassName: 'whitespace-nowrap',
      render: (c) => {
        const canMutate = canMutateViolationCase(c.status);
        const canFollowUp = canAddDisciplineFollowUp(c.status);
        const isCurrentUserApprover = isEmployeeInViolationApproverStates(c.approverStates, currentEmployeeId);
        const approvalUi = getViolationApprovalUiState(c.approverStates, currentEmployeeId);
        const showMutateActions = !isCurrentUserApprover;
        const menuItems = [
          ...(showMutateActions && canMutate
            ? [{ label: 'تعديل', onClick: () => openEdit(c), icon: <Edit3 className="h-3.5 w-3.5" /> }]
            : []),
          ...(showMutateActions && canFollowUp && c.typeNeedsWarning
            ? [{ label: 'إنذار', onClick: () => setNoticeCase(c), icon: <AlertTriangle className="h-3.5 w-3.5" /> }]
            : []),
          ...(showMutateActions && canFollowUp && c.typeNeedsInvestigation
            ? [{ label: 'تحقيق', onClick: () => setInvestigationCase(c), icon: <Search className="h-3.5 w-3.5" /> }]
            : []),
          ...(showMutateActions && canFollowUp
            ? [{ label: 'تظلم', onClick: () => setAppealCase(c), icon: <Scale className="h-3.5 w-3.5" /> }]
            : []),
          ...(showMutateActions && canMutate
            ? [{
                label: 'حذف',
                onClick: () => setDeleteId(c.id),
                icon: <Trash2 className="h-3.5 w-3.5" />,
                destructive: true,
                separator: true,
              }]
            : []),
        ];
        return (
          <div className="flex items-start justify-end gap-1">
            {c.status === 'pending' && approvalUi.showActions ? (
              <ViolationApprovalActionCell
                states={c.approverStates}
                currentEmployeeId={currentEmployeeId}
                onApprove={() => void handleApprove(c)}
                onReject={() => void openRejectDialog(c)}
              />
            ) : null}
            {menuItems.length > 0 ? (
              <TableRowActions menuItems={menuItems} />
            ) : null}
          </div>
        );
      },
    },
  ], [violationTypes, handleApprove, openRejectDialog, currentEmployeeId]);

  const tools = useListTools<ViolationCaseRecord>({
    section: 'hr',
    page: 'discipline-violation-cases',
    columns,
    rows: items,
    fetchAll: pagination.loadAll,
    resetKey: pagination.resetKey,
    fields: {
      caseNumber: { kind: 'code', text: (c) => c.caseNumber || '—' },
      employee: { kind: 'name', text: (c) => c.employeeNameAr || '—', group: (c) => c.employeeNameAr || null },
      type: { text: (c) => c.typeNameAr || '—', group: (c) => c.typeNameAr || null },
      date: { kind: 'date', text: (c) => c.date || '—', group: (c) => (c.date ? c.date.slice(0, 7) : null) },
      description: { text: (c) => c.description || '—', sortable: false },
      status: { kind: 'status', text: (c) => STATUS_LABELS[c.status] ?? c.status, group: (c) => STATUS_LABELS[c.status] ?? c.status },
      decisionNotes: { text: (c) => c.decisionNotes || '—', sortable: false },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        {tools.exportMenu('سجل المخالفات', 'violation-cases')}
        <Button variant="luxe" size="sm" className="h-8 gap-1.5 px-3 text-xs shadow-sm shrink-0"
          onClick={() => { setDraft(CREATE_EMPTY); setFormError(null); setCreateOpen(true); }}>
          <Plus className="h-3.5 w-3.5" />
          مخالفة جديدة
        </Button>
      </div>
    ),
    [activeFilterCount, tools.depsKey],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        ref={filterToolbarRef}
        inlineSelects={inlineSelects}
        companyId={companyId}
        selectedEmpIds={selectedEmpIds}
        onSelectedEmpIdsChange={setSelectedEmpIds}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => setStatusFilter(v as StatusFilter)}
        statusOrder={STATUS_ORDER}
        statusLabels={STATUS_LABELS as unknown as Record<string, string>}
        statusCounts={statusCounts}
        onDateBoundsChange={onDateBoundsChange}
        onDateFilterMetaChange={onDateFilterMetaChange}
        dataView={{
          value: viewMode,
          onChange: (v) => setViewMode(v as ViolationViewMode),
          options: [
            { value: 'cards', label: 'بطاقات', icon: 'layout-grid' },
            { value: 'list', label: 'قائمة', icon: 'list' },
          ],
        }}
      />
    ),
    [
      companyId,
      selectedEmpIds,
      statusFilter,
      violationTypeFilter,
      statusCounts,
      viewMode,
      dateMeta.hasRestriction,
      inlineSelects,
      onDateBoundsChange,
      onDateFilterMetaChange,
    ],
  );

  if (accessDenied) {
    return <ForbiddenState title="لا تملك صلاحية الوصول لسجل المخالفات" />;
  }

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EntityActionCardGridSkeleton count={6} />
      </div>
    );
  }

  if (listError) {
    return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">{listError}</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PdfPreviewExportDialog
        open={casePrintOpen}
        onOpenChange={(open) => {
          setCasePrintOpen(open);
          if (!open) setCasePrintRecord(null);
        }}
        title="معاينة محضر المخالفة"
        fileName={
          casePrintRecord
            ? `violation-${casePrintRecord.caseNumber}.pdf`
            : 'violation-case.pdf'
        }
        printable={casePrintable}
      />

      <DisciplineListViewport>
      {sourceCases.length === 0 && !loading ? (
        <EmptyState title="لا توجد مخالفات مطابقة للفلاتر المحددة." />
      ) : listFiltered.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            لا توجد مخالفات بحالة «{STATUS_LABELS[statusFilter as ViolationRecordStatus]}».
          </p>
          <Button variant="link" size="sm" className="mt-2 text-xs" onClick={() => filterToolbarRef.current?.resetStatusFilter()}>عرض الكل</Button>
        </div>
      ) : (
        <ListToolsTable tools={tools} keyExtractor={(c) => c.id} onRowClick={(c) => setViewCase(c)}>
        <DisciplinePaginatedList pagination={tools.pagination(pagination)}>
          {viewMode === 'cards' ? (
          <EntityActionCardGrid>
            {tools.rows.map((c) => {
            const isPending = c.status === 'pending';
            const isCurrentUserApprover = isEmployeeInViolationApproverStates(c.approverStates, currentEmployeeId);
            const approvalUi = getViolationApprovalUiState(c.approverStates, currentEmployeeId);
            const showMutateActions = !isCurrentUserApprover;
            return (
              <EntityActionCard
                key={c.id}
                onClick={() => setViewCase(c)}
                reference={c.caseNumber}
                title={c.employeeNameAr ?? '—'}
                subtitle={c.typeNameAr}
                description={
                  [c.description, c.decisionNotes?.trim() ? `ملاحظات القرار: ${c.decisionNotes}` : '']
                    .filter(Boolean)
                    .join(' — ') || undefined
                }
                status={{
                  label: STATUS_LABELS[c.status],
                  tone: VIOLATION_STATUS_TONE[c.status],
                }}
                chips={
                  <>
                    <EntityActionCardChip className="font-mono tabular-nums">
                      <span className="inline-flex items-center gap-1" dir="ltr">
                        <CalendarDays className="h-3 w-3 shrink-0" />
                        {c.date}
                      </span>
                    </EntityActionCardChip>
                    {c.hasInvestigations && c.latestInvestigationResult ? (
                      <EntityActionCardChip>
                        {INVESTIGATION_RESULT_LABELS[c.latestInvestigationResult]}
                      </EntityActionCardChip>
                    ) : null}
                    {c.latestInvestigationRecommendation ? (
                      <EntityActionCardChip>
                        {INVESTIGATION_RECOMMENDATION_LABELS[c.latestInvestigationRecommendation]}
                      </EntityActionCardChip>
                    ) : null}
                  </>
                }
                footerNote={
                  !isPending && (c.decidedAt || c.decisionNotes) ? (
                    <div className="space-y-0.5 text-[11px] text-muted-foreground">
                      {c.decidedAt ? (
                        <p>
                          <span className="text-foreground/80">تاريخ القرار: </span>
                          {formatDisplayDateTime(c.decidedAt)}
                        </p>
                      ) : null}
                      {c.decisionNotes ? (
                        <p className=" " title={c.decisionNotes}>
                          <span className="text-foreground/80">ملاحظات: </span>
                          {c.decisionNotes}
                        </p>
                      ) : null}
                    </div>
                  ) : undefined
                }
                workflow={
                  isPending && approvalUi.showActions
                    ? {
                        showApproveReject: true,
                        onApprove: () => void handleApprove(c),
                        onReject: () => void openRejectDialog(c),
                        disabled: !approvalUi.canAct,
                        waitingReason: approvalUi.reasonAr ?? undefined,
                      }
                    : undefined
                }
                onEdit={showMutateActions && canMutateViolationCase(c.status) ? () => openEdit(c) : undefined}
                onDelete={showMutateActions && canMutateViolationCase(c.status) ? () => setDeleteId(c.id) : undefined}
                extraFooter={
                  showMutateActions && canAddDisciplineFollowUp(c.status) ? (
                    <div className="flex gap-1">
                      {c.typeNeedsWarning ? (
                        <Button variant="ghost" size="sm" type="button"
                          className="h-7 flex-1 gap-1 px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => setNoticeCase(c)}>
                          <AlertTriangle className="h-3 w-3" /> إنذار
                        </Button>
                      ) : null}
                      {c.typeNeedsInvestigation ? (
                        <Button variant="ghost" size="sm" type="button"
                          className="h-7 flex-1 gap-1 px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => setInvestigationCase(c)}>
                          <Search className="h-3 w-3" /> تحقيق
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" type="button"
                        className="h-7 flex-1 gap-1 px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => setAppealCase(c)}>
                        <Scale className="h-3 w-3" /> تظلم
                      </Button>
                    </div>
                  ) : undefined
                }
              >
                {c.approverStates ? (
                  <ViolationApproverStatesPanel
                    states={c.approverStates}
                    compact
                    className="border-0 bg-transparent p-0"
                  />
                ) : undefined}
              </EntityActionCard>
            );
            })}
          </EntityActionCardGrid>
          ) : (
          <DataTable
            variant="directory"
            alwaysShowTable
            tableClassName="min-w-[1200px]"
            columns={tools.columns}
            {...tools.tableSort}
            data={tools.rows}
            loading={tools.loading}
            keyExtractor={(c) => c.id}
            onRowClick={(c) => setViewCase(c)}
          />
          )}
        </DisciplinePaginatedList>
        </ListToolsTable>
      )}
      </DisciplineListViewport>

      {/* ── Create Drawer ── */}
      <HRSettingsFormDrawer open={createOpen} onOpenChange={setCreateOpen} title="مخالفة جديدة" size="lg"
        onSave={() => void handleCreate()} saveDisabled={saving} error={formError}>
        <FormField label="الموظف" required>
          <SearchableDropdown value={draft.employeeId} onChange={v => setD({ employeeId: v })} options={empOptions} placeholder="اختر الموظف…" />
        </FormField>
        <FormField label="نوع المخالفة" required>
          <SearchableDropdown value={draft.violationTypeId} onChange={v => setD({ violationTypeId: v })} options={typeOptions} placeholder="اختر نوع المخالفة…" />
        </FormField>

        {/* Live type requirement indicators */}
        {selectedType && (selectedType.needsWarning || selectedType.needsInvestigation) && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">هذا النوع يتطلب:</p>
            <TypeRequirementBadges needsWarning={selectedType.needsWarning} needsInvestigation={selectedType.needsInvestigation} />
            <p className="text-[11px] text-muted-foreground">سيمكنك إضافتها بعد حفظ المخالفة من البطاقة.</p>
          </div>
        )}

        <FormField label="تاريخ المخالفة" required>
          <DatePickerInput value={draft.date} onChange={(ymd) => setD({ date: ymd })} />
        </FormField>
        <FormField label="الوصف" required>
          <textarea value={draft.description} onChange={e => setD({ description: e.target.value })} placeholder="اكتب وصف المخالفة…"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </FormField>
        <FormField label="ملاحظات">
          <textarea value={draft.notes} onChange={e => setD({ notes: e.target.value })} placeholder="ملاحظات إضافية…"
            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </FormField>
        <FormField label="ملاحظة المرفقات">
          <Input value={draft.attachmentsNote} onChange={e => setD({ attachmentsNote: e.target.value })} placeholder="وصف المستندات المرفقة…" />
        </FormField>
      </HRSettingsFormDrawer>

      {/* ── Edit Drawer ── */}
      <HRSettingsFormDrawer open={!!editCase} onOpenChange={v => !v && setEditCase(null)}
        title={`تعديل: ${editCase?.caseNumber ?? ''}`} size="lg"
        onSave={() => void handleEdit()} saveDisabled={editSaving} error={editError}>
        <FormField label="تاريخ المخالفة" required>
          <DatePickerInput value={editForm.date} onChange={(ymd) => setEditForm(f => ({ ...f, date: ymd }))} />
        </FormField>
        <FormField label="الوصف" required>
          <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="وصف المخالفة…"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </FormField>
        <FormField label="ملاحظات">
          <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات إضافية…"
            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </FormField>
        <FormField label="ملاحظة المرفقات">
          <Input value={editForm.attachmentsNote} onChange={e => setEditForm(f => ({ ...f, attachmentsNote: e.target.value }))} placeholder="وصف المستندات المرفقة…" />
        </FormField>
      </HRSettingsFormDrawer>

      {/* ── View Dialog ── */}
      <Dialog open={!!viewCase} onOpenChange={v => !v && setViewCase(null)}>
        <DialogContent className="sm:max-w-lg border-border gap-0 overflow-hidden">
          <DialogHeader className="pb-3">
            <DialogTitle className="font-display">{viewCase?.caseNumber}</DialogTitle>
            <DialogDescription className="sr-only">تفاصيل المخالفة</DialogDescription>
          </DialogHeader>
          {viewCase ? (
            <DialogBody className="min-h-0 space-y-4 pe-1 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground text-xs">الموظف</span><p className="font-medium">{viewCase.employeeNameAr}</p></div>
                <div><span className="text-muted-foreground text-xs">نوع المخالفة</span><p className="font-medium">{viewCase.typeNameAr}</p></div>
                <div><span className="text-muted-foreground text-xs">التاريخ</span><p>{viewCase.date}</p></div>
                <div>
                  <span className="text-muted-foreground text-xs">الحالة</span>
                  <p className="flex items-center gap-1.5">
                    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', STATUS_COLORS[viewCase.status])}>{STATUS_LABELS[viewCase.status]}</span>
                    {viewCase.hasInvestigations ? (
                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', STATUS_PILL.calculated)}>يوجد تحقيق</span>
                    ) : null}
                  </p>
                </div>
              </div>
              {viewCase.typeNeedsInvestigation || viewCase.typeNeedsWarning ? (
                <TypeRequirementBadges
                  needsWarning={viewCase.typeNeedsWarning}
                  needsInvestigation={viewCase.typeNeedsInvestigation}
                />
              ) : null}
              {viewCase.approverStates ? (
                <RequestApproversInline states={viewCase.approverStates} />
              ) : null}
              <ViolationApproverStatesPanel states={viewCase.approverStates} />
              <div><span className="text-muted-foreground text-xs">الوصف</span><p className="mt-1 break-words">{viewCase.description}</p></div>
              {viewCase.notes && <div><span className="text-muted-foreground text-xs">ملاحظات</span><p className="mt-1 break-words">{viewCase.notes}</p></div>}
              {viewCase.attachmentsNote && (
                <div>
                  <span className="text-muted-foreground text-xs">ملاحظة المرفقات</span>
                  <p className="mt-1 break-words">{viewCase.attachmentsNote}</p>
                </div>
              )}
              <RelatedEmployeeAttachments
                employeeId={viewCase.employeeId}
                companyId={companyId}
                preset="discipline"
                title="آخر مرفقات المخالفات والإنذارات"
              />
              {viewCase.investigations.length > 0 ? (
                <div className="space-y-2 rounded-lg border border-border bg-muted/15 p-3">
                  <p className="text-xs font-semibold text-foreground">
                    التحقيقات ({viewCase.investigationCount})
                  </p>
                  <div className="space-y-2">
                    {viewCase.investigations.map((inv) => (
                      <div key={inv.id} className="rounded-md border border-border/60 bg-background px-3 py-2 text-xs space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono tabular-nums" dir="ltr">{inv.investigationDate}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {INVESTIGATION_RESULT_LABELS[inv.result]}
                          </Badge>
                          {inv.recommendation ? (
                            <Badge variant="outline" className="text-[10px]">
                              {INVESTIGATION_RECOMMENDATION_LABELS[inv.recommendation]}
                            </Badge>
                          ) : null}
                        </div>
                        {inv.employeeStatement ? (
                          <p><span className="text-muted-foreground">أقوال الموظف: </span>{inv.employeeStatement}</p>
                        ) : null}
                        {inv.witnessStatement ? (
                          <p><span className="text-muted-foreground">أقوال الشهود: </span>{inv.witnessStatement}</p>
                        ) : null}
                        {inv.deductionType && inv.deductionValue ? (
                          <p>
                            <span className="text-muted-foreground">الاستقطاع: </span>
                            {INVESTIGATION_DEDUCTION_TYPE_LABELS[inv.deductionType]} · {inv.deductionValue}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {(viewCase.decidedAt || viewCase.decisionNotes) && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">القرار</p>
                  {viewCase.decidedAt && (
                    <div><span className="text-muted-foreground text-xs">تاريخ القرار</span><p className="font-mono text-xs">{formatDisplayDateTime(viewCase.decidedAt)}</p></div>
                  )}
                  {viewCase.decisionNotes && (
                    <div><span className="text-muted-foreground text-xs">ملاحظات القرار</span><p className="mt-0.5">{viewCase.decisionNotes}</p></div>
                  )}
                </div>
              )}
              {viewCase.typeHasDeduction && viewCase.typeDeductionKind ? (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                  <p className="text-xs font-semibold text-foreground">خصم مالي</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">النوع: </span>{viewCase.typeDeductionKind}
                    {viewCase.typeDeductionValue && <><span className="mx-1">·</span><span className="font-medium text-foreground">القيمة: </span>{viewCase.typeDeductionValue}</>}
                  </p>
                </div>
              ) : null}
              {viewCase.status === 'pending' ? (
                <ViolationApprovalActionButtons
                  states={viewCase.approverStates}
                  currentEmployeeId={currentEmployeeId}
                  onApprove={() => void handleApprove(viewCase)}
                  onReject={() => void openRejectDialog(viewCase)}
                />
              ) : null}
              {!isEmployeeInViolationApproverStates(viewCase.approverStates, currentEmployeeId) && canAddDisciplineFollowUp(viewCase.status) ? (
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  {viewCase.typeNeedsWarning ? (
                    <Button size="sm" variant="outline" className="gap-1.5"
                      onClick={() => { setViewCase(null); setNoticeCase(viewCase); }}>
                      <AlertTriangle className="h-3.5 w-3.5" /> إصدار إنذار
                    </Button>
                  ) : null}
                  {viewCase.typeNeedsInvestigation ? (
                    <Button size="sm" variant="outline" className="gap-1.5"
                      onClick={() => { setViewCase(null); setInvestigationCase(viewCase); }}>
                      <Search className="h-3.5 w-3.5" /> فتح تحقيق
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" className="gap-1.5"
                    onClick={() => { setViewCase(null); setAppealCase(viewCase); }}>
                    <Scale className="h-3.5 w-3.5" /> تقديم تظلم
                  </Button>
                </div>
              ) : null}
            </DialogBody>
          ) : null}
          {viewCase ? (
            <DialogFooter className={dialogFormFooterClass}>
              <PdfPreviewDownloadButton
                onClick={() => {
                  setCasePrintRecord(viewCase);
                  setCasePrintOpen(true);
                }}
              />
              <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setViewCase(null)}>
                إغلاق
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Reject Dialog ── */}
      <Dialog open={!!rejectCase} onOpenChange={v => !v && setRejectCase(null)}>
        <DialogContent className="sm:max-w-sm border-border">
          <DialogHeader>
            <DialogTitle>رفض المخالفة {rejectCase?.caseNumber}</DialogTitle>
            <DialogDescription className="sr-only">أدخل سبب الرفض اختياريًا ثم أكّد.</DialogDescription>
          </DialogHeader>
          <Input value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="سبب الرفض (اختياري)…" />
          <DialogFooter>
            <Button variant="destructive" onClick={() => void handleReject()}>تأكيد الرفض</Button>
            <Button variant="outline" onClick={() => setRejectCase(null)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <ConfirmationModal
        open={!!deleteId}
        onOpenChange={v => !v && setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            try { await deleteCase(deleteId); toast.success('تم الحذف'); } catch { toast.error('فشل الحذف'); }
            setDeleteId(null);
          }
        }}
        title="حذف المخالفة"
      />

      {/* ── Contextual dialogs ── */}
      <NoticeDialog
        open={!!noticeCase}
        onClose={() => setNoticeCase(null)}
        violationCase={noticeCase}
        companyId={companyId}
      />
      <ViolationInvestigationDrawer
        open={!!investigationCase}
        onOpenChange={(open) => { if (!open) setInvestigationCase(null); }}
        violationCase={investigationCase}
        companyId={companyId}
        employees={employees}
        onSuccess={() => void reload()}
      />
      <AppealDialog
        open={!!appealCase}
        onClose={() => setAppealCase(null)}
        violationCase={appealCase}
        companyId={companyId}
      />
    </div>
  );
}
