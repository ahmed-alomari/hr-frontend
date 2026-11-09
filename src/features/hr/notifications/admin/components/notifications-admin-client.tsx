'use client';

import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import { Bell, CheckCircle2, Circle, Clock, Mail, Plus, Trash2, Users } from 'lucide-react';
import { PdfPreviewExportDialog } from '@/components/pdf/pdf-preview-export-dialog';
import { PdfPreviewDownloadButton } from '@/components/pdf/pdf-preview-download-button';
import { DisciplineLetterPrintHtml } from '@/components/pdf/print/discipline-letter-print-html';
import { useDefaultCompany } from '@/features/hr/organization/hooks/useActiveCompany';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { ListFilterBar, type ListFilterInlineSelect } from '@/components/ui/list-filter-bar';
import { EMPTY_PERIOD_RANGE } from '@/features/hr/discipline/lib/discipline-date-filter';
import { EmployeePicker } from '@/components/ui/employee-picker';
import { DirectoryPageGate } from '@/components/shared/directory-page-gate';
import { FILTER_PERMISSIONS } from '@/features/auth/permissions/filter-permissions';
import { cn, formatDisplayDateTime } from '@/shared/utils';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { fetchAllPaginatedItems } from '@/features/hr/lib/api/client';
import { ConfirmationModal, EmptyState, FormField, HRSettingsFormDrawer, MinimalDropdown } from '@/components/ui/shared-dialogs';
import { Dialog, DialogBody, DialogContent, DialogTitle, dialogShellBodyClass, dialogShellContentClass } from '@/components/ui/dialog';
import { DataTable, AppPagination, usePagination, type ColumnDef } from '@/components/ui/data-table';
import { PagedListViewport, PaginatedListShell } from '@/components/ui/paged-list';
import { TableDateCell, TableRowActions } from '@/components/ui/table-cells';
import { useNotificationsAdminDirectoryModel } from '@/features/hr/notifications/admin/hooks/useNotificationsAdminDirectoryModel';
import { NOTIFICATION_AUDIENCE_LABELS, NOTIFICATION_CATEGORY_FILTER_ORDER, NOTIFICATION_CATEGORY_LABELS, NOTIFICATION_SEVERITY_LABELS, mapSentNotification, type HRAdminNotificationRecord } from '@/features/hr/notifications/admin/constants/notification-labels';
import { notificationsApi, type NotificationCategory, type NotificationDetailResponseDto, type NotificationRecipientDto, type NotificationSeverity, type SendNotificationDto } from '@/features/hr/notifications/lib/api/notifications';

type CategoryFilter = 'all' | NotificationCategory;
type SeverityFilter = 'all' | NotificationSeverity;

interface SendForm {
  titleAr: string;
  bodyAr: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  employeeIds: Set<string>;
  requiresAcknowledgment: boolean;
  actionUrl: string;
  actionLabelAr: string;
}

const EMPTY_FORM: SendForm = {
  titleAr: '',
  bodyAr: '',
  category: 'announcement',
  severity: 'info',
  employeeIds: new Set(),
  requiresAcknowledgment: false,
  actionUrl: '',
  actionLabelAr: 'عرض التفاصيل',
};

const SEVERITY_FILTER_ORDER: SeverityFilter[] = ['all', 'info', 'success', 'warning', 'error'];

function severityBadgeClass(severity: NotificationSeverity): string {
  switch (severity) {
    case 'success':
      return 'border-success/30 bg-success/10 text-success';
    case 'warning':
      return 'border-warning/30 bg-warning/10 text-warning';
    case 'error':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    default:
      return 'border-primary/25 bg-primary/5 text-primary';
  }
}


function AudienceEmployeesCell({ record }: { record: HRAdminNotificationRecord }) {
  const employees = record.audienceEmployees;
  if (employees.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">{record.audienceSummaryAr}</span>
    );
  }
  return (
    <div className="space-y-0.5 text-sm">
      {employees.slice(0, 3).map((e) => (
        <div key={e.employeeId}>
          <span>{e.nameAr ?? '—'}</span>
          {' '}
          <span className="font-mono text-xs text-muted-foreground">
            ({e.employeeCode ?? '—'})
          </span>
        </div>
      ))}
      {employees.length > 3 ? (
        <span className="text-xs text-muted-foreground">
          +
          {employees.length - 3}
          {' '}
          آخرون
        </span>
      ) : null}
    </div>
  );
}


