'use client';

import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BarChart2, Bell, Loader2, Lock, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, dialogFormFooterClass } from '@/components/ui/dialog';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, useServerDirectoryPagination } from '@/components/ui/paged-list';
import { fetchAllPaginatedItems } from '@/features/hr/lib/api/client';
import { TableRowActions } from '@/components/ui/table-cells';
import { EmptyState } from '@/components/ui/shared-dialogs';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { useHRPayrollPeriodsStore, PERIOD_STATUS_LABELS, PERIOD_STATUS_COLORS, REVIEW_COMPLETED_LABEL, REVIEW_STAGE_LABELS } from '@/features/hr/payroll/lib/payroll-periods-store';
import { formatLatinNumber } from '@/features/hr/payroll/lib/compensation-preview';
import { hrPayrollSalaryApprovalsQueryHref, hrPayrollPeriodCompensationHref } from '@/features/hr/payroll/constants/routes';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { hrFiltersKey } from '@/features/hr/lib/use-persisted-filter-state';
import { employeeStatusFilterLabelAr, employeeStatusQuery, isEmployeeStatusFilterActive, useEmployeeStatusFilter } from '@/features/hr/lib/employee-status-filter';
import { PAYSLIP_ACCEPTANCE_STATUS_COLORS, PAYSLIP_ACCEPTANCE_STATUS_LABELS, PAYSLIP_STATUS_COLORS, PAYSLIP_STATUS_LABELS, parsePayslipMoney, payslipAcceptanceStatus, payslipsApi, type PayslipResponseDto, type PayslipStatusDto } from '@/features/hr/payroll/lib/api/payslips';
import { PayslipDetailDialog } from '@/features/hr/payroll/payroll-salary-approvals/components/payslip-detail-dialog';
import { CompensationPeriodExportActions } from '@/features/hr/payroll/compensation/components/compensation-period-export-actions';
import { SendNotificationDrawer } from '@/features/hr/notifications/components/send-notification-drawer';
import { usePayslipEmployeeDecision } from '@/features/hr/payroll/components/payslip-employee-decision-actions';
import { MinimalDropdown } from '@/components/ui/shared-dialogs';
import type { EmployeePickerOption } from '@/components/ui/employee-picker';
import { fetchEmployeeFilterPickerOptions } from '@/features/hr/lib/use-employee-filter-picker';
import { cn } from '@/shared/utils';


const PAYSLIP_STATUS_ORDER = ['all', 'draft', 'approved', 'paid'] as const;
type StatusFilter = (typeof PAYSLIP_STATUS_ORDER)[number];

const STATUS_TAB_LABELS: Record<StatusFilter, string> = {
  all: 'الكل',
  ...PAYSLIP_STATUS_LABELS,
};

function money(value: string): string {
  return formatLatinNumber(parsePayslipMoney(value), 2);
}

