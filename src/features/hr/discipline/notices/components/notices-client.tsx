'use client';

import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import { Trash2, CalendarDays, Plus } from 'lucide-react';
import { EntityActionCard, EntityActionCardChip, EntityActionCardGrid, EntityActionCardGridSkeleton } from '@/components/ui/entity-action-card';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { ConfirmationModal, HRSettingsFormDrawer, FormField, EmptyState, MinimalDropdown, SearchableDropdown } from '@/components/ui/shared-dialogs';
import { useDisciplineNoticesDirectoryModel, type NoticeRecord } from '@/features/hr/discipline/notices/hooks/useDisciplineNoticesDirectoryModel';
import type { HRDisciplineNoticeKind } from '@/features/hr/discipline/lib/types';
import { NOTICE_KIND_LABELS, NOTICE_KIND_FILTER_ORDER } from '@/features/hr/discipline/lib/types';
import { ListFilterBar, type ListFilterBarHandle } from '@/components/ui/list-filter-bar';
import { type DateFilterTab } from '@/features/hr/discipline/lib/discipline-date-filter';
import { useDefaultCompany } from '@/features/hr/organization/hooks/useActiveCompany';
import { PdfPreviewExportDialog } from '@/components/pdf/pdf-preview-export-dialog';
import { RoseDisciplineNoticePrintHtml } from '@/components/pdf/rose-trading/rose-discipline-notice-print-html';
import { RelatedEmployeeAttachments } from '@/features/hr/organization/employees/components/related-employee-attachments';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { TableDateCell, TableRowActions, TableRowDetailDialog } from '@/components/ui/table-cells';
import { DisciplineListViewport, DisciplinePaginatedList } from '@/features/hr/discipline/components/discipline-paginated-list';
import { PdfPreviewDownloadButton } from '@/components/pdf/pdf-preview-download-button';

const KIND_OPTIONS = (Object.entries(NOTICE_KIND_LABELS) as [HRDisciplineNoticeKind, string][]).map(([v, l]) => ({ value: v, label: l }));

