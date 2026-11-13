'use client';

import * as React from 'react';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import { Trash2, CalendarDays, FileDown, FileSpreadsheet, Plus, CheckCircle2, XCircle, Clock, Ban, Pencil, Loader2 } from 'lucide-react';
import {
  EntityActionCard,
  EntityActionCardChip,
  EntityActionCardGrid,
  EntityActionCardGridSkeleton,
  type WorkflowStatusTone,
} from '@/components/ui/entity-action-card';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { TableDateCell, TableRowActions, TableRowDetailDialog } from '@/components/ui/table-cells';
import { RelatedEmployeeAttachments } from '@/features/hr/organization/employees/components/related-employee-attachments';
import { Input } from '@/components/ui/input';
import {
  ConfirmationModal, HRSettingsFormDrawer, FormField,
  EmptyState, MinimalDropdown, SearchableDropdown,
} from '@/components/ui/shared-dialogs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { fetchAllPaginatedItems } from '@/features/hr/lib/api/client';
import { disciplineAppealsApi, type AppealStatusDto } from '@/features/hr/discipline/lib/api/discipline-appeals';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { useDisciplineAppealsDirectoryModel, type AppealRecord } from '@/features/hr/discipline/appeals/hooks/useDisciplineAppealsDirectoryModel';
import {
  canDeleteAppealRecord,
  canMutateAppealRecord,
  DECISION_STATUS_LABELS,
} from '@/features/hr/discipline/appeals/services/discipline-appeals.service';
import type { HRAppealChannel, HRAppealStatus } from '@/features/hr/discipline/lib/types';
import { APPEAL_CHANNEL_LABELS, APPEAL_STATUS_LABELS, APPEAL_STATUS_FILTER_ORDER } from '@/features/hr/discipline/lib/types';
import type { AppealChannelDto, ProcessDisciplineAppealDecisionDto } from '@/features/hr/discipline/lib/api/discipline-appeals';
import {
  ListFilterBar,
  type ListFilterBarHandle,
} from '@/components/ui/list-filter-bar';
import { useDisciplineDateFilterState } from '@/features/hr/discipline/lib/use-discipline-date-filter-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/shared/utils';
import { APPEAL_STATUS_PILL } from '@/shared/status-pill-classes';
import { useDefaultCompany } from '@/features/hr/organization/hooks/useActiveCompany';
import { PdfPreviewExportDialog } from '@/components/pdf/pdf-preview-export-dialog';
import { PdfPreviewDownloadButton } from '@/components/pdf/pdf-preview-download-button';
import { GenericRegisterPrintHtml } from '@/components/pdf/print/generic-register-print-html';
import { DisciplineLetterPrintHtml } from '@/components/pdf/print/discipline-letter-print-html';
import { downloadXlsxFromAoA, type XlsxCell } from '@/shared/export/download-xlsx';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { DisciplineListViewport, DisciplinePaginatedList } from '@/features/hr/discipline/components/discipline-paginated-list';
import { RejectReasonSuggestions } from '@/components/approval/reject-reason-dialog';
import { isRejectReasonValid, REJECT_REASON_MIN_LENGTH } from '@/components/approval/reject-reasons';

const CHANNEL_OPTIONS = (Object.entries(APPEAL_CHANNEL_LABELS) as [HRAppealChannel, string][]).map(([v, l]) => ({ value: v, label: l }));

const STATUS_COLORS: Record<HRAppealStatus, string> = APPEAL_STATUS_PILL;

const APPEAL_STATUS_TONE: Record<HRAppealStatus, WorkflowStatusTone> = {
  pending: 'pending',
  under_review: 'warning',
  accepted: 'approved',
  rejected: 'rejected',
  withdrawn: 'muted',
};

type StatusFilter = 'all' | HRAppealStatus;
type DisciplineViewMode = 'cards' | 'list';

type DecisionStatus = ProcessDisciplineAppealDecisionDto['status'];

const DECISION_DIALOG_TITLES: Record<DecisionStatus, string> = {
  accepted: 'قبول التظلم',
  rejected: 'رفض التظلم',
  under_review: 'تحويل إلى تحت المراجعة',
  withdrawn: 'التراجع عن التظلم',
};

function canDecideAppeal(status: HRAppealStatus) {
  return status === 'pending' || status === 'under_review';
}