export function PayrollSalaryApprovalClient() {
  const searchParams = useSearchParams();
  const requestedPeriodId = searchParams.get('period') ?? '';
  const companyId = useDefaultCompanyId();
  const actor = useAuthStore(s => s.user?.email ?? undefined);
  const user = useAuthStore(s => s.user);

  const periods = useHRPayrollPeriodsStore(s => s.periods);
  const fetchPeriodCatalog = useHRPayrollPeriodsStore(s => s.fetchCatalog);
  const refreshPeriodCatalog = useHRPayrollPeriodsStore(s => s.refreshCatalog);
  const [empPickerEmployees, setEmpPickerEmployees] = React.useState<EmployeePickerOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = React.useState(false);
  const employeesFetchStarted = React.useRef(false);

  const loadEmployeePicker = React.useCallback(() => {
    if (!companyId || employeesFetchStarted.current) return;
    employeesFetchStarted.current = true;
    setEmployeesLoading(true);
    void fetchEmployeeFilterPickerOptions(companyId)
      .then(setEmpPickerEmployees)
      .catch(() => setEmpPickerEmployees([]))
      .finally(() => setEmployeesLoading(false));
  }, [companyId]);

  React.useEffect(() => {
    employeesFetchStarted.current = false;
    setEmpPickerEmployees([]);
    setEmployeesLoading(false);
  }, [companyId]);

  const sortedPeriods = React.useMemo(
    () => [...periods].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)),
    [periods],
  );

  const [periodId, setPeriodId] = React.useState(requestedPeriodId);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [selectedEmpIds, setSelectedEmpIds] = React.useState<Set<string>>(() => new Set());
  const [employeeStatus, setEmployeeStatus] = useEmployeeStatusFilter(
    hrFiltersKey('payroll', 'payslips', companyId, 'employeeStatus'),
  );
  const [metaPayslips, setMetaPayslips] = React.useState<PayslipResponseDto[]>([]);
  /** Payslips of the chosen employee status — drives the status counts. */
  const [statusMetaPayslips, setStatusMetaPayslips] = React.useState<PayslipResponseDto[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);

  const bulkMode = selectedEmpIds.size > 1;

  const loadMetaPayslips = React.useCallback(async () => {
    if (!companyId || !periodId) {
      setMetaPayslips([]);
      setStatusMetaPayslips([]);
      return;
    }
    try {
      // Every payslip of the period (notification recipients), plus the ones
      // of the chosen employee status for the status counts.
      const [all, scoped] = await Promise.all([
        fetchAllPaginatedItems((page, limit) =>
          payslipsApi.list({ companyId, payrollPeriodId: periodId, page, limit }),
        ),
        employeeStatus === 'all'
          ? null
          : fetchAllPaginatedItems((page, limit) =>
            payslipsApi.list({
              companyId,
              payrollPeriodId: periodId,
              page,
              limit,
              ...employeeStatusQuery(employeeStatus),
            }),
          ),
      ]);
      setMetaPayslips(all.items);
      setStatusMetaPayslips(scoped ? scoped.items : all.items);
    } catch (err) {
      handleApiError(err, 'payslips.list');
      setMetaPayslips([]);
      setStatusMetaPayslips([]);
    }
  }, [companyId, periodId, employeeStatus]);

  React.useEffect(() => { void loadMetaPayslips(); }, [loadMetaPayslips]);

  const selectedEmpKey = React.useMemo(() => [...selectedEmpIds].sort().join(','), [selectedEmpIds]);

  const loadPage = React.useCallback(async (page: number, pageSize: number) => {
    if (!companyId || !periodId) return { items: [] as PayslipResponseDto[], total: 0 };
    const res = await payslipsApi.list({
      companyId,
      payrollPeriodId: periodId,
      page,
      limit: pageSize,
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      ...(selectedEmpIds.size === 1 ? { employeeId: [...selectedEmpIds][0] } : {}),
      ...employeeStatusQuery(employeeStatus),
    });
    return { items: res.items, total: res.pagination.total };
  }, [companyId, periodId, statusFilter, selectedEmpIds, employeeStatus]);

  const loadBulk = React.useCallback(async () => {
    if (!companyId || !periodId) return { items: [] as PayslipResponseDto[], total: 0 };
    const res = await fetchAllPaginatedItems((page, limit) =>
      payslipsApi.list({
        companyId,
        payrollPeriodId: periodId,
        page,
        limit,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...employeeStatusQuery(employeeStatus),
      }),
    );
    const items = res.items.filter(p => selectedEmpIds.has(p.employeeId));
    return { items, total: items.length };
  }, [companyId, periodId, statusFilter, selectedEmpIds, employeeStatus]);

  const {
    items: payslips,
    loading: listLoading,
    pagination,
    reload: reloadList,
  } = useServerDirectoryPagination<PayslipResponseDto>(loadPage, {
    enabled: !!companyId && !!periodId,
    bulkMode,
    loadBulk: bulkMode ? loadBulk : undefined,
    resetDeps: [companyId, periodId, statusFilter, selectedEmpKey, employeeStatus],
  });

  const reloadPayslips = React.useCallback(async () => {
    await Promise.all([loadMetaPayslips(), reloadList()]);
  }, [loadMetaPayslips, reloadList]);

  const [finalizeOpen, setFinalizeOpen] = React.useState(false);
  const [replaceExisting, setReplaceExisting] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [notificationOpen, setNotificationOpen] = React.useState(false);
  const [decisionRefreshKey, setDecisionRefreshKey] = React.useState(0);

  React.useEffect(() => { void fetchPeriodCatalog(); }, [fetchPeriodCatalog]);

  React.useEffect(() => {
    if (requestedPeriodId && sortedPeriods.some(p => p.id === requestedPeriodId)) {
      setPeriodId(requestedPeriodId);
    }
  }, [requestedPeriodId, sortedPeriods]);

  React.useEffect(() => {
    if (periodId && sortedPeriods.some(p => p.id === periodId)) return;
    setPeriodId(sortedPeriods[0]?.id ?? '');
  }, [periodId, sortedPeriods]);

  React.useEffect(() => {
    setSelectedEmpIds(new Set());
    setStatusFilter('all');
  }, [periodId]);

  const period = sortedPeriods.find(p => p.id === periodId);

  const periodEmployees = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of metaPayslips) {
      if (!seen.has(p.employeeId)) seen.set(p.employeeId, p.employeeNameAr);
    }
    if (seen.size === 0 && period) {
      for (const line of period.employmentLines) {
        if (!seen.has(line.employeeId)) seen.set(line.employeeId, line.employeeNameAr);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [metaPayslips, period]);

  const periodEmployeeIds = React.useMemo(
    () => new Set(periodEmployees.map(e => e.id)),
    [periodEmployees],
  );

  const exportEmployeeIdsFilter = React.useMemo(() => {
    if (selectedEmpIds.size === 0 || selectedEmpIds.size >= periodEmployees.length) return undefined;
    return [...selectedEmpIds];
  }, [selectedEmpIds, periodEmployees.length]);

  const notificationDefaults = React.useMemo(() => {
    if (!period) return undefined;
    return {
      category: 'payroll' as const,
      severity: 'info' as const,
      titleAr: `قسيمة راتب — ${period.nameAr}`,
      bodyAr: `تم إعداد قسيمة راتبكم لفترة ${period.nameAr}. يرجى مراجعتها والموافقة عليها من خلال النظام.`,
      requiresAcknowledgment: true,
      actionLabelAr: 'عرض القسيمة',
      actionUrl: hrPayrollSalaryApprovalsQueryHref(period.id),
      sourceKind: 'payroll_payslip',
      sourceTable: 'hr_payroll_periods',
      sourceId: period.id,
    };
  }, [period]);

  const loadPayslips = reloadPayslips;

  const getDecisionActor = React.useCallback(() => ({
    name: user?.email || 'مسؤول',
    email: user?.email,
  }), [user]);

  const employeeDecision = usePayslipEmployeeDecision({
    channel: 'dashboard',
    getActor: getDecisionActor,
    onSuccess: async () => {
      await loadPayslips();
      setDecisionRefreshKey(k => k + 1);
    },
  });

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: statusMetaPayslips.length };
    for (const s of PAYSLIP_STATUS_ORDER) {
      if (s === 'all') continue;
      counts[s] = statusMetaPayslips.filter(p => p.status === s).length;
    }
    return counts;
  }, [statusMetaPayslips]);

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0)
    + (selectedEmpIds.size > 0 ? 1 : 0)
    + (isEmployeeStatusFilterActive(employeeStatus) ? 1 : 0);

  const periodOptions = React.useMemo(
    () => sortedPeriods.map(p => ({
      value: p.id,
      label: `${p.nameAr} (${p.code})`,
    })),
    [sortedPeriods],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        statusFilter={statusFilter}
        onStatusFilterChange={v => setStatusFilter(v as StatusFilter)}
        statusOrder={PAYSLIP_STATUS_ORDER}
        statusLabels={STATUS_TAB_LABELS}
        statusCounts={statusCounts}
        empPickerEmployees={empPickerEmployees}
        employeePickerLoading={employeesLoading}
        onEmployeePickerOpen={loadEmployeePicker}
        selectedEmpIds={selectedEmpIds}
        onSelectedEmpIdsChange={setSelectedEmpIds}
        employeeStatus={employeeStatus}
        onEmployeeStatusChange={setEmployeeStatus}
        onDateBoundsChange={() => {}}
      />
    ),
    [statusFilter, employeeStatus, statusCounts, selectedEmpIds, empPickerEmployees, employeesLoading, loadEmployeePicker],
  );

  const canFinalize = period
    && period.isReviewCompleted
    && !['locked', 'closed', 'cancelled'].includes(period.status);


  const payslipExportSubtitle = React.useMemo(
    () => [
      ...(period ? [`الفترة: ${period.nameAr} (${period.code})`] : []),
      `حالة الموظفين: ${employeeStatusFilterLabelAr(employeeStatus)}`,
    ],
    [period, employeeStatus],
  );


  const handleFinalize = async () => {
    if (!period) return;
    setBusy('finalize');
    try {
      const result = await payslipsApi.finalize({
        payrollPeriodId: period.id,
        replaceExisting,
        finalizedBy: actor,
      });
      setFinalizeOpen(false);
      setReplaceExisting(false);
      await refreshPeriodCatalog();
      await loadPayslips();
      toast.success(
        `تم اعتماد الفترة: ${result.generatedCount} مُولَّدة، ${result.approvedCount} معتمدة، ${result.totalPayslips} إجمالي.`,
      );
    } catch (err) {
      handleApiError(err, 'payslips.finalize');
    } finally {
      setBusy(null);
    }
  };

  const updateStatus = async (id: string, status: PayslipStatusDto) => {
    setBusy(id);
    try {
      await payslipsApi.update(id, { status, updatedBy: actor });
      await loadPayslips();
      toast.success(`تم تحديث حالة القسيمة إلى «${PAYSLIP_STATUS_LABELS[status]}».`);
    } catch (err) {
      handleApiError(err, 'payslips.update');
    } finally {
      setBusy(null);
    }
  };

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  const columns = React.useMemo((): ColumnDef<PayslipResponseDto>[] => [
    {
      key: 'employee',
      title: 'الموظف',
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.employeeNameAr}</p>
          <p className="text-[10px] text-muted-foreground md:hidden font-mono">{row.contractNumber ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'contract',
      title: 'العقد',
      hideOnMobile: true,
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.contractNumber ?? '—'}</span>
      ),
    },
    {
      key: 'base',
      title: 'الأساسي',
      className: 'text-center',
      headerClassName: 'text-center',
      render: (row) => <span className="font-mono tabular-nums text-xs">{money(row.baseSalary)}</span>,
    },
    {
      key: 'gross',
      title: 'الإجمالي',
      hideOnMobile: true,
      className: 'text-center',
      headerClassName: 'text-center',
      render: (row) => <span className="font-mono tabular-nums text-xs">{money(row.gross)}</span>,
    },
    {
      key: 'status',
      title: 'حالة القسيمة',
      className: 'text-center',
      headerClassName: 'text-center',
      render: (row) => (
        <Badge className={cn('rounded-lg border px-2 py-0.5 text-[10px] font-semibold', PAYSLIP_STATUS_COLORS[row.status])}>
          {PAYSLIP_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'acceptanceStatus',
      title: 'موافقة الموظف',
      className: 'text-center',
      headerClassName: 'text-center',
      render: (row) => {
        const acceptance = payslipAcceptanceStatus(row);
        return (
          <Badge className={cn('rounded-lg border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap', PAYSLIP_ACCEPTANCE_STATUS_COLORS[acceptance])}>
            {PAYSLIP_ACCEPTANCE_STATUS_LABELS[acceptance]}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      title: 'إجراءات',
      isActions: true,
      className: 'text-center',
      headerClassName: 'text-center',
      render: (row) => {
        const rowBusy = busy === row.id || employeeDecision.busyId === row.id;
        const acceptanceActions = employeeDecision.canDecide(row)
          ? [
              { label: 'موافقة', variant: 'success' as const, onClick: () => employeeDecision.accept(row), disabled: rowBusy },
              { label: 'رفض', variant: 'destructive' as const, onClick: () => employeeDecision.openReject(row), disabled: rowBusy },
            ]
          : [];
        const primaryActions = row.status === 'draft'
          ? [{ label: 'اعتماد', variant: 'success' as const, onClick: () => void updateStatus(row.id, 'approved'), disabled: rowBusy }]
          : row.status === 'approved'
            ? [{ label: 'دفع', variant: 'primary' as const, onClick: () => void updateStatus(row.id, 'paid'), disabled: rowBusy }]
            : undefined;
        const mergedPrimary = [...acceptanceActions, ...(primaryActions ?? [])];
        if (!mergedPrimary.length) return null;
        return <TableRowActions primaryActions={mergedPrimary} />;
      },
    },
  ], [busy, employeeDecision]);

  const acceptanceOf = (row: PayslipResponseDto) => PAYSLIP_ACCEPTANCE_STATUS_LABELS[payslipAcceptanceStatus(row)];
  const tools = useListTools<PayslipResponseDto>({
    section: 'hr',
    page: 'payroll-approvals',
    columns,
    rows: payslips,
    fetchAll: pagination.loadAll,
    resetKey: pagination.resetKey,
    fields: {
      employee: { kind: 'name', text: (row) => row.employeeNameAr, group: (row) => row.employeeNameAr || null },
      contract: { kind: 'code', text: (row) => row.contractNumber ?? '—' },
      base: { text: (row) => money(row.baseSalary), sort: (row) => Number(row.baseSalary) || 0, sum: (row) => Number(row.baseSalary) || 0, formatSum: (n) => money(String(n)) },
      gross: { text: (row) => money(row.gross), sort: (row) => Number(row.gross) || 0, sum: (row) => Number(row.gross) || 0, formatSum: (n) => money(String(n)) },
      status: { kind: 'status', text: (row) => PAYSLIP_STATUS_LABELS[row.status] ?? row.status, group: (row) => PAYSLIP_STATUS_LABELS[row.status] ?? row.status },
      acceptanceStatus: { kind: 'status', text: acceptanceOf, group: acceptanceOf },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        {tools.exportMenu('سجل قسائم الرواتب', 'payslips', payslipExportSubtitle)}
        <CompensationPeriodExportActions
          periodId={periodId || null}
          employeeIdsFilter={exportEmployeeIdsFilter}
          lazyLoad
          disabled={!periodId}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          disabled={!period || periodEmployees.length === 0 || !companyId}
          title={
            !period
              ? undefined
              : periodEmployees.length === 0
                ? 'لا يوجد موظفون في هذه الفترة'
                : 'إرسال إشعار لموظفي الفترة'
          }
          onClick={() => setNotificationOpen(true)}
        >
          <Bell className="h-3.5 w-3.5" />
          إرسال إشعار
        </Button>
        <Button
          size="sm"
          variant="luxe"
          className="h-8 gap-1.5 text-xs"
          disabled={!canFinalize || busy !== null}
          title={period && !period.isReviewCompleted ? 'أكمل المراجعات أولاً' : undefined}
          onClick={() => { setReplaceExisting(false); setFinalizeOpen(true); }}
        >
          <Lock className="h-3.5 w-3.5" />
          اعتماد الفترة
        </Button>
      </div>
    ),
    [canFinalize, busy, period?.isReviewCompleted, activeFilterCount, period, periodEmployees.length, companyId, periodId, exportEmployeeIdsFilter, payslipExportSubtitle, tools.depsKey],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <SetPageTitle
        titleAr="قسائم الرواتب"
        descriptionAr="توليد قسائم الموظفين، اعتمادها، ومتابعة دورة draft → approved → paid"
        iconName="UserCheck"
      />

      {period && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <MinimalDropdown
              value={periodId}
              onChange={setPeriodId}
              options={periodOptions}
              placeholder="فترة الراتب"
              className="h-8 max-w-[min(16rem,100%)] justify-between text-start text-xs font-semibold"
            />
            <Badge className={cn('rounded-lg border px-2 py-0.5 text-[10px] font-semibold', PERIOD_STATUS_COLORS[period.status])}>
              {PERIOD_STATUS_LABELS[period.status]}
            </Badge>
          <Badge className={cn(
            'rounded-lg border px-2 py-0.5 text-[10px] font-semibold',
            period.isReviewCompleted
              ? 'bg-success/10 text-success border-success/25'
              : 'bg-warning/10 text-warning border-warning/25',
          )}>
            {period.isReviewCompleted ? REVIEW_COMPLETED_LABEL : REVIEW_STAGE_LABELS[period.reviewStage]}
          </Badge>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px] text-primary" asChild>
            <Link href={hrPayrollPeriodCompensationHref(period.id)}>
              <BarChart2 className="h-3 w-3" />
              تقرير المستحقات
            </Link>
          </Button>
          {!period.isReviewCompleted && (
            <span className="text-[11px] text-amber-800 dark:text-amber-200">
              أكمل المراجعات الثلاث قبل اعتماد الفترة.
            </span>
          )}
          </div>
        </div>
      )}

      {sortedPeriods.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="لا توجد فترات رواتب"
          description="أنشئ فترة راتب من صفحة فترات الراتب أولاً."
        />
      ) : !listLoading && payslips.length === 0 && pagination.total === 0 ? (
        <EmptyState
          icon={Receipt}
          title="لا توجد قسائم"
          description={
            activeFilterCount > 0
              ? 'جرّب تغيير الفلاتر أو مسحها.'
              : 'لا توجد قسائم لهذه الفترة — يتم إنشاؤها تلقائياً عند إتمام المراجعة الثالثة من صفحة تقرير المستحقات.'
          }
        />
      ) : (
        <ListToolsTable tools={tools} keyExtractor={(row) => row.id} onRowClick={(row) => openDetail(row.id)}>
        <DirectoryPagedViews
          items={tools.rows}
          serverPagination={tools.pagination(pagination)}
          loading={listLoading || tools.loading}
        >
          {(pageItems) => (
        <DataTable
          columns={tools.columns}
          {...tools.tableSort}
          data={pageItems}
          keyExtractor={row => row.id}
          loading={listLoading}
          onRowClick={row => openDetail(row.id)}
          mobileCard={row => {
            const acceptance = payslipAcceptanceStatus(row);
            return (
            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{row.employeeNameAr}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{row.contractNumber ?? '—'}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge className={cn('rounded-lg border px-2 py-0.5 text-[10px] font-semibold', PAYSLIP_STATUS_COLORS[row.status])}>
                    {PAYSLIP_STATUS_LABELS[row.status]}
                  </Badge>
                  <Badge className={cn('rounded-lg border px-2 py-0.5 text-[10px] font-semibold', PAYSLIP_ACCEPTANCE_STATUS_COLORS[acceptance])}>
                    {PAYSLIP_ACCEPTANCE_STATUS_LABELS[acceptance]}
                  </Badge>
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">الإجمالي</span>
                <span className="font-mono font-semibold tabular-nums">{money(row.gross)}</span>
              </div>
            </div>
            );
          }}
        />
          )}
        </DirectoryPagedViews>
        </ListToolsTable>
      )}

      <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <DialogContent className="max-w-md gap-0 overflow-visible border-border p-0" dir="rtl">
          <div className="border-b border-border/60 bg-linear-to-b from-warning/8 to-transparent px-6 pb-4 pt-6">
            <DialogHeader className="space-y-2 text-right">
              <DialogTitle className="font-display text-base">اعتماد الفترة وقفلها</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                يولّد القسائم، يعتمد كل المسودات، ويقفل الفترة — لن تُعدَّل مدخلات الشهر بعد ذلك.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-4">
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border/60 bg-muted/15 p-3">
              <Checkbox checked={replaceExisting} onCheckedChange={v => setReplaceExisting(v === true)} />
              <span className="text-xs leading-relaxed">
                <span className="font-semibold">استبدال القسائم غير المدفوعة قبل الاعتماد</span>
              </span>
            </label>
          </div>
          <DialogFooter className={dialogFormFooterClass}>
            <Button disabled={busy === 'finalize'} onClick={() => void handleFinalize()}>
              {busy === 'finalize' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'اعتماد وقفل'}
            </Button>
            <Button variant="outline" onClick={() => setFinalizeOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <PayslipDetailDialog
        payslipId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAccept={employeeDecision.accept}
        onReject={employeeDecision.openReject}
        decisionBusyId={employeeDecision.busyId}
        refreshKey={decisionRefreshKey}
      />

      {employeeDecision.rejectDialog}

      <SendNotificationDrawer
        open={notificationOpen}
        onOpenChange={setNotificationOpen}
        companyId={companyId}
        employeeOptions={periodEmployees}
        initialEmployeeIds={periodEmployeeIds}
        requireSelection
        defaults={notificationDefaults}
        createdBy={actor}
        description={
          period
            ? `يُرسل إلى ${periodEmployees.length} موظفاً في فترة ${period.nameAr}. يمكنك تعديل قائمة المستلمين قبل الإرسال.`
            : undefined
        }
      />
    </div>
  );
}
