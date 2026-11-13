'use client';

import * as React from 'react';
import { Ban, CalendarDays, CheckCircle2, Loader2, Plus, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import {
  EntityActionCard,
  EntityActionCardChip,
  EntityActionCardGrid,
  type WorkflowStatusTone,
} from '@/components/ui/entity-action-card';
import { DirectoryPagedViews, useServerDirectoryPagination } from '@/components/ui/paged-list';
import { correctionRequestsApi } from '@/features/hr/requests/lib/api/correction-requests';
import { fetchAllPaginatedItems } from '@/features/hr/lib/api/client';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import { RejectReasonDialog } from '@/components/approval/reject-reason-dialog';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import {
  employeeStatusFilterLabelAr,
  employeeStatusQuery,
  isEmployeeStatusFilterActive,
  useEmployeeStatusFilter,
} from '@/features/hr/lib/employee-status-filter';
import type { RegisterColumn } from '@/components/pdf/print/register-document';
import { exportClock, exportDate, exportDateTime, exportText } from '@/features/hr/requests/lib/list-export-format';
import { mapCorrectionRequest } from '@/features/hr/requests/lib/attendance-correction-store';
import { TableDateCell, TableRowActions } from '@/components/ui/table-cells';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { useSetPageTitle } from '@/components/layouts/page-title-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/shared-dialogs';
import { AttendanceCorrectionRequestDialog } from '@/features/hr/requests/attendance-corrections/components/attendance-correction-request-dialog';
import {
  attendanceEventsApi,
  type DailyBreakdownResponseDto,
} from '@/features/hr/attendance/lib/api/attendance-events';
import {
  ActualRegistrationBlock,
  PeriodCard,
  StatChip,
  WEEKDAY_AR,
  defaultTimezoneOffsetMinutes,
  resolveDayActualWithoutPeriods,
  statusCfg,
} from '@/features/hr/attendance/daily/components/daily-day-detail-dialog';
import { fmtFull, minutesToHHMM } from '@/features/hr/attendance/daily/utils/daily-attendance-format';
import { useHRConfigurationStore } from '@/features/hr/requests/lib/configuration-store';
import { useHREmployeeDirectoryStore } from '@/features/hr/requests/lib/employee-directory-store';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { useCurrentEmployee } from '@/features/hr/organization/employees/hooks/useCurrentEmployee';
import { checkRequestApprovalAccess } from '@/features/hr/requests/lib/request-approval-access';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import {
  buildRequestCorrectionDecisionPayload,
  getRequestApprovalUiState,
  isEmployeeInRequestApproverStates,
  isRequestFullyApproved,
} from '@/features/hr/requests/lib/request-approver-states';
import { RequestApproverStatesPanel } from '@/features/hr/requests/components/request-approver-states-panel';
import { RequestApprovalActionCell, RequestApprovalActionButtons } from '@/features/hr/requests/components/request-approval-actions';
import { RequestApproversInline } from '@/features/hr/requests/components/request-approvers-inline';
import {
  CorrectionTimesComparisonCell,
  CorrectionTimesComparisonDetail,
} from '@/features/hr/requests/components/correction-period-times';
import {
  useAttendanceCorrectionRequestsStore,
  attendanceCorrectionStatusLabelAr,
} from '@/features/hr/requests/lib/attendance-correction-store';
import type { AttendanceCorrectionRequest } from '@/features/hr/requests/lib/attendance-correction-store';
import { cn } from '@/shared/utils';
import {
  hrFiltersKey,
  usePersistedEmpIdSet,
  usePersistedFilterState,
} from '@/features/hr/lib/use-persisted-filter-state';

import { AR_CORRECTION_REQUEST_STATUS_LABELS } from '@/shared/i18n/ar';

type ViewMode = 'cards' | 'list';

const STATUS_ORDER: readonly string[] = ['pending', 'approved', 'rejected'];
const STATUS_LABELS: Record<string, string> = AR_CORRECTION_REQUEST_STATUS_LABELS;

const CORRECTION_STATUS_TONE: Record<AttendanceCorrectionRequest['status'], WorkflowStatusTone> = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'muted',
};

