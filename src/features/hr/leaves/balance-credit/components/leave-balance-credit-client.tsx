'use client';

import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import { CheckCircle2, Plus, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { TableDateCell, TableRowActions, TableRowDetailDialog } from '@/components/ui/table-cells';
import { FormField, EmptyState } from '@/components/ui/shared-dialogs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, dialogFormFooterClass } from '@/components/ui/dialog';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { cn, toWesternDigits } from '@/shared/utils';
import { STATUS_PILL } from '@/shared/status-pill-classes';
import { AR_LEAVE_BALANCE_CREDIT_STATUS_LABELS } from '@/shared/i18n/ar';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { DirectoryPagedViews } from '@/components/ui/paged-list';
import { EmployeePicker } from '@/components/ui/employee-picker';
import { useLeaveBalanceCreditModel } from '@/features/hr/leaves/balance-credit/hooks/useLeaveBalanceCreditModel';
import type { LeaveBalanceCreditRequest } from '@/features/hr/leaves/balance-credit/types';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import { employeeStatusFilterLabelAr, isEmployeeStatusFilterActive } from '@/features/hr/lib/employee-status-filter';
import { exportDateTime, exportText } from '@/features/hr/requests/lib/list-export-format';

const CREDIT_STATUS_ORDER: readonly string[] = ['pending', 'approved', 'rejected'];

const CREDIT_STATUS_LABELS: Record<string, string> = AR_LEAVE_BALANCE_CREDIT_STATUS_LABELS;

function statusBadgeClass(status: LeaveBalanceCreditRequest['status']) {
  if (status === 'pending') return STATUS_PILL.pending;
  if (status === 'approved') return STATUS_PILL.approved;
  return STATUS_PILL.rejected;
}

function statusLabelAr(status: LeaveBalanceCreditRequest['status']) {
  return CREDIT_STATUS_LABELS[status] ?? status;
}


export function LeaveBalanceCreditClient() {
  const m = useLeaveBalanceCreditModel();
  const [detailRow, setDetailRow] = React.useState<LeaveBalanceCreditRequest | null>(null);

  const activeFilterCount = (m.branchId !== 'all' ? 1 : 0) + (m.departmentId !== 'all' ? 1 : 0) + (m.statusFilter !== 'all' ? 1 : 0) + (m.selectedEmpIds.size > 0 ? 1 : 0)
    + (isEmployeeStatusFilterActive(m.employeeStatus) ? 1 : 0);

  const openAddFromHeader = useLatestCallback(() =>
    m.openAddDialog(m.selectedEmpIds.size > 0 ? m.selectedEmpIds : undefined),
  );


  useEntityFilterSlot(
    () => (
      <ListFilterBar
        inlineSelects={[
          { id: 'branch', value: m.branchId, onChange: m.setBranchId, placeholder: 'الفرع', options: m.branchInlineOptions },
          { id: 'dept', value: m.departmentId, onChange: m.setDepartmentId, placeholder: 'القسم', options: m.deptInlineOptions },
        ]}
        companyId={m.companyId}
        empPickerEmployees={m.employeePickerOptions}
        selectedEmpIds={m.selectedEmpIds}
        onSelectedEmpIdsChange={m.setSelectedEmpIds}
        employeeStatus={m.employeeStatus}
        onEmployeeStatusChange={m.setEmployeeStatus}
        statusFilter={m.statusFilter}
        onStatusFilterChange={m.setStatusFilter}
        statusOrder={CREDIT_STATUS_ORDER}
        statusLabels={CREDIT_STATUS_LABELS}
        statusCounts={m.statusCounts}
        onDateBoundsChange={m.setDateBounds}
        trailingActions={undefined}
      />
    ),
    [
      m.branchId,
      m.departmentId,
      m.statusFilter,
      m.employeeStatus,
      m.selectedEmpKey,
      m.dateBounds.from,
      m.dateBounds.to,
      m.statusCounts.all,
      m.statusCounts.pending,
      m.statusCounts.approved,
      m.statusCounts.rejected,
      m.companyId,
      m.branchInlineOptions,
      m.deptInlineOptions,
      m.employeePickerOptions,
    ],
  );

  const columns: ColumnDef<LeaveBalanceCreditRequest>[] = React.useMemo(
    () => [
      {
        key: 'employee',
        title: 'الموظف',
        render: (r) => (
          <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {(r?.employeeNameAr ?? '?').charAt(0)}
            </div>
            <p className="font-medium text-sm">{r?.employeeNameAr ?? '—'}</p>
          </div>
        ),
      },
      {
        key: 'leaveType',
        title: 'نوع الإجازة',
        hideOnMobile: true,
        render: (r) => (
          <span className="text-xs text-muted-foreground">{r.leaveTypeNameAr ?? '—'}</span>
        ),
      },
      {
        key: 'days',
        title: 'عدد الأيام المضافة',
        render: (r) => (
          <span className="font-mono text-sm tabular-nums" dir="ltr">
            +{toWesternDigits(String(r.daysAdded))}
          </span>
        ),
      },
      {
        key: 'reason',
        title: 'الوصف أو العنوان',
        hideOnMobile: true,
        render: (r) => (
          <span className="text-xs text-muted-foreground   max-w-[280px]">{r.reasonAr || '—'}</span>
        ),
      },
      {
        key: 'status',
        title: 'الحالة',
        render: (r) => (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
              statusBadgeClass(r.status),
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                r.status === 'pending'
                  ? 'bg-gold'
                  : r.status === 'approved'
                    ? 'bg-success'
                    : 'bg-muted-foreground',
              )}
            />
            {statusLabelAr(r.status)}
          </span>
        ),
      },
      {
        key: 'createdAt',
        title: 'التاريخ',
        className: 'align-top',
        hideOnMobile: true,
        render: (r) => <TableDateCell value={r.createdAt} mode="datetime" />,
      },
      {
        key: 'actions',
        title: 'إجراء',
        isActions: true,
        render: (r) => {
          if (r.status !== 'pending') {
            return <TableDateCell value={r.decidedAt} mode="datetime" />;
          }
          return (
            <TableRowActions
              primaryActions={[
                {
                  label: 'موافقة',
                  variant: 'success',
                  icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                  onClick: () => void m.approveCreditRequest(r.id),
                },
                {
                  label: 'رفض',
                  variant: 'destructive',
                  icon: <XCircle className="h-3.5 w-3.5" />,
                  onClick: () => void m.rejectCreditRequest(r.id),
                },
              ]}
            />
          );
        },
      },
    ],
    [m.approveCreditRequest, m.rejectCreditRequest],
  );

  const tools = useListTools<LeaveBalanceCreditRequest>({
    section: 'hr',
    page: 'leave-balance-credit',
    columns,
    rows: m.sortedRequests,
    fetchAll: m.loadAllForExport,
    resetKey: m.pagination.resetKey,
    fields: {
      employee: { kind: 'name', text: (r) => exportText(r.employeeNameAr), group: (r) => r.employeeNameAr || null },
      leaveType: { text: (r) => exportText(r.leaveTypeNameAr), group: (r) => r.leaveTypeNameAr || null },
      days: { text: (r) => `+${toWesternDigits(String(r.daysAdded))}`, sort: (r) => Number(r.daysAdded) || 0, sum: (r) => Number(r.daysAdded) || 0 },
      reason: { text: (r) => exportText(r.reasonAr), sortable: false },
      status: { kind: 'status', text: (r) => statusLabelAr(r.status), group: (r) => statusLabelAr(r.status) },
      createdAt: { kind: 'date', text: (r) => exportDateTime(r.createdAt), sort: (r) => r.createdAt ?? '', group: (r) => (r.createdAt ? r.createdAt.slice(0, 7) : null) },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        {tools.exportMenu('سجل طلبات إضافة رصيد الإجازات', 'leave-balance-credits', [`حالة الموظفين: ${employeeStatusFilterLabelAr(m.employeeStatus)}`])}
        <Button
          variant="luxe"
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs shadow-sm shrink-0"
          onClick={openAddFromHeader}
        >
          <Plus className="h-3.5 w-3.5" />
          طلب إضافة رصيد
        </Button>
      </div>
    ),
    [activeFilterCount, m.employeeStatus, openAddFromHeader, tools.depsKey],
  );

  if (m.accessDenied) {
    return <ForbiddenState title="لا تملك صلاحية الوصول لطلبات إضافة الرصيد" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 animate-fade-in">
      {m.listError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive whitespace-pre-wrap">{m.listError}</p>
      ) : null}

      <div className="space-y-3">
        {m.loading && m.sortedRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">جاري التحميل...</p>
        ) : m.sortedRequests.length === 0 && !m.loading ? (
          <EmptyState title="لا توجد طلبات ضمن الفلاتر" />
        ) : (
          <ListToolsTable tools={tools} keyExtractor={(r) => r.id} onRowClick={(r) => setDetailRow(r)}>
          <DirectoryPagedViews
            items={tools.rows}
            serverPagination={tools.pagination(m.pagination)}
            loading={m.loading || tools.loading}
            resetDeps={[m.branchId, m.departmentId, m.statusFilter, m.selectedEmpKey, m.dateBounds.from, m.dateBounds.to]}
          >
            {(pageItems) => (
          <DataTable
            columns={tools.columns}
            {...tools.tableSort}
            data={pageItems}
            keyExtractor={(r) => r.id}
            emptyText="لا توجد طلبات"
            onRowClick={(r) => setDetailRow(r)}
            mobileCard={(r) => (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(r?.employeeNameAr ?? '?').charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{r?.employeeNameAr ?? '—'}</p>
                      <p className="text-[11px] font-mono text-muted-foreground" dir="ltr">
                        {r.createdAt.slice(0, 16).replace('T', ' ')}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                      statusBadgeClass(r.status),
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        r.status === 'pending'
                          ? 'bg-gold'
                          : r.status === 'approved'
                            ? 'bg-success'
                            : 'bg-muted-foreground',
                      )}
                    />
                    {statusLabelAr(r.status)}
                  </span>
                </div>
                <p className="text-sm font-mono tabular-nums" dir="ltr">
                  +{toWesternDigits(String(r.daysAdded))} يوماً
                </p>
                <p className="text-[11px] text-muted-foreground">{r.leaveTypeNameAr ?? '—'}</p>
                {r.reasonAr ? <p className="text-[11px] text-muted-foreground line-clamp-3">{r.reasonAr}</p> : null}
                {r.status === 'pending' ? (
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs text-success border-success/40 hover:bg-success/10"
                      onClick={() => void m.approveCreditRequest(r.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> موافقة
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                      onClick={() => void m.rejectCreditRequest(r.id)}
                    >
                      <XCircle className="h-3.5 w-3.5" /> رفض
                    </Button>
                  </div>
                ) : (
                  <p className="text-[10px] font-mono text-muted-foreground" dir="ltr">
                    {r.decidedAt ? `تاريخ القرار: ${r.decidedAt.slice(0, 10)}` : '—'}
                  </p>
                )}
              </div>
            )}
          />
            )}
          </DirectoryPagedViews>
          </ListToolsTable>
        )}
      </div>

      <Dialog open={m.addOpen} onOpenChange={(o) => { if (!o) m.resetAddForm(); m.setAddOpen(o); }}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <form onSubmit={m.handleDialogSubmit}>
            <DialogHeader>
              <DialogTitle>
                {m.formEmployeeIds.size > 1 ? 'طلب إضافة رصيد جماعي' : 'طلب إضافة رصيد'}
              </DialogTitle>
              <DialogDescription>
                اختر الموظفين ونوع الإجازة وعدد الأيام المضافة. يُسجَّل الطلب بحالة «في الانتظار» حتى الموافقة.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <FormField
                label={`الموظفون${m.formEmployeeIds.size > 0 ? ` (${m.formEmployeeIds.size})` : ''}`}
                required
              >
                <EmployeePicker
                  variant="form"
                  selectionMode="target"
                  employees={m.formEmployeePickerOptions}
                  selected={m.formEmployeeIds}
                  onChange={m.setFormEmployeeIds}
                  loading={m.loading}
                />
              </FormField>
              <FormField label="نوع الإجازة" required>
                <Select value={m.leaveTypeId} onValueChange={m.setLeaveTypeId}>
                  <SelectTrigger className="h-10 w-full rounded-lg border-input bg-background">
                    <SelectValue placeholder="اختر نوع الإجازة…" />
                  </SelectTrigger>
                  <SelectContent>
                    {m.leaveTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nameAr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              {m.formEmployeeIds.size === 1 && m.selectedBalance ? (
                <p className="text-[11px] text-muted-foreground font-mono" dir="ltr">
                  الرصيد الحالي ({m.selectedLeaveTypeNameAr}): {toWesternDigits(String(m.selectedBalance.used))}/
                  {toWesternDigits(String(m.selectedBalance.total))}
                </p>
              ) : m.formEmployeeIds.size === 1 && m.leaveTypeId ? (
                <p className="text-[11px] text-muted-foreground">
                  لا يوجد رصيد مسجّل لـ {m.selectedLeaveTypeNameAr} — سيُنشأ عند الموافقة.
                </p>
              ) : m.formEmployeeIds.size > 1 ? (
                <p className="text-[11px] text-muted-foreground">
                  سيتم إنشاء طلب منفصل لكل موظف من بين {m.formEmployeeIds.size} موظفين محددين.
                </p>
              ) : null}
              <FormField label="عدد الأيام المضافة">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  placeholder="مثال: 3"
                  value={m.daysAddedRaw}
                  onChange={(ev) => m.setDaysAddedRaw(ev.target.value)}
                  className="h-10 font-mono rounded-lg border-input bg-background"
                  dir="ltr"
                />
              </FormField>
              <FormField label="الوصف أو العنوان">
                <Textarea
                  value={m.reasonAr}
                  onChange={(e) => m.setReasonAr(e.target.value)}
                  placeholder="وصف مختصر أو عنوان الطلب…"
                  rows={3}
                  className="min-h-[88px] resize-none rounded-lg border-input bg-background"
                />
              </FormField>
            </div>
            <DialogFooter className={dialogFormFooterClass}>
              <Button type="submit" variant="luxe">
                {m.formEmployeeIds.size > 1 ? `تسجيل ${m.formEmployeeIds.size} طلبات` : 'تسجيل الطلب'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { m.setAddOpen(false); m.resetAddForm(); }}>
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TableRowDetailDialog
        open={detailRow != null}
        onOpenChange={(o) => !o && setDetailRow(null)}
        title="تفاصيل طلب إضافة الرصيد"
        fields={detailRow ? [
          { label: 'الموظف', value: detailRow.employeeNameAr },
          { label: 'نوع الإجازة', value: detailRow.leaveTypeNameAr ?? '—' },
          { label: 'عدد الأيام', value: `+${toWesternDigits(String(detailRow.daysAdded))}` },
          { label: 'الوصف', value: detailRow.reasonAr || '—' },
          { label: 'الحالة', value: statusLabelAr(detailRow.status) },
          { label: 'تاريخ الطلب', value: <TableDateCell value={detailRow.createdAt} mode="datetime" /> },
          { label: 'تاريخ القرار', value: <TableDateCell value={detailRow.decidedAt} mode="datetime" /> },
        ] : []}
      />
    </div>
  );
}
