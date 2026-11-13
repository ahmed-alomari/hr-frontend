'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Timer, CalendarDays, Ban, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  attendanceEventsApi,
  type DailyBreakdownResponseDto,
} from '@/features/hr/attendance/lib/api/attendance-events';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import {
  HRSettingsFormDrawer, FormField, ConfirmationModal, EmptyState, SearchableDropdown,
} from '@/components/ui/shared-dialogs';
import { DirectoryPagedViews } from '@/components/ui/paged-list';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { TableDateCell, TableRowActions } from '@/components/ui/table-cells';
import {
  EntityActionCard,
  EntityActionCardChip,
  EntityActionCardGrid,
  EntityActionCardMetric,
  EntityActionCardMetricsRow,
  type WorkflowStatusTone,
} from '@/components/ui/entity-action-card';
import { RequestApproverStatesPanel } from '@/features/hr/requests/components/request-approver-states-panel';
import { RequestApproversInline } from '@/features/hr/requests/components/request-approvers-inline';
import {
  ApprovalActionCell,
  ApprovalActionButtons,
} from '@/features/hr/requests/components/request-approval-actions';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { DurationMinutesDisplay } from '@/components/shared/duration-minutes-display';
import { Can } from '@/components/shared/can';
import { RejectReasonDialog } from '@/components/approval/reject-reason-dialog';
import { cn, formatTime } from '@/shared/utils';
import { STATUS_PILL } from '@/shared/status-pill-classes';
import {
  useOvertimeRequestsDirectoryModel,
  OVERTIME_STATUS_LABELS,
} from '@/features/hr/requests/overtime-requests/hooks/useOvertimeRequestsDirectoryModel';
import type { OvertimeRequestRecord } from '@/features/hr/requests/overtime-requests/services/overtime-requests.service';
import type { OvertimeRequestStatusDto } from '@/features/hr/requests/lib/api/overtime-requests';

const STATUS_COLORS: Record<OvertimeRequestStatusDto, string> = {
  pending: STATUS_PILL.pending,
  approved: STATUS_PILL.approved,
  rejected: STATUS_PILL.rejected,
  cancelled: STATUS_PILL.cancelled,
};

const STATUS_TONE: Record<OvertimeRequestStatusDto, WorkflowStatusTone> = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'muted',
};

type DraftForm = {
  employeeId: string;
  workDate: string;
  hours: string;
  minutes: string;
  reasonAr: string;
};

const EMPTY_FORM: DraftForm = {
  employeeId: '',
  workDate: new Date().toISOString().slice(0, 10),
  hours: '1',
  minutes: '0',
  reasonAr: '',
};

function isEditable(status: OvertimeRequestStatusDto): boolean {
  return status === 'pending';
}

function isCancellable(status: OvertimeRequestStatusDto): boolean {
  return status === 'pending';
}

function isDeletable(status: OvertimeRequestStatusDto): boolean {
  return status === 'rejected' || status === 'cancelled';
}

type AttendanceSummary = {
  checkInAt: string | null;
  checkOutAt: string | null;
  workedMinutes: number;
  expectedMinutes: number;
  overtimeMinutes: number;
};

/** Earliest check-in / latest check-out across the day's periods, plus totals. */
function summarizeAttendance(breakdown: DailyBreakdownResponseDto): AttendanceSummary {
  let checkInAt: string | null = null;
  let checkOutAt: string | null = null;
  for (const period of breakdown.periods) {
    const { checkInAt: inAt, checkOutAt: outAt } = period.actual;
    if (inAt && (!checkInAt || inAt < checkInAt)) checkInAt = inAt;
    if (outAt && (!checkOutAt || outAt > checkOutAt)) checkOutAt = outAt;
  }
  return {
    checkInAt,
    checkOutAt,
    workedMinutes: breakdown.totals.workedMinutes,
    expectedMinutes: breakdown.totals.expectedMinutes,
    overtimeMinutes: breakdown.totals.overtimeMinutes,
  };
}