const EXPORT_COLUMNS: RegisterColumn[] = [
  { label: 'الموظف', kind: 'name' },
  { label: 'القسم', kind: 'text' },
  { label: 'نوع الطلب', kind: 'text' },
  { label: 'الحالة السابقة', kind: 'status' },
  { label: 'حالة الطلب', kind: 'status' },
  { label: 'السبب', kind: 'text', weight: 1.4 },
  { label: 'أوقات التصحيح', kind: 'text', weight: 1.4 },
  { label: 'تاريخ التصحيح', kind: 'date' },
  { label: 'تاريخ التقديم', kind: 'date' },
  { label: 'ملاحظات القرار', kind: 'text' },
];

/** «قبل: 8:00 ص - 4:00 م / بعد: …» — same before/after pairs as the times cell. */
function correctionTimesExportText(r: AttendanceCorrectionRequest): string {
  const parts: string[] = [];
  if (r.previousCheckIn || r.previousCheckOut) {
    parts.push(`قبل: ${exportClock(r.previousCheckIn)} - ${exportClock(r.previousCheckOut)}`);
  }
  r.correctedPeriods.forEach((p, i) => {
    const label = r.correctedPeriods.length <= 1 ? 'بعد' : `بعد ${i + 1}`;
    parts.push(`${label}: ${exportClock(p.checkInAt)} - ${exportClock(p.checkOutAt)}`);
  });
  return parts.length ? parts.join(' / ') : '—';
}

function statusBadgeClass(s: AttendanceCorrectionRequest['status']) {
  if (s === 'pending') return 'bg-gold/15 text-gold border-gold/30';
  if (s === 'approved') return 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30';
  return 'bg-destructive/10 text-destructive border-destructive/30';
}

function DetailBreakdownPanel({ breakdown }: { breakdown: DailyBreakdownResponseDto }) {
  const offsetMinutes = breakdown.timezoneOffsetMinutes;
  const dayCfg = statusCfg(breakdown.status);
  const { totals } = breakdown;
  const dayActualWithoutPeriods =
    breakdown.periods.length === 0 ? resolveDayActualWithoutPeriods(breakdown) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 space-y-1.5">
        <p className="text-xs text-muted-foreground">
          {fmtFull(breakdown.workDate)} · {WEEKDAY_AR[breakdown.weekDay] ?? ''}
        </p>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', dayCfg.color)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', dayCfg.dot)} />
          {dayCfg.label}
        </span>
      </div>

      {breakdown.shiftTemplate ? (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: breakdown.shiftTemplate.colorHex ?? '#64748b' }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{breakdown.shiftTemplate.nameAr}</p>
            {breakdown.shiftAssignment ? (
              <p className="text-[11px] text-muted-foreground">
                ساري من {breakdown.shiftAssignment.effectiveFrom}
                {breakdown.shiftAssignment.effectiveTo ? ` إلى ${breakdown.shiftAssignment.effectiveTo}` : ''}
              </p>
            ) : null}
          </div>
        </div>
      ) : breakdown.isUnscheduled ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          لا يوجد قالب دوام نشط لهذا اليوم
        </p>
      ) : null}

      {totals ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">إجماليات اليوم</p>
          <div className="grid grid-cols-3 gap-2">
            <StatChip label="متوقع" value={minutesToHHMM(totals.expectedMinutes)} />
            <StatChip label="فعلي" value={minutesToHHMM(totals.workedMinutes)} />
            <StatChip label="داخل الفترات" value={minutesToHHMM(totals.workedMinutesInsidePeriods ?? 0)} />
            <StatChip label="خارج الفترات" value={minutesToHHMM(totals.workedMinutesOutsidePeriods ?? 0)} />
            <StatChip label="استراحات" value={minutesToHHMM(totals.breakMinutes)} />
            <StatChip label="حضور مبكر" value={minutesToHHMM(totals.earlyArrivalMinutes ?? 0)} />
            <StatChip label="تأخير" value={minutesToHHMM(totals.lateMinutes)} tone={totals.lateMinutes > 0 ? 'warn' : 'default'} />
            <StatChip label="انصراف مبكر" value={minutesToHHMM(totals.earlyLeaveMinutes)} tone={totals.earlyLeaveMinutes > 0 ? 'warn' : 'default'} />
            <StatChip label="إضافي" value={minutesToHHMM(totals.overtimeMinutes)} tone={totals.overtimeMinutes > 0 ? 'success' : 'default'} />
            <StatChip label="نقص" value={minutesToHHMM(totals.shortageMinutes)} tone={totals.shortageMinutes > 0 ? 'danger' : 'default'} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <StatChip label="فترات" value={String(totals.periodsTotal)} />
            <StatChip label="حضر" value={String(totals.periodsAttended)} tone="success" />
            <StatChip label="تأخر" value={String(totals.periodsLate)} tone="warn" />
            <StatChip label="فائت" value={String(totals.periodsMissed)} tone="danger" />
          </div>
        </div>
      ) : null}

      {breakdown.periods.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">تحليل الفترات</p>
          {breakdown.periods.map((period, index) => (
            <PeriodCard
              key={period.expected.periodId}
              period={period}
              index={index}
              offsetMinutes={offsetMinutes}
              unmatchedEvents={breakdown.unmatchedEvents}
              singlePeriod={breakdown.periods.length === 1}
            />
          ))}
        </div>
      ) : dayActualWithoutPeriods ? (
        <ActualRegistrationBlock actual={dayActualWithoutPeriods} offsetMinutes={offsetMinutes} />
      ) : null}
    </div>
  );
}

