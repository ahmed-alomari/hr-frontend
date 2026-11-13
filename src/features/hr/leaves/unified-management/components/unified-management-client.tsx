'use client';

import * as React from 'react';
import {
  Plus,
  Clock, CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { TableDateCell } from '@/components/ui/table-cells';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { ListFilterBar, type ListFilterInlineSelect } from '@/components/ui/list-filter-bar';
import { intervalOverlapsYmdRange } from '@/features/hr/discipline/lib/discipline-date-filter';
import {
  hrFiltersKey,
  usePersistedEmpIdSet,
  usePersistedFilterState,
} from '@/features/hr/lib/use-persisted-filter-state';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  dialogFormFooterClass,
} from '@/components/ui/dialog';
import {
  canShowLeaveApprovalActions, getApprovalStage,
  LEAVE_TYPE_LABELS,
} from '@/features/hr/leaves/unified-management/lib/leaves-utils';
import { employeesApi, type EmployeeResponseDto } from '@/features/hr/organization/employees/lib/api/employees';
import { branchesApi, type BranchResponseDto } from '@/features/hr/organization/lib/api/branches';
import { departmentsApi, type DepartmentResponseDto } from '@/features/hr/organization/lib/api/departments';
import { organizationActiveListStatusQuery } from '@/features/hr/organization/lib/archive-scope';
import type { UnifiedLeaveRecord, UnifiedLeaveType, LeaveStatus, UnifiedFilterState } from '@/features/hr/leaves/unified-management/types';
import type { LeaveTypeResponseDto } from '@/features/hr/leaves/leave-types/lib/api/leave-types';
import { loadCompanyLeaveTypes } from '@/features/hr/leaves/lib/leave-types-utils';
import { pickDefaultLeaveRequestTypeId, loadLeaveRequestTypes } from '@/features/hr/requests/lib/load-leave-request-types';
import {
  leaveRequestsNewApi,
  type ApiLeaveRequest,
} from '@/features/hr/requests/lib/api/correction-requests';
import type { ApiRequestType } from '@/features/hr/requests/lib/api/request-types';
import { fetchAllPaginatedItems } from '@/features/hr/lib/api/client';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import { RejectReasonDialog } from '@/components/approval/reject-reason-dialog';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import {
  CREATE_PICKER_ACTIVE_ONLY,
  employeeMatchesStatus,
  employeeStatusFilterLabelAr,
  employeeStatusQuery,
  isEmployeeStatusFilterActive,
  useEmployeeStatusFilter,
} from '@/features/hr/lib/employee-status-filter';
import type { RegisterColumn } from '@/components/pdf/print/register-document';
import { exportDate, exportDateTime, exportText } from '@/features/hr/requests/lib/list-export-format';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { useCurrentEmployee } from '@/features/hr/organization/employees/hooks/useCurrentEmployee';
import { checkRequestApprovalAccess } from '@/features/hr/requests/lib/request-approval-access';
import {
  buildRequestApproverStatesFromListItem,
  buildRequestCorrectionDecisionPayload,
  isRequestFullyApproved,
  normalizeRequestApproverStates,
} from '@/features/hr/requests/lib/request-approver-states';
import type { RequestApprovalAssignmentCatalogDto } from '@/features/hr/requests/types/api/request-approver-states-types';
import { RequestApproverStatesPanel } from '@/features/hr/requests/components/request-approver-states-panel';
import { RequestApproversInline } from '@/features/hr/requests/components/request-approvers-inline';
import { RequestApprovalActionCell, RequestApprovalActionButtons } from '@/features/hr/requests/components/request-approval-actions';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { cn } from '@/shared/utils';
import { AR_LEAVE_STATUS_LABELS } from '@/shared/i18n/ar';
import { toast } from 'sonner';
import { DirectoryPagedViews, useServerDirectoryPagination } from '@/components/ui/paged-list';
import {
  EntityActionCard,
  EntityActionCardChip,
  EntityActionCardGrid,
  EntityActionCardMetric,
  EntityActionCardMetricDivider,
  EntityActionCardMetricsRow,
  EntityActionCardStatusBlock,
  type WorkflowStatusTone,
} from '@/components/ui/entity-action-card';

// ─── Style config ─────────────────────────────────────────────────────────────

const TYPE_STYLE: Record<UnifiedLeaveType, { color: string; dot: string }> = {
  annual:    { color: 'bg-primary/10 text-primary border-primary/30', dot: 'bg-primary' },
  sick:      { color: 'bg-warning/10 text-warning border-warning/30', dot: 'bg-warning' },
  unpaid:    { color: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
  maternity: { color: 'bg-accent/80 text-accent-foreground border-border', dot: 'bg-accent' },
  emergency: { color: 'bg-destructive/10 text-destructive border-destructive/30', dot: 'bg-destructive' },
};

const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = AR_LEAVE_STATUS_LABELS;

const LEAVE_STATUS_TONE: Record<LeaveStatus, WorkflowStatusTone> = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'muted',
};

// ─── Default filter state ─────────────────────────────────────────────────────

// ─── Working days helper ──────────────────────────────────────────────────────