/** Real check-in/check-out + computed overtime for a work day, pulled from /attendance/events/daily-breakdown. */
function AttendanceBreakdownPanel({
  loading,
  error,
  breakdown,
}: {
  loading: boolean;
  error: string | null;
  breakdown: DailyBreakdownResponseDto | null;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground">
        جاري تحميل بيانات الحضور الفعلية…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {error}
      </div>
    );
  }
  if (!breakdown) return null;

  const summary = summarizeAttendance(breakdown);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3">
      <p className="text-xs font-semibold text-foreground">الحضور الفعلي لهذا اليوم</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-md bg-background px-2.5 py-2">
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><LogIn className="h-3 w-3" />الحضور</p>
          <p className="font-mono text-xs font-medium tabular-nums" >{summary.checkInAt ? formatTime(summary.checkInAt) : '—'}</p>
        </div>
        <div className="rounded-md bg-background px-2.5 py-2">
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><LogOut className="h-3 w-3" />الانصراف</p>
          <p className="font-mono text-xs font-medium tabular-nums" >{summary.checkOutAt ? formatTime(summary.checkOutAt) : '—'}</p>
        </div>
        <div className="rounded-md bg-background px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground">ساعات العمل الفعلية</p>
          <p className="text-xs font-medium tabular-nums"><DurationMinutesDisplay minutes={summary.workedMinutes} /></p>
        </div>
        <div className="rounded-md bg-background px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground">الإضافي المحسوب فعلياً</p>
          <p className="text-xs font-medium tabular-nums text-primary"><DurationMinutesDisplay minutes={summary.overtimeMinutes} /></p>
        </div>
      </div>
    </div>
  );
}

