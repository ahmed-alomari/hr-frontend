'use client';

import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import { Trash2, CalendarDays, Megaphone, Send, Search, Plus } from 'lucide-react';
import {
  EntityActionCard,
  EntityActionCardChip,
  EntityActionCardGrid,
} from '@/components/ui/entity-action-card';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions, usePageHeaderActionsState } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { useDefaultCompany } from '@/features/hr/organization/hooks/useActiveCompany';
import { PdfPreviewExportDialog } from '@/components/pdf/pdf-preview-export-dialog';
import { PdfPreviewDownloadButton } from '@/components/pdf/pdf-preview-download-button';
import { DisciplineCircularPrintHtml } from '@/components/pdf/print/discipline-circular-print-html';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import type { RegisterColumn } from '@/components/pdf/print/register-document';
import {
  ConfirmationModal, HRSettingsFormDrawer, FormField,
  EmptyState,
} from '@/components/ui/shared-dialogs';
import { Checkbox } from '@/components/ui/checkbox';
import { EmployeePicker } from '@/components/ui/employee-picker';
import { useDisciplineCircularsDirectoryModel } from '@/features/hr/discipline/circulars/hooks/useDisciplineCircularsDirectoryModel';
import { toCircularAudienceType } from '@/features/hr/discipline/circulars/services/discipline-circulars.service';
import type { HRDisciplineCircularAudience } from '@/features/hr/discipline/lib/types';
import {
  CIRCULAR_AUDIENCE_LABELS,
  CIRCULAR_AUDIENCE_FILTER_ORDER,
} from '@/features/hr/discipline/lib/types';
import type { HRDisciplineCircularRecord } from '@/features/hr/discipline/lib/types';
import { useDisciplineDateFilterState } from '@/features/hr/discipline/lib/use-discipline-date-filter-state';
import {
  DisciplineFilterToolbar,
  type DisciplineFilterToolbarHandle,
  type DisciplineViewMode,
} from '@/features/hr/discipline/components/discipline-filter-toolbar';
import { tryBuildCircularAudienceSnapshot } from '@/features/hr/discipline/circulars/utils/build-circular-audience-summary';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, dialogFormFooterClass } from '@/components/ui/dialog';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { TableDateCell, TableRowActions } from '@/components/ui/table-cells';
import { DisciplineListViewport, DisciplinePaginatedList } from '@/features/hr/discipline/components/discipline-paginated-list';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';

type AudienceFilter = 'all' | HRDisciplineCircularAudience;

const CIRCULAR_EXPORT_COLUMNS: RegisterColumn[] = [
  { label: 'العنوان', kind: 'text' },
  { label: 'النطاق', kind: 'text', weight: 2 },
  { label: 'التاريخ', kind: 'date' },
  { label: 'النص', kind: 'text', weight: 4 },
];

interface DraftForm {
  titleAr: string;
  bodyAr: string;
  date: string;
  targetEmployeeIds: Set<string>;
  /** تنفيذ الإرسال فور الحفظ — الافتراضي لا */
  executeSend: boolean;
}

const EMPTY: DraftForm = {
  titleAr: '',
  bodyAr: '',
  date: new Date().toISOString().slice(0, 10),
  targetEmployeeIds: new Set(),
  executeSend: false,
};

function canMutateCircular(c: HRDisciplineCircularRecord) {
  return !c.sentAt;
}

