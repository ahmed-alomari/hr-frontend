'use client';

import * as React from 'react';
import { Plus, Banknote, Send, CalendarDays } from 'lucide-react';
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
import { exportDate, exportMoney, exportText } from '@/features/hr/requests/lib/list-export-format';
import { toast } from 'sonner';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { Button } from '@/components/ui/button';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import {
  hrFiltersKey,
  usePersistedEmpIdSet,
  usePersistedFilterState,
} from '@/features/hr/lib/use-persisted-filter-state';
import { useCurrentEmployee } from '@/features/hr/organization/employees/hooks/useCurrentEmployee';
import { checkRequestApprovalAccess } from '@/features/hr/requests/lib/request-approval-access';
import {
  buildEmployeeAdvanceDecisionPayload,
  getRequestApprovalUiState,
  isRequestFullyApproved,
} from '@/features/hr/requests/lib/request-approver-states';
import { RequestApproverStatesPanel } from '@/features/hr/requests/components/request-approver-states-panel';
import { RequestApproversInline } from '@/features/hr/requests/components/request-approvers-inline';
import { RequestApprovalActionCell, RequestApprovalActionButtons } from '@/features/hr/requests/components/request-approval-actions';
import {
  HRSettingsFormDrawer, FormField, ConfirmationModal, EmptyState, SearchableDropdown, MinimalDropdown,
} from '@/components/ui/shared-dialogs';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { duplicateAdvanceNumberMessage, isDuplicateAdvanceNumberError } from '@/features/hr/contracts/lib/employee-advance-errors';
import { employeeAdvancesApi } from '@/features/hr/contracts/lib/api/employee-advances';
import { fetchAllPaginatedItems } from '@/features/hr/lib/api/client';
import type { RequestApprovalAssignmentCatalogDto } from '@/features/hr/requests/types/api/overtime-requests';
import {
  useHREmployeeAdvancesStore,
  mapEmployeeAdvanceFromApi,
  ADVANCE_STATUS_LABELS,
  ADVANCE_STATUS_FILTER_ORDER,
  ADVANCE_KIND_LABELS,
  REPAYMENT_MODE_LABELS,
  EDITABLE_ADVANCE_STATUSES,
  DELETABLE_ADVANCE_STATUSES,
  advanceReasonText,
  type HREmployeeAdvance,
  type HREmployeeAdvanceKind,
  type HREmployeeAdvanceRepaymentMode,
  type HREmployeeAdvanceStatus,
} from '@/features/hr/contracts/lib/employee-advances-store';
import { DirectoryPagedViews, useServerDirectoryPagination } from '@/components/ui/paged-list';
import { useHREmployeeDirectoryStore } from '@/features/hr/requests/lib/employee-directory-store';
import { cn, formatNumber } from '@/shared/utils';
import { STATUS_PILL } from '@/shared/status-pill-classes';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import {
  EntityActionCard,
  EntityActionCardChip,
  EntityActionCardGrid,
  type WorkflowStatusTone,
} from '@/components/ui/entity-action-card';
import { TableDateCell, TableRowActions } from '@/components/ui/table-cells';
import { SarAmount } from '@/components/ui/sar-amount';

type ViewMode = 'cards' | 'list';

type StatusFilter = 'all' | HREmployeeAdvanceStatus;

const STATUS_COLORS: Record<HREmployeeAdvanceStatus, string> = {
  draft: STATUS_PILL.muted,
  pending_approval: STATUS_PILL.pending,
  approved: STATUS_PILL.approved,
  rejected: STATUS_PILL.rejected,
  disbursed: STATUS_PILL.info,
  repaying: STATUS_PILL.warning,
  fully_repaid: STATUS_PILL.approved,
  cancelled: STATUS_PILL.cancelled,
};

const ADVANCE_STATUS_TONE: Record<HREmployeeAdvanceStatus, WorkflowStatusTone> = {
  draft: 'muted',
  pending_approval: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  disbursed: 'info',
  repaying: 'warning',
  fully_repaid: 'success',
  cancelled: 'muted',
};

type DraftForm = {
  employeeId: string;
  employeeNameAr: string;
  amount: string;
  currency: string;
  advanceDate: string;
  note: string;
  advanceKind: HREmployeeAdvanceKind;
  repaymentMode: HREmployeeAdvanceRepaymentMode;
  repaymentMonths: string;
  monthlyInstallment: string;
};

const EMPTY_FORM: DraftForm = {
  employeeId: '', employeeNameAr: '', amount: '', currency: 'SAR',
  advanceDate: new Date().toISOString().slice(0, 10), note: '',
  advanceKind: 'personal',
  repaymentMode: 'by_months',
  repaymentMonths: '12',
  monthlyInstallment: '',
};

function AdvanceRepaymentLine({ x, className }: { x: HREmployeeAdvance; className?: string }) {
  if (x.repaymentMode === 'by_months' && x.repaymentMonths != null && x.repaymentMonths > 0) {
    const per = x.monthlyInstallmentAmount != null && x.monthlyInstallmentAmount > 0
      ? x.monthlyInstallmentAmount
      : Math.round((x.amount / x.repaymentMonths) * 100) / 100;
    return (
      <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', className)}>
        <span>{x.repaymentMonths} شهر ·</span>
        <SarAmount currency={x.currency} iconClassName="h-3 w-3" suffix="/شهر">
          {formatNumber(per)}
        </SarAmount>
      </span>
    );
  }
  if (x.repaymentMode === 'by_monthly_amount' && x.monthlyInstallmentAmount != null && x.monthlyInstallmentAmount > 0) {
    const approxMonths = Math.ceil(x.amount / x.monthlyInstallmentAmount);
    return (
      <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', className)}>
        <SarAmount currency={x.currency} iconClassName="h-3 w-3" suffix="/شهر">
          {formatNumber(x.monthlyInstallmentAmount)}
        </SarAmount>
        <span>· {approxMonths} شهر</span>
      </span>
    );
  }
  return <span className={className}>—</span>;
}