export function AttendanceCorrectionRequestsClient() {
  const companyId = useDefaultCompanyId();
  const authUser = useAuthStore((s) => s.user);
  const { data: currentEmployee } = useCurrentEmployee();
  const currentEmployeeId = currentEmployee?.id ?? null;
  const updatedByActor = authUser?.id ?? undefined;
  const departments = useHRConfigurationStore((s) => s.departments);
  const fetchDepartments = useHRConfigurationStore((s) => s.fetchDepartments);
  const employees = useHREmployeeDirectoryStore((s) => s.employees);
  const fetchEmployees = useHREmployeeDirectoryStore((s) => s.fetch);
  // New correction requests: active employees only (not suspended / ended).
  const activeEmployees = React.useMemo(() => employees.filter((e) => e.status === 'active'), [employees]);

  const { approve, reject, cancel } = useAttendanceCorrectionRequestsStore();

  React.useEffect(() => {
    if (!companyId) return;
    fetchDepartments();
    fetchEmployees();
  }, [companyId, fetchDepartments, fetchEmployees]);

  const [appliedDept, setAppliedDept] = usePersistedFilterState(
    hrFiltersKey('requests', 'attendance-corrections', companyId, 'appliedDept'),
    'all',
  );
  const [selectedEmpIds, setSelectedEmpIds] = usePersistedEmpIdSet(
    hrFiltersKey('requests', 'attendance-corrections', companyId, 'selectedEmpIds'),
  );
  const [employeeStatus, setEmployeeStatus] = useEmployeeStatusFilter(
    hrFiltersKey('requests', 'attendance-corrections', companyId, 'employeeStatus'),
  );
  const [statusFilter, setStatusFilter] = usePersistedFilterState(
    hrFiltersKey('requests', 'attendance-corrections', companyId, 'statusFilter'),
    'all',
  );
  const [dateBounds, setDateBounds] = usePersistedFilterState(
    hrFiltersKey('requests', 'attendance-corrections', companyId, 'dateBounds'),
    { from: '', to: '' },
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [detailRow, setDetailRow] = React.useState<AttendanceCorrectionRequest | null>(null);
  const [detailBreakdown, setDetailBreakdown] = React.useState<DailyBreakdownResponseDto | null>(null);
  const [detailBreakdownLoading, setDetailBreakdownLoading] = React.useState(false);

  React.useEffect(() => {
    if (!detailRow || !companyId) {
      setDetailBreakdown(null);
      return;
    }
    let cancelled = false;
    setDetailBreakdownLoading(true);
    attendanceEventsApi
      .getDailyBreakdown({
        employeeId: detailRow.employeeId,
        workDate: detailRow.workDate,
        companyId,
        timezoneOffsetMinutes: defaultTimezoneOffsetMinutes(),
      })
      .then((data) => {
        if (!cancelled) setDetailBreakdown(data);
      })
      .catch((err) => {
        if (!cancelled) {
          handleApiError(err, 'attendance/events/daily-breakdown');
          setDetailBreakdown(null);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailBreakdownLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailRow, companyId]);
  const [viewMode, setViewMode] = usePersistedFilterState<ViewMode>(
    hrFiltersKey('requests', 'attendance-corrections', companyId, 'viewMode'),
    'cards',
  );

  const deptOptions = React.useMemo(
    () => [{ value: 'all', label: 'جميع الأقسام' }, ...departments.filter((d) => d.isActive).map((d) => ({ value: d.id, label: d.nameAr }))],
    [departments],
  );

  const selectedEmpKey = React.useMemo(() => [...selectedEmpIds].sort().join(','), [selectedEmpIds]);

  const buildListQuery = React.useCallback((page: number, pageSize: number) => ({
    companyId: companyId!,
    page,
    limit: pageSize,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(dateBounds.from ? { workDateFrom: dateBounds.from } : {}),
    ...(dateBounds.to ? { workDateTo: dateBounds.to } : {}),
    ...(selectedEmpIds.size > 0 ? { employeeIds: [...selectedEmpIds] } : {}),
    ...(appliedDept !== 'all' ? { departmentId: appliedDept } : {}),
    ...employeeStatusQuery(employeeStatus),
  }), [companyId, statusFilter, dateBounds.from, dateBounds.to, selectedEmpIds, appliedDept, employeeStatus]);

  const loadPage = React.useCallback(async (page: number, pageSize: number) => {
    if (!companyId) return { items: [] as AttendanceCorrectionRequest[], total: 0 };
    try {
      const res = await correctionRequestsApi.list(buildListQuery(page, pageSize));
      const items = res.items.map((r) => mapCorrectionRequest(r, res.approvalAssignments));
      return { items, total: res.pagination.total };
    } catch {
      return { items: [], total: 0 };
    }
  }, [buildListQuery, companyId]);

  const {
    items: sorted,
    loading: listLoading,
    pagination,
    reload: reloadList,
  } = useServerDirectoryPagination<AttendanceCorrectionRequest>(loadPage, {
    enabled: !!companyId,
    resetDeps: [companyId, appliedDept, statusFilter, dateBounds.from, dateBounds.to, selectedEmpKey, employeeStatus],
  });

  const statusCounts = React.useMemo(
    () => ({
      all: pagination.total,
      pending: sorted.filter((r) => r.status === 'pending').length,
      approved: sorted.filter((r) => r.status === 'approved').length,
      rejected: sorted.filter((r) => r.status === 'rejected').length,
    }),
    [sorted, pagination.total],
  );

  const openNew = React.useCallback(() => {
    setDialogOpen(true);
  }, []);

  const handleApprove = React.useCallback(async (r: AttendanceCorrectionRequest) => {
    if (!companyId || !currentEmployeeId) return;
    try {
      const access = await checkRequestApprovalAccess(
        'attendance',
        companyId,
        currentEmployeeId,
        r.approverStates,
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
      await approve(r.id, payload);
      if (payload.approverStates && isRequestFullyApproved(payload.approverStates)) {
        toast.success('تم اعتماد طلب التصحيح نهائياً.');
      } else {
        toast.success('تم تسجيل موافقتك — بانتظار بقية المعتمدين.');
      }
      await reloadList();
      setDetailRow(null);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'correction-requests.decide.approve');
      toast.error(displayMessage);
    }
  }, [approve, companyId, currentEmployeeId, reloadList, updatedByActor]);

  const [rejectTarget, setRejectTarget] = React.useState<{
    row: AttendanceCorrectionRequest;
    states: Parameters<typeof buildRequestCorrectionDecisionPayload>[0];
  } | null>(null);

  /** Checks the approver may act, then asks for the reason before rejecting. */
  const handleReject = React.useCallback(async (r: AttendanceCorrectionRequest) => {
    if (!companyId || !currentEmployeeId) return;
    try {
      const access = await checkRequestApprovalAccess(
        'attendance',
        companyId,
        currentEmployeeId,
        r.approverStates,
      );
      if (!access.ok) {
        toast.warning(access.message);
        return;
      }
      setRejectTarget({ row: r, states: access.states });
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'correction-requests.decide.reject');
      toast.error(displayMessage);
    }
  }, [companyId, currentEmployeeId]);

  const confirmReject = React.useCallback(async (reason: string) => {
    if (!rejectTarget || !currentEmployeeId) return;
    try {
      const payload = buildRequestCorrectionDecisionPayload(
        rejectTarget.states,
        currentEmployeeId,
        'reject',
        { decisionNotesAr: reason, updatedBy: updatedByActor },
      );
      await reject(rejectTarget.row.id, payload);
      toast.message('تم رفض الطلب.');
      await reloadList();
      setDetailRow(null);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'correction-requests.decide.reject');
      toast.error(displayMessage);
      throw err;
    }
  }, [currentEmployeeId, reject, rejectTarget, reloadList, updatedByActor]);

  const canShowApprovalActions = React.useCallback(
    (r: AttendanceCorrectionRequest) =>
      r.status === 'pending' && getRequestApprovalUiState(r.approverStates, currentEmployeeId).showActions,
    [currentEmployeeId],
  );

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (appliedDept !== 'all') count++;
    if (selectedEmpIds.size > 0) count++;
    if (dateBounds.from || dateBounds.to) count++;
    if (statusFilter !== 'all') count++;
    if (isEmployeeStatusFilterActive(employeeStatus)) count++;
    return count;
  }, [appliedDept, selectedEmpIds.size, dateBounds.from, dateBounds.to, statusFilter, employeeStatus]);

  const getExportRows = useLatestCallback(async (): Promise<string[][]> => {
    if (!companyId) return [];
    const { items } = await fetchAllPaginatedItems(async (page, limit) => {
      const res = await correctionRequestsApi.list(buildListQuery(page, limit));
      return { items: res.items.map((r) => mapCorrectionRequest(r, res.approvalAssignments)), pagination: res.pagination };
    });
    return items.map((r) => [
      exportText(r.employeeNameAr),
      exportText(r.departmentNameAr),
      r.subtypeNameAr ? `${r.requestTypeNameAr} — ${r.subtypeNameAr}` : exportText(r.requestTypeNameAr),
      exportText(r.previousStatusAr),
      attendanceCorrectionStatusLabelAr(r.status),
      exportText(r.reasonAr),
      correctionTimesExportText(r),
      exportDate(r.workDate),
      exportDateTime(r.submittedAt),
      exportText(r.decisionNotesAr),
    ]);
  });

  useSetPageTitle({ titleAr: 'تصحيح الحضور', descriptionAr: 'طلبات تصحيح أوقات الحضور والانصراف', iconName: 'CalendarClock' });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <RegisterExportMenu
          title="سجل طلبات تصحيح الحضور"
          fileName="attendance-correction-requests"
          columns={EXPORT_COLUMNS}
          getRows={getExportRows}
          subtitleLines={[`حالة الموظفين: ${employeeStatusFilterLabelAr(employeeStatus)}`]}
          landscape
        />
        <Button variant="luxe" size="sm" className="h-8 gap-1.5 px-3 text-xs shadow-sm shrink-0" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" />
          طلب تصحيح حضور
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
        inlineSelects={[
          {
            id: 'dept',
            value: appliedDept,
            onChange: setAppliedDept,
            placeholder: 'القسم',
            options: deptOptions,
          },
        ]}
        companyId={companyId}
        selectedEmpIds={selectedEmpIds}
        onSelectedEmpIdsChange={setSelectedEmpIds}
        employeeStatus={employeeStatus}
        onEmployeeStatusChange={setEmployeeStatus}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOrder={STATUS_ORDER}
        statusLabels={STATUS_LABELS}
        statusCounts={statusCounts}
        onDateBoundsChange={setDateBounds}
        dataView={{
          value: viewMode,
          onChange: (v) => setViewMode(v as ViewMode),
          options: [
            { value: 'cards', label: 'بطاقات', icon: 'layout-grid' },
            { value: 'list', label: 'جدول', icon: 'list' },
          ],
        }}
      />
    ),
    [
      appliedDept,
      employeeStatus,
      selectedEmpIds,
      statusFilter,
      dateBounds.from,
      dateBounds.to,
      statusCounts.all,
      statusCounts.pending,
      statusCounts.approved,
      statusCounts.rejected,
      deptOptions,
      companyId,
      viewMode,
    ],
  );

  const columns: ColumnDef<AttendanceCorrectionRequest>[] = React.useMemo(
    () => [
      {
        key: 'emp',
        title: 'الموظف',
        render: (r) => (
          <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {r.employeeNameAr.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-sm">{r.employeeNameAr}</p>
              <p className="text-[10px] text-muted-foreground">{r.departmentNameAr || '—'}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'requestType',
        title: 'نوع الطلب',
        hideOnMobile: true,
        render: (r) => (
          <div>
            <p className="text-sm font-medium">{r.requestTypeNameAr}</p>
            {r.subtypeNameAr ? (
              <p className="text-[10px] text-muted-foreground">{r.subtypeNameAr}</p>
            ) : null}
          </div>
        ),
      },
      {
        key: 'prevStatus',
        title: 'الحالة السابقة',
        render: (r) => <span className="text-xs text-foreground">{r.previousStatusAr}</span>,
      },
      {
        key: 'status',
        title: 'حالة الطلب',
        render: (r) => (
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium', statusBadgeClass(r.status))}>
            <span className={cn('h-1.5 w-1.5 rounded-full', r.status === 'pending' ? 'bg-gold' : r.status === 'approved' ? 'bg-emerald-500' : 'bg-destructive')} />
            {attendanceCorrectionStatusLabelAr(r.status)}
          </span>
        ),
      },
      {
        key: 'reason',
        title: 'السبب / الملاحظات',
        hideOnMobile: true,
        render: (r) => <span className="text-xs text-muted-foreground   max-w-[200px]">{r.reasonAr || '—'}</span>,
      },
      {
        key: 'times',
        title: 'أوقات التصحيح',
        render: (r) => (
          <CorrectionTimesComparisonCell
            previousCheckIn={r.previousCheckIn}
            previousCheckOut={r.previousCheckOut}
            correctedPeriods={r.correctedPeriods}
          />
        ),
      },
      {
        key: 'workDate',
        title: 'تاريخ التصحيح',
        render: (r) => <TableDateCell value={r.workDate} />,
      },
      {
        key: 'submittedAt',
        title: 'تاريخ التقديم',
        hideOnMobile: true,
        render: (r) => <TableDateCell value={r.submittedAt} mode="datetime" />,
      },
      {
        key: 'approvers',
        title: 'مسار الموافقة',
        hideOnMobile: true,
        render: (r) => <RequestApproversInline states={r.approverStates} requestStatus={r.status} />,
      },
      {
        key: 'decisionNotes',
        title: 'ملاحظات القرار',
        hideOnMobile: true,
        render: (r) => (
          <span className="line-clamp-2 max-w-[12rem] text-xs text-muted-foreground" title={r.decisionNotesAr || undefined}>
            {r.decisionNotesAr || '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        title: 'إجراء',
        isActions: true,
        render: (r) => {
          if (r.status !== 'pending') {
            return <TableDateCell value={r.decidedAt} mode="datetime" />;
          }
          if (getRequestApprovalUiState(r.approverStates, currentEmployeeId).showActions) {
            return (
              <RequestApprovalActionCell
                states={r.approverStates}
                currentEmployeeId={currentEmployeeId}
                onApprove={() => void handleApprove(r)}
                onReject={() => void handleReject(r)}
              />
            );
          }
          if (!isEmployeeInRequestApproverStates(r.approverStates, currentEmployeeId)) {
            return (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs text-amber-600"
                onClick={(e) => {
                  e.stopPropagation();
                  void cancel(r.id).then(async () => {
                    toast.message('تم سحب الطلب.');
                    await reloadList();
                  });
                }}
              >
                إلغاء
              </Button>
            );
          }
          return <span className="text-xs text-muted-foreground">—</span>;
        },
      },
    ],
    [cancel, currentEmployeeId, handleApprove, handleReject, reloadList],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex min-h-0 flex-1 flex-col">
        {!listLoading && sorted.length === 0 && pagination.total === 0 ? (
          <EmptyState title="لا توجد طلبات ضمن الفلاتر" />
        ) : (
          <DirectoryPagedViews
            items={sorted}
            serverPagination={pagination}
            loading={listLoading}
          >
            {(pageItems) => (
              viewMode === 'cards' ? (
                <EntityActionCardGrid>
                  {pageItems.map((r) => (
                    <EntityActionCard
                      key={r.id}
                      onClick={() => setDetailRow(r)}
                      title={r.employeeNameAr}
                      subtitle={r.departmentNameAr || '—'}
                      status={{
                        label: attendanceCorrectionStatusLabelAr(r.status),
                        tone: CORRECTION_STATUS_TONE[r.status],
                      }}
                      chips={
                        <>
                          <EntityActionCardChip>
                            {r.requestTypeNameAr}
                            {r.subtypeNameAr ? ` — ${r.subtypeNameAr}` : ''}
                          </EntityActionCardChip>
                          <EntityActionCardChip className="font-mono tabular-nums">
                            <span className="inline-flex items-center gap-1" dir="ltr">
                              <CalendarDays className="h-3 w-3 shrink-0" />
                              {r.workDate}
                            </span>
                          </EntityActionCardChip>
                          <EntityActionCardChip>
                            الحالة السابقة: {r.previousStatusAr}
                          </EntityActionCardChip>
                          {r.submittedAt ? (
                            <EntityActionCardChip className="font-mono tabular-nums">
                              <span className="inline-flex items-center gap-1" dir="ltr">
                                <CalendarDays className="h-3 w-3 shrink-0" />
                                {r.submittedAt.slice(0, 10)}
                              </span>
                            </EntityActionCardChip>
                          ) : null}
                        </>
                      }
                      description={
                        [r.reasonAr, r.decisionNotesAr?.trim() ? `ملاحظات القرار: ${r.decisionNotesAr}` : '']
                          .filter(Boolean)
                          .join(' — ') || undefined
                      }
                      workflow={
                        canShowApprovalActions(r)
                          ? {
                              showApproveReject: true,
                              onApprove: () => void handleApprove(r),
                              onReject: () => void handleReject(r),
                              disabled: !getRequestApprovalUiState(r.approverStates, currentEmployeeId).canAct,
                              waitingReason: getRequestApprovalUiState(r.approverStates, currentEmployeeId).reasonAr ?? undefined,
                            }
                          : undefined
                      }
                      extraFooter={
                        r.status === 'pending' && !isEmployeeInRequestApproverStates(r.approverStates, currentEmployeeId) ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full text-xs text-amber-600"
                            onClick={async () => {
                              await cancel(r.id);
                              toast.message('تم سحب الطلب.');
                              await reloadList();
                            }}
                          >
                            إلغاء
                          </Button>
                        ) : undefined
                      }
                    >
                      <CorrectionTimesComparisonCell
                        previousCheckIn={r.previousCheckIn}
                        previousCheckOut={r.previousCheckOut}
                        correctedPeriods={r.correctedPeriods}
                      />
                      <RequestApproverStatesPanel states={r.approverStates} requestStatus={r.status} compact className="border-0 bg-transparent p-0" />
                    </EntityActionCard>
                  ))}
                </EntityActionCardGrid>
              ) : (
                <DataTable
                  variant="directory"
                  alwaysShowTable
                  tableClassName="min-w-[1200px]"
                  columns={columns}
                  data={pageItems}
                  keyExtractor={(r) => r.id}
                  emptyText="لا توجد طلبات"
                  onRowClick={(r) => setDetailRow(r)}
                />
              )
            )}
          </DirectoryPagedViews>
        )}
      </div>

      <AttendanceCorrectionRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        companyId={companyId ?? undefined}
        employees={activeEmployees.map((e) => ({ id: e.id, nameAr: e.nameAr }))}
        onSuccess={() => void reloadList()}
      />

      <Dialog open={detailRow != null} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-visible p-0" dir="rtl">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-right">
            <DialogTitle>تفاصيل طلب تصحيح الحضور</DialogTitle>
          </DialogHeader>
          {detailRow ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="text-xs text-muted-foreground">الموظف</p><p className="text-sm font-medium">{detailRow.employeeNameAr}</p></div>
                <div><p className="text-xs text-muted-foreground">القسم</p><p className="text-sm font-medium">{detailRow.departmentNameAr || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">نوع الطلب</p><p className="text-sm font-medium">{detailRow.requestTypeNameAr}</p></div>
                <div><p className="text-xs text-muted-foreground">تاريخ التصحيح</p><p className="text-sm font-medium"><TableDateCell value={detailRow.workDate} /></p></div>
                <div><p className="text-xs text-muted-foreground">الحالة السابقة</p><p className="text-sm font-medium">{detailRow.previousStatusAr}</p></div>
                <div><p className="text-xs text-muted-foreground">حالة الطلب</p><p className="text-sm font-medium">{attendanceCorrectionStatusLabelAr(detailRow.status)}</p></div>
                <div><p className="text-xs text-muted-foreground">تاريخ التقديم</p><p className="text-sm font-medium"><TableDateCell value={detailRow.submittedAt} mode="datetime" /></p></div>
                <CorrectionTimesComparisonDetail
                  previousCheckIn={detailRow.previousCheckIn}
                  previousCheckOut={detailRow.previousCheckOut}
                  correctedPeriods={detailRow.correctedPeriods}
                />
                <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">السبب</p><p className="text-sm">{detailRow.reasonAr || '—'}</p></div>
                <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">ملاحظات القرار</p><p className="text-sm">{detailRow.decisionNotesAr || '—'}</p></div>
              </div>

              <RequestApproverStatesPanel states={detailRow.approverStates} requestStatus={detailRow.status} />
              {canShowApprovalActions(detailRow) ? (
                <RequestApprovalActionButtons
                  states={detailRow.approverStates}
                  currentEmployeeId={currentEmployeeId}
                  onApprove={() => void handleApprove(detailRow)}
                  onReject={() => void handleReject(detailRow)}
                />
              ) : null}

              {/* Daily attendance breakdown for the corrected day */}
              <div className="space-y-3 border-t border-border/60 pt-4">
                <p className="text-xs font-semibold text-muted-foreground">تحليل يوم الحضور</p>
                {detailBreakdownLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : detailBreakdown ? (
                  <DetailBreakdownPanel breakdown={detailBreakdown} />
                ) : (
                  <p className="py-4 text-center text-xs text-muted-foreground">تعذّر تحميل التحليل التفصيلي</p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <RejectReasonDialog
        open={rejectTarget != null}
        onOpenChange={(open) => { if (!open) setRejectTarget(null); }}
        kind="attendance"
        title="رفض طلب تصحيح الحضور"
        description={rejectTarget ? `${rejectTarget.row.employeeNameAr} · ${rejectTarget.row.workDate}` : undefined}
        onConfirm={confirmReject}
      />
    </div>
  );
}