function wDays(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

const KNOWN_LEAVE_CODES = ['annual', 'sick', 'unpaid', 'maternity', 'emergency'];

function resolveLeaveTypeCode(lt?: LeaveTypeResponseDto, subtypeSlug?: string | null): UnifiedLeaveType {
  const code = lt?.code ?? subtypeSlug ?? '';
  if (code && KNOWN_LEAVE_CODES.includes(code)) return code as UnifiedLeaveType;
  return 'emergency';
}

function leaveTypeDisplayLabel(l: UnifiedLeaveRecord): string {
  return l.leaveTypeName || l.subtypeNameAr || LEAVE_TYPE_LABELS[l.type] || '—';
}

function formatIsoDate(iso?: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

const LEAVE_EXPORT_COLUMNS: RegisterColumn[] = [
  { label: 'الموظف', kind: 'name' },
  { label: 'القسم', kind: 'text' },
  { label: 'النوع', kind: 'status' },
  { label: 'الحالة', kind: 'status' },
  { label: 'من', kind: 'date' },
  { label: 'إلى', kind: 'date' },
  { label: 'أيام', kind: 'number', weight: 0.6 },
  { label: 'تاريخ التقديم', kind: 'date' },
  { label: 'سبب الطلب', kind: 'text', weight: 1.6 },
];

function employeeDisplayName(l: UnifiedLeaveRecord, employees: { id: string; nameAr: string }[]): string {
  return l.employeeNameAr || employees.find((e) => e.id === l.employeeId)?.nameAr || l.employeeId;
}

function leaveStatusMeta(l: UnifiedLeaveRecord): { dateLabel?: string; dateValue?: string } {
  if (l.status === 'pending') {
    const submitted = formatIsoDate(l.submittedAt);
    return submitted ? { dateLabel: 'تاريخ التقديم', dateValue: submitted } : {};
  }
  if (l.status === 'cancelled') {
    const cancelled = formatIsoDate(l.cancelledAt);
    return cancelled ? { dateLabel: 'تاريخ الإلغاء', dateValue: cancelled } : {};
  }
  if (l.status === 'approved' || l.status === 'rejected') {
    const decided = formatIsoDate(l.decidedAt);
    return decided ? { dateLabel: 'تاريخ القرار', dateValue: decided } : {};
  }
  return {};
}

function LeaveStatusBadge({ leave }: { leave: UnifiedLeaveRecord }) {
  return (
    <EntityActionCardStatusBlock
      status={{
        label: LEAVE_STATUS_LABELS[leave.status],
        tone: LEAVE_STATUS_TONE[leave.status],
      }}
    />
  );
}

function LeaveStatusBlock({ leave, compact = false }: { leave: UnifiedLeaveRecord; compact?: boolean }) {
  const meta = leaveStatusMeta(leave);
  return (
    <EntityActionCardStatusBlock
      status={{
        label: LEAVE_STATUS_LABELS[leave.status],
        tone: LEAVE_STATUS_TONE[leave.status],
        meta: meta.dateValue ? (
          <>
            {meta.dateLabel}: <span className="font-mono text-foreground" dir="ltr">{meta.dateValue}</span>
          </>
        ) : leave.decisionNotesAr?.trim() ? (
          <span className=" " title={leave.decisionNotesAr}>{leave.decisionNotesAr}</span>
        ) : undefined,
      }}
      compact={compact}
    />
  );
}

function LeaveDecisionCell({
  leave,
  currentEmployeeId,
  onApprove,
  onReject,
}: {
  leave: UnifiedLeaveRecord;
  currentEmployeeId: string | null;
  onApprove: (l: UnifiedLeaveRecord) => void;
  onReject: (l: UnifiedLeaveRecord) => void;
}) {
  const meta = leaveStatusMeta(leave);

  if (leave.status !== 'pending') {
    return (
      <div className="min-w-[6.5rem] space-y-0.5 text-[10px]">
        {meta.dateValue ? (
          <>
            <p className="text-muted-foreground">{meta.dateLabel}</p>
            <p className="font-mono text-xs font-semibold tabular-nums text-foreground" dir="ltr">
              {meta.dateValue}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">{LEAVE_STATUS_LABELS[leave.status]}</p>
        )}
        {leave.decisionNotesAr?.trim() ? (
          <p className="  text-muted-foreground" title={leave.decisionNotesAr}>
            {leave.decisionNotesAr}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <RequestApprovalActionCell
      states={leave.approverStates}
      currentEmployeeId={currentEmployeeId}
      onApprove={() => onApprove(leave)}
      onReject={() => onReject(leave)}
      fallback={<span className="text-xs text-muted-foreground">—</span>}
    />
  );
}

function resolveLeaveApproverStates(
  r: ApiLeaveRequest,
  approvalCatalog?: RequestApprovalAssignmentCatalogDto[],
) {
  if (approvalCatalog?.length) {
    const fromList = buildRequestApproverStatesFromListItem(
      {
        approvalAssignmentId: r.approvalAssignmentId ?? null,
        approverDecisions: r.approverDecisions ?? null,
      },
      approvalCatalog,
    );
    if (fromList) return fromList;
  }
  return normalizeRequestApproverStates(r);
}

function mapApiLeave(
  r: ApiLeaveRequest,
  leaveTypes: LeaveTypeResponseDto[],
  approvalCatalog?: RequestApprovalAssignmentCatalogDto[],
): UnifiedLeaveRecord {
  const lt = leaveTypes.find((t) => t.id === r.leaveTypeId);
  const derivedType = resolveLeaveTypeCode(lt, r.subtypeSlug);
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeNameAr: r.employeeNameAr,
    requestTypeId: r.requestTypeId,
    requestTypeNameAr: r.requestTypeNameAr,
    leaveTypeId: r.leaveTypeId,
    leaveTypeName: r.leaveTypeNameAr || lt?.nameAr || r.leaveTypeId,
    type: derivedType,
    status: r.status,
    start: r.startDate,
    end: r.endDate,
    requestBranchId: '',
    workingDays: r.workingDays,
    noteAr: r.reasonAr ?? undefined,
    subtypeSlug: r.subtypeSlug,
    subtypeNameAr: r.subtypeNameAr,
    departmentNameAr: r.departmentNameAr,
    submittedAt: r.submittedAt,
    decidedAt: r.decidedAt ?? undefined,
    cancelledAt: r.cancelledAt ?? undefined,
    decidedByEmployeeId: r.decidedByEmployeeId,
    decisionNotesAr: r.decisionNotesAr ?? undefined,
    approverStates: resolveLeaveApproverStates(r, approvalCatalog),
    approvalChain: [],
  };
}

function leaveOverlapsYmdRange(leave: UnifiedLeaveRecord, from: string, to: string): boolean {
  return intervalOverlapsYmdRange(leave.start, leave.end, from, to);
}

const LEAVE_STATUS_TOOLBAR_ORDER: LeaveStatus[] = ['pending', 'approved', 'rejected', 'cancelled'];

const LEAVE_STATUS_LABELS_FOR_TOOLBAR: Record<string, string> = AR_LEAVE_STATUS_LABELS;

// ─── Main component ───────────────────────────────────────────────────────────

export function UnifiedManagementClient() {
  const companyId = useDefaultCompanyId();
  const authUser = useAuthStore((s) => s.user);
  const { data: currentEmployee } = useCurrentEmployee();
  const currentEmployeeId = currentEmployee?.id ?? null;
  const updatedByActor = authUser?.id ?? undefined;

  const [branches, setBranches] = React.useState<BranchResponseDto[]>([]);
  const [departments, setDepartments] = React.useState<DepartmentResponseDto[]>([]);
  const branchesLoadedRef = React.useRef<string | null>(null);
  const departmentsLoadedRef = React.useRef<string | null>(null);
  const branchesLoadRef = React.useRef<Promise<void> | null>(null);
  const departmentsLoadRef = React.useRef<Promise<void> | null>(null);

  const loadBranches = React.useCallback(async () => {
    if (!companyId) return;
    if (branchesLoadedRef.current === companyId) return;
    if (branchesLoadRef.current) return branchesLoadRef.current;
    branchesLoadRef.current = (async () => {
      try {
        const res = await branchesApi.getAll({
          companyId,
          limit: 200,
          ...organizationActiveListStatusQuery(),
        });
        setBranches(res.items.filter((b) => b.isActive));
        branchesLoadedRef.current = companyId;
      } catch {
        // branch filter stays empty until retry
      } finally {
        branchesLoadRef.current = null;
      }
    })();
    return branchesLoadRef.current;
  }, [companyId]);

  const loadDepartments = React.useCallback(async () => {
    if (!companyId) return;
    if (departmentsLoadedRef.current === companyId) return;
    if (departmentsLoadRef.current) return departmentsLoadRef.current;
    departmentsLoadRef.current = (async () => {
      try {
        const res = await departmentsApi.getAll({
          companyId,
          limit: 200,
          ...organizationActiveListStatusQuery(),
        });
        setDepartments(res.items.filter((d) => d.isActive));
        departmentsLoadedRef.current = companyId;
      } catch {
        // department filter stays empty until retry
      } finally {
        departmentsLoadRef.current = null;
      }
    })();
    return departmentsLoadRef.current;
  }, [companyId]);

  const [leaveTypes, setLeaveTypes] = React.useState<LeaveTypeResponseDto[]>([]);
  const [leaveRequestTypes, setLeaveRequestTypes] = React.useState<ApiRequestType[]>([]);
  const leaveTypesLoadedRef = React.useRef<string | null>(null);
  const leaveTypesLoadRef = React.useRef<Promise<void> | null>(null);
  const addCatalogLoadedRef = React.useRef<string | null>(null);

  const leaveTypesRef = React.useRef(leaveTypes);
  leaveTypesRef.current = leaveTypes;

  const loadLeaveTypesForFilter = React.useCallback(async () => {
    if (!companyId) return;
    if (leaveTypesLoadedRef.current === companyId) return;
    if (leaveTypesLoadRef.current) return leaveTypesLoadRef.current;
    leaveTypesLoadRef.current = (async () => {
      try {
        const ltRes = await loadCompanyLeaveTypes({ companyId, limit: 200, isActive: true });
        setLeaveTypes(ltRes.items);
        leaveTypesLoadedRef.current = companyId;
      } catch {
        toast.error('فشل تحميل أنواع الإجازات');
      } finally {
        leaveTypesLoadRef.current = null;
      }
    })();
    return leaveTypesLoadRef.current;
  }, [companyId]);

  const employeesCacheRef = React.useRef<{ companyId: string; items: EmployeeResponseDto[] } | null>(null);
  const employeesLoadRef = React.useRef<Promise<EmployeeResponseDto[]> | null>(null);
  const [employeesList, setEmployeesList] = React.useState<EmployeeResponseDto[]>([]);
  const [employeesLoading, setEmployeesLoading] = React.useState(false);

  const loadEmployees = React.useCallback(async (): Promise<EmployeeResponseDto[]> => {
    if (!companyId) return [];
    if (employeesCacheRef.current?.companyId === companyId) {
      return employeesCacheRef.current.items;
    }
    if (employeesLoadRef.current) return employeesLoadRef.current;
    employeesLoadRef.current = (async () => {
      setEmployeesLoading(true);
      try {
        const res = await employeesApi.getAll({ companyId, limit: 500 });
        employeesCacheRef.current = { companyId, items: res.items };
        setEmployeesList(res.items);
        return res.items;
      } catch {
        toast.error('فشل تحميل الموظفين');
        return [];
      } finally {
        setEmployeesLoading(false);
        employeesLoadRef.current = null;
      }
    })();
    return employeesLoadRef.current;
  }, [companyId]);

  const ensureAddDialogData = React.useCallback(async () => {
    if (!companyId) return;
    const tasks: Promise<unknown>[] = [loadEmployees(), loadBranches()];
    if (addCatalogLoadedRef.current !== companyId) {
      tasks.push((async () => {
        try {
          const [ltRes, rtRes] = await Promise.all([
            loadCompanyLeaveTypes({ companyId, limit: 200, isActive: true }),
            loadLeaveRequestTypes(companyId),
          ]);
          setLeaveTypes(ltRes.items);
          leaveTypesLoadedRef.current = companyId;
          setLeaveRequestTypes(rtRes);
          addCatalogLoadedRef.current = companyId;
        } catch {
          toast.error('فشل تحميل بيانات النموذج');
        }
      })());
    }
    await Promise.all(tasks);
  }, [companyId, loadEmployees, loadBranches]);

  React.useEffect(() => {
    branchesLoadedRef.current = null;
    departmentsLoadedRef.current = null;
    leaveTypesLoadedRef.current = null;
    addCatalogLoadedRef.current = null;
    employeesCacheRef.current = null;
    setBranches([]);
    setDepartments([]);
    setLeaveTypes([]);
    setLeaveRequestTypes([]);
    setEmployeesList([]);
  }, [companyId]);

  const [branchId, setBranchId] = usePersistedFilterState(
    hrFiltersKey('requests', 'unified-management', companyId, 'branchId'),
    'all',
  );
  const [departmentId, setDepartmentId] = usePersistedFilterState(
    hrFiltersKey('requests', 'unified-management', companyId, 'departmentId'),
    'all',
  );
  const [leaveType, setLeaveType] = usePersistedFilterState(
    hrFiltersKey('requests', 'unified-management', companyId, 'leaveType'),
    'all',
  );
  const [approvalStageFilter, setApprovalStageFilter] = usePersistedFilterState(
    hrFiltersKey('requests', 'unified-management', companyId, 'approvalStageFilter'),
    'all',
  );

  const handleBranchChange = React.useCallback((v: string) => {
    setBranchId(v);
    if (v !== 'all') void loadEmployees();
  }, [loadEmployees]);

  const handleDepartmentChange = React.useCallback((v: string) => {
    setDepartmentId(v);
    if (v !== 'all') void loadEmployees();
  }, [loadEmployees]);

  const branchInlineOptions = React.useMemo(
    () => [{ value: 'all', label: 'جميع الفروع' }, ...branches.map((b) => ({ value: b.id, label: b.nameAr }))],
    [branches],
  );
  const deptInlineOptions = React.useMemo(
    () => [
      { value: 'all', label: 'جميع الأقسام' },
      ...departments.map((d) => ({ value: d.id, label: d.nameAr })),
    ],
    [departments],
  );
  const typeInlineOptions = React.useMemo(() => {
    const options = new Map<string, string>();
    for (const lt of leaveTypes) options.set(lt.id, lt.nameAr);
    return [
      { value: 'all', label: 'جميع الأنواع' },
      ...[...options.entries()].map(([value, label]) => ({ value, label })),
    ];
  }, [leaveTypes]);
  const stageInlineOptions = React.useMemo(
    () => [
      { value: 'all', label: 'الكل' },
      { value: 'fully_approved', label: 'مكتمل' },
      { value: 'awaiting_first', label: 'بانتظار الأول' },
      { value: 'awaiting_second', label: 'بانتظار الثاني' },
      { value: 'awaiting_third', label: 'بانتظار الثالث' },
    ],
    [],
  );

  const inlineSelects = React.useMemo((): ListFilterInlineSelect[] => [
    {
      id: 'branch',
      value: branchId,
      onChange: handleBranchChange,
      onOpen: () => { void loadBranches(); },
      placeholder: 'الفرع',
      className: 'w-[9rem]',
      options: branchInlineOptions,
    },
    {
      id: 'dept',
      value: departmentId,
      onChange: handleDepartmentChange,
      onOpen: () => { void loadDepartments(); },
      placeholder: 'القسم',
      className: 'w-[9rem]',
      options: deptInlineOptions,
    },
    {
      id: 'type',
      value: leaveType,
      onChange: setLeaveType,
      onOpen: () => { void loadLeaveTypesForFilter(); },
      placeholder: 'نوع الإجازة',
      className: 'w-[9.5rem]',
      options: typeInlineOptions,
    },
    {
      id: 'stage',
      value: approvalStageFilter,
      onChange: setApprovalStageFilter,
      placeholder: 'مرحلة الاعتماد',
      className: 'w-[10rem]',
      options: stageInlineOptions,
    },
  ], [
    branchId,
    departmentId,
    leaveType,
    approvalStageFilter,
    handleBranchChange,
    handleDepartmentChange,
    loadBranches,
    loadDepartments,
    loadLeaveTypesForFilter,
    branchInlineOptions,
    deptInlineOptions,
    typeInlineOptions,
    stageInlineOptions,
  ]);

  const [selectedEmpIds, setSelectedEmpIds] = usePersistedEmpIdSet(
    hrFiltersKey('requests', 'unified-management', companyId, 'selectedEmpIds'),
  );
  const [employeeStatus, setEmployeeStatus] = useEmployeeStatusFilter(
    hrFiltersKey('requests', 'unified-management', companyId, 'employeeStatus'),
  );
  const [statusFilter, setStatusFilter] = usePersistedFilterState(
    hrFiltersKey('requests', 'unified-management', companyId, 'statusFilter'),
    'all',
  );
  const [dateBounds, setDateBounds] = usePersistedFilterState(
    hrFiltersKey('requests', 'unified-management', companyId, 'dateBounds'),
    { from: '', to: '' },
  );

  const employeeById = React.useMemo(
    () => new Map(employeesList.map((e) => [e.id, e])),
    [employeesList],
  );

  const filters: UnifiedFilterState = {
    branchId: branchId || 'all',
    departmentId: departmentId || 'all',
    status: (statusFilter as UnifiedFilterState['status']) || 'all',
    type: (leaveType as UnifiedFilterState['type']) || 'all',
    approvalStage: (approvalStageFilter as UnifiedFilterState['approvalStage']) || 'all',
    employeeIds: [...selectedEmpIds],
  };

  const [view, setView] = usePersistedFilterState<'table' | 'card'>(
    hrFiltersKey('requests', 'unified-management', companyId, 'view'),
    'table',
  );
  const [detailLeave, setDetailLeave] = React.useState<UnifiedLeaveRecord | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editLeave, setEditLeave] = React.useState<UnifiedLeaveRecord | null>(null);

  const selectedEmpKey = React.useMemo(() => [...selectedEmpIds].sort().join(','), [selectedEmpIds]);

  const bulkMode =
    branchId !== 'all' ||
    departmentId !== 'all' ||
    approvalStageFilter !== 'all' ||
    selectedEmpIds.size > 1;

  const buildListQuery = React.useCallback((page: number, pageSize: number) => ({
    companyId: companyId!,
    page,
    limit: pageSize,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(leaveType !== 'all' ? { leaveTypeId: leaveType } : {}),
    ...(selectedEmpIds.size === 1 ? { employeeId: [...selectedEmpIds][0] } : {}),
    ...(dateBounds.from ? { dateFrom: dateBounds.from } : {}),
    ...(dateBounds.to ? { dateTo: dateBounds.to } : {}),
    ...employeeStatusQuery(employeeStatus),
  }), [companyId, statusFilter, leaveType, selectedEmpIds, dateBounds.from, dateBounds.to, employeeStatus]);

  const applyClientFilters = React.useCallback((items: UnifiedLeaveRecord[]) => {
    const empPick = [...selectedEmpIds];
    return items.filter((l) => {
      if (empPick.length > 0 && !empPick.includes(l.employeeId)) return false;
      const emp = employeeById.get(l.employeeId);
      if (branchId !== 'all' && emp?.branchId !== branchId) return false;
      if (departmentId !== 'all' && emp?.departmentId !== departmentId) return false;
      if (approvalStageFilter !== 'all') {
        const stage = getApprovalStage(l);
        if (stage !== approvalStageFilter && !(approvalStageFilter === 'fully_approved' && stage === 'fully_approved')) return false;
      }
      if (!leaveOverlapsYmdRange(l, dateBounds.from, dateBounds.to)) return false;
      return true;
    });
  }, [approvalStageFilter, branchId, departmentId, dateBounds.from, dateBounds.to, employeeById, selectedEmpIds]);

  const loadPage = React.useCallback(async (page: number, pageSize: number) => {
    if (!companyId) return { items: [] as UnifiedLeaveRecord[], total: 0 };
    try {
      const res = await leaveRequestsNewApi.list(buildListQuery(page, pageSize));
      const mapped = res.items.map((r) => mapApiLeave(r, leaveTypesRef.current, res.approvalAssignments));
      if (bulkMode) {
        const items = applyClientFilters(mapped);
        return { items, total: items.length };
      }
      return { items: mapped, total: res.pagination.total };
    } catch {
      toast.error('فشل تحميل طلبات الإجازات');
      return { items: [], total: 0 };
    }
  }, [applyClientFilters, buildListQuery, bulkMode, companyId]);

  const loadBulk = React.useCallback(async () => {
    if (!companyId) return { items: [] as UnifiedLeaveRecord[], total: 0 };
    try {
      const catalogById = new Map<string, RequestApprovalAssignmentCatalogDto>();
      const rawItems: ApiLeaveRequest[] = [];
      let page = 1;
      const limit = 200;
      let totalPages = 1;
      do {
        const res = await leaveRequestsNewApi.list({ ...buildListQuery(page, limit) });
        for (const assignment of res.approvalAssignments) {
          catalogById.set(assignment.id, assignment);
        }
        rawItems.push(...res.items);
        totalPages = Math.max(res.pagination.totalPages, 1);
        page += 1;
      } while (page <= totalPages);

      const catalog = [...catalogById.values()];
      const mapped = rawItems.map((r) => mapApiLeave(r, leaveTypesRef.current, catalog));
      const items = applyClientFilters(mapped);
      return { items, total: items.length };
    } catch {
      toast.error('فشل تحميل طلبات الإجازات');
      return { items: [], total: 0 };
    }
  }, [applyClientFilters, buildListQuery, companyId]);

  const {
    items: filtered,
    loading: listLoading,
    pagination,
    reload: reloadLeaves,
  } = useServerDirectoryPagination<UnifiedLeaveRecord>(loadPage, {
    enabled: !!companyId,
    bulkMode,
    loadBulk: bulkMode ? loadBulk : undefined,
    resetDeps: [companyId, branchId, departmentId, leaveType, approvalStageFilter, statusFilter, selectedEmpKey, dateBounds.from, dateBounds.to, employeeStatus],
  });

  const statusCounts = React.useMemo(() => ({
    all: pagination.total,
    pending: filtered.filter((l) => l.status === 'pending').length,
    approved: filtered.filter((l) => l.status === 'approved').length,
    rejected: filtered.filter((l) => l.status === 'rejected').length,
    cancelled: filtered.filter((l) => l.status === 'cancelled').length,
  }), [filtered, pagination.total]);

  const handleApprove = React.useCallback(async (leave: UnifiedLeaveRecord) => {
    if (!companyId || !currentEmployeeId) return;
    try {
      const access = await checkRequestApprovalAccess(
        'leave',
        companyId,
        currentEmployeeId,
        leave.approverStates,
      );
      if (!access.ok) {
        toast.warning(access.message);
        return;
      }
      const payload = buildRequestCorrectionDecisionPayload(
        access.states,
        currentEmployeeId,
        'approve',
        { updatedBy: updatedByActor },
      );
      const updated = await leaveRequestsNewApi.decide(leave.id, payload);
      const mapped = mapApiLeave(updated, leaveTypesRef.current);
      if (detailLeave?.id === leave.id) setDetailLeave(mapped);
      await reloadLeaves();
      if (payload.approverStates && isRequestFullyApproved(payload.approverStates)) {
        toast.success('تم اعتماد طلب الإجازة نهائياً.');
      } else {
        toast.success('تم تسجيل موافقتك — بانتظار بقية المعتمدين.');
      }
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'leave-requests.decide.approve');
      toast.error(displayMessage);
    }
  }, [companyId, currentEmployeeId, detailLeave?.id, reloadLeaves, updatedByActor]);

  const [rejectTarget, setRejectTarget] = React.useState<{
    leave: UnifiedLeaveRecord;
    states: Parameters<typeof buildRequestCorrectionDecisionPayload>[0];
  } | null>(null);

  /** Checks the approver may act, then asks for the reason before rejecting. */
  const handleReject = React.useCallback(async (leave: UnifiedLeaveRecord) => {
    if (!companyId || !currentEmployeeId) return;
    try {
      const access = await checkRequestApprovalAccess(
        'leave',
        companyId,
        currentEmployeeId,
        leave.approverStates,
      );
      if (!access.ok) {
        toast.warning(access.message);
        return;
      }
      setRejectTarget({ leave, states: access.states });
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'leave-requests.decide.reject');
      toast.error(displayMessage);
    }
  }, [companyId, currentEmployeeId]);

  const confirmReject = React.useCallback(async (reason: string) => {
    if (!rejectTarget || !currentEmployeeId) return;
    const { leave, states } = rejectTarget;
    try {
      const payload = buildRequestCorrectionDecisionPayload(
        states,
        currentEmployeeId,
        'reject',
        { decisionNotesAr: reason, updatedBy: updatedByActor },
      );
      const updated = await leaveRequestsNewApi.decide(leave.id, payload);
      const mapped = mapApiLeave(updated, leaveTypesRef.current);
      if (detailLeave?.id === leave.id) setDetailLeave(mapped);
      await reloadLeaves();
      toast.message('تم رفض الطلب.');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'leave-requests.decide.reject');
      toast.error(displayMessage);
      throw err;
    }
  }, [currentEmployeeId, detailLeave?.id, rejectTarget, reloadLeaves, updatedByActor]);

  const activeFilterCount =
    (branchId !== 'all' ? 1 : 0) + (departmentId !== 'all' ? 1 : 0) +
    (leaveType !== 'all' ? 1 : 0) + (approvalStageFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) + (selectedEmpIds.size > 0 ? 1 : 0) +
    (dateBounds.from !== '' ? 1 : 0) +
    (isEmployeeStatusFilterActive(employeeStatus) ? 1 : 0);

  // New leave requests: active employees only; the leave's own employee stays
  // selectable when editing.
  const editLeaveEmployeeId = editLeave?.employeeId;
  const addDialogEmployees = React.useMemo(
    () => employeesList.filter(
      (e) => e.id === editLeaveEmployeeId || employeeMatchesStatus(e.contractStatus, CREATE_PICKER_ACTIVE_ONLY),
    ),
    [employeesList, editLeaveEmployeeId],
  );

  const onAddClick = React.useCallback(() => {
    setEditLeave(null);
    setAddOpen(true);
  }, []);

  React.useEffect(() => {
    if (addOpen) void ensureAddDialogData();
  }, [addOpen, ensureAddDialogData]);

  const getExportRows = useLatestCallback(async (): Promise<string[][]> => {
    if (!companyId) return [];
    let leaves: UnifiedLeaveRecord[];
    if (bulkMode) {
      leaves = (await loadBulk()).items;
    } else {
      const catalogById = new Map<string, RequestApprovalAssignmentCatalogDto>();
      const { items } = await fetchAllPaginatedItems(async (page, limit) => {
        const res = await leaveRequestsNewApi.list(buildListQuery(page, limit));
        for (const assignment of res.approvalAssignments) catalogById.set(assignment.id, assignment);
        const catalog = [...catalogById.values()];
        return { items: res.items.map((r) => mapApiLeave(r, leaveTypesRef.current, catalog)), pagination: res.pagination };
      });
      leaves = items;
    }
    return leaves.map((l) => [
      employeeDisplayName(l, employeesList),
      exportText(l.departmentNameAr),
      leaveTypeDisplayLabel(l),
      LEAVE_STATUS_LABELS[l.status] ?? l.status,
      exportDate(l.start),
      exportDate(l.end),
      exportText(l.workingDays),
      exportDateTime(l.submittedAt),
      exportText(l.noteAr),
    ]);
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <RegisterExportMenu
          title="سجل طلبات الإجازات"
          fileName="leave-requests"
          columns={LEAVE_EXPORT_COLUMNS}
          getRows={getExportRows}
          subtitleLines={[`حالة الموظفين: ${employeeStatusFilterLabelAr(employeeStatus)}`]}
          landscape
        />
        <Button
          variant="luxe"
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs shadow-sm"
          onClick={onAddClick}
        >
          <Plus className="h-3.5 w-3.5" />
          إضافة إجازة
        </Button>
      </div>
    ),
    [activeFilterCount, employeeStatus],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        optionalDateRange
        periodValue={dateBounds}
        onPeriodChange={setDateBounds}
        inlineSelects={inlineSelects}
        companyId={companyId}
        selectedEmpIds={selectedEmpIds}
        onSelectedEmpIdsChange={setSelectedEmpIds}
        employeeStatus={employeeStatus}
        onEmployeeStatusChange={setEmployeeStatus}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOrder={LEAVE_STATUS_TOOLBAR_ORDER}
        statusLabels={LEAVE_STATUS_LABELS_FOR_TOOLBAR}
        statusCounts={statusCounts}
        onDateBoundsChange={setDateBounds}
        dataView={{
          value: view,
          onChange: (v) => setView(v as 'table' | 'card'),
          options: [
            { value: 'table', label: 'جدول', icon: 'list' },
            { value: 'card', label: 'بطاقات', icon: 'layout-grid' },
          ],
        }}
      />
    ),
    [
      branchId, departmentId, leaveType, approvalStageFilter,
      statusFilter, selectedEmpKey, employeeStatus,
      dateBounds.from, dateBounds.to,
      statusCounts.all, statusCounts.pending, statusCounts.approved, statusCounts.rejected, statusCounts.cancelled,
      view, companyId, inlineSelects,
    ],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 animate-fade-in">

      <DirectoryPagedViews
        items={filtered}
        serverPagination={pagination}
        loading={listLoading}
        resetDeps={[view, filters.branchId, filters.departmentId, filters.status, filters.type, filters.approvalStage, selectedEmpKey, dateBounds.from, dateBounds.to, employeeStatus]}
      >
        {(pageItems) => (
          view === 'table'
            ? <LeaveTable leaves={pageItems} employees={employeesList} branches={branches} currentEmployeeId={currentEmployeeId} onDetail={setDetailLeave} onApprove={handleApprove} onReject={handleReject} />
            : <LeaveCardGrid leaves={pageItems} employees={employeesList} currentEmployeeId={currentEmployeeId} onDetail={setDetailLeave} onApprove={handleApprove} onReject={handleReject} />
        )}
      </DirectoryPagedViews>

      {/* Detail dialog */}
      {detailLeave && (
        <LeaveDetailDialog
          leave={detailLeave}
          employees={employeesList}
          open={!!detailLeave}
          onClose={() => setDetailLeave(null)}
        />
      )}

      <RejectReasonDialog
        open={rejectTarget != null}
        onOpenChange={(open) => { if (!open) setRejectTarget(null); }}
        kind="leave"
        title="رفض طلب الإجازة"
        description={rejectTarget
          ? `${employeeDisplayName(rejectTarget.leave, employeesList)} · ${leaveTypeDisplayLabel(rejectTarget.leave)} · ${rejectTarget.leave.start} إلى ${rejectTarget.leave.end}`
          : undefined}
        onConfirm={confirmReject}
      />

      {/* Add/Edit dialog */}
      <AddLeaveDialog
        open={addOpen}
        editLeave={editLeave}
        employees={addDialogEmployees}
        branches={branches}
        leaveTypes={leaveTypes}
        leaveRequestTypes={leaveRequestTypes}
        companyId={companyId ?? ''}
        onClose={() => { setAddOpen(false); setEditLeave(null); }}
        onSave={async () => {
          await reloadLeaves();
          setAddOpen(false);
          setEditLeave(null);
        }}
      />
    </div>
  );
}