function AdvanceMetricCell({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 text-start">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <div className="text-start text-xs font-bold leading-snug">{value}</div>
    </div>
  );
}

function AdvanceCardMetrics({ x }: { x: HREmployeeAdvance }) {
  const showProgress = x.totalRepaidAmount > 0 || x.remainingAmount > 0;

  return (
    <div className="grid grid-cols-2 justify-items-start gap-x-4 gap-y-2.5 rounded-lg bg-muted/30 px-3 py-2.5 text-start">
      <AdvanceMetricCell
        label="المبلغ"
        value={
          <SarAmount currency={x.currency} className="font-mono">
            {formatNumber(x.amount)}
          </SarAmount>
        }
      />
      <AdvanceMetricCell label="القسط" value={<AdvanceRepaymentLine x={x} />} />
      {showProgress ? (
        <>
          <AdvanceMetricCell
            label="السداد"
            value={
              <SarAmount currency={x.currency} className="font-mono">
                {formatNumber(x.totalRepaidAmount)} / {formatNumber(x.amount)}
              </SarAmount>
            }
          />
          <AdvanceMetricCell
            label="المتبقي"
            value={
              <SarAmount currency={x.currency} className="font-mono">
                {formatNumber(x.remainingAmount)}
              </SarAmount>
            }
          />
        </>
      ) : null}
    </div>
  );
}

function AdvanceInstallmentTableCell({ x }: { x: HREmployeeAdvance }) {
  if (
    (x.repaymentMode !== 'by_months' || x.repaymentMonths == null || x.repaymentMonths <= 0)
    && (x.repaymentMode !== 'by_monthly_amount' || x.monthlyInstallmentAmount == null || x.monthlyInstallmentAmount <= 0)
  ) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <AdvanceRepaymentLine x={x} className="text-xs font-medium leading-snug text-foreground" />
  );
}

function advanceHasRepaymentProgress(x: HREmployeeAdvance): boolean {
  return x.totalRepaidAmount > 0
    || x.remainingAmount > 0
    || x.status === 'repaying'
    || x.status === 'fully_repaid'
    || x.status === 'disbursed';
}

/** Plain-text twin of `AdvanceRepaymentLine` for exports. */
function advanceInstallmentExportText(x: HREmployeeAdvance): string {
  if (x.repaymentMode === 'by_months' && x.repaymentMonths != null && x.repaymentMonths > 0) {
    const per = x.monthlyInstallmentAmount != null && x.monthlyInstallmentAmount > 0
      ? x.monthlyInstallmentAmount
      : Math.round((x.amount / x.repaymentMonths) * 100) / 100;
    return `${x.repaymentMonths} شهر · ${exportMoney(per, x.currency)}/شهر`;
  }
  if (x.repaymentMode === 'by_monthly_amount' && x.monthlyInstallmentAmount != null && x.monthlyInstallmentAmount > 0) {
    const approxMonths = Math.ceil(x.amount / x.monthlyInstallmentAmount);
    return `${exportMoney(x.monthlyInstallmentAmount, x.currency)}/شهر · ${approxMonths} شهر`;
  }
  return '—';
}

const ADVANCE_EXPORT_COLUMNS: RegisterColumn[] = [
  { label: 'الموظف', kind: 'name' },
  { label: 'رقم السلفة', kind: 'code' },
  { label: 'الفرع', kind: 'text' },
  { label: 'التاريخ', kind: 'date' },
  { label: 'المبلغ', kind: 'number' },
  { label: 'النوع', kind: 'status' },
  { label: 'السبب', kind: 'text', weight: 1.4 },
  { label: 'الحالة', kind: 'status' },
  { label: 'القسط', kind: 'text', weight: 1.3 },
  { label: 'المسدد', kind: 'number' },
  { label: 'المتبقي', kind: 'number' },
];

function AdvancePaidTableCell({ x }: { x: HREmployeeAdvance }) {
  if (!advanceHasRepaymentProgress(x)) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <SarAmount currency={x.currency} className="whitespace-nowrap text-xs font-medium">
      {formatNumber(x.totalRepaidAmount)} / {formatNumber(x.amount)}
    </SarAmount>
  );
}

function AdvanceRemainingTableCell({ x }: { x: HREmployeeAdvance }) {
  if (x.remainingAmount <= 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <SarAmount currency={x.currency} className="whitespace-nowrap text-xs font-medium">
      {formatNumber(x.remainingAmount)}
    </SarAmount>
  );
}

function isEditable(status: HREmployeeAdvanceStatus): boolean {
  return EDITABLE_ADVANCE_STATUSES.includes(status);
}

function isDeletable(status: HREmployeeAdvanceStatus): boolean {
  return DELETABLE_ADVANCE_STATUSES.includes(status);
}

function canOpenAdvanceDetail(status: HREmployeeAdvanceStatus): boolean {
  return status === 'pending_approval' || status === 'approved' || status === 'rejected';
}

