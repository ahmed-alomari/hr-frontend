'use client';

import { FoldedHeaderTool } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import { FileDown, FileSpreadsheet, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import {
  scopeEmployeeIdsByAssignedBranch,
  useAssignedBranchFilter,
} from '@/features/hr/attendance/lib/use-assigned-branch-filter';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { AttendanceRegisterPrintHtml } from '@/components/pdf/print/attendance-register-print-html';
import { normalizePeriodRange, todayYMD } from '@/features/hr/discipline/lib/discipline-date-filter';
import type { AttendanceDaySummary, AttendanceEvent } from '@/features/hr/attendance/lib/types';
import { enumerateDates } from '@/features/hr/attendance/lib/utils';
import { downloadXlsxFromAoA, type XlsxCell } from '@/shared/export/download-xlsx';
import {
  ATT_VISUAL_STATUS_ORDER,
  STATUS,
} from '@/features/hr/attendance/daily/constants/daily-attendance-status';
import { resolveVisualKey } from '@/features/hr/attendance/daily/utils/daily-attendance-status-resolve';
import { minutesToHHMM } from '@/features/hr/attendance/daily/utils/daily-attendance-format';
import { attendanceDaySummariesApi } from '@/features/hr/attendance/lib/api/attendance-day-summaries';
import { attendanceEventsApi } from '@/features/hr/attendance/lib/api/attendance-events';
import { recomputeTodayDaySummaries } from '@/features/hr/attendance/lib/api/recompute-today-day-summaries';
import type {
  AttendanceDayStatus,
  DaySummaryListQuery,
  DaySummaryResponseDto,
} from '@/features/hr/attendance/types/api/attendance-day-summaries';
import type { AttendanceEventResponseDto } from '@/features/hr/attendance/types/api/attendance-events';
import { companiesApi } from '@/features/hr/lib/api/companies';
import { resolveDirectoryLoadFailure } from '@/features/hr/lib/api/directory-load-error';
import { useEmployeeFilterPicker } from '@/features/hr/lib/use-employee-filter-picker';
import { getDefaultCompanyId, useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import {
  employeeMatchesStatus,
  employeeStatusFilterLabelAr,
  employeeStatusQuery,
  isEmployeeStatusFilterActive,
  useEmployeeStatusFilter,
} from '@/features/hr/lib/employee-status-filter';
import {
  attendanceFiltersKey,
  usePersistedEmpIdSet,
  usePersistedFilterState,
} from '@/features/hr/attendance/lib/use-persisted-filter-state';
import { useListPagination, type PaginationBarState } from '@/components/ui/paged-list';

export type AttendanceViewMode = 'card' | 'table';

const API_STATUS_FILTERS = new Set<string>([
  'present',
  'partial',
  'late',
  'absent',
  'rest_day',
  'unscheduled',
  'holiday',
  'on_leave',
]);

const COUNT_FETCH_PAGE_SIZE = 100;

function mapDaySummary(s: DaySummaryResponseDto): AttendanceDaySummary {
  return {
    id: s.id,
    employeeId: s.employeeId,
    employeeName: s.employeeNameAr,
    date: s.workDate,
    templateId: s.shiftAssignmentId ?? null,
    status: s.status as AttendanceDaySummary['status'],
    lateMinutes: s.lateMinutes,
    earlyLeaveMinutes: s.earlyLeaveMinutes,
    overtimeMinutes: s.overtimeMinutes,
    workedMinutes: s.workedMinutes,
    notes: s.notes ?? undefined,
    actualCheckInAt: s.actualCheckInAt ?? null,
    actualCheckOutAt: s.actualCheckOutAt ?? null,
    expectedStartAt: s.expectedStartAt ?? null,
    expectedEndAt: s.expectedEndAt ?? null,
    isFinalized: s.isFinalized,
  };
}

function mapEvent(e: AttendanceEventResponseDto): AttendanceEvent {
  return {
    id: e.id,
    employeeId: e.employeeId,
    employeeName: e.employeeNameAr,
    date: e.workDate,
    type: e.eventType,
    at: e.occurredAt,
    source: e.source ?? 'manual_hr',
  };
}


async function fetchAllDaySummaries(
  baseQuery: Omit<DaySummaryListQuery, 'page' | 'limit'>,
): Promise<AttendanceDaySummary[]> {
  const all: AttendanceDaySummary[] = [];
  let page = 1;

  while (true) {
    const res = await attendanceDaySummariesApi.getAll({
      ...baseQuery,
      page,
      limit: COUNT_FETCH_PAGE_SIZE,
    });
    all.push(...res.items.map(mapDaySummary));
    if (all.length >= res.pagination.total || res.items.length === 0) break;
    page += 1;
  }

  return all;
}

export function useDailyAttendanceModel() {
  const companyId = useDefaultCompanyId();
  const [events, setEvents] = React.useState<AttendanceEvent[]>([]);
  const [eventsLoading, setEventsLoading] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);
  const { employees: pickerEmployees } = useEmployeeFilterPicker(companyId);
  const {
    branchId: assignedBranchId,
    select: assignedBranchSelect,
    assignedIds,
    selectedBranchNameAr,
    resolveBranchByEmployeeId,
  } = useAssignedBranchFilter(
    companyId,
    'daily',
  );
  const includeBranchColumn = assignedBranchId === 'all';
  // The employees' own status: active by default (the register of who works
  // now); suspended / ended on demand.
  const [employeeStatus, setEmployeeStatus] = useEmployeeStatusFilter(
    attendanceFiltersKey('daily', companyId, 'employeeStatus'),
  );
  const visiblePickerEmployees = React.useMemo(
    () =>
      pickerEmployees.filter(
        (employee) =>
          (!assignedIds || assignedIds.has(employee.id)) &&
          employeeMatchesStatus(employee.contractStatus, employeeStatus),
      ),
    [assignedIds, pickerEmployees, employeeStatus],
  );
  const allEmployees = React.useMemo(
    () => visiblePickerEmployees.map((e) => ({ id: e.id, name: e.name })),
    [visiblePickerEmployees],
  );
  const [companyNameAr, setCompanyNameAr] = React.useState('');
  const [companyNameEn, setCompanyNameEn] = React.useState('');

  const todayPeriod = React.useMemo(() => {
    const today = todayYMD();
    return { from: today, to: today };
  }, []);

  const [selectedEmpIds, setSelectedEmpIds] = usePersistedEmpIdSet(
    attendanceFiltersKey('daily', companyId, 'selectedEmpIds'),
  );
  const [dateBounds, setDateBounds] = usePersistedFilterState(
    attendanceFiltersKey('daily', companyId, 'dateBounds'),
    todayPeriod,
  );
  const [statusFilter, setStatusFilter] = usePersistedFilterState(
    attendanceFiltersKey('daily', companyId, 'statusFilter'),
    'all',
  );
  const [viewMode, setViewMode] = usePersistedFilterState<AttendanceViewMode>(
    attendanceFiltersKey('daily', companyId, 'viewMode'),
    'card',
  );
  const [pdfOpen, setPdfOpen] = React.useState(false);
  const [exportPrintRows, setExportPrintRows] = React.useState<
    { employeeName: string; date: string; statusLabel: string; worked: string; late: string; branchName?: string }[]
  >([]);
  const [recomputeOpen, setRecomputeOpen] = React.useState(false);
  const [registerOpen, setRegisterOpen] = React.useState(false);

  const { from: filterFrom, to: filterTo } = dateBounds;

  React.useEffect(() => {
    const id = getDefaultCompanyId();
    if (!id) return;
    void companiesApi.getById(id).then((companyRes) => {
      if (companyRes) {
        setCompanyNameAr(companyRes.nameAr);
        setCompanyNameEn(companyRes.nameEn ?? '');
      }
    });
  }, []);

  const from = filterFrom || todayYMD();
  const to = filterTo || todayYMD();
  const dates = React.useMemo(() => enumerateDates(from, to), [from, to]);
  const selectedEmpKey = React.useMemo(() => [...selectedEmpIds].sort().join(','), [selectedEmpIds]);

  // `/attendance/day-summaries` paginates raw (employeeId, workDate) rows, but this
  // view paginates by EMPLOYEE (one card/row per employee spanning the whole date
  // range). Paginating by raw row count would split a single employee's days across
  // multiple server pages once the range spans more than a few days — so instead we
  // paginate the (already-loaded, zero extra cost) company employee directory in
  // memory first, then fetch exactly one page's worth of day-summaries — scoped to
  // just that page's employee ids, for the whole date range — in a single request.
  // Changing the page or page size only ever triggers that one scoped request, same
  // as every other server-paginated directory in the app.
  const employeeDirectory = React.useMemo(() => {
    if (assignedBranchId !== 'all' && assignedIds === null) return [];
    const scoped = scopeEmployeeIdsByAssignedBranch(assignedIds, selectedEmpIds);
    const list = scoped
      ? allEmployees.filter((employee) => scoped.has(employee.id))
      : allEmployees;
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [allEmployees, assignedBranchId, assignedIds, selectedEmpIds]);

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageItems: pageEmployeeRows,
    total,
    totalPages,
  } = useListPagination(employeeDirectory, [companyId, selectedEmpKey, assignedBranchId, employeeStatus]);

  const pagination: PaginationBarState = React.useMemo(
    () => ({ page, pageSize, total, totalPages, setPage, setPageSize }),
    [page, pageSize, total, totalPages, setPage, setPageSize],
  );

  const pageEmployeeIdsKey = React.useMemo(
    () => pageEmployeeRows.map((e) => e.id).sort().join(','),
    [pageEmployeeRows],
  );

  const [pageSummaries, setPageSummaries] = React.useState<AttendanceDaySummary[]>([]);
  const [summariesLoading, setSummariesLoading] = React.useState(false);
  const summariesFetchGenRef = React.useRef(0);

  const loadPageSummaries = React.useCallback(async () => {
    if (!companyId || pageEmployeeIdsKey.length === 0) {
      setPageSummaries([]);
      return;
    }

    const gen = ++summariesFetchGenRef.current;
    setListError(null);
    setSummariesLoading(true);
    const employeeIds = pageEmployeeIdsKey.split(',').filter(Boolean);
    const query: DaySummaryListQuery = {
      companyId,
      from,
      to,
      employeeIds,
      page: 1,
      limit: Math.max(employeeIds.length * dates.length + 10, 50),
    };
    if (statusFilter !== 'all' && API_STATUS_FILTERS.has(statusFilter)) {
      query.status = statusFilter as AttendanceDayStatus;
    }

    try {
      await recomputeTodayDaySummaries(companyId).catch(() => {});
      const res = await attendanceDaySummariesApi.getAll(query);
      if (gen !== summariesFetchGenRef.current) return;
      setPageSummaries(res.items.map(mapDaySummary));
    } catch (err) {
      if (gen !== summariesFetchGenRef.current) return;
      const failure = resolveDirectoryLoadFailure(err, 'attendance/day-summaries.load');
      setListError(failure.listError);
      setPageSummaries([]);
    } finally {
      if (gen === summariesFetchGenRef.current) setSummariesLoading(false);
    }
  }, [companyId, from, to, pageEmployeeIdsKey, dates.length, statusFilter]);

  React.useEffect(() => {
    void loadPageSummaries();
  }, [loadPageSummaries]);

  const denseForView = React.useMemo(() => {
    if (statusFilter === 'all') return pageSummaries;
    return pageSummaries.filter((s) => resolveVisualKey(s.status) === statusFilter);
  }, [pageSummaries, statusFilter]);

  React.useEffect(() => {
    if (!companyId || pageEmployeeIdsKey.length === 0) {
      setEvents([]);
      return;
    }

    const employeeIds = pageEmployeeIdsKey.split(',').filter(Boolean);
    let cancelled = false;
    setEventsLoading(true);

    void attendanceEventsApi
      .getAll({
        companyId,
        workDateFrom: from,
        workDateTo: to,
        employeeIds,
        page: 1,
        limit: Math.max(employeeIds.length * dates.length * 6, 50),
      })
      .then((res) => {
        if (!cancelled) setEvents(res.items.map(mapEvent));
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, from, to, pageEmployeeIdsKey, dates.length]);

  const eventsForView = events;

  const reloadSummaries = React.useCallback(() => {
    void loadPageSummaries();
  }, [loadPageSummaries]);

  const attendanceStatusLabels = React.useMemo(
    () => Object.fromEntries(ATT_VISUAL_STATUS_ORDER.map((k) => [k, STATUS[k].label])) as Record<string, string>,
    [],
  );

  // Page-scoped counts (same convention as other server-paginated directories in
  // this app) — "all" reflects the true total from pagination; per-status tallies
  // reflect the currently loaded page, not a separate full-range count fetch.
  const attendanceStatusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: total };
    for (const k of ATT_VISUAL_STATUS_ORDER) counts[k] = 0;
    for (const s of pageSummaries) {
      counts[resolveVisualKey(s.status)] += 1;
    }
    return counts;
  }, [pageSummaries, total]);

  const fetchExportSummaries = React.useCallback(async () => {
    if (!companyId) return [] as AttendanceDaySummary[];
    if (assignedBranchId !== 'all' && assignedIds === null) return [] as AttendanceDaySummary[];
    const scopedEmpIds = scopeEmployeeIdsByAssignedBranch(assignedIds, selectedEmpIds);
    if (scopedEmpIds && scopedEmpIds.size === 0) return [] as AttendanceDaySummary[];
    const baseQuery: Omit<DaySummaryListQuery, 'page' | 'limit'> = { from, to, companyId };
    if (scopedEmpIds) baseQuery.employeeIds = [...scopedEmpIds];
    Object.assign(baseQuery, employeeStatusQuery(employeeStatus));
    if (statusFilter !== 'all' && API_STATUS_FILTERS.has(statusFilter)) {
      baseQuery.status = statusFilter as AttendanceDayStatus;
    }
    const items = await fetchAllDaySummaries(baseQuery);
    if (statusFilter === 'all') return items;
    return items.filter((s) => resolveVisualKey(s.status) === statusFilter);
  }, [assignedBranchId, assignedIds, companyId, employeeStatus, from, selectedEmpIds, statusFilter, to]);

  const openPdfExport = useLatestCallback(async () => {
    try {
      const rows = await fetchExportSummaries();
      if (rows.length === 0) {
        toast.error('لا توجد سجلات للتصدير ضمن الفلاتر الحالية.');
        return;
      }
      const branchMap = includeBranchColumn
        ? await resolveBranchByEmployeeId()
        : new Map<string, string>();
      setExportPrintRows(
        rows.map((s) => ({
          employeeName: s.employeeName,
          date: s.date,
          statusLabel: STATUS[resolveVisualKey(s.status)].label,
          worked: minutesToHHMM(s.workedMinutes),
          late: minutesToHHMM(s.lateMinutes),
          branchName: branchMap.get(s.employeeId) ?? '—',
        })),
      );
      setPdfOpen(true);
    } catch {
      toast.error('تعذر تحضير تصدير PDF.');
    }
  });

  const attendancePdfRows = exportPrintRows;

  const attendancePrintable = React.useMemo(
    () =>
      attendancePdfRows.length === 0 ? null : (
        <AttendanceRegisterPrintHtml
          companyNameAr={companyNameAr}
          companyNameEn={companyNameEn}
          titleAr="تقرير الحضور اليومي"
          periodDateFrom={from}
          periodDateTo={to}
          employeesFilterAll={selectedEmpIds.size === 0}
          employeesSelectedCount={selectedEmpIds.size}
          statusFilterLabelAr={
            statusFilter === 'all' ? 'الكل' : attendanceStatusLabels[statusFilter] ?? statusFilter
          }
          employeeStatusLabelAr={employeeStatusFilterLabelAr(employeeStatus)}
          branchFilterNameAr={selectedBranchNameAr}
          includeBranchColumn={includeBranchColumn}
          rows={attendancePdfRows}
        />
      ),
    [attendancePdfRows, from, to, selectedEmpIds.size, statusFilter, employeeStatus, attendanceStatusLabels, companyNameAr, companyNameEn, selectedBranchNameAr, includeBranchColumn],
  );

  const attendancePdfFileName = `attendance-${from}-${to}.pdf`;

  const handleExportAttendanceExcel = useLatestCallback(async () => {
    try {
      const rows = await fetchExportSummaries();
      if (rows.length === 0) {
        toast.error('لا توجد سجلات للتصدير ضمن الفلاتر الحالية.');
        return;
      }
      const branchMap = includeBranchColumn
        ? await resolveBranchByEmployeeId()
        : new Map<string, string>();
      const sheet: XlsxCell[][] = [
        includeBranchColumn
          ? ['الموظف', 'الفرع', 'معرف الموظف', 'اليوم', 'الحالة', 'دقائق العمل', 'دقائق التأخير']
          : ['الموظف', 'معرف الموظف', 'اليوم', 'الحالة', 'دقائق العمل', 'دقائق التأخير'],
      ];
      for (const s of rows) {
        const branch = branchMap.get(s.employeeId) ?? '—';
        sheet.push(
          includeBranchColumn
            ? [
                s.employeeName,
                selectedBranchNameAr ?? branch,
                s.employeeId,
                s.date,
                STATUS[resolveVisualKey(s.status)].label,
                s.workedMinutes,
                s.lateMinutes,
              ]
            : [
                s.employeeName,
                s.employeeId,
                s.date,
                STATUS[resolveVisualKey(s.status)].label,
                s.workedMinutes,
                s.lateMinutes,
              ],
        );
      }
      await downloadXlsxFromAoA(`attendance-${from}-${to}.xlsx`, 'الحضور', sheet);
      toast.success('تم تنزيل ملف Excel.');
    } catch {
      toast.error('تعذر تصدير الحضور.');
    }
  });

  const isDefaultDate = filterFrom === todayPeriod.from && filterTo === todayPeriod.to;
  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0)
    + (isEmployeeStatusFilterActive(employeeStatus) ? 1 : 0)
    + (assignedBranchId !== 'all' ? 1 : 0)
    + (selectedEmpIds.size > 0 ? 1 : 0)
    + (!isDefaultDate ? 1 : 0);

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <Button
          type="button"
          size="sm"
          variant="luxe"
          onClick={() => setRegisterOpen(true)}
          className="h-8 gap-2"
        >
          <Plus className="h-4 w-4" />
          تسجيل حضور
        </Button>
        <FoldedHeaderTool>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={() => setRecomputeOpen(true)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            تحديث البيانات
          </Button>
        </FoldedHeaderTool>
        <FoldedHeaderTool>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 w-8 shrink-0" aria-label="تصدير الحضور">
                <FileDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => void openPdfExport()}>
                <FileDown className="h-4 w-4" />
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleExportAttendanceExcel()}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </FoldedHeaderTool>
      </div>
    ),
    [activeFilterCount, handleExportAttendanceExcel, openPdfExport],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        empPickerEmployees={visiblePickerEmployees}
        selectedEmpIds={selectedEmpIds}
        onSelectedEmpIdsChange={setSelectedEmpIds}
        employeeStatus={employeeStatus}
        onEmployeeStatusChange={setEmployeeStatus}
        inlineSelects={[assignedBranchSelect]}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOrder={ATT_VISUAL_STATUS_ORDER}
        statusLabels={attendanceStatusLabels}
        statusCounts={attendanceStatusCounts}
        periodValue={dateBounds}
        defaultPeriod={todayPeriod}
        onPeriodChange={(b) => {
          const normalized = normalizePeriodRange(b);
          setDateBounds(normalized ?? todayPeriod);
        }}
        dataView={{
          value: viewMode,
          onChange: (v) => setViewMode(v as AttendanceViewMode),
          options: [
            { value: 'card', label: 'بطاقات', icon: 'layout-grid' },
            { value: 'table', label: 'جدول', icon: 'list' },
          ],
        }}
      />
    ),
    [
      statusFilter,
      employeeStatus,
      assignedBranchSelect,
      assignedBranchId,
      selectedEmpKey,
      viewMode,
      visiblePickerEmployees,
      dateBounds.from,
      dateBounds.to,
      todayPeriod.from,
      todayPeriod.to,
      attendanceStatusCounts.all,
      attendanceStatusCounts.present,
      attendanceStatusCounts.late,
      attendanceStatusCounts.absent,
      attendanceStatusCounts.early_leave,
      attendanceStatusCounts.holiday,
      attendanceStatusCounts.rest_day,
      attendanceStatusCounts.unscheduled,
      attendanceStatusCounts.on_leave,
    ],
  );

  const refreshAfterRecompute = React.useCallback(() => {
    void reloadSummaries();
  }, [reloadSummaries]);

  return {
    from,
    to,
    dates,
    dateBounds,
    selectedEmpIds,
    denseForView,
    eventsForView,
    allEmployees,
    attendancePrintable,
    attendancePdfFileName,
    pdfOpen,
    setPdfOpen,
    recomputeOpen,
    setRecomputeOpen,
    registerOpen,
    setRegisterOpen,
    refreshAfterRecompute,
    viewMode,
    setViewMode,
    pagination,
    loading: summariesLoading || eventsLoading,
    listError,
  };
}