// ─── Leave table ──────────────────────────────────────────────────────────────

function LeaveTable({ leaves, employees, branches, currentEmployeeId, onDetail, onApprove, onReject }: {
  leaves: UnifiedLeaveRecord[];
  employees: { id: string; nameAr: string }[];
  branches: BranchResponseDto[];
  currentEmployeeId: string | null;
  onDetail: (l: UnifiedLeaveRecord) => void;
  onApprove: (l: UnifiedLeaveRecord) => void;
  onReject: (l: UnifiedLeaveRecord) => void;
}) {
  const columns: ColumnDef<UnifiedLeaveRecord>[] = [
    {
      key: 'employee',
      title: 'الموظف',
      render: (l) => {
        const name = employeeDisplayName(l, employees);
        return (
          <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {name.charAt(0) ?? '?'}
            </div>
            <div>
              <p className="font-medium">{name}</p>
              {l.departmentNameAr ? (
                <p className="text-[10px] text-muted-foreground">{l.departmentNameAr}</p>
              ) : l.requestTypeNameAr ? (
                <p className="text-[10px] text-muted-foreground">{l.requestTypeNameAr}</p>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      key: 'type',
      title: 'النوع',
      render: (l) => {
        const typeCfg = TYPE_STYLE[l.type];
        return (
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium', typeCfg.color)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', typeCfg.dot)} />
            {leaveTypeDisplayLabel(l)}
          </span>
        );
      },
    },
    {
      key: 'status',
      title: 'الحالة',
      render: (l) => <LeaveStatusBadge leave={l} />,
    },
    {
      key: 'start',
      title: 'من',
      render: (l) => <TableDateCell value={l.start} />,
    },
    {
      key: 'end',
      title: 'إلى',
      render: (l) => <TableDateCell value={l.end} />,
    },
    {
      key: 'days',
      title: 'أيام',
      render: (l) => <span className="font-mono text-xs number-ar">{l.workingDays}</span>,
    },
    {
      key: 'submitted',
      title: 'تاريخ التقديم',
      hideOnMobile: true,
      render: (l) => <TableDateCell value={l.submittedAt} mode="datetime" />,
    },
    {
      key: 'approvers',
      title: 'مسار الموافقة',
      hideOnMobile: true,
      render: (l) => <RequestApproversInline states={l.approverStates} />,
    },
    {
      key: 'department',
      title: 'القسم',
      hideOnMobile: true,
      render: (l) => <span className="text-xs text-muted-foreground">{l.departmentNameAr || '—'}</span>,
    },
    {
      key: 'note',
      title: 'سبب الطلب',
      hideOnMobile: true,
      render: (l) => (
        <span className="line-clamp-3 max-w-[14rem] text-xs text-muted-foreground" title={l.noteAr ?? undefined}>
          {l.noteAr ?? '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: 'قرار',
      isActions: true,
      className: 'min-w-[7rem]',
      render: (l) => <LeaveDecisionCell leave={l} currentEmployeeId={currentEmployeeId} onApprove={onApprove} onReject={onReject} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={leaves}
      keyExtractor={(l) => l.id}
      emptyText="لا توجد إجازات بهذه الفلاتر"
      onRowClick={onDetail}
      mobileCard={(l) => {
        const name = employeeDisplayName(l, employees);
        const typeCfg = TYPE_STYLE[l.type];
        const showApproval = canShowLeaveApprovalActions(l, currentEmployeeId);
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {name.charAt(0) ?? '?'}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{name}</p>
                </div>
              </div>
              <LeaveStatusBlock leave={l} compact />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', typeCfg.color)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', typeCfg.dot)} />
                {leaveTypeDisplayLabel(l)}
              </span>
              <span className="text-xs text-muted-foreground font-mono" dir="ltr">{l.start} → {l.end}</span>
              <span className="text-xs text-muted-foreground">{l.workingDays} أيام</span>
            </div>
            {l.noteAr?.trim() ? (
              <p className="  text-xs text-muted-foreground text-right" title={l.noteAr}>
                {l.noteAr}
              </p>
            ) : null}
            {l.decisionNotesAr?.trim() ? (
              <p className="text-xs text-muted-foreground text-right" title={l.decisionNotesAr}>
                ملاحظات القرار: {l.decisionNotesAr}
              </p>
            ) : null}
            <RequestApproversInline states={l.approverStates} />
            {showApproval ? (
              <RequestApprovalActionButtons
                states={l.approverStates}
                currentEmployeeId={currentEmployeeId}
                onApprove={() => onApprove(l)}
                onReject={() => onReject(l)}
                compact
              />
            ) : null}
          </div>
        );
      }}
    />
  );
}

// ─── Card grid view ────────────────────────────────────────────────────────────

function LeaveCardGrid({ leaves, employees, currentEmployeeId, onDetail, onApprove, onReject }: {
  leaves: UnifiedLeaveRecord[];
  employees: { id: string; nameAr: string }[];
  currentEmployeeId: string | null;
  onDetail: (l: UnifiedLeaveRecord) => void;
  onApprove: (l: UnifiedLeaveRecord) => void;
  onReject: (l: UnifiedLeaveRecord) => void;
}) {
  if (leaves.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border py-16 text-center">
        <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">لا توجد إجازات بهذه الفلاتر</p>
      </div>
    );
  }

  return (
    <EntityActionCardGrid>
      {leaves.map((l) => {
        const name = employeeDisplayName(l, employees);
        const typeCfg = TYPE_STYLE[l.type];
        const showApproval = canShowLeaveApprovalActions(l, currentEmployeeId);
        const meta = leaveStatusMeta(l);
        return (
          <EntityActionCard
            key={l.id}
            onClick={() => onDetail(l)}
            title={name}
            subtitle={l.departmentNameAr || l.requestTypeNameAr || leaveTypeDisplayLabel(l)}
            avatarLetter={name}
            status={{
              label: LEAVE_STATUS_LABELS[l.status],
              tone: LEAVE_STATUS_TONE[l.status],
              meta: meta.dateValue ? (
                <>
                  {meta.dateLabel}: <span className="font-mono text-foreground" dir="ltr">{meta.dateValue}</span>
                </>
              ) : undefined,
            }}
            chips={
              <>
                <EntityActionCardChip className={typeCfg.color}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', typeCfg.dot)} />
                  {leaveTypeDisplayLabel(l)}
                </EntityActionCardChip>
                {l.submittedAt ? (
                  <EntityActionCardChip className="font-mono tabular-nums">
                    <span dir="ltr">{formatIsoDate(l.submittedAt)}</span>
                  </EntityActionCardChip>
                ) : null}
              </>
            }
            metrics={
              <EntityActionCardMetricsRow>
                <EntityActionCardMetric label="من" value={l.start} dir="ltr" />
                <EntityActionCardMetricDivider />
                <EntityActionCardMetric label="إلى" value={l.end} dir="ltr" />
                <EntityActionCardMetricDivider />
                <EntityActionCardMetric label="أيام" value={l.workingDays} />
              </EntityActionCardMetricsRow>
            }
            description={
              [l.noteAr, l.decisionNotesAr?.trim() ? `ملاحظات القرار: ${l.decisionNotesAr}` : '']
                .filter(Boolean)
                .join(' — ') || undefined
            }
            children={
              <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                {showApproval ? (
                  <RequestApprovalActionButtons
                    states={l.approverStates}
                    currentEmployeeId={currentEmployeeId}
                    onApprove={() => onApprove(l)}
                    onReject={() => onReject(l)}
                    compact
                  />
                ) : null}
                {l.approverStates ? (
                  <RequestApproverStatesPanel states={l.approverStates} compact className="border-0 bg-transparent p-0" />
                ) : null}
              </div>
            }
          />
        );
      })}
    </EntityActionCardGrid>
  );
}

// ─── Leave detail dialog ───────────────────────────────────────────────────────

function LeaveDetailDialog({ leave, employees, open, onClose }: {
  leave: UnifiedLeaveRecord;
  employees: { id: string; nameAr: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const name = employeeDisplayName(leave, employees);
  const typeCfg = TYPE_STYLE[leave.type];
  const statusMeta = leaveStatusMeta(leave);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-visible border-border p-0">
        <div className="shrink-0 border-b border-border px-6 py-5">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">تفاصيل الإجازة</DialogTitle>
            <DialogDescription>{name} · {leaveTypeDisplayLabel(leave)}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Employee & type/status */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
              {name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{name}</p>
              {leave.requestTypeNameAr ? (
                <p className="text-xs text-muted-foreground">{leave.requestTypeNameAr}</p>
              ) : null}
            </div>
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium', typeCfg.color)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', typeCfg.dot)} />
              {leaveTypeDisplayLabel(leave)}
            </span>
          </div>

          <LeaveStatusBlock leave={leave} />

          {/* Dates */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'من', value: leave.start },
              { label: 'إلى', value: leave.end },
              { label: 'الأيام', value: `${leave.workingDays} يوم` },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
                <p className="mt-0.5 font-mono text-sm font-semibold" dir="ltr">{item.value}</p>
              </div>
            ))}
          </div>

          {leave.noteAr ? (
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground">سبب الطلب</p>
              <p className="mt-1 text-sm">{leave.noteAr}</p>
            </div>
          ) : null}

          <Separator />

          <RequestApproverStatesPanel states={leave.approverStates} />

          <div>
            <p className="mb-3 text-sm font-semibold">القرار</p>
            {leave.status === 'pending' ? (
              <div className="space-y-2 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 text-gold" />
                  بانتظار الموافقة أو الرفض
                </p>
                {statusMeta.dateValue ? (
                  <p className="text-muted-foreground">
                    {statusMeta.dateLabel}:{' '}
                    <span className="font-mono text-foreground" dir="ltr">{statusMeta.dateValue}</span>
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm">
                {statusMeta.dateValue ? (
                  <p className="text-muted-foreground">
                    {statusMeta.dateLabel}:{' '}
                    <span className="font-mono text-foreground" dir="ltr">{statusMeta.dateValue}</span>
                  </p>
                ) : null}
                {leave.decisionNotesAr ? (
                  <p className="text-muted-foreground">
                    ملاحظات القرار: <span className="text-foreground">{leave.decisionNotesAr}</span>
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    {leave.status === 'approved' ? 'تمت الموافقة على الطلب' :
                      leave.status === 'rejected' ? 'تم رفض الطلب' :
                        leave.status === 'cancelled' ? 'تم إلغاء الطلب' : 'تم تسجيل القرار'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className={dialogFormFooterClass}>
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add/Edit leave dialog ────────────────────────────────────────────────────

function AddLeaveDialog({ open, editLeave, employees, branches, leaveTypes, leaveRequestTypes, companyId, onClose, onSave }: {
  open: boolean;
  editLeave: UnifiedLeaveRecord | null;
  employees: { id: string; nameAr: string }[];
  branches: BranchResponseDto[];
  leaveTypes: LeaveTypeResponseDto[];
  leaveRequestTypes: ApiRequestType[];
  companyId: string;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [empId, setEmpId] = React.useState('');
  const [branchId, setBranchId] = React.useState('');
  const [requestTypeId, setRequestTypeId] = React.useState('');
  const [leaveTypeId, setLeaveTypeId] = React.useState('');
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const [reasonAr, setReasonAr] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const defaultRequestTypeId = pickDefaultLeaveRequestTypeId(leaveRequestTypes);

  React.useEffect(() => {
    if (open && editLeave) {
      setEmpId(editLeave.employeeId);
      setBranchId(editLeave.requestBranchId);
      setRequestTypeId(editLeave.requestTypeId ?? defaultRequestTypeId);
      setLeaveTypeId(editLeave.leaveTypeId);
      setStart(editLeave.start);
      setEnd(editLeave.end);
      setReasonAr(editLeave.noteAr ?? '');
    } else if (open) {
      setEmpId('');
      setBranchId('');
      setRequestTypeId(defaultRequestTypeId);
      setLeaveTypeId(leaveTypes[0]?.id ?? '');
      setStart('');
      setEnd('');
      setReasonAr('');
    }
    setError(null);
  }, [open, editLeave, leaveTypes, defaultRequestTypeId]);

  const submit = async () => {
    if (!empId || !leaveTypeId) { setError('اختر الموظف ونوع الإجازة'); return; }
    if (!start || !end || start > end) { setError('تحقق من التواريخ'); return; }
    if (!editLeave && reasonAr.trim().length < 3) {
      setError('أدخل سبباً (3 أحرف على الأقل)');
      return;
    }
    const userId = useAuthStore.getState().user?.id ?? '';
    const resolvedRequestTypeId = requestTypeId || defaultRequestTypeId;
    try {
      if (editLeave) {
        await leaveRequestsNewApi.update(editLeave.id, {
          startDate: start,
          endDate: end,
          workingDays: wDays(start, end),
          reasonAr: reasonAr.trim() || undefined,
          updatedBy: userId,
        });
        toast.success('تم تحديث الطلب');
      } else {
        await leaveRequestsNewApi.create({
          companyId,
          employeeId: empId,
          requestTypeId: resolvedRequestTypeId,
          leaveTypeId,
          startDate: start,
          endDate: end,
          workingDays: wDays(start, end),
          reasonAr: reasonAr.trim(),
          createdBy: userId,
        });
        toast.success('تم إنشاء الطلب');
      }
      await onSave();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const empOptions = employees.map((e) => ({ value: e.id, label: e.nameAr }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-md flex-col overflow-visible border-border p-0">
        <div className="shrink-0 border-b border-border px-6 py-5">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editLeave ? 'تعديل الإجازة' : 'إضافة إجازة'}</DialogTitle>
            <DialogDescription>أدخل بيانات طلب الإجازة.</DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="space-y-2">
            <Label>الموظف <span className="text-destructive">*</span></Label>
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
              <SelectContent>
                {empOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>فرع الطلب</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
              <SelectContent>
                {branches.length === 0 ? (
                  <SelectItem value="__none__" disabled>لا توجد فروع</SelectItem>
                ) : (
                  branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.nameAr}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>نوع الإجازة <span className="text-destructive">*</span></Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId} disabled={!!editLeave}>
              <SelectTrigger><SelectValue placeholder="اختر نوع الإجازة" /></SelectTrigger>
              <SelectContent>
                {leaveTypes.map((lt) => <SelectItem key={lt.id} value={lt.id}>{lt.nameAr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>السبب / الملاحظات {!editLeave ? <span className="text-destructive">*</span> : null}</Label>
            <Textarea
              value={reasonAr}
              onChange={(e) => setReasonAr(e.target.value)}
              placeholder="سبب طلب الإجازة…"
              className="min-h-[72px] resize-none text-sm"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>من <span className="text-destructive">*</span></Label>
              <DatePickerInput value={start} onChange={setStart} placeholder="تاريخ البداية" />
            </div>
            <div className="space-y-2">
              <Label>إلى <span className="text-destructive">*</span></Label>
              <DatePickerInput value={end} onChange={setEnd} placeholder="تاريخ النهاية" minDate={start || undefined} />
            </div>
          </div>

          {start && end && start <= end && (
            <p className="text-xs text-muted-foreground">
              عدد الأيام: <span className="font-bold text-foreground number-ar">{wDays(start, end)}</span> يوم
            </p>
          )}

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className={dialogFormFooterClass}>
          <Button variant="luxe" onClick={() => void submit()}>{editLeave ? 'حفظ التعديلات' : 'إضافة الإجازة'}</Button>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