export function CircularsClient() {
  const m = useDisciplineCircularsDirectoryModel();
  const { setListFilters } = m;
  const { filterPanelOpen } = usePageHeaderActionsState();

  const [q, setQ] = React.useState('');
  const [selectedEmpIds, setSelectedEmpIds] = React.useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = React.useState<DisciplineViewMode>('cards');
  const [audienceFilter, setAudienceFilter] = React.useState<AudienceFilter>('all');
  const { dateBounds, dateMeta, onDateBoundsChange, onDateFilterMetaChange } = useDisciplineDateFilterState();
  const filterToolbarRef = React.useRef<DisciplineFilterToolbarHandle>(null);

  const empPickerList = React.useMemo(
    () => m.employees.map((e) => ({ id: e.id, name: e.nameAr })),
    [m.employees],
  );

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftForm>(EMPTY);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const [detailCircular, setDetailCircular] = React.useState<HRDisciplineCircularRecord | null>(null);
  const [letterOpen, setLetterOpen] = React.useState(false);
  const { data: defaultCompany } = useDefaultCompany();
  const companyNameAr = defaultCompany?.nameAr ?? '';
  const companyNameEn = defaultCompany?.nameEn ?? '';

  React.useEffect(() => {
    setListFilters({
      q,
      selectedEmpIds: [...selectedEmpIds],
      audienceFilter,
      dateFrom: dateBounds.from,
      dateTo: dateBounds.to,
    });
  }, [q, selectedEmpIds, audienceFilter, dateBounds.from, dateBounds.to, setListFilters]);

  // Load filter reference data lazily: only when filter panel opens or drawer opens.
  const loadFilterDirectory = m.loadFilterDirectory;
  React.useEffect(() => {
    if (filterPanelOpen || drawerOpen) {
      void loadFilterDirectory();
    }
  }, [filterPanelOpen, drawerOpen, loadFilterDirectory]);

  const listFiltered = m.filteredItems;
  const filtered = m.dateFilteredItems;
  const searchFiltered = m.searchFilteredItems;

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: filtered.length };
    for (const a of CIRCULAR_AUDIENCE_FILTER_ORDER) counts[a] = 0;
    for (const c of filtered) counts[c.audience] = (counts[c.audience] ?? 0) + 1;
    return counts;
  }, [filtered]);

  const dateRangeActive = dateMeta.hasRestriction;

  const activeFilterCount = (q.trim() ? 1 : 0) + (selectedEmpIds.size > 0 ? 1 : 0) + (audienceFilter !== 'all' ? 1 : 0) + (dateMeta.hasRestriction ? 1 : 0);

  const { loadAllForExport } = m;
  const getExportRows = useLatestCallback(
    async () =>
      (await loadAllForExport()).map((c) => [
        c.titleAr || '—',
        c.audienceSummaryAr || '—',
        c.date ? c.date.slice(0, 10) : '—',
        c.bodyAr || '—',
      ]),
  );


  useEntityFilterSlot(
    () => (
      <DisciplineFilterToolbar
        ref={filterToolbarRef}
        showPrimaryAction={false}
        primaryActionLabel="تعميم جديد"
        onPrimaryAction={() => {
          setDraft({ ...EMPTY, date: new Date().toISOString().slice(0, 10), executeSend: false });
          setFormError(null);
          setDrawerOpen(true);
        }}
        beforeEmployeePicker={(
          <div className="relative shrink-0">
            <Search className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث في العنوان أو النص أو النطاق…"
              className="h-8 pr-8 text-xs w-56"
            />
          </div>
        )}
        companyId={m.companyId}
        selectedEmpIds={selectedEmpIds}
        onSelectedEmpIdsChange={setSelectedEmpIds}
        statusFilter={audienceFilter}
        onStatusFilterChange={(v) => setAudienceFilter(v as AudienceFilter)}
        statusOrder={CIRCULAR_AUDIENCE_FILTER_ORDER}
        statusLabels={CIRCULAR_AUDIENCE_LABELS as unknown as Record<string, string>}
        statusCounts={statusCounts}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onDateBoundsChange={onDateBoundsChange}
        onDateFilterMetaChange={onDateFilterMetaChange}
      />
    ),
    [q, m.companyId, selectedEmpIds, audienceFilter, statusCounts, viewMode, onDateBoundsChange, onDateFilterMetaChange],
  );

  const set = (patch: Partial<DraftForm>) => setDraft((d) => ({ ...d, ...patch }));

  const handleMarkSent = React.useCallback(async (id: string) => {
    try {
      await m.markSent(id);
      toast.success('تم إرسال التعميم');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'discipline-circulars.send');
      toast.error(displayMessage);
    }
  }, [m]);

  const columns = React.useMemo((): ColumnDef<HRDisciplineCircularRecord>[] => [
    {
      key: 'title',
      title: 'العنوان',
      headerClassName: 'whitespace-nowrap',
      className: 'max-w-[12rem] truncate font-medium',
      render: (c) => c.titleAr || '—',
    },
    {
      key: 'audience',
      title: 'النطاق',
      headerClassName: 'whitespace-nowrap',
      className: 'max-w-[14rem] whitespace-normal text-xs',
      render: (c) => c.audienceSummaryAr,
    },
    {
      key: 'date',
      title: 'التاريخ',
      headerClassName: 'whitespace-nowrap',
      className: 'whitespace-nowrap font-mono text-xs tabular-nums',
      render: (c) => <TableDateCell value={c.date} />,
    },
    {
      key: 'body',
      title: 'النص',
      className: 'max-w-[20rem] truncate text-xs text-muted-foreground',
      render: (c) => c.bodyAr,
    },
    {
      key: 'actions',
      title: 'إجراءات',
      isActions: true,
      headerClassName: 'whitespace-nowrap',
      render: (c) => (
        canMutateCircular(c) ? (
          <TableRowActions
            primaryActions={[
              {
                label: 'إرسال',
                variant: 'primary',
                icon: <Send className="h-3.5 w-3.5" />,
                onClick: () => void handleMarkSent(c.id),
              },
            ]}
            menuItems={[
              {
                label: 'حذف',
                onClick: () => setDeleteId(c.id),
                icon: <Trash2 className="h-3.5 w-3.5" />,
                destructive: true,
                separator: true,
              },
            ]}
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )
      ),
    },
  ], [handleMarkSent]);

  const tools = useListTools<HRDisciplineCircularRecord>({
    section: 'hr',
    page: 'discipline-circulars',
    columns,
    rows: m.items,
    fetchAll: loadAllForExport,
    resetKey: JSON.stringify([q, [...selectedEmpIds], audienceFilter, dateBounds]),
    fields: {
      title: { kind: 'name', text: (c) => c.titleAr || '—' },
      audience: { text: (c) => c.audienceSummaryAr || '—', group: (c) => c.audienceSummaryAr || null },
      date: { kind: 'date', text: (c) => (c.date ? c.date.slice(0, 10) : '—'), group: (c) => (c.date ? c.date.slice(0, 7) : null) },
      body: { text: (c) => c.bodyAr || '—', sortable: false },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        <RegisterExportMenu
          title="سجل التعاميم"
          fileName="discipline-circulars"
          columns={CIRCULAR_EXPORT_COLUMNS}
          getRows={getExportRows}
        />
        <Button variant="luxe" size="sm" className="h-8 gap-1.5 px-3 text-xs shadow-sm shrink-0"
          onClick={() => { setDraft({ ...EMPTY, date: new Date().toISOString().slice(0, 10), executeSend: false }); setFormError(null); setDrawerOpen(true); }}>
          <Plus className="h-3.5 w-3.5" />
          تعميم جديد
        </Button>
      </div>
    ),
    [activeFilterCount, getExportRows, tools.depsKey],
  );

  const handleSave = async () => {
    setFormError(null);
    if (!draft.bodyAr.trim()) { setFormError('نص التعميم مطلوب'); return; }
    if (!draft.date) { setFormError('التاريخ مطلوب'); return; }
    if (!m.companyId) { setFormError('تعذر تحديد الشركة'); return; }

    const built = tryBuildCircularAudienceSnapshot({
      audience: 'employees',
      branchIds: new Set(),
      departmentIds: new Set(),
      targetEmployeeIds: draft.targetEmployeeIds,
    });
    if (!built.ok) { setFormError(built.error); return; }

    const { targetEmployeeIds } = built.data;

    try {
      await m.add({
        companyId: m.companyId,
        titleAr: draft.titleAr.trim() ? draft.titleAr.trim() : null,
        bodyAr: draft.bodyAr.trim(),
        issueDate: draft.date,
        audienceType: toCircularAudienceType('employees'),
        audienceTargetIds: targetEmployeeIds,
        sendOnSave: draft.executeSend,
      });
      toast.success(
        draft.executeSend
          ? 'تم إصدار التعميم وإرساله إلى المستلمين'
          : 'تم حفظ التعميم دون إرسال — يمكنك الإرسال لاحقاً من عرض الجدول',
      );
      setDrawerOpen(false);
      setDraft(EMPTY);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'discipline-circulars.save');
      setFormError(displayMessage);
    }
  };

  if (m.accessDenied) {
    return <ForbiddenState title="لا تملك صلاحية الوصول للتعميمات" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PdfPreviewExportDialog
        open={letterOpen}
        onOpenChange={setLetterOpen}
        title={
          detailCircular
            ? `معاينة التعميم — ${detailCircular.titleAr || detailCircular.date}`
            : 'معاينة التعميم'
        }
        fileName={
          detailCircular
            ? `circular-${detailCircular.date}.pdf`
            : 'circular.pdf'
        }
        printable={
          detailCircular ? (
            <DisciplineCircularPrintHtml
              company={{ nameAr: companyNameAr, nameEn: companyNameEn || companyNameAr }}
              titleAr={detailCircular.titleAr}
              issuedDate={detailCircular.date}
              bodyAr={detailCircular.bodyAr}
            />
          ) : null
        }
      />

      {/* Detail dialog */}
      <Dialog open={!!detailCircular} onOpenChange={(v) => !v && setDetailCircular(null)}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden border-border" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-display">
              <Megaphone className="h-4 w-4 text-primary shrink-0" />
              {detailCircular?.titleAr || 'تعميم'}
            </DialogTitle>
          </DialogHeader>
          {detailCircular && (
            <div className="space-y-4 px-6 pb-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span dir="ltr">{detailCircular.date}</span>
                </span>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  {detailCircular.audienceSummaryAr}
                </span>
                <span className={detailCircular.sentAt
                  ? 'text-muted-foreground'
                  : 'rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-800 dark:text-amber-200'}>
                  {detailCircular.sentAt ? 'مُرسل' : 'لم يُرسل'}
                </span>
              </div>
              <div className="rounded-xl border border-border bg-muted/10 px-4 py-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{detailCircular.bodyAr}</p>
              </div>
            </div>
          )}
          {detailCircular ? (
            <DialogFooter className={dialogFormFooterClass}>
              <PdfPreviewDownloadButton onClick={() => setLetterOpen(true)} />
              <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setDetailCircular(null)}>
                إغلاق
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      {m.listError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive whitespace-pre-wrap">
          {m.listError}
        </p>
      ) : null}

      <DisciplineListViewport>
      {m.loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">جاري التحميل...</p>
      ) : searchFiltered.length === 0 ? (
        <EmptyState title="لا توجد تعميمات مطابقة للبحث أو للموظفين المحددين في شريط الفلاتر." />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            {dateMeta.tab === 'today'
              ? 'لا توجد تعميمات بتاريخ اليوم ضمن النتائج الحالية.'
              : dateMeta.tab === 'week'
                ? 'لا توجد تعميمات ضمن هذا الأسبوع ضمن النتائج الحالية.'
                : dateMeta.tab === 'month'
                  ? 'لا توجد تعميمات ضمن هذا الشهر ضمن النتائج الحالية.'
                  : dateMeta.tab === 'custom' && dateRangeActive
                    ? 'لا توجد تعميمات ضمن نطاق التاريخ المخصص مع عوامل البحث الحالية.'
                    : 'لا توجد تعميمات ضمن النتائج الحالية.'}
          </p>
          {dateRangeActive ? (
            <Button variant="link" size="sm" className="mt-2 text-xs" onClick={() => filterToolbarRef.current?.resetDateFilter()}>
              عرض كل الفترات
            </Button>
          ) : null}
        </div>
      ) : listFiltered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            لا توجد تعميمات بنطاق «{audienceFilter === 'all' ? '' : CIRCULAR_AUDIENCE_LABELS[audienceFilter]}» مع عوامل البحث الحالية.
          </p>
          <Button variant="link" size="sm" className="mt-2 text-xs" onClick={() => filterToolbarRef.current?.resetStatusFilter()}>
            عرض الكل
          </Button>
        </div>
      ) : (
        <ListToolsTable tools={tools} keyExtractor={(c) => c.id} onRowClick={(c) => setDetailCircular(c)}>
        <DisciplinePaginatedList pagination={tools.pagination(m.pagination)}>
          {viewMode === 'cards' ? (
          <EntityActionCardGrid>
            {tools.rows.map((c) => (
            <EntityActionCard
              key={c.id}
              title={c.titleAr || 'تعميم'}
              status={{
                label: c.sentAt ? 'مُرسل' : 'لم يُرسل',
                tone: c.sentAt ? 'approved' : 'pending',
              }}
              chips={
                <>
                  <EntityActionCardChip className="max-w-[10rem] leading-tight">{c.audienceSummaryAr}</EntityActionCardChip>
                  <EntityActionCardChip className="font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1" dir="ltr">
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      {c.date}
                    </span>
                  </EntityActionCardChip>
                </>
              }
              description={c.bodyAr}
              avatarLetter={c.titleAr?.charAt(0) ?? 'ت'}
              onClick={() => setDetailCircular(c)}
              onDelete={canMutateCircular(c) ? () => setDeleteId(c.id) : undefined}
              extraFooter={
                !c.sentAt ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 w-full gap-1.5 text-xs"
                    type="button"
                    onClick={() => {
                      void (async () => {
                        try {
                          await m.markSent(c.id);
                          toast.success('تم إرسال التعميم');
                        } catch (err) {
                          const { displayMessage } = handleApiError(err, 'discipline-circulars.send');
                          toast.error(displayMessage);
                        }
                      })();
                    }}
                  >
                    <Send className="h-3.5 w-3.5" /> إرسال التعميم
                  </Button>
                ) : undefined
              }
            />
            ))}
          </EntityActionCardGrid>
          ) : (
          <DataTable
            variant="directory"
            alwaysShowTable
            tableClassName="min-w-[880px]"
            columns={tools.columns}
            {...tools.tableSort}
            data={tools.rows}
            keyExtractor={(c) => c.id}
            onRowClick={(c) => setDetailCircular(c)}
          />
          )}
        </DisciplinePaginatedList>
        </ListToolsTable>
      )}
      </DisciplineListViewport>

      <HRSettingsFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="تعميم جديد"
        size="lg"
        onSave={() => void handleSave()}
        error={formError}
      >
        <FormField label="عنوان التعميم (اختياري)">
          <Input value={draft.titleAr} onChange={(e) => set({ titleAr: e.target.value })} placeholder="مثال: تعميم بخصوص سياسة الحضور…" />
        </FormField>
        <FormField label="نص التعميم" required>
          <textarea
            value={draft.bodyAr}
            onChange={(e) => set({ bodyAr: e.target.value })}
            placeholder="اكتب نص التعميم — استخدم «-» للنقاط، «○» للاستثناءات، «1.» للترقيم، «##» للعناوين الفرعية…"
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </FormField>
        <FormField label="تاريخ الإصدار" required>
          <DatePickerInput value={draft.date} onChange={(ymd) => set({ date: ymd })} />
        </FormField>
        <FormField label={`الموظفون المستهدفون${draft.targetEmployeeIds.size > 0 ? ` (${draft.targetEmployeeIds.size})` : ''}`} required>
          <EmployeePicker
            variant="form"
            selectionMode="target"
            employees={empPickerList}
            selected={draft.targetEmployeeIds}
            onChange={(s) => set({ targetEmployeeIds: s })}
          />
        </FormField>
        <FormField label="تنفيذ">
          <p className="mb-2 text-[11px] text-muted-foreground">
            الافتراضي: لا إرسال — يُحفظ التعميم فقط حتى تختار الإرسال من هنا أو من عرض الجدول.
          </p>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-muted/10 p-3">
            <Checkbox
              checked={draft.executeSend}
              onCheckedChange={(v) => set({ executeSend: v === true })}
              className="mt-0.5"
            />
            <span className="text-sm leading-relaxed">
              إرسال التعميم إلى المستلمين فور الحفظ
            </span>
          </label>
        </FormField>
      </HRSettingsFormDrawer>

      <ConfirmationModal
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          void (async () => {
            try {
              await m.remove(deleteId);
              toast.success('تم حذف التعميم');
              setDeleteId(null);
            } catch (err) {
              const { displayMessage } = handleApiError(err, 'discipline-circulars.delete');
              toast.error(displayMessage);
            }
          })();
        }}
        title="حذف التعميم"
      />
    </div>
  );
}