export function NotificationsAdminClient() {
  const m = useNotificationsAdminDirectoryModel();
  const { data: defaultCompany } = useDefaultCompany();
  const companyNameAr = defaultCompany?.nameAr ?? '';
  const companyNameEn = defaultCompany?.nameEn ?? '';
  const [letterOpen, setLetterOpen] = React.useState(false);
  const [letterRecord, setLetterRecord] = React.useState<HRAdminNotificationRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [form, setForm] = React.useState<SendForm>(EMPTY_FORM);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [detailRecord, setDetailRecord] = React.useState<HRAdminNotificationRecord | null>(null);
  const [detailData, setDetailData] = React.useState<NotificationDetailResponseDto | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<HRAdminNotificationRecord | null>(null);

  const openDetail = React.useCallback(async (record: HRAdminNotificationRecord) => {
    setDetailRecord(record);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const res = await notificationsApi.getById(record.id);
      setDetailData(res);
    } catch {
      // keep detailData null — dialog will show basic info only
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openNotificationPreview = React.useCallback((record: HRAdminNotificationRecord) => {
    setLetterRecord(record);
    setLetterOpen(true);
  }, []);

  const notificationLetterPrintable = React.useMemo(() => {
    if (!letterRecord) return null;
    return (
      <DisciplineLetterPrintHtml
        companyNameAr={companyNameAr}
        companyNameEn={companyNameEn}
        titleAr={letterRecord.titleAr}
        rows={[
          { label: 'التصنيف', value: NOTIFICATION_CATEGORY_LABELS[letterRecord.category] },
          { label: 'الجمهور', value: letterRecord.audienceSummaryAr },
          { label: 'عدد المستلمين', value: String(letterRecord.recipientCount) },
        ]}
        bodyAr={letterRecord.bodyAr}
      />
    );
  }, [letterRecord, companyNameAr, companyNameEn]);

  // Every notification under the current filters: for a sort, a grouping or an export.
  const { companyId, filters, dateBounds } = m;
  const loadAllNotifications = useLatestCallback(async (): Promise<HRAdminNotificationRecord[]> => {
    const { items } = await fetchAllPaginatedItems((page, limit) =>
      notificationsApi.list({
        page,
        limit,
        ...(companyId ? { companyId } : {}),
        ...(filters.category !== 'all' ? { category: filters.category } : {}),
        ...(filters.severity !== 'all' ? { severity: filters.severity } : {}),
        ...(dateBounds.from ? { from: dateBounds.from } : {}),
        ...(dateBounds.to ? { to: dateBounds.to } : {}),
        ...(filters.excludeExpired ? { excludeExpired: true } : {}),
        ...(filters.sourceKind.trim() ? { sourceKind: filters.sourceKind.trim() } : {}),
        ...(filters.sourceTable.trim() ? { sourceTable: filters.sourceTable.trim() } : {}),
        ...(filters.sourceId.trim() ? { sourceId: filters.sourceId.trim() } : {}),
      }),
    );
    return items.map((row) => {
      const snapshot = row.audienceSnapshot;
      const summaryAr = snapshot && typeof snapshot.summaryAr === 'string' && snapshot.summaryAr
        ? snapshot.summaryAr
        : (NOTIFICATION_AUDIENCE_LABELS[row.audienceKind] ?? row.audienceKind);
      return mapSentNotification(row, summaryAr);
    });
  });

  const allEmployeeOptions = React.useMemo(
    () => m.employeeOptions.map((e) => ({
      id: e.value,
      name: e.label,
      branchNameAr: e.branchNameAr,
      departmentNameAr: e.departmentNameAr,
    })),
    [m.employeeOptions],
  );

  const inlineSelects = React.useMemo((): ListFilterInlineSelect[] => [
    {
      id: 'category',
      value: m.filters.category,
      onChange: (v) => m.patchFilters({ category: (v || 'all') as CategoryFilter }),
      placeholder: 'التصنيف',
      className: 'w-[9rem]',
      options: [
        { value: 'all', label: 'كل التصنيفات' },
        ...NOTIFICATION_CATEGORY_FILTER_ORDER.map((cat) => ({
          value: cat,
          label: NOTIFICATION_CATEGORY_LABELS[cat],
        })),
      ],
    },
    {
      id: 'severity',
      value: m.filters.severity,
      onChange: (v) => m.patchFilters({ severity: (v || 'all') as SeverityFilter }),
      placeholder: 'النبرة',
      className: 'w-[8rem]',
      options: SEVERITY_FILTER_ORDER.map((s) => ({
        value: s,
        label: s === 'all' ? 'كل النبرات' : NOTIFICATION_SEVERITY_LABELS[s],
      })),
    },
  ], [m.filters.category, m.filters.severity, m.patchFilters]);

  const onPeriodChange = React.useCallback(
    ({ from, to }: { from: string; to: string }) => m.setDateBounds({ from, to }),
    [m.setDateBounds],
  );
  const onPeriodFilterClear = React.useCallback(
    () => m.setDateBounds({ ...EMPTY_PERIOD_RANGE }),
    [m.setDateBounds],
  );

  const extraFilters = React.useMemo(
    () => (
      <label className="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
        <Checkbox
          checked={m.filters.excludeExpired}
          onCheckedChange={(v) => m.patchFilters({ excludeExpired: v === true })}
        />
        إخفاء المنتهية
      </label>
    ),
    [m.filters.excludeExpired, m.patchFilters],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showStatusSection={false}
        showEmployeePicker={false}
        periodValue={m.dateBounds}
        onPeriodChange={onPeriodChange}
        defaultPeriod={EMPTY_PERIOD_RANGE}
        defaultDateFilterTab="all"
        onPeriodFilterClear={onPeriodFilterClear}
        inlineSelects={inlineSelects}
        beforeEmployeePicker={extraFilters}
      />
    ),
    [
      inlineSelects,
      m.dateBounds,
      onPeriodChange,
      onPeriodFilterClear,
      extraFilters,
    ],
  );


  const columns = React.useMemo((): ColumnDef<HRAdminNotificationRecord>[] => [
    {
      key: 'title',
      title: 'العنوان',
      render: (n) => (
        <div className="space-y-1">
          <span className="font-medium">{n.titleAr}</span>
          {n.bodyAr ? (
            <p className="  text-xs text-muted-foreground max-w-[15rem]">{n.bodyAr}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'categorySeverity',
      title: 'التصنيف',
      render: (n) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{NOTIFICATION_CATEGORY_LABELS[n.category]}</Badge>
        </div>
      ),
    },
    {
      key: 'counts',
      title: 'العدد / المقروء',
      render: (n) => (
        <span className="tabular-nums text-sm">
          {n.recipientCount}
          {' '}
          /
          {' '}
          {n.readCount}
        </span>
      ),
    },
    {
      key: 'date',
      title: 'تاريخ الإرسال',
      className: 'text-xs text-muted-foreground tabular-nums',
      render: (n) => <TableDateCell value={n.createdAt} mode="datetime" />,
    },
    {
      key: 'source',
      title: 'المصدر',
      className: 'text-sm text-muted-foreground',
      render: (n) => n.sourceKind ?? '—',
    },
    {
      key: 'actions',
      title: 'إجراءات',
      isActions: true,
      headerClassName: 'w-24',
      render: (n) => (
        <TableRowActions
          menuItems={[
            {
              label: 'حذف',
              onClick: () => setDeleteTarget(n),
              icon: <Trash2 className="h-3.5 w-3.5" />,
              destructive: true,
            },
          ]}
        />
      ),
    },
  ], []);

  const categoryOf = (n: HRAdminNotificationRecord) => NOTIFICATION_CATEGORY_LABELS[n.category] ?? n.category;
  const tools = useListTools<HRAdminNotificationRecord>({
    section: 'hr',
    page: 'notifications-admin',
    columns,
    rows: m.notifications,
    fetchAll: loadAllNotifications,
    resetKey: JSON.stringify([companyId, filters, dateBounds]),
    fields: {
      title: { kind: 'name', text: (n) => n.titleAr },
      categorySeverity: { text: categoryOf, group: categoryOf },
      counts: {
        text: (n) => `${n.readCount ?? 0}/${n.recipientCount ?? 0}`,
        sort: (n) => n.recipientCount ?? 0,
        sum: (n) => n.recipientCount ?? 0,
      },
      date: { kind: 'date', text: (n) => formatDisplayDateTime(n.createdAt), sort: (n) => n.createdAt, group: (n) => n.createdAt.slice(0, 7) },
      source: { text: (n) => n.sourceKind ?? '—', group: (n) => n.sourceKind ?? null },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={m.activeFilterCount} />
        {tools.buttons}
        {tools.exportMenu('سجل الإشعارات المرسلة', 'notifications-register')}
        <Button
          type="button"
          size="sm"
          variant="luxe"
          className="h-8 gap-1.5 px-3 text-xs shadow-sm shrink-0"
          onClick={() => {
            setForm({ ...EMPTY_FORM, employeeIds: new Set() });
            setFormError(null);
            setDrawerOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          إرسال إشعار
        </Button>
      </div>
    ),
    [m.activeFilterCount, tools.depsKey],
  );

  const resolveSendCompanyId = (): string | null => m.companyId;

  const submitSend = async () => {
    const sendCompanyId = resolveSendCompanyId();
    if (!sendCompanyId) {
      setFormError('تعذر تحديد الشركة');
      return;
    }
    if (!form.titleAr.trim()) {
      setFormError('العنوان مطلوب');
      return;
    }

    const allEmployeeIds = m.employeeOptions.map((e) => e.value);
    const isAllSelected =
      form.employeeIds.size === 0
      || (form.employeeIds.size === allEmployeeIds.length
        && allEmployeeIds.every((id) => form.employeeIds.has(id)));

    const dto: SendNotificationDto = {
      companyId: sendCompanyId,
      category: form.category,
      severity: form.severity,
      titleAr: form.titleAr.trim(),
      bodyAr: form.bodyAr.trim() || null,
      audienceKind: isAllSelected ? 'company' : 'employee',
      employeeIds: isAllSelected ? undefined : [...form.employeeIds],
      deliveryChannel: 'in_app',
      sourceKind: 'manual',
      requiresAcknowledgment: form.requiresAcknowledgment,
      actionUrl: form.actionUrl.trim() || undefined,
      actionLabelAr: form.actionLabelAr.trim() || undefined,
    };

    setSaving(true);
    setFormError(null);
    try {
      await m.sendNotification(dto);
      toast.success('تم إرسال الإشعار');
      setDrawerOpen(false);
    } catch (e) {
      setFormError(handleApiError(e).displayMessage);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await m.deleteNotification(deleteTarget.id);
      toast.success('تم حذف الإشعار');
      setDeleteTarget(null);
    } catch (e) {
      toast.error(handleApiError(e).displayMessage);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <SetPageTitle
        titleAr="إدارة الإشعارات"
        descriptionAr="إرسال إشعارات للموظفين ومتابعة التسليم والقراءة"
        iconName="Bell"
      />

      <DirectoryPageGate
        accessDenied={m.accessDenied}
        listError={m.listError}
        loading={m.loading && m.notifications.length === 0 && !m.accessDenied}
        forbiddenTitle="لا تملك صلاحية الوصول لإدارة الإشعارات"
        loadErrorTitle="تعذر تحميل الإشعارات"
      >
      {!m.loading && m.notifications.length === 0 ? (
        <EmptyState
          title="لا توجد إشعارات"
          description={
            m.activeFilterCount > 0
              ? 'جرّب تغيير الفلاتر أو مسحها.'
              : 'أرسل أول إشعار للموظفين من زر «إرسال إشعار».'
          }
        />
      ) : (
        <ListToolsTable tools={tools} keyExtractor={(n) => n.id} onRowClick={(n) => { void openDetail(n); }}>
        <PagedListViewport>
          <PaginatedListShell
            pagination={tools.pagination({
              page: m.page,
              pageSize: m.limit,
              total: m.total,
              totalPages: Math.max(1, Math.ceil(m.total / m.limit)),
              setPage: m.setPage,
              setPageSize: m.setLimit,
            })}
          >
            <DataTable
              variant="directory"
              alwaysShowTable
              columns={tools.columns}
              {...tools.tableSort}
              data={tools.rows}
              keyExtractor={(n) => n.id}
              loading={m.loading || tools.loading}
              onRowClick={(n) => { void openDetail(n); }}
            />
          </PaginatedListShell>
        </PagedListViewport>
        </ListToolsTable>
      )}

      </DirectoryPageGate>

      <HRSettingsFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="إرسال إشعار جديد"
        description="يُوزَّع الإشعار على المستلمين حسب النطاق المحدد."
        onSave={submitSend}
        saveDisabled={saving}
        saveLabel="إرسال"
        error={formError}
      >
        <FormField label="العنوان *">
          <Input
            value={form.titleAr}
            onChange={(e) => setForm((f) => ({ ...f, titleAr: e.target.value }))}
            placeholder="مثال: إعلان عام للموظفين"
          />
        </FormField>
        <FormField label="المحتوى">
          <textarea
            value={form.bodyAr}
            onChange={(e) => setForm((f) => ({ ...f, bodyAr: e.target.value }))}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="نص الإشعار..."
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="التصنيف">
            <MinimalDropdown
              value={form.category}
              options={NOTIFICATION_CATEGORY_FILTER_ORDER.map((c) => ({
                value: c,
                label: NOTIFICATION_CATEGORY_LABELS[c],
              }))}
              onChange={(v) => setForm((f) => ({ ...f, category: v as NotificationCategory }))}
            />
          </FormField>
          <FormField label="نوع الاشعار">
            <MinimalDropdown
              value={form.severity}
              options={(
                Object.entries(NOTIFICATION_SEVERITY_LABELS) as [NotificationSeverity, string][]
              ).map(([value, label]) => ({ value, label }))}
              onChange={(v) => setForm((f) => ({ ...f, severity: v as NotificationSeverity }))}
            />
          </FormField>
        </div>
        <FormField label={`الموظفون${form.employeeIds.size > 0 ? ` (${form.employeeIds.size})` : ''}`}>
          <EmployeePicker
            variant="form"
            employees={allEmployeeOptions}
            selected={form.employeeIds}
            onChange={(employeeIds) => setForm((f) => ({ ...f, employeeIds }))}
            requirePermission={FILTER_PERMISSIONS.employee}
          />
        </FormField>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={form.requiresAcknowledgment}
            onCheckedChange={(v) =>
              setForm((f) => ({ ...f, requiresAcknowledgment: v === true }))
            }
          />
          يتطلب الموافقة من المستلم
        </label>
      </HRSettingsFormDrawer>

      <NotificationDetailDialog
        record={detailRecord}
        detail={detailData}
        loading={detailLoading}
        onClose={() => { setDetailRecord(null); setDetailData(null); }}
        onPreviewPdf={detailRecord ? () => openNotificationPreview(detailRecord) : undefined}
      />

      <PdfPreviewExportDialog
        open={letterOpen}
        onOpenChange={(openNext) => {
          setLetterOpen(openNext);
          if (!openNext) setLetterRecord(null);
        }}
        title={letterRecord ? `خطاب إشعار — ${letterRecord.titleAr}` : 'خطاب إشعار'}
        fileName={letterRecord ? `notification-${letterRecord.id.slice(0, 8)}.pdf` : 'notification.pdf'}
        printable={notificationLetterPrintable}
      />

      <ConfirmationModal
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="حذف الإشعار"
        description="سيُحذف الإشعار وجميع صفوف المستلمين. لا يمكن التراجع."
        confirmLabel="حذف"
        variant="destructive"
      />
    </div>
  );
}

function ReadStatusBadge({ isRead }: { isRead: boolean }) {
  if (isRead) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
        <CheckCircle2 className="h-3 w-3" />
        نعم
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <Circle className="h-3 w-3" />
      لا
    </span>
  );
}

function buildRecipientColumns(showAcknowledgment: boolean): ColumnDef<NotificationRecipientDto>[] {
  const headerClassName = 'bg-background shadow-none';

  const columns: ColumnDef<NotificationRecipientDto>[] = [
    {
      key: 'employee',
      title: 'الموظف',
      headerClassName,
      className: 'align-top',
      render: (r) => (
        <div>
          <p className="font-medium leading-snug">{r.employeeNameAr || r.userFullNameAr || '—'}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{r.employeeCode || '—'}</p>
        </div>
      ),
    },
    {
      key: 'email',
      title: 'البريد الإلكتروني',
      headerClassName,
      className: 'align-top text-xs text-muted-foreground',
      render: (r) =>
        r.userEmail ? (
          <span className="inline-flex items-start gap-1 break-all">
            <Mail className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
            <span>{r.userEmail}</span>
          </span>
        ) : (
          <span>—</span>
        ),
    },
    {
      key: 'isRead',
      title: 'مقروء',
      headerClassName,
      className: 'align-top',
      render: (r) => <ReadStatusBadge isRead={r.isRead} />,
    },
    {
      key: 'deliveredAt',
      title: 'وقت التسليم',
      headerClassName,
      className: 'align-top text-xs tabular-nums text-muted-foreground',
      render: (r) => formatDisplayDateTime(r.deliveredAt),
    },
    {
      key: 'readAt',
      title: 'وقت القراءة',
      headerClassName,
      className: 'align-top text-xs tabular-nums text-muted-foreground',
      render: (r) => formatDisplayDateTime(r.readAt),
    },
  ];

  if (showAcknowledgment) {
    columns.push(
      {
        key: 'acknowledgedAt',
        title: 'وقت القبول',
        headerClassName,
        className: 'align-top text-xs tabular-nums text-muted-foreground',
        render: (r) => formatDisplayDateTime(r.acknowledgedAt),
      },
      {
        key: 'dismissedAt',
        title: 'وقت الرفض',
        headerClassName,
        className: 'align-top text-xs tabular-nums text-muted-foreground',
        render: (r) => formatDisplayDateTime(r.dismissedAt),
      },
    );
  }

  return columns;
}

function RecipientMobileCard({
  recipient,
  showAcknowledgment,
}: {
  recipient: NotificationRecipientDto;
  showAcknowledgment: boolean;
}) {
  const rows = [
    { label: 'البريد الإلكتروني', value: recipient.userEmail ?? '—' },
    { label: 'وقت التسليم', value: formatDisplayDateTime(recipient.deliveredAt) },
    { label: 'وقت القراءة', value: formatDisplayDateTime(recipient.readAt) },
  ];

  if (showAcknowledgment) {
    rows.push(
      { label: 'وقت القبول', value: formatDisplayDateTime(recipient.acknowledgedAt) },
      { label: 'وقت الرفض', value: formatDisplayDateTime(recipient.dismissedAt) },
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium leading-snug">
          {recipient.employeeNameAr || recipient.userFullNameAr || '—'}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {recipient.employeeCode || '—'}
        </p>
      </div>

      <ReadStatusBadge isRead={recipient.isRead} />

      <dl className="space-y-2 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1">
            <dt className="font-medium text-muted-foreground">{row.label}</dt>
            <dd className="break-words text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Detail dialog ────────────────────────────────────────────────────────────

type ReadFilter = 'all' | 'read' | 'unread';

function NotificationDetailDialog({
  record,
  detail,
  loading,
  onClose,
  onPreviewPdf,
}: {
  record: HRAdminNotificationRecord | null;
  detail: NotificationDetailResponseDto | null;
  loading: boolean;
  onClose: () => void;
  onPreviewPdf?: () => void;
}) {
  const open = record != null;
  const [readFilter, setReadFilter] = React.useState<ReadFilter>('all');

  React.useEffect(() => { if (!open) setReadFilter('all'); }, [open]);

  const recipients = detail?.recipients ?? [];

  const filteredRecipients = React.useMemo(() => {
    if (readFilter === 'read') return recipients.filter((r) => r.isRead);
    if (readFilter === 'unread') return recipients.filter((r) => !r.isRead);
    return recipients;
  }, [recipients, readFilter]);

  const showAcknowledgment = record?.requiresAcknowledgment === true;

  const recipientColumns = React.useMemo(
    () => buildRecipientColumns(showAcknowledgment),
    [showAcknowledgment],
  );

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    slice: pagedRecipients,
    total: filteredTotal,
  } = usePagination(filteredRecipients, 10);

  React.useEffect(() => { setPage(1); }, [readFilter, setPage]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          dialogShellContentClass,
          'overflow-hidden sm:rounded-2xl',
          'w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)]',
          'sm:w-[min(96vw,72rem)] sm:max-w-[min(96vw,72rem)]',
          'lg:w-[min(94vw,84rem)] lg:max-w-[min(94vw,84rem)]',
          'xl:w-[min(92vw,96rem)] xl:max-w-[min(92vw,96rem)]',
        )}
        dir="rtl"
      >
        <div className="relative shrink-0 overflow-hidden border-b border-border/50 bg-muted/20 px-5 pb-4 pt-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-primary/50 via-primary/20 to-transparent" />

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm ring-1 ring-border/60">
              <Bell className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1 pe-8">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <DialogTitle className="font-display text-base font-semibold leading-snug tracking-tight">
                  {record?.titleAr || '—'}
                </DialogTitle>

                {record?.createdAt ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground backdrop-blur-sm">
                    <Clock className="h-3 w-3 shrink-0 opacity-70" />
                    {formatDisplayDateTime(record.createdAt)}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px] font-normal">
                  {record ? NOTIFICATION_CATEGORY_LABELS[record.category] : '—'}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'h-5 rounded-md px-1.5 text-[10px] font-normal',
                    record ? severityBadgeClass(record.severity) : '',
                  )}
                >
                  {record ? NOTIFICATION_SEVERITY_LABELS[record.severity] : '—'}
                </Badge>
                {showAcknowledgment ? (
                  <Badge
                    variant="outline"
                    className="h-5 rounded-md border-primary/25 bg-primary/5 px-1.5 text-[10px] font-normal text-primary"
                  >
                    يتطلب إقراراً
                  </Badge>
                ) : null}
                {record?.sourceKind ? (
                  <Badge
                    variant="outline"
                    className="h-5 rounded-md px-1.5 font-mono text-[10px] font-normal text-muted-foreground"
                    title={record.sourceKind}
                  >
                    {record.sourceKind}
                  </Badge>
                ) : null}
              </div>

              {record?.bodyAr ? (
                <p className="mt-2.5 rounded-lg border border-border/50 bg-background/70 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  {record.bodyAr}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <DialogBody className={cn(dialogShellBodyClass, 'min-w-0 space-y-3 px-5 py-4')}>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              جارٍ التحميل…
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>المستلمون</span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground">
                      {filteredRecipients.length}
                    </span>
                  </div>

                  <div className="inline-flex items-center rounded-md border border-border/60 bg-muted/20 p-0.5">
                    {(['all', 'read', 'unread'] as ReadFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setReadFilter(f)}
                        className={cn(
                          'inline-flex h-6 items-center rounded px-2.5 text-[10px] font-medium transition-colors',
                          readFilter === f
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {f === 'all' ? 'الكل' : f === 'read' ? 'مقروء' : 'لم يُقرأ'}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredRecipients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 py-12 text-center">
                    <Users className="mb-2 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">لا يوجد مستلمون</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <DataTable
                      variant="directory"
                      loading={false}
                      columns={recipientColumns}
                      data={pagedRecipients}
                      keyExtractor={(r) => r.recipientId}
                      emptyText="لا يوجد مستلمون"
                      className="rounded-xl border border-border/60 bg-card shadow-none md:rounded-none md:border-0 md:bg-transparent"
                      tableClassName="w-full"
                      mobileCard={(r) => (
                        <RecipientMobileCard recipient={r} showAcknowledgment={showAcknowledgment} />
                      )}
                    />
                    {filteredTotal > pageSize ? (
                      <AppPagination
                        page={page}
                        pageSize={pageSize}
                        total={filteredTotal}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                        pageSizeOptions={[10, 20, 50]}
                      />
                    ) : null}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogBody>

        {onPreviewPdf ? (
          <div className="flex shrink-0 justify-end border-t border-border/60 px-5 py-3">
            <PdfPreviewDownloadButton onClick={onPreviewPdf} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

