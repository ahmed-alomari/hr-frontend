'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useSetPageTitle } from '@/components/layouts/page-title-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { Plus } from 'lucide-react';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { useServerDirectoryPagination } from '@/components/ui/paged-list';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { useCurrentEmployee } from '@/features/hr/organization/employees/hooks/useCurrentEmployee';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { usePagePermissions } from '@/features/auth/permissions';
import {
  OVERTIME_REQUESTS_PAGE_PERMISSIONS,
} from '@/features/hr/requests/overtime-requests/permissions';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { resolveDirectoryLoadFailure } from '@/features/hr/lib/api/directory-load-error';
import { fetchAllPaginatedItems } from '@/features/hr/lib/api/client';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import {
  employeeStatusFilterLabelAr,
  employeeStatusQuery,
  isEmployeeStatusFilterActive,
  useEmployeeStatusFilter,
} from '@/features/hr/lib/employee-status-filter';
import type { RegisterColumn } from '@/components/pdf/print/register-document';
import { exportDate, exportDuration, exportText } from '@/features/hr/requests/lib/list-export-format';
import { overtimeRequestsApi } from '@/features/hr/requests/lib/api/overtime-requests';
import type { OvertimeRequestStatusDto } from '@/features/hr/requests/lib/api/overtime-requests';
import { requestTypesApi, type ApiRequestType } from '@/features/hr/requests/lib/api/request-types';
import { useHREmployeeDirectoryStore } from '@/features/hr/requests/lib/employee-directory-store';
import {
  attendanceEventsApi,
  type DailyBreakdownResponseDto,
} from '@/features/hr/attendance/lib/api/attendance-events';
import {
  mapOvertimeRequestListItem,
  type OvertimeRequestRecord,
} from '@/features/hr/requests/overtime-requests/services/overtime-requests.service';
import { getRequestApprovalUiState } from '@/features/hr/requests/lib/request-approver-states';
import type { ApprovalUiState } from '@/features/hr/requests/components/request-approval-actions';
import {
  hrFiltersKey,
  usePersistedEmpIdSet,
  usePersistedFilterState,
} from '@/features/hr/lib/use-persisted-filter-state';

export type OvertimeStatusFilter = 'all' | OvertimeRequestStatusDto;
export type OvertimeViewMode = 'cards' | 'list';

export const OVERTIME_STATUS_LABELS: Record<OvertimeRequestStatusDto, string> = {
  pending: 'قيد الموافقة',
  approved: 'معتمد',
  rejected: 'مرفوض',
  cancelled: 'ملغاة',
};

export const OVERTIME_STATUS_ORDER: OvertimeRequestStatusDto[] = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
];

const OVERTIME_EXPORT_COLUMNS: RegisterColumn[] = [
  { label: 'الموظف', kind: 'name' },
  { label: 'تاريخ العمل الإضافي', kind: 'date' },
  { label: 'المدة المطلوبة', kind: 'number' },
  { label: 'المدة المعتمدة', kind: 'number' },
  { label: 'السبب', kind: 'text', weight: 1.6 },
  { label: 'الحالة', kind: 'status' },
  { label: 'ملاحظات القرار', kind: 'text', weight: 1.3 },
];