export function OvertimeRequestsClient() {
  const m = useOvertimeRequestsDirectoryModel();

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<DraftForm>(EMPTY_FORM);

  const [approveChoice, setApproveChoice] = React.useState<'requested' | 'actual'>('requested');
  const [approveNotes, setApproveNotes] = React.useState('');
  const [rejectTarget, setRejectTarget] = React.useState<OvertimeRequestRecord | null>(null);

  const [formBreakdown, setFormBreakdown] = React.useState<DailyBreakdownResponseDto | null>(null);
  const [formBreakdownLoading, setFormBreakdownLoading] = React.useState(false);
  const [formBreakdownError, setFormBreakdownError] = React.useState<string | null>(null);

  const patch = (p: Partial<DraftForm>) => setForm((f) => ({ ...f, ...p }));

  React.useEffect(() => {
    if (!m.drawerOpen || !form.employeeId || !form.workDate) {
      setFormBreakdown(null);
      setFormBreakdownError(null);
      return;
    }
    let cancelled = false;
    setFormBreakdownLoading(true);
    setFormBreakdownError(null);
    void attendanceEventsApi
      .getDailyBreakdown({
        employeeId: form.employeeId,
        workDate: form.workDate,
        companyId: m.companyId ?? undefined,
        timezoneOffsetMinutes: 180,
      })
      .then((res) => {
        if (cancelled) return;
        setFormBreakdown(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setFormBreakdown(null);
        setFormBreakdownError(handleApiError(err, 'overtime-requests.form.daily-breakdown').displayMessage);
      })
      .finally(() => {
        if (!cancelled) setFormBreakdownLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [m.drawerOpen, form.employeeId, form.workDate, m.companyId]);

  React.useEffect(() => {
    if (!m.drawerOpen) return;
    if (m.editTarget) {
      setForm({
        employeeId: m.editTarget.employeeId,
        workDate: m.editTarget.workDate,
        hours: String(Math.floor(m.editTarget.requestedMinutes / 60)),
        minutes: String(m.editTarget.requestedMinutes % 60),
        reasonAr: m.editTarget.reasonAr,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [m.drawerOpen, m.editTarget]);

  React.useEffect(() => {
    if (!m.approveTarget) return;
    setApproveChoice('requested');
    setApproveNotes('');
  }, [m.approveTarget]);

  if (m.accessDenied) {
    return <ForbiddenState title="لا تملك صلاحية الوصول لطلبات العمل الإضافي" />;
  }

  const openApprove = (x: OvertimeRequestRecord) => {
    m.setDetailTarget(null);
    m.setApproveTarget(x);
  };

  const rawActualOvertimeMinutes = m.dailyBreakdown ? summarizeAttendance(m.dailyBreakdown).overtimeMinutes : null;
  const actualOvertimeMinutes = rawActualOvertimeMinutes != null && rawActualOvertimeMinutes > 0 ? rawActualOvertimeMinutes : null;

  const confirmApprove = async () => {
    if (!m.approveTarget) return;
    const approvedMinutes = approveChoice === 'actual' && actualOvertimeMinutes != null
      ? actualOvertimeMinutes
      : m.approveTarget.requestedMinutes;
    await m.handleApprove(m.approveTarget, { approvedMinutes, decisionNotesAr: approveNotes });
  };

  const handleSave = async () => {
    if (!form.employeeId) { setError('اختر الموظف'); return; }
    if (!form.workDate) { setError('تاريخ العمل الإضافي مطلوب'); return; }
    const hours = parseInt(form.hours || '0', 10);
    const minutes = parseInt(form.minutes || '0', 10);
    const totalMinutes = (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
    if (totalMinutes < 1) { setError('أدخل مدة عمل إضافي صحيحة (دقيقة واحدة على الأقل)'); return; }
    if (!form.reasonAr.trim() || form.reasonAr.trim().length < 3) {
      setError('السبب مطلوب (٣ أحرف على الأقل)');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (m.editTarget) {
        await m.updateRequest(m.editTarget.id, {
          requestedMinutes: totalMinutes,
          reasonAr: form.reasonAr.trim(),
        });
        toast.success('تم تحديث طلب العمل الإضافي.');
      } else {
        await m.createRequest({
          employeeId: form.employeeId,
          workDate: form.workDate,
          requestedMinutes: totalMinutes,
          reasonAr: form.reasonAr.trim(),
        });
        toast.success('تم تقديم طلب العمل الإضافي.');
      }
      m.setDrawerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (x: OvertimeRequestRecord) => {
    if (!isEditable(x.status)) return;
    m.setEditTarget(x);
    m.setDrawerOpen(true);
  };

  const openDetail = (x: OvertimeRequestRecord) => m.setDetailTarget(x);

  const columns = React.useMemo((): ColumnDef<OvertimeRequestRecord>[] => [
    {
      key: 'employee',
      title: 'الموظف',
      render: (x) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{x.employeeNameAr}</p>
          {x.departmentNameAr ? <p className="text-[10px] text-muted-foreground">{x.departmentNameAr}</p> : null}
        </div>
      ),
    },
    {
      key: 'workDate',
      title: 'تاريخ العمل الإضافي',
      render: (x) => <TableDateCell value={x.workDate} />,
    },
    {
      key: 'minutes',
      title: 'المدة المطلوبة',
      render: (x) => <DurationMinutesDisplay minutes={x.requestedMinutes} className="font-medium" />,
    },
    {
      key: 'approvedMinutes',
      title: 'المدة المعتمدة',
      hideOnMobile: true,
      render: (x) => (
        <DurationMinutesDisplay
          minutes={x.approvedMinutes}
          className="text-muted-foreground"
        />
      ),
    },
    {
      key: 'reasonAr',
      title: 'السبب',
      render: (x) => (
        <span className="text-xs text-muted-foreground max-w-[220px] truncate block">{x.reasonAr || '—'}</span>
      ),
    },
    {
      key: 'status',
      title: 'الحالة',
      render: (x) => (
        <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[x.status])}>
          {OVERTIME_STATUS_LABELS[x.status]}
        </Badge>
      ),
    },
    {
      key: 'approvers',
      title: 'مسار الموافقة',
      hideOnMobile: true,
      render: (x) => <RequestApproversInline states={x.approverStates} requestStatus={x.status} />,
    },
    {
      key: 'decisionNotes',
      title: 'ملاحظات القرار',
      hideOnMobile: true,
      render: (x) => (
        <span className="line-clamp-2 max-w-[12rem] text-xs text-muted-foreground" title={x.decisionNotesAr || undefined}>
          {x.decisionNotesAr || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: 'إجراءات',
      isActions: true,
      render: (x) => {
        const loading = m.actionLoadingId === x.id;
        const menuItems = [
          { label: 'التفاصيل', onClick: () => openDetail(x) },
          ...(isEditable(x.status) ? [{ label: 'تعديل', onClick: () => openEdit(x) }] : []),
          ...(isCancellable(x.status) ? [{ label: 'سحب الطلب', onClick: () => m.setCancelId(x.id) }] : []),
          ...(isDeletable(x.status) ? [{
            label: 'حذف', onClick: () => m.setDeleteId(x.id), separator: true as const, destructive: true,
          }] : []),
        ];
        return (
          <div className="flex items-start justify-end gap-1">
            {m.canShowApprovalActions(x) ? (
              <ApprovalActionCell
                states={x.approverStates}
                currentEmployeeId={m.currentEmployeeId}
                getUiState={() => m.getApprovalUiState(x)}
                onApprove={() => openApprove(x)}
                onReject={() => setRejectTarget(x)}
              />
            ) : null}
            <TableRowActions menuItems={menuItems} />
            {loading ? <span className="text-[10px] text-muted-foreground">…</span> : null}
          </div>
        );
      },
    },
  ], [m]);

  return (
    <>
      <SetPageTitle
        titleAr="طلبات العمل الإضافي"
        descriptionAr="تقديم واعتماد طلبات العمل الإضافي للموظفين."
        iconName="Timer"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-5">
        {!m.loading && m.items.length === 0 && m.pagination.total === 0 ? (
          <EmptyState icon={Timer} title="لا توجد طلبات عمل إضافي" description="أضف طلب عمل إضافي جديد لموظف للبدء." />
        ) : (
          <DirectoryPagedViews items={m.items} serverPagination={m.pagination} loading={m.loading}>
            {(pageItems) => m.viewMode === 'list' ? (
              <DataTable
                variant="directory"
                alwaysShowTable
                tableClassName="min-w-[1200px]"
                columns={columns}
                data={pageItems}
                keyExtractor={(x) => x.id}
                emptyText="لا توجد طلبات"
                onRowClick={(x) => {
                  if (isEditable(x.status)) openEdit(x);
                  else openDetail(x);
                }}
              />
            ) : (
              <EntityActionCardGrid>
                {pageItems.map((x) => {
                  const loading = m.actionLoadingId === x.id;
                  return (
                    <EntityActionCard
                      key={x.id}
                      title={x.employeeNameAr}
                      subtitle={x.departmentNameAr || undefined}
                      onClick={() => (isEditable(x.status) ? openEdit(x) : openDetail(x))}
                      status={{ label: OVERTIME_STATUS_LABELS[x.status], tone: STATUS_TONE[x.status] }}
                      chips={
                        <>
                          <EntityActionCardChip className="font-mono tabular-nums">
                            <span className="inline-flex items-center gap-1" dir="ltr">
                              <CalendarDays className="h-3 w-3 shrink-0" />
                              {x.workDate}
                            </span>
                          </EntityActionCardChip>
                        </>
                      }
                      metrics={
                        <EntityActionCardMetricsRow>
                          <EntityActionCardMetric label="المدة المطلوبة" value={<DurationMinutesDisplay minutes={x.requestedMinutes} />} />
                          <EntityActionCardMetric
                            label="المدة المعتمدة"
                            value={<DurationMinutesDisplay minutes={x.approvedMinutes} />}
                          />
                        </EntityActionCardMetricsRow>
                      }
                      description={
                        [x.reasonAr, x.decisionNotesAr?.trim() ? `ملاحظات القرار: ${x.decisionNotesAr}` : '']
                          .filter(Boolean)
                          .join(' — ') || undefined
                      }
                      workflow={
                        m.canShowApprovalActions(x)
                          ? {
                              showApproveReject: true,
                              onApprove: () => openApprove(x),
                              onReject: () => setRejectTarget(x),
                              disabled: !m.getApprovalUiState(x).canAct,
                              waitingReason: m.getApprovalUiState(x).reasonAr ?? undefined,
                            }
                          : undefined
                      }
                      extraFooter={
                        isCancellable(x.status) || isDeletable(x.status) ? (
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {isCancellable(x.status) ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-amber-600"
                                disabled={loading}
                                onClick={() => m.setCancelId(x.id)}
                              >
                                <Ban className="h-3 w-3 me-1" />
                                سحب الطلب
                              </Button>
                            ) : null}
                            {isDeletable(x.status) ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-destructive hover:text-destructive"
                                disabled={loading}
                                onClick={() => m.setDeleteId(x.id)}
                              >
                                حذف
                              </Button>
                            ) : null}
                          </div>
                        ) : undefined
                      }
                    >
                      <RequestApproverStatesPanel states={x.approverStates} requestStatus={x.status} compact className="border-0 bg-transparent p-0" />
                    </EntityActionCard>
                  );
                })}
              </EntityActionCardGrid>
            )}
          </DirectoryPagedViews>
        )}
      </div>

      <Can permission="hr.requests.overtime-requests.create">
        <HRSettingsFormDrawer
          open={m.drawerOpen}
          onOpenChange={m.setDrawerOpen}
          title={m.editTarget ? 'تعديل طلب العمل الإضافي' : 'طلب عمل إضافي جديد'}
          onSave={() => void handleSave()}
          saveDisabled={saving}
          error={error}
        >
          <FormField label="الموظف" required>
            <SearchableDropdown
              value={form.employeeId}
              onChange={(id) => patch({ employeeId: id })}
              options={m.employees}
              placeholder="اختر الموظف…"
              disabled={!!m.editTarget}
            />
          </FormField>
          <FormField label="تاريخ العمل الإضافي" required>
            <DatePickerInput value={form.workDate} onChange={(ymd) => patch({ workDate: ymd })} disabled={!!m.editTarget} />
          </FormField>
          {form.employeeId && form.workDate ? (
            <AttendanceBreakdownPanel
              loading={formBreakdownLoading}
              error={formBreakdownError}
              breakdown={formBreakdown}
            />
          ) : null}
          <FormField label="المدة المطلوبة" required span2>
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <Input type="number" min={0} value={form.hours} onChange={(e) => patch({ hours: e.target.value })} placeholder="ساعات" />
                <p className="text-[10px] text-muted-foreground">ساعات</p>
              </div>
              <div className="flex-1 space-y-1">
                <Input type="number" min={0} max={59} value={form.minutes} onChange={(e) => patch({ minutes: e.target.value })} placeholder="دقائق" />
                <p className="text-[10px] text-muted-foreground">دقائق</p>
              </div>
            </div>
          </FormField>
          <FormField label="سبب طلب العمل الإضافي" required span2>
            <Textarea
              value={form.reasonAr}
              onChange={(e) => patch({ reasonAr: e.target.value })}
              rows={3}
              minLength={3}
              placeholder="اشرح سبب الحاجة للعمل الإضافي (٣ أحرف على الأقل)…"
            />
          </FormField>
          {!m.editTarget ? (
            <p className="col-span-2 text-[11px] text-muted-foreground">
              يُقدَّم الطلب بحالة «قيد الموافقة»، ويمكن اعتماده مباشرة إن لم يوجد مسار موافقة مُسنَد لهذا النوع من الطلبات.
            </p>
          ) : null}
        </HRSettingsFormDrawer>
      </Can>

      <ConfirmationModal
        open={!!m.cancelId}
        onOpenChange={(v) => { if (!v) m.setCancelId(null); }}
        title="سحب طلب العمل الإضافي"
        description="هل أنت متأكد من سحب هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="سحب الطلب"
        variant="destructive"
        onConfirm={() => void m.handleCancel()}
      />

      <ConfirmationModal
        open={!!m.deleteId}
        onOpenChange={(v) => { if (!v) m.setDeleteId(null); }}
        title="حذف طلب العمل الإضافي"
        description="هل أنت متأكد من حذف هذا الطلب نهائياً؟"
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={() => void m.handleDelete()}
      />

      <Dialog open={m.detailTarget != null} onOpenChange={(o) => { if (!o) m.setDetailTarget(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل طلب العمل الإضافي</DialogTitle>
          </DialogHeader>
          {m.detailTarget ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">الموظف</p>
                  <p className="text-sm font-medium">{m.detailTarget.employeeNameAr}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">القسم</p>
                  <p className="text-sm font-medium">{m.detailTarget.departmentNameAr || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">تاريخ العمل الإضافي</p>
                  <p className="text-sm font-medium font-mono">{m.detailTarget.workDate}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">حالة الطلب</p>
                  <p className="text-sm font-medium">{OVERTIME_STATUS_LABELS[m.detailTarget.status]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المدة المطلوبة</p>
                  <p className="text-sm font-medium tabular-nums"><DurationMinutesDisplay minutes={m.detailTarget.requestedMinutes} /></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المدة المعتمدة</p>
                  <p className="text-sm font-medium tabular-nums">
                    <DurationMinutesDisplay minutes={m.detailTarget.approvedMinutes} />
                  </p>
                </div>
                {m.detailTarget.previousOvertimeMinutes != null ? (
                  <div>
                    <p className="text-xs text-muted-foreground">إضافي سابق في اليوم</p>
                    <p className="text-sm font-medium tabular-nums">
                      <DurationMinutesDisplay minutes={m.detailTarget.previousOvertimeMinutes} />
                      {m.detailTarget.previousOvertimePayrollAllowed ? ' · محتسب في الرواتب' : ''}
                    </p>
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">السبب</p>
                  <p className="text-sm">{m.detailTarget.reasonAr || '—'}</p>
                </div>
                {m.detailTarget.decisionNotesAr ? (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">ملاحظات القرار</p>
                    <p className="text-sm">{m.detailTarget.decisionNotesAr}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs text-muted-foreground">تاريخ التقديم</p>
                  <p className="text-sm font-medium font-mono">{m.detailTarget.submittedAt.slice(0, 10)}</p>
                </div>
                {m.detailTarget.decidedAt ? (
                  <div>
                    <p className="text-xs text-muted-foreground">تاريخ القرار</p>
                    <p className="text-sm font-medium font-mono">{m.detailTarget.decidedAt.slice(0, 10)}</p>
                  </div>
                ) : null}
              </div>
              <AttendanceBreakdownPanel
                loading={m.breakdownLoading}
                error={m.breakdownError}
                breakdown={m.dailyBreakdown}
              />
              <RequestApproverStatesPanel states={m.detailTarget.approverStates} requestStatus={m.detailTarget.status} />
              {m.canShowApprovalActions(m.detailTarget) ? (
                <ApprovalActionButtons
                  states={m.detailTarget.approverStates}
                  currentEmployeeId={m.currentEmployeeId}
                  getUiState={() => m.getApprovalUiState(m.detailTarget!)}
                  onApprove={() => openApprove(m.detailTarget!)}
                  onReject={() => setRejectTarget(m.detailTarget!)}
                />
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={m.approveTarget != null} onOpenChange={(o) => { if (!o) m.setApproveTarget(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>اعتماد طلب العمل الإضافي</DialogTitle>
          </DialogHeader>
          {m.approveTarget ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">الموظف</p>
                  <p className="text-sm font-medium">{m.approveTarget.employeeNameAr}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">تاريخ العمل الإضافي</p>
                  <p className="text-sm font-medium font-mono">{m.approveTarget.workDate}</p>
                </div>
              </div>

              <AttendanceBreakdownPanel
                loading={m.breakdownLoading}
                error={m.breakdownError}
                breakdown={m.dailyBreakdown}
              />

              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">المدة التي يتم اعتمادها للرواتب</p>

                <label
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm transition-colors',
                    approveChoice === 'requested' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/20',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="approve-minutes-choice"
                      checked={approveChoice === 'requested'}
                      onChange={() => setApproveChoice('requested')}
                    />
                    المدة المطلوبة في الطلب
                  </span>
                  <DurationMinutesDisplay minutes={m.approveTarget.requestedMinutes} className="font-medium" />
                </label>

                <label
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition-colors',
                    actualOvertimeMinutes == null
                      ? 'cursor-not-allowed border-border/60 opacity-50'
                      : cn('cursor-pointer', approveChoice === 'actual' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/20'),
                  )}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="approve-minutes-choice"
                      checked={approveChoice === 'actual'}
                      disabled={actualOvertimeMinutes == null}
                      onChange={() => setApproveChoice('actual')}
                    />
                    المدة الفعلية المحسوبة من الحضور
                  </span>
                  <DurationMinutesDisplay minutes={actualOvertimeMinutes} className="font-medium" />
                </label>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">ملاحظات القرار (اختياري)</p>
                <Textarea
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  rows={2}
                  placeholder="ملاحظة تُرفق مع قرار الاعتماد…"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => m.setApproveTarget(null)}>
                  إلغاء
                </Button>
                <Button
                  variant="luxe"
                  size="sm"
                  className="gap-1.5"
                  disabled={m.actionLoadingId === m.approveTarget.id}
                  onClick={() => void confirmApprove()}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  اعتماد
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <RejectReasonDialog
        open={rejectTarget != null}
        onOpenChange={(open) => { if (!open) setRejectTarget(null); }}
        kind="overtime"
        title="رفض طلب العمل الإضافي"
        description={rejectTarget ? `${rejectTarget.employeeNameAr} · ${rejectTarget.workDate}` : undefined}
        onConfirm={async (reason) => {
          if (rejectTarget) await m.handleReject(rejectTarget, reason);
        }}
      />
    </>
  );
}