interface DraftForm {
  caseId: string; employeeNameAr: string;
  date: string; channel: HRAppealChannel; grounds: string;
}
const EMPTY: DraftForm = { caseId: '', employeeNameAr: '', date: '', channel: 'in_person', grounds: '' };

export function AppealsClient() {
  const hook = useDisciplineAppealsDirectoryModel();
  const { employees, cases, loading, listError, accessDenied, createAppeal, updateAppeal, decideAppeal, deleteAppeal, setListFilters, items, pagination, filteredItems, sourceAppeals, companyId } = hook;

  const { data: defaultCompany } = useDefaultCompany();
  const companyNameAr = defaultCompany?.nameAr ?? '';
  const companyNameEn = defaultCompany?.nameEn ?? '';

  const [selectedEmpIds, setSelectedEmpIds] = React.useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = React.useState<DisciplineViewMode>('cards');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const { dateBounds, dateMeta, setDateBounds, onDateBoundsChange, onDateFilterMetaChange } = useDisciplineDateFilterState();
  const filterToolbarRef = React.useRef<ListFilterBarHandle>(null);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftForm>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = React.useState(false);
  const [detailRow, setDetailRow] = React.useState<AppealRecord | null>(null);
  const [letterOpen, setLetterOpen] = React.useState(false);
  const [decisionTarget, setDecisionTarget] = React.useState<{ appeal: AppealRecord; status: DecisionStatus } | null>(null);
  const [decisionNote, setDecisionNote] = React.useState('');
  const [decisionError, setDecisionError] = React.useState<string | null>(null);
  const [deciding, setDeciding] = React.useState(false);
  const [editAppeal, setEditAppeal] = React.useState<AppealRecord | null>(null);
  const [editDraft, setEditDraft] = React.useState<DraftForm>(EMPTY);
  const [editSaving, setEditSaving] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const caseOptions = cases.map(c => ({ value: c.id, label: c.caseNumber, sub: c.employeeNameAr }));

  React.useEffect(() => {
    setListFilters({
      selectedEmpIds: [...selectedEmpIds],
      statusFilter,
      dateFrom: dateBounds.from,
      dateTo: dateBounds.to,
    });
  }, [selectedEmpIds, statusFilter, dateBounds.from, dateBounds.to, setListFilters]);

  const listFiltered = filteredItems;

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: sourceAppeals.length };
    for (const s of APPEAL_STATUS_FILTER_ORDER) counts[s] = 0;
    for (const a of sourceAppeals) counts[a.status] = (counts[a.status] ?? 0) + 1;
    return counts;
  }, [sourceAppeals]);

  const dateRangeActive = dateMeta.hasRestriction;
  const activeFilterCount = (selectedEmpIds.size > 0 ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (dateRangeActive ? 1 : 0);

  // Exports cover every appeal matching the current filters (same query as the list), not just the visible page.
  const [appealsPdfRows, setAppealsPdfRows] = React.useState<string[][]>([]);
  const [exporting, setExporting] = React.useState(false);

  const fetchAllForExport = React.useCallback(async (): Promise<string[][] | null> => {
    setExporting(true);
    try {
      const empIds = [...selectedEmpIds];
      const { items: all } = await fetchAllPaginatedItems((page, limit) =>
        disciplineAppealsApi.getAll({
          ...(companyId ? { companyId } : {}),
          page,
          limit,
          ...(empIds.length > 0 ? { subjectEmployeeIds: empIds } : {}),
          ...(statusFilter !== 'all' ? { status: statusFilter as AppealStatusDto } : {}),
          ...(dateBounds.from ? { dateFrom: dateBounds.from } : {}),
          ...(dateBounds.to ? { dateTo: dateBounds.to } : {}),
        }),
      );
      const empNames = new Map(employees.map((e) => [e.id, e.nameAr]));
      return all.map((a) => {
        const channel = (a.channel ?? 'system') as keyof typeof APPEAL_CHANNEL_LABELS;
        const status = a.status as keyof typeof APPEAL_STATUS_LABELS;
        return [
          a.linkedViolationRecordNumber,
          empNames.get(a.subjectEmployeeId) ?? a.subjectEmployeeId,
          a.appealDate,
          APPEAL_CHANNEL_LABELS[channel] ?? String(channel),
          APPEAL_STATUS_LABELS[status] ?? String(status),
          a.groundsAr,
        ];
      });
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'discipline-appeals.export');
      toast.error(displayMessage || 'تعذّر تحميل التظلمات للتصدير.');
      return null;
    } finally {
      setExporting(false);
    }
  }, [companyId, selectedEmpIds, statusFilter, dateBounds.from, dateBounds.to, employees]);

  const handleExportAppealsPdf = useLatestCallback(async () => {
    if (exporting) return;
    const all = await fetchAllForExport();
    if (!all) return;
    if (all.length === 0) { toast.error('لا توجد تظلمات للتصدير ضمن الفلاتر الحالية.'); return; }
    setAppealsPdfRows(all);
    setPdfOpen(true);
  });

  const handleExportAppealsExcel = useLatestCallback(async () => {
    if (exporting) return;
    const all = await fetchAllForExport();
    if (!all) return;
    if (all.length === 0) { toast.error('لا توجد تظلمات للتصدير ضمن الفلاتر الحالية.'); return; }
    const rows: XlsxCell[][] = [
      ['رقم القضية', 'الموظف', 'التاريخ', 'القناة', 'الحالة', 'أسباب التظلم'],
      ...all,
    ];
    await downloadXlsxFromAoA('discipline-appeals.xlsx', 'التظلمات', rows);
    toast.success('تم تنزيل ملف Excel.');
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8 w-8 shrink-0" aria-label="تصدير التظلمات" disabled={exporting} aria-busy={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem disabled={exporting} onSelect={() => void handleExportAppealsPdf()}>
              <FileDown className="h-4 w-4" />
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem disabled={exporting} onSelect={() => void handleExportAppealsExcel()}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="luxe" size="sm" className="h-8 gap-1.5 px-3 text-xs shadow-sm shrink-0"
          onClick={() => setDrawerOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          إضافة تظلم
        </Button>
      </div>
    ),
    [activeFilterCount, exporting, handleExportAppealsPdf, handleExportAppealsExcel],
  );

  const printable = React.useMemo(
    () =>
      appealsPdfRows.length === 0 ? null : (
        <GenericRegisterPrintHtml
          companyNameAr={companyNameAr}
          companyNameEn={companyNameEn}
          titleAr="سجل التظلمات"
          headers={['رقم القضية', 'الموظف', 'التاريخ', 'القناة', 'الحالة', 'أسباب التظلم']}
          rows={appealsPdfRows}
          landscape
        />
      ),
    [appealsPdfRows, companyNameAr, companyNameEn],
  );

  const letterPrintable = React.useMemo(
    () =>
      detailRow ? (
        <DisciplineLetterPrintHtml
          companyNameAr={companyNameAr}
          companyNameEn={companyNameEn}
          titleAr={`تظلم ${detailRow.caseNumber}`}
          rows={[
            { label: 'المخالفة', value: detailRow.caseNumber },
            { label: 'الموظف', value: detailRow.employeeNameAr },
            { label: 'التاريخ', value: detailRow.date },
            { label: 'القناة', value: APPEAL_CHANNEL_LABELS[detailRow.channel] },
            { label: 'الحالة', value: APPEAL_STATUS_LABELS[detailRow.status] },
            { label: 'تاريخ القرار', value: detailRow.decidedAt || '—' },
          ]}
          bodyAr={[
            detailRow.grounds.trim() ? `أسباب التظلم:\n${detailRow.grounds.trim()}` : '',
            detailRow.responseNote.trim() ? `رد الموارد البشرية:\n${detailRow.responseNote.trim()}` : '',
          ].filter(Boolean).join('\n\n')}
        />
      ) : null,
    [detailRow, companyNameAr, companyNameEn],
  );

  const set = (patch: Partial<DraftForm>) => setDraft(d => ({ ...d, ...patch }));

  const handleCaseSelect = (caseId: string) => {
    const c = cases.find(x => x.id === caseId);
    if (!c) { set({ caseId: '', employeeNameAr: '' }); return; }
    set({ caseId: c.id, employeeNameAr: c.employeeNameAr });
  };

  const handleSave = async () => {
    setFormError(null);
    if (!draft.caseId) { setFormError('المخالفة مطلوبة'); return; }
    if (!draft.date) { setFormError('التاريخ مطلوب'); return; }
    if (!draft.grounds.trim()) { setFormError('أسباب التظلم مطلوبة'); return; }
    setSaving(true);
    try {
      await createAppeal({ caseId: draft.caseId, date: draft.date, channel: draft.channel as AppealChannelDto, grounds: draft.grounds });
      toast.success('تم تقديم التظلم');
      setDrawerOpen(false);
      setDraft(EMPTY);
    } catch {
      setFormError('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDecide = async () => {
    if (!decisionTarget) return;
    if (!decisionNote.trim()) {
      setDecisionError('رد الموارد البشرية مطلوب');
      return;
    }
    if (decisionTarget.status === 'rejected' && !isRejectReasonValid(decisionNote)) {
      setDecisionError(`سبب الرفض مطلوب (${REJECT_REASON_MIN_LENGTH} أحرف على الأقل)`);
      return;
    }
    setDecisionError(null);
    setDeciding(true);
    try {
      const { notificationSent } = await decideAppeal(decisionTarget.appeal, {
        status: decisionTarget.status,
        responseNote: decisionNote.trim(),
      });
      toast.success(
        notificationSent
          ? 'تم معالجة التظلم وإرسال إشعار للموظف'
          : 'تم معالجة التظلم، لكن تعذّر إرسال الإشعار',
      );
      setDecisionTarget(null);
      setDecisionNote('');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'discipline-appeals.decide');
      toast.error(displayMessage);
    } finally {
      setDeciding(false);
    }
  };

  const openDecision = (appeal: AppealRecord, status: DecisionStatus) => {
    setDecisionNote('');
    setDecisionError(null);
    setDecisionTarget({ appeal, status });
  };

  const openEdit = (appeal: AppealRecord) => {
    setEditDraft({
      caseId: appeal.caseId,
      employeeNameAr: appeal.employeeNameAr,
      date: appeal.date,
      channel: appeal.channel,
      grounds: appeal.grounds,
    });
    setEditError(null);
    setEditAppeal(appeal);
  };

  const handleEditSave = async () => {
    if (!editAppeal) return;
    setEditError(null);
    if (!editDraft.date) { setEditError('التاريخ مطلوب'); return; }
    if (!editDraft.grounds.trim()) { setEditError('أسباب التظلم مطلوبة'); return; }
    setEditSaving(true);
    try {
      await updateAppeal(editAppeal.id, {
        appealDate: editDraft.date,
        groundsAr: editDraft.grounds.trim(),
        channel: editDraft.channel as AppealChannelDto,
      });
      toast.success('تم تحديث التظلم');
      setEditAppeal(null);
      setEditDraft(EMPTY);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'discipline-appeals.update');
      setEditError(displayMessage);
    } finally {
      setEditSaving(false);
    }
  };

  const renderDecisionActions = (appeal: AppealRecord, compact = false) => {
    if (!canDecideAppeal(appeal.status)) return null;
    const btnClass = compact ? 'h-7 flex-1 gap-1 px-1.5 text-[10px]' : 'h-7 flex-1 gap-1 px-2 text-xs';
    return (
      <div className="flex flex-wrap gap-1">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className={cn(btnClass, 'text-success hover:bg-success/10 hover:text-success')}
          onClick={(e) => { e.stopPropagation(); openDecision(appeal, 'accepted'); }}
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          قبول
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className={cn(btnClass, 'text-destructive hover:bg-destructive/10 hover:text-destructive')}
          onClick={(e) => { e.stopPropagation(); openDecision(appeal, 'rejected'); }}
        >
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          رفض
        </Button>
        {appeal.status === 'pending' ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className={cn(btnClass, 'text-warning hover:bg-warning/10 hover:text-warning')}
            onClick={(e) => { e.stopPropagation(); openDecision(appeal, 'under_review'); }}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" />
            مراجعة
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className={cn(btnClass, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
          onClick={(e) => { e.stopPropagation(); openDecision(appeal, 'withdrawn'); }}
        >
          <Ban className="h-3.5 w-3.5 shrink-0" />
          تراجع
        </Button>
      </div>
    );
  };

  const columns = React.useMemo((): ColumnDef<AppealRecord>[] => [
    {
      key: 'caseNumber',
      title: 'المخالفة',
      className: 'font-mono text-xs font-medium tabular-nums text-muted-foreground',
      render: (a) => <span >{a.caseNumber}</span>,
    },
    {
      key: 'employee',
      title: 'الموظف',
      className: 'max-w-[10rem] truncate font-medium',
      render: (a) => a.employeeNameAr,
    },
    {
      key: 'date',
      title: 'التاريخ',
      className: 'whitespace-nowrap font-mono text-xs tabular-nums',
      render: (a) => <TableDateCell value={a.date} />,
    },
    {
      key: 'channel',
      title: 'القناة',
      className: 'whitespace-nowrap text-xs',
      render: (a) => APPEAL_CHANNEL_LABELS[a.channel],
    },
    {
      key: 'grounds',
      title: 'أسباب التظلم',
      className: 'max-w-[16rem] text-xs text-muted-foreground',
      render: (a) => <span className=" " title={a.grounds ?? undefined}>{a.grounds ?? '—'}</span>,
    },
    {
      key: 'status',
      title: 'الحالة',
      render: (a) => (
        <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[a.status])}>
          {APPEAL_STATUS_LABELS[a.status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      title: 'إجراءات',
      isActions: true,
      render: (a) => (
        <TableRowActions
          menuItems={[
            ...(canDecideAppeal(a.status)
              ? [
                  { label: 'قبول', onClick: () => openDecision(a, 'accepted') },
                  { label: 'رفض', onClick: () => openDecision(a, 'rejected'), destructive: true },
                  ...(a.status === 'pending'
                    ? [{ label: 'تحت المراجعة', onClick: () => openDecision(a, 'under_review') }]
                    : []),
                  { label: 'تراجع', onClick: () => openDecision(a, 'withdrawn'), separator: true },
                ]
              : []),
            ...(canMutateAppealRecord(a.status)
              ? [
                  {
                    label: 'تعديل',
                    onClick: () => openEdit(a),
                    icon: <Pencil className="h-3.5 w-3.5" />,
                  },
                ]
              : []),
            ...(canDeleteAppealRecord(a.status)
              ? [
                  {
                    label: 'حذف',
                    onClick: () => setDeleteId(a.id),
                    icon: <Trash2 className="h-3.5 w-3.5" />,
                    destructive: true,
                    separator: true,
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ], []);

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        ref={filterToolbarRef}
        companyId={companyId}
        selectedEmpIds={selectedEmpIds}
        onSelectedEmpIdsChange={setSelectedEmpIds}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => setStatusFilter(v as StatusFilter)}
        statusOrder={APPEAL_STATUS_FILTER_ORDER}
        statusLabels={APPEAL_STATUS_LABELS as unknown as Record<string, string>}
        statusCounts={statusCounts}
        onDateBoundsChange={onDateBoundsChange}
        onDateFilterMetaChange={onDateFilterMetaChange}
        dataView={{
          value: viewMode,
          onChange: (v) => setViewMode(v as DisciplineViewMode),
          options: [
            { value: 'cards', label: 'بطاقات', icon: 'layout-grid' },
            { value: 'list', label: 'قائمة', icon: 'list' },
          ],
        }}
      />
    ),
    [companyId, selectedEmpIds, statusFilter, statusCounts, viewMode, onDateBoundsChange, onDateFilterMetaChange],
  );

  if (accessDenied) {
    return <ForbiddenState title="لا تملك صلاحية الوصول للتظلمات" />;
  }

  if (loading) {
    return <EntityActionCardGridSkeleton count={6} />;
  }

  if (listError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
        {listError}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PdfPreviewExportDialog open={pdfOpen} onOpenChange={setPdfOpen} title="معاينة تصدير التظلمات" fileName="discipline-appeals.pdf" printable={printable} orientation="landscape" />
      <PdfPreviewExportDialog
        open={letterOpen}
        onOpenChange={setLetterOpen}
        title="معاينة ملف التظلم"
        fileName={detailRow ? `appeal-${detailRow.caseNumber}.pdf` : 'appeal.pdf'}
        printable={letterPrintable}
      />

      <DisciplineListViewport>
      {sourceAppeals.length === 0 && !loading ? (
        <EmptyState title="لا توجد تظلمات مطابقة للفلاتر المحددة." />
      ) : listFiltered.length === 0 && !loading && sourceAppeals.length > 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            {dateRangeActive ? 'لا توجد تظلمات ضمن الفترة المحددة.'
              : 'لا توجد تظلمات ضمن النتائج الحالية.'}
          </p>
          {dateRangeActive ? (
            <Button variant="link" size="sm" className="mt-2 text-xs" onClick={() => setDateBounds({ from: '', to: '' })}>عرض كل الفترات</Button>
          ) : null}
        </div>
      ) : (
        <DisciplinePaginatedList pagination={pagination}>
          {viewMode === 'cards' ? (
          <EntityActionCardGrid>
            {items.map((a) => (
            <EntityActionCard
              key={a.id}
              reference={a.caseNumber}
              title={a.employeeNameAr ?? '—'}
              status={{
                label: APPEAL_STATUS_LABELS[a.status],
                tone: APPEAL_STATUS_TONE[a.status],
              }}
              chips={
                <>
                  <EntityActionCardChip>{APPEAL_CHANNEL_LABELS[a.channel]}</EntityActionCardChip>
                  <EntityActionCardChip className="font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1" dir="ltr">
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      {a.date}
                    </span>
                  </EntityActionCardChip>
                </>
              }
              description={a.grounds}
              footerNote={
                a.responseNote?.trim() ? (
                  <p className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[11px] text-muted-foreground text-right">
                    <span className="font-medium text-foreground">رد الموارد البشرية: </span>
                    {a.responseNote}
                  </p>
                ) : null
              }
              extraFooter={renderDecisionActions(a)}
              onEdit={canMutateAppealRecord(a.status) ? () => openEdit(a) : undefined}
              onClick={() => setDetailRow(a)}
              onDelete={canDeleteAppealRecord(a.status) ? () => setDeleteId(a.id) : undefined}
            />
            ))}
          </EntityActionCardGrid>
          ) : (
          <DataTable
            variant="directory"
            alwaysShowTable
            tableClassName="min-w-[800px]"
            columns={columns}
            data={items}
            keyExtractor={(a) => a.id}
            onRowClick={(a) => setDetailRow(a)}
          />
          )}
        </DisciplinePaginatedList>
      )}
      </DisciplineListViewport>

      <HRSettingsFormDrawer open={editAppeal != null} onOpenChange={(o) => { if (!o) { setEditAppeal(null); setEditDraft(EMPTY); setEditError(null); } }} title="تعديل التظلم" size="lg" onSave={() => void handleEditSave()} saveDisabled={editSaving} error={editError}>
        {editDraft.employeeNameAr ? (
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm"><span className="text-muted-foreground">الموظف: </span>{editDraft.employeeNameAr}</div>
        ) : null}
        <FormField label="تاريخ التظلم" required>
          <Input type="date" value={editDraft.date} onChange={e => setEditDraft(d => ({ ...d, date: e.target.value }))} />
        </FormField>
        <FormField label="قناة التظلم" required>
          <MinimalDropdown value={editDraft.channel} onChange={v => setEditDraft(d => ({ ...d, channel: v as HRAppealChannel }))} options={CHANNEL_OPTIONS} />
        </FormField>
        <FormField label="أسباب التظلم" required>
          <textarea value={editDraft.grounds} onChange={e => setEditDraft(d => ({ ...d, grounds: e.target.value }))} placeholder="اشرح أسباب التظلم…" className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </FormField>
      </HRSettingsFormDrawer>

      <Dialog open={decisionTarget != null} onOpenChange={(o) => { if (!o) { setDecisionTarget(null); setDecisionNote(''); setDecisionError(null); } }}>
        <DialogContent dir="rtl" className="max-w-md text-right">
          <DialogHeader>
            <DialogTitle>{decisionTarget ? DECISION_DIALOG_TITLES[decisionTarget.status] : 'معالجة التظلم'}</DialogTitle>
            <DialogDescription className="sr-only">
              {decisionTarget
                ? `${decisionTarget.appeal.caseNumber} · ${decisionTarget.appeal.employeeNameAr} · ${DECISION_STATUS_LABELS[decisionTarget.status]}`
                : 'معالجة التظلم'}
            </DialogDescription>
            {decisionTarget ? (
              <div className="space-y-2 text-right text-xs text-muted-foreground">
                <p>{decisionTarget.appeal.caseNumber} · {decisionTarget.appeal.employeeNameAr}</p>
                <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[decisionTarget.status as HRAppealStatus] ?? STATUS_COLORS.pending)}>
                  {DECISION_STATUS_LABELS[decisionTarget.status]}
                </Badge>
              </div>
            ) : null}
          </DialogHeader>

          {decisionTarget?.appeal.responseNote?.trim() ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground text-right">
              <p className="mb-1 font-medium text-foreground">آخر رد مسجّل</p>
              <p>{decisionTarget.appeal.responseNote}</p>
            </div>
          ) : null}

          {decisionTarget?.status === 'rejected' ? (
            <RejectReasonSuggestions
              kind="appeal"
              value={decisionNote}
              onChange={(next) => {
                setDecisionNote(next);
                if (decisionError) setDecisionError(null);
              }}
              disabled={deciding}
            />
          ) : null}

          <FormField label={decisionTarget?.status === 'rejected' ? 'سبب رفض التظلم' : 'رد الموارد البشرية'} required>
            <textarea
              value={decisionNote}
              onChange={(e) => {
                setDecisionNote(e.target.value);
                if (decisionError) setDecisionError(null);
              }}
              placeholder="اكتب رد الموارد البشرية للموظف — يُرسل مع الإشعار…"
              className={cn(
                'flex min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                decisionError ? 'border-destructive' : 'border-input',
              )}
            />
            {decisionError ? <p className="mt-1 text-xs text-destructive">{decisionError}</p> : null}
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              سيُسجَّل القرار ويُرسل إشعار in-app للموظف المعني.
            </p>
          </FormField>

          <DialogFooter>
            <Button onClick={() => void handleDecide()} disabled={deciding}>
              {deciding ? 'جاري الحفظ…' : 'تأكيد وإرسال'}
            </Button>
            <Button variant="outline" onClick={() => { setDecisionTarget(null); setDecisionNote(''); setDecisionError(null); }}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HRSettingsFormDrawer open={drawerOpen} onOpenChange={setDrawerOpen} title="تقديم تظلم" size="lg" onSave={() => void handleSave()} saveDisabled={saving} error={formError}>
        <FormField label="المخالفة" required>
          <SearchableDropdown value={draft.caseId} onChange={handleCaseSelect} options={caseOptions} placeholder="اختر المخالفة…" />
        </FormField>
        {draft.employeeNameAr && (
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm"><span className="text-muted-foreground">الموظف: </span>{draft.employeeNameAr}</div>
        )}
        <FormField label="تاريخ التظلم" required>
          <Input type="date" value={draft.date} onChange={e => set({ date: e.target.value })} />
        </FormField>
        <FormField label="قناة التظلم" required>
          <MinimalDropdown value={draft.channel} onChange={v => set({ channel: v as HRAppealChannel })} options={CHANNEL_OPTIONS} />
        </FormField>
        <FormField label="أسباب التظلم" required>
          <textarea value={draft.grounds} onChange={e => set({ grounds: e.target.value })} placeholder="اشرح أسباب التظلم…" className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </FormField>
      </HRSettingsFormDrawer>

      <ConfirmationModal
        open={!!deleteId}
        onOpenChange={v => !v && setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            try { await deleteAppeal(deleteId); toast.success('تم الحذف'); } catch { toast.error('فشل الحذف'); }
            setDeleteId(null);
          }
        }}
        title="حذف التظلم"
      />

      <TableRowDetailDialog
        open={detailRow != null}
        onOpenChange={(o) => !o && setDetailRow(null)}
        title="تفاصيل التظلم"
        fields={detailRow ? [
          { label: 'المخالفة', value: detailRow.caseNumber },
          { label: 'الموظف', value: detailRow.employeeNameAr },
          { label: 'التاريخ', value: <TableDateCell value={detailRow.date} /> },
          { label: 'القناة', value: APPEAL_CHANNEL_LABELS[detailRow.channel] },
          { label: 'الحالة', value: APPEAL_STATUS_LABELS[detailRow.status] },
          { label: 'رد الموارد البشرية', value: detailRow.responseNote?.trim() || '—' },
          { label: 'تاريخ القرار', value: detailRow.decidedAt ? <TableDateCell value={detailRow.decidedAt} /> : '—' },
          { label: 'أسباب التظلم', value: detailRow.grounds || '—' },
        ] : []}
        footer={
          detailRow ? (
            <PdfPreviewDownloadButton onClick={() => setLetterOpen(true)} />
          ) : null
        }
      >
        {detailRow ? (
          <RelatedEmployeeAttachments
            employeeId={detailRow.employeeId}
            companyId={companyId}
            preset="discipline"
          />
        ) : null}
      </TableRowDetailDialog>
    </div>
  );
}