export function useOvertimeRequestsDirectoryModel() {
  useSetPageTitle({
    titleAr: 'طلبات العمل الإضافي',
    descriptionAr: 'تقديم واعتماد طلبات العمل الإضافي للموظفين.',
    iconName: 'Timer',
  });

  const companyId = useDefaultCompanyId();
  const authUser = useAuthStore((s) => s.user);
  const { data: currentEmployee } = useCurrentEmployee();
  const currentEmployeeId = currentEmployee?.id ?? null;
  const actor = authUser?.email ?? authUser?.id ?? undefined;

  const perms = usePagePermissions(OVERTIME_REQUESTS_PAGE_PERMISSIONS);
  const [apiAccessDenied, setApiAccessDenied] = React.useState(false);
  const accessDenied = !perms.canRead || apiAccessDenied;
  const [listError, setListError] = React.useState<string | null>(null);

  const { employees: allEmployees, fetch: fetchEmployees } = useHREmployeeDirectoryStore();
  React.useEffect(() => {
    if (allEmployees.length === 0) void fetchEmployees();
  }, [allEmployees.length, fetchEmployees]);

  // Filter picker: every employee with its status; ListFilterBar keeps the
  // ones of the chosen employee status.
  const empPickerEmployees = React.useMemo(
    () => allEmployees.map((e) => ({ id: e.id, name: e.nameAr, contractStatus: e.status })),
    [allEmployees],
  );

  // The catalog row backing "طلب عمل إضافي" — resolved once per company.
  const [overtimeRequestType, setOvertimeRequestType] = React.useState<ApiRequestType | null>(null);
  React.useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void requestTypesApi
      .list({ companyId, requestCategory: 'overtime', isActive: true, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        const officialFirst = res.items.find((t) => t.slug === 'overtime-request') ?? res.items[0] ?? null;
        setOvertimeRequestType(officialFirst);
      })
      .catch(() => {
        if (!cancelled) setOvertimeRequestType(null);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const [statusFilter, setStatusFilter] = usePersistedFilterState<OvertimeStatusFilter>(
    hrFiltersKey('requests', 'overtime-requests', companyId, 'statusFilter'),
    'all',
  );
  const [selectedEmpIds, setSelectedEmpIds] = usePersistedEmpIdSet(
    hrFiltersKey('requests', 'overtime-requests', companyId, 'selectedEmpIds'),
  );
  const [employeeStatus, setEmployeeStatus] = useEmployeeStatusFilter(
    hrFiltersKey('requests', 'overtime-requests', companyId, 'employeeStatus'),
  );
  const [dateBounds, setDateBounds] = usePersistedFilterState(
    hrFiltersKey('requests', 'overtime-requests', companyId, 'dateBounds'),
    { from: '', to: '' },
  );
  const [viewMode, setViewMode] = usePersistedFilterState<OvertimeViewMode>(
    hrFiltersKey('requests', 'overtime-requests', companyId, 'viewMode'),
    'cards',
  );

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<OvertimeRequestRecord | null>(null);
  const [detailTarget, setDetailTarget] = React.useState<OvertimeRequestRecord | null>(null);
  const [approveTarget, setApproveTarget] = React.useState<OvertimeRequestRecord | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [cancelId, setCancelId] = React.useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  // Real check-in/check-out + computed overtime for whichever request is
  // currently open in the detail or approve dialog — lets the approver
  // compare the requested minutes against what actually happened that day.
  const [dailyBreakdown, setDailyBreakdown] = React.useState<DailyBreakdownResponseDto | null>(null);
  const [breakdownLoading, setBreakdownLoading] = React.useState(false);
  const [breakdownError, setBreakdownError] = React.useState<string | null>(null);

  const breakdownSource = detailTarget ?? approveTarget;
  React.useEffect(() => {
    if (!breakdownSource) {
      setDailyBreakdown(null);
      setBreakdownError(null);
      return;
    }
    let cancelled = false;
    setBreakdownLoading(true);
    setBreakdownError(null);
    void attendanceEventsApi
      .getDailyBreakdown({
        employeeId: breakdownSource.employeeId,
        workDate: breakdownSource.workDate,
        companyId: companyId ?? undefined,
        timezoneOffsetMinutes: 180,
      })
      .then((res) => {
        if (cancelled) return;
        setDailyBreakdown(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setDailyBreakdown(null);
        setBreakdownError(handleApiError(err, 'overtime-requests.daily-breakdown').displayMessage);
      })
      .finally(() => {
        if (!cancelled) setBreakdownLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [breakdownSource, companyId]);

  const selectedEmpKey = React.useMemo(() => [...selectedEmpIds].sort().join(','), [selectedEmpIds]);

  const buildListQuery = React.useCallback((page: number, pageSize: number) => ({
    companyId: companyId!,
    page,
    limit: pageSize,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(dateBounds.from ? { workDateFrom: dateBounds.from } : {}),
    ...(dateBounds.to ? { workDateTo: dateBounds.to } : {}),
    ...(selectedEmpIds.size > 0 ? { employeeIds: [...selectedEmpIds] } : {}),
    ...employeeStatusQuery(employeeStatus),
  }), [companyId, statusFilter, dateBounds.from, dateBounds.to, selectedEmpIds, employeeStatus]);

  const loadPage = React.useCallback(async (page: number, pageSize: number) => {
    if (!companyId) return { items: [] as OvertimeRequestRecord[], total: 0 };
    setListError(null);
    try {
      const res = await overtimeRequestsApi.list(buildListQuery(page, pageSize));
      const items = res.items.map((item) => mapOvertimeRequestListItem(item, res.approvalAssignments));
      setApiAccessDenied(false);
      return { items, total: res.pagination.total };
    } catch (err) {
      const failure = resolveDirectoryLoadFailure(err, 'overtime-requests.load');
      setApiAccessDenied(failure.accessDenied);
      setListError(failure.listError);
      return { items: [], total: 0 };
    }
  }, [buildListQuery, companyId]);

  const {
    items,
    loading,
    pagination,
    reload: reloadList,
  } = useServerDirectoryPagination<OvertimeRequestRecord>(loadPage, {
    enabled: !!companyId,
    resetDeps: [companyId, statusFilter, dateBounds.from, dateBounds.to, selectedEmpKey, employeeStatus],
  });

  const statusCounts = React.useMemo((): Record<string, number> => {
    const counts: Record<string, number> = { all: pagination.total };
    for (const key of OVERTIME_STATUS_ORDER) {
      counts[key] = statusFilter === key ? pagination.total : items.filter((x) => x.status === key).length;
    }
    return counts;
  }, [items, pagination.total, statusFilter]);

  const runAction = React.useCallback(async (id: string, action: () => Promise<void>, successMessage: string) => {
    setActionLoadingId(id);
    try {
      await action();
      toast.success(successMessage);
      await reloadList();
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'overtime-requests.action');
      toast.error(displayMessage);
    } finally {
      setActionLoadingId(null);
    }
  }, [reloadList]);

  const createRequest = React.useCallback(async (payload: {
    employeeId: string;
    workDate: string;
    requestedMinutes: number;
    reasonAr: string;
  }) => {
    if (!companyId) throw new Error('تعذر تحديد الشركة');
    if (!overtimeRequestType) throw new Error('تعذر تحديد نوع طلب العمل الإضافي — تأكد من وجود نوع طلب مفعّل بفئة «إضافي».');
    await overtimeRequestsApi.create({
      companyId,
      employeeId: payload.employeeId,
      requestTypeId: overtimeRequestType.id,
      workDate: payload.workDate,
      requestedMinutes: payload.requestedMinutes,
      reasonAr: payload.reasonAr,
      createdBy: actor ?? null,
    });
    await reloadList();
  }, [actor, companyId, overtimeRequestType, reloadList]);

  const updateRequest = React.useCallback(async (id: string, payload: {
    requestedMinutes?: number;
    reasonAr?: string;
  }) => {
    await overtimeRequestsApi.update(id, { ...payload, updatedBy: actor ?? null });
    await reloadList();
  }, [actor, reloadList]);

  const handleApprove = React.useCallback(async (
    x: OvertimeRequestRecord,
    options?: { approvedMinutes?: number; decisionNotesAr?: string | null },
  ) => {
    if (!companyId) return;
    try {
      setActionLoadingId(x.id);
      const updated = await overtimeRequestsApi.decide(x.id, {
        decision: 'approve',
        ...(currentEmployeeId ? { approverEmployeeId: currentEmployeeId, decidedByEmployeeId: currentEmployeeId } : {}),
        ...(options?.approvedMinutes != null ? { approvedMinutes: options.approvedMinutes } : {}),
        ...(options?.decisionNotesAr?.trim() ? { decisionNotesAr: options.decisionNotesAr.trim() } : {}),
        updatedBy: actor,
      });
      toast.success(
        updated.status === 'approved'
          ? 'تم اعتماد طلب العمل الإضافي نهائياً.'
          : 'تم تسجيل موافقتك — بانتظار بقية المعتمدين.',
      );
      await reloadList();
      setDetailTarget(null);
      setApproveTarget(null);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'overtime-requests.decide.approve');
      toast.error(displayMessage);
    } finally {
      setActionLoadingId(null);
    }
  }, [actor, companyId, currentEmployeeId, reloadList]);

  /** Rejects with the reason the approver wrote; throws so the reason dialog stays open on failure. */
  const handleReject = React.useCallback(async (x: OvertimeRequestRecord, reason: string) => {
    if (!companyId) return;
    try {
      setActionLoadingId(x.id);
      await overtimeRequestsApi.decide(x.id, {
        decision: 'reject',
        ...(currentEmployeeId ? { approverEmployeeId: currentEmployeeId, decidedByEmployeeId: currentEmployeeId } : {}),
        decisionNotesAr: reason,
        updatedBy: actor,
      });
      toast.message('تم رفض طلب العمل الإضافي.');
      await reloadList();
      setDetailTarget(null);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'overtime-requests.decide.reject');
      toast.error(displayMessage);
      throw err;
    } finally {
      setActionLoadingId(null);
    }
  }, [actor, companyId, currentEmployeeId, reloadList]);

  /**
   * Only people on the active assignment can approve. A request with no
   * approvers yet stays pending and shows no decision buttons.
   */
  const getApprovalUiState = React.useCallback(
    (x: OvertimeRequestRecord): ApprovalUiState => {
      if (x.status !== 'pending' || !x.approverStates) {
        return { showActions: false, canAct: false, reasonAr: null };
      }
      return getRequestApprovalUiState(x.approverStates, currentEmployeeId);
    },
    [currentEmployeeId],
  );

  const canShowApprovalActions = React.useCallback(
    (x: OvertimeRequestRecord) => getApprovalUiState(x).showActions,
    [getApprovalUiState],
  );

  const handleCancel = React.useCallback(async () => {
    if (!cancelId) return;
    await runAction(cancelId, async () => {
      await overtimeRequestsApi.cancel(cancelId, { updatedBy: actor ?? null });
    }, 'تم سحب طلب العمل الإضافي.');
    setCancelId(null);
  }, [actor, cancelId, runAction]);

  const handleDelete = React.useCallback(async () => {
    if (!deleteId) return;
    await runAction(deleteId, async () => {
      await overtimeRequestsApi.remove(deleteId);
    }, 'تم حذف طلب العمل الإضافي.');
    setDeleteId(null);
  }, [deleteId, runAction]);

  const activeFilterCount =
    (selectedEmpIds.size > 0 ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (dateBounds.from || dateBounds.to ? 1 : 0)
    + (isEmployeeStatusFilterActive(employeeStatus) ? 1 : 0);

  const getExportRows = useLatestCallback(async (): Promise<string[][]> => {
    if (!companyId) return [];
    const { items: all } = await fetchAllPaginatedItems(async (page, limit) => {
      const res = await overtimeRequestsApi.list(buildListQuery(page, limit));
      return {
        items: res.items.map((item) => mapOvertimeRequestListItem(item, res.approvalAssignments)),
        pagination: res.pagination,
      };
    });
    return all.map((x) => [
      exportText(x.employeeNameAr),
      exportDate(x.workDate),
      exportDuration(x.requestedMinutes),
      exportDuration(x.approvedMinutes),
      exportText(x.reasonAr),
      OVERTIME_STATUS_LABELS[x.status] ?? x.status,
      exportText(x.decisionNotesAr),
    ]);
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <RegisterExportMenu
          title="سجل طلبات العمل الإضافي"
          fileName="overtime-requests"
          columns={OVERTIME_EXPORT_COLUMNS}
          getRows={getExportRows}
          subtitleLines={[`حالة الموظفين: ${employeeStatusFilterLabelAr(employeeStatus)}`]}
          landscape
        />
        <PageHeaderPrimaryButton
          icon={Plus}
          label="طلب عمل إضافي"
          onClick={() => { setEditTarget(null); setDrawerOpen(true); }}
        >
          طلب عمل إضافي
        </PageHeaderPrimaryButton>
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
        onDateBoundsChange={setDateBounds}
        companyId={companyId}
        empPickerEmployees={empPickerEmployees}
        selectedEmpIds={selectedEmpIds}
        onSelectedEmpIdsChange={setSelectedEmpIds}
        employeeStatus={employeeStatus}
        onEmployeeStatusChange={setEmployeeStatus}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => setStatusFilter(v as OvertimeStatusFilter)}
        statusOrder={OVERTIME_STATUS_ORDER}
        statusLabels={OVERTIME_STATUS_LABELS}
        statusCounts={statusCounts}
        dataView={{
          value: viewMode,
          onChange: (v) => setViewMode(v as OvertimeViewMode),
          options: [
            { value: 'cards', label: 'بطاقات', icon: 'layout-grid' },
            { value: 'list', label: 'جدول', icon: 'list' },
          ],
        }}
      />
    ),
    [
      dateBounds.from, dateBounds.to, companyId, empPickerEmployees, selectedEmpKey, employeeStatus,
      statusFilter, statusCounts, viewMode,
    ],
  );

  // New requests: active employees only; the request's own employee stays
  // selectable when editing.
  const editEmployeeId = editTarget?.employeeId;
  const empOptions = React.useMemo(
    () => allEmployees
      .filter((e) => e.status === 'active' || e.id === editEmployeeId)
      .map((e) => ({ value: e.id, label: e.nameAr })),
    [allEmployees, editEmployeeId],
  );

  return {
    perms,
    accessDenied,
    listError,
    companyId,
    currentEmployeeId,
    items,
    loading,
    pagination,
    viewMode,
    employees: empOptions,
    drawerOpen,
    setDrawerOpen,
    editTarget,
    setEditTarget,
    detailTarget,
    setDetailTarget,
    approveTarget,
    setApproveTarget,
    dailyBreakdown,
    breakdownLoading,
    breakdownError,
    deleteId,
    setDeleteId,
    cancelId,
    setCancelId,
    actionLoadingId,
    createRequest,
    updateRequest,
    handleApprove,
    handleReject,
    handleCancel,
    handleDelete,
    canShowApprovalActions,
    getApprovalUiState,
    reloadList,
    overtimeRequestType,
  };
}

export type OvertimeRequestsDirectoryModel = ReturnType<typeof useOvertimeRequestsDirectoryModel>;