function noticeAttachmentsNote(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type KindFilter = 'all' | HRDisciplineNoticeKind;

/** Same raw notice_kind variants the list query sends (useDisciplineNoticesDirectoryModel). */
type DisciplineViewMode = 'cards' | 'list';

interface DraftForm {
  employeeId: string; kind: HRDisciplineNoticeKind; reasonAr: string;
  date: string; linkedCaseId: string; attachmentsNote: string;
}
const EMPTY: DraftForm = { employeeId: '', kind: 'verbal', reasonAr: '', date: '', linkedCaseId: '', attachmentsNote: '' };

export function NoticesClient() {
  const hook = useDisciplineNoticesDirectoryModel();
  const { employees, cases, loading, listError, accessDenied, createNotice, deleteNotice, setListFilters, items, pagination, filteredItems, dateFilteredItems, sourceNotices, companyId } = hook;

  const { data: defaultCompany } = useDefaultCompany();
  const companyNameAr = defaultCompany?.nameAr ?? '';
  const companyNameEn = defaultCompany?.nameEn ?? '';

  const [selectedEmpIds, setSelectedEmpIds] = React.useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = React.useState<DisciplineViewMode>('cards');
  const [kindFilter, setKindFilter] = React.useState<KindFilter>('all');
  const [dateBounds, setDateBounds] = React.useState({ from: '', to: '' });
  const [dateMeta, setDateMeta] = React.useState<{ tab: DateFilterTab; hasRestriction: boolean }>(() => ({
    tab: 'all',
    hasRestriction: false,
  }));
  const filterToolbarRef = React.useRef<ListFilterBarHandle>(null);
  const onDateBoundsChange = React.useCallback((b: { from: string; to: string }) => {
    setDateBounds(b);
  }, []);
  const onDateFilterMetaChange = React.useCallback((meta: { tab: DateFilterTab; hasRestriction: boolean }) => {
    setDateMeta(meta);
  }, []);

  React.useEffect(() => {
    setListFilters({
      selectedEmpIds: [...selectedEmpIds],
      kindFilter,
      dateFrom: dateBounds.from,
      dateTo: dateBounds.to,
    });
  }, [selectedEmpIds, kindFilter, dateBounds.from, dateBounds.to, setListFilters]);

  const listFiltered = filteredItems;
  const filtered = dateFilteredItems;
  const searchFiltered = sourceNotices;

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftForm>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [detailRow, setDetailRow] = React.useState<NoticeRecord | null>(null);
  const [letterOpen, setLetterOpen] = React.useState(false);

  const empOptions = employees.map(e => ({ value: e.id, label: e.nameAr }));
  const caseOptions = cases.map((c) => ({
    value: c.id,
    label: c.caseNumber,
    sub: c.violationTypeNameAr
      ? `${c.violationTypeNameAr} · ${c.employeeNameAr}`
      : c.employeeNameAr,
  }));

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: filtered.length };
    for (const k of NOTICE_KIND_FILTER_ORDER) counts[k] = 0;
    for (const n of filtered) counts[n.kind] = (counts[n.kind] ?? 0) + 1;
    return counts;
  }, [filtered]);

  const dateRangeActive = dateMeta.hasRestriction;
  const activeFilterCount = (selectedEmpIds.size > 0 ? 1 : 0) + (kindFilter !== 'all' ? 1 : 0) + (dateRangeActive ? 1 : 0);

  // Exports cover every notice matching the current filters (same query as the list), not just the visible page.

  const noticePrintFields = React.useMemo(() => {
    if (!detailRow) return null;
    const emp = employees.find((e) => e.id === detailRow.employeeId);
    return {
      noticeDate: detailRow.date,
      employeeNameAr: detailRow.employeeNameAr,
      nationalId: emp?.nationalId ?? '',
      nationality: emp?.nationality ?? '',
      jobTitle: emp?.position ?? '',
      branchNameAr: emp?.branchNameAr ?? '',
      kind: detailRow.kind,
      violationDetail: detailRow.reasonAr,
    };
  }, [detailRow, employees]);

  const noticePrintable = React.useMemo(
    () =>
      noticePrintFields ? (
        <RoseDisciplineNoticePrintHtml
          companyNameAr={companyNameAr}
          companyNameEn={companyNameEn}
          fields={noticePrintFields}
        />
      ) : null,
    [noticePrintFields, companyNameAr, companyNameEn],
  );

  const set = (patch: Partial<DraftForm>) => setDraft(d => ({ ...d, ...patch }));

  const columns = React.useMemo((): ColumnDef<NoticeRecord>[] => [
    {
      key: 'employee',
      title: 'الموظف',
      headerClassName: 'whitespace-nowrap',
      className: 'max-w-[12rem] truncate font-medium',
      render: (n) => n.employeeNameAr,
    },
    {
      key: 'kind',
      title: 'نوع الإنذار',
      headerClassName: 'whitespace-nowrap',
      className: 'whitespace-nowrap text-xs',
      render: (n) => n.kindLabel,
    },
    {
      key: 'date',
      title: 'التاريخ',
      headerClassName: 'whitespace-nowrap',
      className: 'whitespace-nowrap font-mono text-xs tabular-nums',
      render: (n) => <TableDateCell value={n.date} />,
    },
    {
      key: 'reason',
      title: 'السبب',
      className: 'max-w-[20rem] truncate text-xs text-muted-foreground',
      render: (n) => n.reasonAr,
    },
    {
      key: 'attachments',
      title: 'المرفقات',
      className: 'max-w-[14rem] truncate text-xs text-muted-foreground',
      render: (n) => noticeAttachmentsNote(n.attachmentsNote) ?? '',
    },
    {
      key: 'actions',
      title: 'إجراءات',
      isActions: true,
      headerClassName: 'whitespace-nowrap',
      render: (n) => (
        <TableRowActions
          menuItems={[
            {
              label: 'حذف',
              onClick: () => setDeleteId(n.id),
              icon: <Trash2 className="h-3.5 w-3.5" />,
              destructive: true,
            },
          ]}
        />
      ),
    },
  ], []);

  const tools = useListTools<NoticeRecord>({
    section: 'hr',
    page: 'discipline-notices',
    columns,
    rows: items,
    fetchAll: pagination.loadAll,
    resetKey: pagination.resetKey,
    fields: {
      employee: { kind: 'name', text: (n) => n.employeeNameAr || '—', group: (n) => n.employeeNameAr || null },
      kind: { text: (n) => n.kindLabel, group: (n) => n.kindLabel },
      date: { kind: 'date', text: (n) => n.date || '—', group: (n) => (n.date ? n.date.slice(0, 7) : null) },
      reason: { text: (n) => n.reasonAr || '—', sortable: false },
      attachments: { text: (n) => noticeAttachmentsNote(n.attachmentsNote) || '—', sortable: false },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        {tools.exportMenu('سجل الإنذارات', 'discipline-notices')}
        <Button variant="luxe" size="sm" className="h-8 gap-1.5 px-3 text-xs shadow-sm shrink-0"
          onClick={() => setDrawerOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          إضافة إنذار
        </Button>
      </div>
    ),
    [activeFilterCount, tools.depsKey],
  );

  const handleSave = async () => {
    setFormError(null);
    if (!draft.employeeId) { setFormError('الموظف مطلوب'); return; }
    if (!draft.reasonAr.trim()) { setFormError('السبب مطلوب'); return; }
    if (!draft.date) { setFormError('التاريخ مطلوب'); return; }
    setSaving(true);
    try {
      await createNotice({
        employeeId: draft.employeeId,
        kind: draft.kind,
        reasonAr: draft.reasonAr,
        date: draft.date,
        linkedCaseId: draft.linkedCaseId || null,
        attachmentsNote: draft.attachmentsNote || null,
      });
      toast.success('تم إضافة الإنذار');
      setDrawerOpen(false);
      setDraft(EMPTY);
    } catch {
      setFormError('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        ref={filterToolbarRef}
        defaultDateFilterTab="all"
        companyId={companyId}
        selectedEmpIds={selectedEmpIds}
        onSelectedEmpIdsChange={setSelectedEmpIds}
        statusFilter={kindFilter}
        onStatusFilterChange={(v) => setKindFilter(v as KindFilter)}
        statusOrder={NOTICE_KIND_FILTER_ORDER}
        statusLabels={NOTICE_KIND_LABELS as unknown as Record<string, string>}
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
    [companyId, selectedEmpIds, kindFilter, statusCounts, viewMode, onDateBoundsChange, onDateFilterMetaChange],
  );

  if (accessDenied) {
    return <ForbiddenState title="لا تملك صلاحية الوصول للإنذارات" />;
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
      <PdfPreviewExportDialog
        open={letterOpen}
        onOpenChange={setLetterOpen}
        title={detailRow ? `إنذار — ${detailRow.employeeNameAr}` : 'معاينة ملف الإنذار'}
        fileName={detailRow ? `discipline-notice-${detailRow.employeeNameAr}-${detailRow.date}.pdf` : 'discipline-notice.pdf'}
        printable={noticePrintable}
      />

      <DisciplineListViewport>
      {searchFiltered.length === 0 ? (
        <EmptyState title="لا توجد إنذارات مطابقة للبحث أو الموظفين المحددين." />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            {dateRangeActive ? 'لا توجد إنذارات ضمن الفترة المحددة.'
              : 'لا توجد إنذارات ضمن النتائج الحالية.'}
          </p>
          {dateRangeActive ? (
            <Button variant="link" size="sm" className="mt-2 text-xs" onClick={() => filterToolbarRef.current?.resetDateFilter()}>عرض كل الفترات</Button>
          ) : null}
        </div>
      ) : listFiltered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-14 text-center">
          <p className="text-sm text-muted-foreground">لا توجد إنذارات من نوع «{kindFilter === 'all' ? '' : NOTICE_KIND_LABELS[kindFilter]}» مع عوامل البحث الحالية.</p>
          <Button variant="link" size="sm" className="mt-2 text-xs" onClick={() => filterToolbarRef.current?.resetStatusFilter()}>عرض الكل</Button>
        </div>
      ) : (
        <ListToolsTable tools={tools} keyExtractor={(n) => n.id} onRowClick={(n) => setDetailRow(n)}>
        <DisciplinePaginatedList pagination={tools.pagination(pagination)}>
          {viewMode === 'cards' ? (
          <EntityActionCardGrid>
            {tools.rows.map((n) => {
            const attachmentsNote = noticeAttachmentsNote(n.attachmentsNote);
            return (
            <EntityActionCard
              key={n.id}
              title={n.employeeNameAr ?? '—'}
              status={{ label: n.kindLabel, tone: 'primary' }}
              chips={
                <EntityActionCardChip className="font-mono tabular-nums">
                  <span className="inline-flex items-center gap-1" dir="ltr">
                    <CalendarDays className="h-3 w-3 shrink-0" />
                    {n.date}
                  </span>
                </EntityActionCardChip>
              }
              description={n.reasonAr}
              footerNote={
                attachmentsNote ? (
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/80">ملاحظة: </span>
                    {attachmentsNote}
                  </p>
                ) : undefined
              }
              onClick={() => setDetailRow(n)}
              onDelete={() => setDeleteId(n.id)}
            />
            );
            })}
          </EntityActionCardGrid>
          ) : (
          <DataTable
            variant="directory"
            alwaysShowTable
            tableClassName="min-w-[640px]"
            columns={tools.columns}
            {...tools.tableSort}
            data={tools.rows}
            loading={tools.loading}
            keyExtractor={(n) => n.id}
            onRowClick={(n) => setDetailRow(n)}
          />
          )}
        </DisciplinePaginatedList>
        </ListToolsTable>
      )}
      </DisciplineListViewport>

      <HRSettingsFormDrawer open={drawerOpen} onOpenChange={setDrawerOpen} title="إضافة إنذار" size="lg" onSave={() => void handleSave()} saveDisabled={saving} error={formError}>
        <FormField label="الموظف" required>
          <SearchableDropdown value={draft.employeeId} onChange={v => set({ employeeId: v })} options={empOptions} placeholder="اختر الموظف…" />
        </FormField>
        <FormField label="نوع الإنذار" required>
          <MinimalDropdown value={draft.kind} onChange={v => set({ kind: v as HRDisciplineNoticeKind })} options={KIND_OPTIONS} />
        </FormField>
        <FormField label="السبب" required>
          <textarea value={draft.reasonAr} onChange={e => set({ reasonAr: e.target.value })} placeholder="اكتب سبب الإنذار…" className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </FormField>
        <FormField label="التاريخ" required>
          <DatePickerInput value={draft.date} onChange={(ymd) => set({ date: ymd })} />
        </FormField>
        <FormField label="ربط بمخالفة">
          <SearchableDropdown value={draft.linkedCaseId} onChange={v => set({ linkedCaseId: v })} options={caseOptions} placeholder="اختر مخالفة (اختياري)…" allowClear />
        </FormField>
        <FormField label="ملاحظة المرفقات">
          <Input value={draft.attachmentsNote} onChange={e => set({ attachmentsNote: e.target.value })} placeholder="وصف المرفقات…" />
        </FormField>
      </HRSettingsFormDrawer>

      <ConfirmationModal
        open={!!deleteId}
        onOpenChange={v => !v && setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            try { await deleteNotice(deleteId); toast.success('تم الحذف'); } catch { toast.error('فشل الحذف'); }
            setDeleteId(null);
          }
        }}
        title="حذف الإنذار"
      />

      <TableRowDetailDialog
        open={detailRow != null}
        onOpenChange={(o) => !o && setDetailRow(null)}
        title="تفاصيل الإنذار"
        fields={detailRow ? [
          { label: 'الموظف', value: detailRow.employeeNameAr },
          { label: 'نوع الإنذار', value: detailRow.kindLabel },
          { label: 'التاريخ', value: <TableDateCell value={detailRow.date} /> },
          { label: 'السبب', value: detailRow.reasonAr },
          ...(detailRow.linkedCaseNumber
            ? [{ label: 'مخالفة مرتبطة', value: detailRow.linkedCaseNumber }]
            : []),
          ...(noticeAttachmentsNote(detailRow.attachmentsNote)
            ? [{ label: 'ملاحظة المرفقات', value: noticeAttachmentsNote(detailRow.attachmentsNote)! }]
            : []),
          { label: 'أُنشئ', value: <TableDateCell value={detailRow.createdAt} mode="datetime" /> },
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
            title="آخر مرفقات الإنذارات"
          />
        ) : null}
      </TableRowDetailDialog>
    </div>
  );
}