export function EmployeeAdvancesClient() {
  const companyId = useDefaultCompanyId();
  const authUser = useAuthStore((s) => s.user);
  const { data: currentEmployee } = useCurrentEmployee();
  const currentEmployeeId = currentEmployee?.id ?? null;
  const decidedByActor = authUser?.id ?? undefined;

  const {
    add, update, remove,
    submitForApproval, approve, reject,
  } = useHREmployeeAdvancesStore();
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

  const employeeNameLookup = React.useCallback(
    (employeeId: string) => allEmployees.find((e) => e.id === employeeId)?.nameAr,
    [allEmployees],
  );

  const mapAdvanceRow = React.useCallback(
    (
      item: Parameters<typeof mapEmployeeAdvanceFromApi>[0],
      catalog: RequestApprovalAssignmentCatalogDto[],
    ) => mapEmployeeAdvanceFromApi(item, { catalog, employeeNameLookup }),
    [employeeNameLookup],
  );

  const [statusFilter, setStatusFilter] = usePersistedFilterState<StatusFilter>(
    hrFiltersKey('requests', 'employee-advances', companyId, 'statusFilter'),
    'all',
  );
  const [selectedEmpIds, setSelectedEmpIds] = usePersistedEmpIdSet(
    hrFiltersKey('requests', 'employee-advances', companyId, 'selectedEmpIds'),
  );
  const [employeeStatus, setEmployeeStatus] = useEmployeeStatusFilter(
    hrFiltersKey('requests', 'employee-advances', companyId, 'employeeStatus'),
  );
  const [dateBounds, setDateBounds] = usePersistedFilterState(
    hrFiltersKey('requests', 'employee-advances', companyId, 'dateBounds'),
    { from: '', to: '' },
  );

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<DraftForm>(EMPTY_FORM);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // New advances: active employees only (not suspended, not ended); the
  // advance's own employee stays selectable when editing.
  const empOptions = React.useMemo(() =>
    allEmployees
      .filter(e => e.status === 'active' || e.id === form.employeeId)
      .map(e => ({ value: e.id, label: e.nameAr })),
    [allEmployees, form.employeeId],
  );
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);
  const [detailAdvance, setDetailAdvance] = React.useState<HREmployeeAdvance | null>(null);
  const [viewMode, setViewMode] = usePersistedFilterState<ViewMode>(
    hrFiltersKey('requests', 'employee-advances', companyId, 'viewMode'),
    'cards',
  );

  const selectedEmpKey = React.useMemo(() => [...selectedEmpIds].sort().join(','), [selectedEmpIds]);

  const bulkMode = selectedEmpIds.size > 1;

  const buildListQuery = React.useCallback((page: number, pageSize: number) => ({
    companyId: companyId!,
    page,
    limit: pageSize,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(dateBounds.from ? { advanceDateFrom: dateBounds.from } : {}),
    ...(dateBounds.to ? { advanceDateTo: dateBounds.to } : {}),
    ...(selectedEmpIds.size === 1 ? { employeeId: [...selectedEmpIds][0] } : {}),
    ...employeeStatusQuery(employeeStatus),
  }), [companyId, statusFilter, dateBounds.from, dateBounds.to, selectedEmpIds, employeeStatus]);

  const sortAdvances = React.useCallback(
    (rows: HREmployeeAdvance[]) =>
      [...rows].sort((a, b) => b.advanceDate.localeCompare(a.advanceDate)),
    [],
  );

  const loadPage = React.useCallback(async (page: number, pageSize: number) => {
    if (!companyId) return { items: [] as HREmployeeAdvance[], total: 0 };
    try {
      const res = await employeeAdvancesApi.list(buildListQuery(page, pageSize));
      return {
        items: sortAdvances(res.items.map((item) => mapAdvanceRow(item, res.approvalAssignments))),
        total: res.pagination.total,
      };
    } catch (e) {
      handleApiError(e, 'employee-advances/fetch');
      return { items: [], total: 0 };
    }
  }, [buildListQuery, companyId, mapAdvanceRow, sortAdvances]);

  const loadBulk = React.useCallback(async () => {
    if (!companyId) return { items: [] as HREmployeeAdvance[], total: 0 };
    try {
      const catalogsById = new Map<string, RequestApprovalAssignmentCatalogDto>();
      const res = await fetchAllPaginatedItems<HREmployeeAdvance>(async (page, limit) => {
        const full = await employeeAdvancesApi.list(buildListQuery(page, limit));
        full.approvalAssignments.forEach((a) => catalogsById.set(a.id, a));
        const catalog = [...catalogsById.values()];
        return {
          items: full.items.map((item) => mapAdvanceRow(item, catalog)),
          pagination: full.pagination,
        };
      });
      const items = sortAdvances(
        res.items.filter((x) => selectedEmpIds.has(x.employeeId)),
      );
      return { items, total: items.length };
    } catch (e) {
      handleApiError(e, 'employee-advances/fetch');
      return { items: [], total: 0 };
    }
  }, [buildListQuery, companyId, mapAdvanceRow, selectedEmpIds, sortAdvances]);

  const {
    items: sorted,
    loading: listLoading,
    pagination,
    reload: reloadList,
  } = useServerDirectoryPagination<HREmployeeAdvance>(loadPage, {
    enabled: !!companyId,
    bulkMode,
    loadBulk: bulkMode ? loadBulk : undefined,
    resetDeps: [companyId, statusFilter, dateBounds.from, dateBounds.to, selectedEmpKey, employeeStatus],
  });

  const advanceStatusCounts = React.useMemo((): Record<string, number> => {
    const counts: Record<string, number> = { all: pagination.total };
    for (const key of ADVANCE_STATUS_FILTER_ORDER) {
      counts[key] = statusFilter === key
        ? pagination.total
        : sorted.filter((x) => x.status === key).length;
    }
    return counts;
  }, [pagination.total, sorted, statusFilter]);

  const runAction = async (id: string, action: () => Promise<void>, successMessage: string) => {
    setActionLoadingId(id);
    try {
      await action();
      toast.success(successMessage);
      await reloadList();
    } catch (e) {
      handleApiError(e, 'employee-advances/action');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproveAdvance = React.useCallback(async (x: HREmployeeAdvance) => {
    if (!companyId || !currentEmployeeId) return;
    try {
      const access = await checkRequestApprovalAccess(
        'advance',
        companyId,
        currentEmployeeId,
        x.approverStates,
      );
      if (!access.ok) {
        toast.warning(access.message);
        return;
      }
      const payload = buildEmployeeAdvanceDecisionPayload(
        access.states,
        currentEmployeeId,
        'approve',
        { decidedBy: decidedByActor },
      );
      setActionLoadingId(x.id);
      await approve(x.id, payload);
      if (payload.approverStates && isRequestFullyApproved(payload.approverStates)) {
        toast.success('تم اعتماد السلفة نهائياً.');
      } else {
        toast.success('تم تسجيل موافقتك — بانتظار بقية المعتمدين.');
      }
      await reloadList();
      setDetailAdvance(null);
    } catch (e) {
      const { status, displayMessage } = handleApiError(e, 'employee-advances/decide.approve');
      if (status === 404) {
        toast.error('مسار موافقة السلف غير مفعّل على الخادم. يُرجى من فريق الباك تفعيل PATCH أو POST على /payroll/employee-advances/{id}/decision.');
      } else {
        toast.error(displayMessage);
      }
    } finally {
      setActionLoadingId(null);
    }
  }, [approve, companyId, currentEmployeeId, decidedByActor, reloadList]);

  const [rejectTarget, setRejectTarget] = React.useState<{
    advance: HREmployeeAdvance;
    states: Parameters<typeof buildEmployeeAdvanceDecisionPayload>[0];
  } | null>(null);

  /** Checks the approver may act, then asks for the reason before rejecting. */
  const handleRejectAdvance = React.useCallback(async (x: HREmployeeAdvance) => {
    if (!companyId || !currentEmployeeId) return;
    try {
      const access = await checkRequestApprovalAccess(
        'advance',
        companyId,
        currentEmployeeId,
        x.approverStates,
      );
      if (!access.ok) {
        toast.warning(access.message);
        return;
      }
      setRejectTarget({ advance: x, states: access.states });
    } catch (e) {
      const { displayMessage } = handleApiError(e, 'employee-advances/decide.reject');
      toast.error(displayMessage);
    }
  }, [companyId, currentEmployeeId]);

  const confirmRejectAdvance = React.useCallback(async (reason: string) => {
    if (!rejectTarget || !currentEmployeeId) return;
    const x = rejectTarget.advance;
    try {
      const payload = buildEmployeeAdvanceDecisionPayload(
        rejectTarget.states,
        currentEmployeeId,
        'reject',
        { notes: reason, decidedBy: decidedByActor },
      );
      setActionLoadingId(x.id);
      await reject(x.id, payload);
      toast.message('تم رفض السلفة.');
      await reloadList();
      setDetailAdvance(null);
    } catch (e) {
      const { status, displayMessage } = handleApiError(e, 'employee-advances/decide.reject');
      if (status === 404) {
        toast.error('مسار موافقة السلف غير مفعّل على الخادم. يُرجى من فريق الباك تفعيل PATCH أو POST على /payroll/employee-advances/{id}/decision.');
      } else {
        toast.error(displayMessage);
      }
      throw e;
    } finally {
      setActionLoadingId(null);
    }
  }, [currentEmployeeId, decidedByActor, reject, rejectTarget, reloadList]);

  const canShowApprovalActions = React.useCallback(
    (x: HREmployeeAdvance) =>
      x.status === 'pending_approval' &&
      getRequestApprovalUiState(x.approverStates, currentEmployeeId).showActions,
    [currentEmployeeId],
  );

  const openAdvanceDetail = (x: HREmployeeAdvance) => {
    setDetailAdvance(x);
  };

  const openCreate = () => {
    setEditId(null); setForm(EMPTY_FORM); setError(null); setDrawerOpen(true);
  };

  const openEdit = (id: string) => {
    const x = sorted.find(i => i.id === id);
    if (!x || !isEditable(x.status)) return;
    setEditId(id);
    setForm({
      employeeId: x.employeeId, employeeNameAr: x.employeeNameAr,
      amount: String(x.amount), currency: x.currency,
      advanceDate: x.advanceDate, note: x.note,
      advanceKind: x.advanceKind,
      repaymentMode: x.repaymentMode,
      repaymentMonths: x.repaymentMonths != null ? String(x.repaymentMonths) : '12',
      monthlyInstallment: x.monthlyInstallmentAmount != null ? String(x.monthlyInstallmentAmount) : '',
    });
    setError(null); setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.employeeId) { setError('اختر الموظف'); return; }
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) { setError('المبلغ يجب أن يكون أكبر من صفر'); return; }
    if (!form.advanceDate) { setError('تاريخ السلفة مطلوب'); return; }
    let repaymentMonths: number | null = null;
    let monthlyInstallmentAmount: number | null = null;
    if (form.repaymentMode === 'by_months') {
      const m = parseInt(form.repaymentMonths, 10);
      if (!Number.isFinite(m) || m < 1 || m > 600) {
        setError('أدخل عدد أشهر صحيحاً (1–600)');
        return;
      }
      repaymentMonths = m;
    } else {
      const inst = parseFloat(form.monthlyInstallment);
      if (!form.monthlyInstallment.trim() || Number.isNaN(inst) || inst <= 0) {
        setError('أدخل مبلغ القسط الشهري');
        return;
      }
      if (inst > amount) {
        setError('المبلغ الشهري لا يجوز أن يتجاوز إجمالي السلفة');
        return;
      }
      monthlyInstallmentAmount = inst;
    }
    const payload = {
      employeeId: form.employeeId, employeeNameAr: form.employeeNameAr,
      amount, currency: form.currency,
      advanceDate: form.advanceDate, note: form.note,
      advanceKind: form.advanceKind,
      repaymentMode: form.repaymentMode,
      repaymentMonths,
      monthlyInstallmentAmount,
    };
    try {
      setSaving(true);
      if (editId) {
        await update(editId, payload);
        toast.success('تم تحديث السلفة.');
      } else {
        await add(payload);
        toast.success('تم إنشاء السلفة — قيد الموافقة.');
      }
      await reloadList();
      setDrawerOpen(false);
    } catch (e) {
      if (isDuplicateAdvanceNumberError(e)) {
        setError(duplicateAdvanceNumberMessage());
      } else if (e instanceof Error && e.message === duplicateAdvanceNumberMessage()) {
        setError(e.message);
      } else {
        setError(handleApiError(e, 'employee-advances/save').displayMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const patch = (p: Partial<DraftForm>) => setForm(f => ({ ...f, ...p }));

  const handleEmployeeSelect = (id: string) => {
    const emp = allEmployees.find(e => e.id === id);
    patch({ employeeId: id, employeeNameAr: emp?.nameAr ?? '' });
  };

  const getExportRows = useLatestCallback(async (): Promise<string[][]> => {
    if (!companyId) return [];
    let exportRows = sorted;
    if (pagination.total > sorted.length) {
      try {
        const res = bulkMode
          ? await loadBulk()
          : await (async () => {
              const catalogsById = new Map<string, RequestApprovalAssignmentCatalogDto>();
              const fetched = await fetchAllPaginatedItems<HREmployeeAdvance>(async (page, limit) => {
                const full = await employeeAdvancesApi.list(buildListQuery(page, limit));
                full.approvalAssignments.forEach((a) => catalogsById.set(a.id, a));
                const catalog = [...catalogsById.values()];
                return {
                  items: full.items.map((item) => mapAdvanceRow(item, catalog)),
                  pagination: full.pagination,
                };
              });
              return {
                items: sortAdvances(fetched.items),
                total: fetched.total,
              };
            })();
        exportRows = res.items;
      } catch (e) {
        throw new Error(handleApiError(e, 'employee-advances/export').displayMessage);
      }
    }
    return exportRows.map((x) => [
      exportText(x.employeeNameAr),
      exportText(x.advanceNumber),
      exportText(x.branchNameAr),
      exportDate(x.advanceDate),
      exportMoney(x.amount, x.currency),
      ADVANCE_KIND_LABELS[x.advanceKind] ?? '—',
      exportText(advanceReasonText(x)),
      ADVANCE_STATUS_LABELS[x.status] ?? x.status,
      advanceInstallmentExportText(x),
      advanceHasRepaymentProgress(x)
        ? `${formatNumber(x.totalRepaidAmount)} / ${exportMoney(x.amount, x.currency)}`
        : '—',
      x.remainingAmount > 0 ? exportMoney(x.remainingAmount, x.currency) : '—',
    ]);
  });

  const activeFilterCount = (selectedEmpIds.size > 0 ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)
    + (dateBounds.from || dateBounds.to ? 1 : 0)
    + (isEmployeeStatusFilterActive(employeeStatus) ? 1 : 0);

  const columns = React.useMemo((): ColumnDef<HREmployeeAdvance>[] => [
    {
      key: 'employee',
      title: 'الموظف',
      render: (x) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{x.employeeNameAr}</p>
          <p className="font-mono text-[10px] text-muted-foreground" dir="ltr">{x.advanceNumber}</p>
          {x.branchNameAr ? (
            <p className="text-[10px] text-muted-foreground">{x.branchNameAr}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'advanceDate',
      title: 'التاريخ',
      render: (x) => <TableDateCell value={x.advanceDate} />,
    },
    {
      key: 'amount',
      title: 'المبلغ',
      className: 'whitespace-nowrap',
      render: (x) => (
        <SarAmount currency={x.currency} className="font-medium">
          {formatNumber(x.amount)}
        </SarAmount>
      ),
    },
    {
      key: 'kind',
      title: 'النوع',
      hideOnMobile: true,
      className: 'whitespace-nowrap',
      render: (x) => ADVANCE_KIND_LABELS[x.advanceKind],
    },
    {
      key: 'reasonAr',
      title: 'السبب',
      render: (x) => (
        <span className="text-xs text-muted-foreground max-w-[220px] truncate block">
          {advanceReasonText(x) || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      title: 'الحالة',
      className: 'whitespace-nowrap',
      render: (x) => (
        <Badge variant="outline" className={cn('whitespace-nowrap text-[10px]', STATUS_COLORS[x.status])}>
          {ADVANCE_STATUS_LABELS[x.status]}
        </Badge>
      ),
    },
    {
      key: 'installment',
      title: 'القسط',
      hideOnMobile: true,
      className: 'whitespace-nowrap',
      render: (x) => <AdvanceInstallmentTableCell x={x} />,
    },
    {
      key: 'paid',
      title: 'السداد',
      hideOnMobile: true,
      className: 'whitespace-nowrap',
      render: (x) => <AdvancePaidTableCell x={x} />,
    },
    {
      key: 'remaining',
      title: 'المتبقي',
      hideOnMobile: true,
      className: 'whitespace-nowrap',
      render: (x) => <AdvanceRemainingTableCell x={x} />,
    },
    {
      key: 'approvers',
      title: 'مسار الموافقة',
      headerClassName: 'whitespace-nowrap',
      className: 'min-w-[14rem]',
      render: (x) => <RequestApproversInline states={x.approverStates} requestStatus={x.status} />,
    },
    {
      key: 'decisionNotes',
      title: 'ملاحظات القرار',
      hideOnMobile: true,
      headerClassName: 'whitespace-nowrap min-w-[6.5rem]',
      className: 'min-w-[6.5rem]',
      render: (x) => (
        <span className="line-clamp-2 max-w-[12rem] text-xs text-muted-foreground" title={x.decisionNotes || undefined}>
          {x.decisionNotes || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: 'إجراءات',
      isActions: true,
      render: (x) => {
        const loading = actionLoadingId === x.id;
        const canSubmit = x.status === 'draft' || x.status === 'rejected';
        const approvalUi = getRequestApprovalUiState(x.approverStates, currentEmployeeId);
        const menuItems = [
          ...(canOpenAdvanceDetail(x.status) ? [{
            label: 'التفاصيل',
            onClick: () => openAdvanceDetail(x),
          }] : []),
          ...(isEditable(x.status) && x.status !== 'pending_approval' ? [{
            label: 'تعديل',
            onClick: () => openEdit(x.id),
          }] : []),
          ...(canSubmit ? [{
            label: 'إرسال للموافقة',
            onClick: () => void runAction(x.id, () => submitForApproval(x.id), 'تم إرسال السلفة للموافقة.'),
          }] : []),
          ...(isDeletable(x.status) ? [{
            label: 'حذف',
            onClick: () => setConfirmId(x.id),
            separator: true as const,
          }] : []),
        ];
        return (
          <div className="flex items-start justify-end gap-1">
            {x.status === 'pending_approval' && approvalUi.showActions ? (
              <RequestApprovalActionCell
                states={x.approverStates}
                currentEmployeeId={currentEmployeeId}
                onApprove={() => void handleApproveAdvance(x)}
                onReject={() => void handleRejectAdvance(x)}
              />
            ) : null}
            {menuItems.length > 0 ? (
              <TableRowActions menuItems={menuItems} />
            ) : null}
            {loading ? <span className="text-[10px] text-muted-foreground">…</span> : null}
          </div>
        );
      },
    },
  ], [
    actionLoadingId,
    currentEmployeeId,
    handleApproveAdvance,
    handleRejectAdvance,
    submitForApproval,
  ]);

  const statusFilterLabels = React.useMemo(
    () => Object.fromEntries(
      ADVANCE_STATUS_FILTER_ORDER.map((key) => [key, ADVANCE_STATUS_LABELS[key]]),
    ) as Record<string, string>,
    [],
  );

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <RegisterExportMenu
          title="سجل السلف"
          fileName="employee-advances"
          columns={ADVANCE_EXPORT_COLUMNS}
          getRows={getExportRows}
          subtitleLines={[`حالة الموظفين: ${employeeStatusFilterLabelAr(employeeStatus)}`]}
          landscape
        />
        <Button variant="luxe" size="sm" className="h-8 gap-1.5 px-3 text-xs shadow-sm shrink-0" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          سلفة جديدة
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
        onDateBoundsChange={setDateBounds}
        companyId={companyId}
        empPickerEmployees={empPickerEmployees}
        selectedEmpIds={selectedEmpIds}
        onSelectedEmpIdsChange={setSelectedEmpIds}
        employeeStatus={employeeStatus}
        onEmployeeStatusChange={setEmployeeStatus}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => setStatusFilter(v as StatusFilter)}
        statusOrder={ADVANCE_STATUS_FILTER_ORDER}
        statusLabels={statusFilterLabels}
        statusCounts={advanceStatusCounts}
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
      statusFilter,
      employeeStatus,
      selectedEmpKey,
      empPickerEmployees,
      dateBounds.from,
      dateBounds.to,
      advanceStatusCounts.all,
      advanceStatusCounts,
      pagination.total,
      statusFilterLabels,
      viewMode,
    ],
  );

  return (
    <>
      <SetPageTitle titleAr="سلف الموظفين" descriptionAr="تسجيل وإدارة سلف الموظفين واعتمادها." iconName="Banknote" />

      <div className="flex min-h-0 flex-1 flex-col gap-5">
        {!listLoading && sorted.length === 0 && pagination.total === 0 ? (
          <EmptyState icon={Banknote} title="لا توجد سلف" description="أضف سلفة جديدة لموظف للبدء." />
        ) : (
          <DirectoryPagedViews
            items={sorted}
            serverPagination={pagination}
            loading={listLoading}
          >
            {(pageItems) => viewMode === 'list' ? (
              <DataTable
                variant="directory"
                alwaysShowTable
                tableClassName="min-w-[1280px]"
                columns={columns}
                data={pageItems}
                keyExtractor={(x) => x.id}
                emptyText="لا توجد سلف"
                onRowClick={(x) => {
                  if (canOpenAdvanceDetail(x.status)) openAdvanceDetail(x);
                  else if (isEditable(x.status) && x.status !== 'pending_approval') openEdit(x.id);
                }}
              />
            ) : (
              <EntityActionCardGrid>
                {pageItems.map((x) => {
            const loading = actionLoadingId === x.id;
            const canSubmit = x.status === 'draft' || x.status === 'rejected';
            const openDetail = canOpenAdvanceDetail(x.status);
            const openEditOnClick = isEditable(x.status) && x.status !== 'pending_approval';

            return (
              <EntityActionCard
                key={x.id}
                reference={x.advanceNumber}
                title={x.employeeNameAr}
                subtitle={x.branchNameAr || undefined}
                onClick={() => {
                  if (openDetail) openAdvanceDetail(x);
                  else if (openEditOnClick) openEdit(x.id);
                }}
                status={{
                  label: ADVANCE_STATUS_LABELS[x.status],
                  tone: ADVANCE_STATUS_TONE[x.status],
                }}
                chips={
                  <>
                    <EntityActionCardChip className="font-mono tabular-nums">
                      <span className="inline-flex items-center gap-1" dir="ltr">
                        <CalendarDays className="h-3 w-3 shrink-0" />
                        {x.advanceDate}
                      </span>
                    </EntityActionCardChip>
                    <EntityActionCardChip>{ADVANCE_KIND_LABELS[x.advanceKind]}</EntityActionCardChip>
                  </>
                }
                metrics={<AdvanceCardMetrics x={x} />}
                description={
                  [advanceReasonText(x), x.decisionNotes?.trim() ? `ملاحظات القرار: ${x.decisionNotes}` : '']
                    .filter(Boolean)
                    .join(' — ') || undefined
                }
                workflow={
                  canShowApprovalActions(x)
                    ? {
                        showApproveReject: true,
                        onApprove: () => void handleApproveAdvance(x),
                        onReject: () => void handleRejectAdvance(x),
                        disabled: !getRequestApprovalUiState(x.approverStates, currentEmployeeId).canAct,
                        waitingReason: getRequestApprovalUiState(x.approverStates, currentEmployeeId).reasonAr ?? undefined,
                      }
                    : undefined
                }
                footerNote={
                  x.approvedAt || x.disbursedAt ? (
                    <div className="space-y-0.5 text-[10px] text-muted-foreground">
                      {x.approvedAt ? <p>تاريخ الاعتماد: {x.approvedAt.slice(0, 10)}</p> : null}
                      {x.disbursedAt ? <p>تاريخ الصرف: {x.disbursedAt.slice(0, 10)}</p> : null}
                    </div>
                  ) : undefined
                }
                extraFooter={
                  canSubmit || (isEditable(x.status) && x.status !== 'pending_approval') || isDeletable(x.status) ? (
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {canSubmit ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-primary"
                          disabled={loading}
                          onClick={() => void runAction(x.id, () => submitForApproval(x.id), 'تم إرسال السلفة للموافقة.')}
                        >
                          <Send className="h-3 w-3 me-1" />
                          إرسال للموافقة
                        </Button>
                      ) : null}
                      {isEditable(x.status) && x.status !== 'pending_approval' ? (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={loading} onClick={() => openEdit(x.id)}>
                          تعديل
                        </Button>
                      ) : null}
                      {isDeletable(x.status) ? (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" disabled={loading} onClick={() => setConfirmId(x.id)}>
                          حذف
                        </Button>
                      ) : null}
                    </div>
                  ) : undefined
                }
              >
                <RequestApproverStatesPanel
                  states={x.approverStates}
                  requestStatus={x.status}
                  compact
                  className="border-0 bg-transparent p-0"
                />
              </EntityActionCard>
            );
          })}
              </EntityActionCardGrid>
            )}
          </DirectoryPagedViews>
        )}
      </div>

      <HRSettingsFormDrawer
        open={drawerOpen} onOpenChange={setDrawerOpen}
        title={editId ? 'تعديل السلفة' : 'سلفة جديدة'}
        onSave={() => void handleSave()} saveDisabled={saving} error={error}
      >
        <FormField label="الموظف" required>
          <SearchableDropdown
            value={form.employeeId}
            onChange={handleEmployeeSelect}
            options={empOptions}
            placeholder="اختر الموظف…"
            disabled={!!editId}
          />
        </FormField>
        <FormField label="المبلغ" required>
          <Input type="number" min="0" value={form.amount} onChange={e => patch({ amount: e.target.value })} placeholder="0" />
        </FormField>
        <FormField label="نوع السلفة" required>
          <MinimalDropdown
            value={form.advanceKind}
            onChange={v => patch({ advanceKind: v as HREmployeeAdvanceKind })}
            options={Object.entries(ADVANCE_KIND_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </FormField>
        <FormField label="آلية حساب القسط الشهري" span2>
          <MinimalDropdown
            value={form.repaymentMode}
            onChange={v => patch({ repaymentMode: v as HREmployeeAdvanceRepaymentMode })}
            options={Object.entries(REPAYMENT_MODE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          {form.repaymentMode === 'by_months' ? (
            <div className="mt-2 space-y-1">
              <p className="text-[11px] text-muted-foreground">يُقسَّط إجمالي السلفة على عدد الأشهر التي تدخلها.</p>
              <Input
                type="number"
                min={1}
                max={600}
                className="max-w-[10rem]"
                value={form.repaymentMonths}
                onChange={e => patch({ repaymentMonths: e.target.value })}
                placeholder="مثال: 12"
              />
            </div>
          ) : (
            <div className="mt-2 space-y-1">
              <p className="text-[11px] text-muted-foreground">يُخصم شهرياً المبلغ التالي حتى اكتمال السداد.</p>
              <Input
                type="number"
                min={0}
                step="0.01"
                className="max-w-[10rem]"
                value={form.monthlyInstallment}
                onChange={e => patch({ monthlyInstallment: e.target.value })}
                placeholder="مبلغ القسط"
              />
            </div>
          )}
        </FormField>
        <FormField label="العملة">
          <MinimalDropdown
            value={form.currency}
            onChange={v => patch({ currency: v })}
            options={[
              { value: 'SAR', label: 'ريال سعودي' },
              { value: 'USD', label: 'دولار أمريكي' },
            ]}
          />
        </FormField>
        <FormField label="تاريخ السلفة" required>
          <DatePickerInput value={form.advanceDate} onChange={(ymd) => patch({ advanceDate: ymd })} />
        </FormField>
        {!editId && (
          <p className="col-span-2 text-[11px] text-muted-foreground">
            تُنشأ السلفة الجديدة بحالة «قيد الموافقة» ويمكن اعتمادها أو رفضها مباشرة.
          </p>
        )}
        <FormField label="ملاحظة" span2>
          <Input value={form.note} onChange={e => patch({ note: e.target.value })} placeholder="ملاحظة اختيارية…" />
        </FormField>
      </HRSettingsFormDrawer>

      <ConfirmationModal
        open={!!confirmId}
        onOpenChange={v => { if (!v) setConfirmId(null); }}
        title="حذف السلفة"
        description="هل أنت متأكد من حذف هذا السجل؟"
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={() => {
          if (!confirmId) return;
          void (async () => {
            try {
              await remove(confirmId);
              toast.success('تم حذف السلفة.');
              setConfirmId(null);
              await reloadList();
            } catch (e) {
              handleApiError(e, 'employee-advances/delete');
            }
          })();
        }}
      />

      <Dialog open={detailAdvance != null} onOpenChange={(o) => { if (!o) setDetailAdvance(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل السلفة</DialogTitle>
          </DialogHeader>
          {detailAdvance ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">الموظف</p>
                  <p className="text-sm font-medium">{detailAdvance.employeeNameAr}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">رقم السلفة</p>
                  <p className="text-sm font-medium font-mono" dir="ltr">{detailAdvance.advanceNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">الفرع</p>
                  <p className="text-sm font-medium">{detailAdvance.branchNameAr || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المبلغ</p>
                  <SarAmount currency={detailAdvance.currency} className="text-sm font-medium">
                    {formatNumber(detailAdvance.amount)}
                  </SarAmount>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">تاريخ السلفة</p>
                  <p className="text-sm font-medium font-mono">{detailAdvance.advanceDate}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">نوع السلفة</p>
                  <p className="text-sm font-medium">{ADVANCE_KIND_LABELS[detailAdvance.advanceKind]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">حالة السلفة</p>
                  <p className="text-sm font-medium">{ADVANCE_STATUS_LABELS[detailAdvance.status]}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">آلية السداد</p>
                  <AdvanceRepaymentLine x={detailAdvance} className="text-sm" />
                </div>
                {advanceReasonText(detailAdvance) ? (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">السبب</p>
                    <p className="text-sm">{advanceReasonText(detailAdvance)}</p>
                  </div>
                ) : null}
                {detailAdvance.totalRepaidAmount > 0 || detailAdvance.remainingAmount > 0 ? (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">المبلغ المسدّد</p>
                      <SarAmount currency={detailAdvance.currency} className="text-sm font-medium">
                        {formatNumber(detailAdvance.totalRepaidAmount)}
                      </SarAmount>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">المبلغ المتبقي</p>
                      <SarAmount currency={detailAdvance.currency} className="text-sm font-medium">
                        {formatNumber(detailAdvance.remainingAmount)}
                      </SarAmount>
                    </div>
                  </>
                ) : null}
                {detailAdvance.monthlyInstallmentAmount != null && detailAdvance.monthlyInstallmentAmount > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground">القسط الشهري</p>
                    <SarAmount currency={detailAdvance.currency} className="text-sm font-medium">
                      {formatNumber(detailAdvance.monthlyInstallmentAmount!)}
                    </SarAmount>
                  </div>
                ) : null}
                {detailAdvance.disbursedAt ? (
                  <div>
                    <p className="text-xs text-muted-foreground">تاريخ الصرف</p>
                    <p className="text-sm font-medium font-mono">{detailAdvance.disbursedAt.slice(0, 10)}</p>
                  </div>
                ) : null}
                {detailAdvance.createdAt ? (
                  <div>
                    <p className="text-xs text-muted-foreground">تاريخ الإنشاء</p>
                    <p className="text-sm font-medium font-mono">{detailAdvance.createdAt.slice(0, 10)}</p>
                  </div>
                ) : null}
                {detailAdvance.decisionNotes ? (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">ملاحظات القرار</p>
                    <p className="text-sm">{detailAdvance.decisionNotes}</p>
                  </div>
                ) : null}
              </div>
              <RequestApproversInline states={detailAdvance.approverStates} requestStatus={detailAdvance.status} />
              <RequestApproverStatesPanel states={detailAdvance.approverStates} requestStatus={detailAdvance.status} />
              {canShowApprovalActions(detailAdvance) ? (
                <RequestApprovalActionButtons
                  states={detailAdvance.approverStates}
                  currentEmployeeId={currentEmployeeId}
                  onApprove={() => void handleApproveAdvance(detailAdvance)}
                  onReject={() => void handleRejectAdvance(detailAdvance)}
                />
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <RejectReasonDialog
        open={rejectTarget != null}
        onOpenChange={(open) => { if (!open) setRejectTarget(null); }}
        kind="advance"
        title="رفض طلب السلفة"
        description={rejectTarget
          ? `${rejectTarget.advance.employeeNameAr} · ${rejectTarget.advance.advanceNumber}`
          : undefined}
        onConfirm={confirmRejectAdvance}
      />
    </>
  );
}
