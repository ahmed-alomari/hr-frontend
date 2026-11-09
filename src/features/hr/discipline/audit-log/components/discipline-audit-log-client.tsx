'use client';

import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import { FoldedHeaderTool } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import { FileDown, FileSpreadsheet, Loader2, Rows3, Table2 } from 'lucide-react';
import {
  EntityActionCard,
  EntityActionCardChip,
  EntityActionCardGrid,
} from '@/components/ui/entity-action-card';
import { toast } from 'sonner';
import { usePageFilters } from '@/components/layouts/filter-panel-context';
import { EmptyState } from '@/components/ui/shared-dialogs';
import { Button } from '@/components/ui/button';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { TableDateCell } from '@/components/ui/table-cells';
import { DisciplineListViewport, DisciplinePaginatedList } from '@/features/hr/discipline/components/discipline-paginated-list';
import { cn, formatDisplayDateTime } from '@/shared/utils';
import { useDefaultCompany } from '@/features/hr/organization/hooks/useActiveCompany';
import type { HRDisciplineAuditCategory, HRDisciplineAuditAction } from '@/features/hr/discipline/lib/discipline-audit-log';
import {
  AUDIT_ACTION_FILTER_ORDER,
  AUDIT_ACTION_LABELS_AR,
  AUDIT_CATEGORY_LABELS_AR,
} from '@/features/hr/discipline/lib/discipline-audit-log';
import { PdfPreviewExportDialog } from '@/components/pdf/pdf-preview-export-dialog';
import { DisciplineAuditLogPrintHtml } from '@/components/pdf/print/discipline-audit-log-print-html';
import { downloadXlsxFromAoA, type XlsxCell } from '@/shared/export/download-xlsx';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import {
  ListFilterBar,
  type ListFilterBarHandle,
  type ListFilterInlineSelect,
} from '@/components/ui/list-filter-bar';
import { useDisciplineDateFilterState } from '@/features/hr/discipline/lib/use-discipline-date-filter-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import {
  useDisciplineAuditLogDirectoryModel,
  type AuditLogEntry,
} from '@/features/hr/discipline/audit-log/hooks/useDisciplineAuditLogDirectoryModel';

type CatFilter = 'all' | HRDisciplineAuditCategory;
type StatusFilter = 'all' | HRDisciplineAuditAction;
type DisciplineViewMode = 'cards' | 'list';

function formatOccurred(iso: string): string {
  return formatDisplayDateTime(iso);
}

function SnapshotComparisonTable({ previousSnapshotAr, currentSnapshotAr }: { previousSnapshotAr: string; currentSnapshotAr: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background">
      <table className="w-full min-w-[280px] border-collapse text-xs" dir="rtl">
        <thead>
          <tr className="border-b border-border bg-muted/60">
            <th className="w-1/2 p-2.5 text-right font-semibold text-foreground">القيمة السابقة</th>
            <th className="w-1/2 p-2.5 text-right font-semibold text-foreground border-s border-border">القيمة الجديدة</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="align-top border-border border-e p-3 whitespace-pre-wrap text-muted-foreground leading-relaxed">
              {previousSnapshotAr?.trim() ? previousSnapshotAr : '—'}
            </td>
            <td className="align-top p-3 whitespace-pre-wrap text-foreground leading-relaxed">
              {currentSnapshotAr?.trim() ? currentSnapshotAr : '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CompareToggle({ expanded, onToggle, compact }: { expanded: boolean; onToggle: () => void; compact?: boolean }) {
  return (
    <Button
      type="button"
      variant={expanded ? 'secondary' : 'outline'}
      size={compact ? 'sm' : 'default'}
      className={cn('gap-1.5 text-xs', compact ? 'h-8 px-2.5' : 'w-full sm:w-auto')}
      onClick={onToggle}
      aria-expanded={expanded}
    >
      {expanded ? <Rows3 className="size-3.5 shrink-0" /> : <Table2 className="size-3.5 shrink-0" />}
      {expanded ? 'إخفاء جدول المقارنة' : 'عرض جدول المقارنة'}
    </Button>
  );
}

export function DisciplineAuditLogClient() {
  const m = useDisciplineAuditLogDirectoryModel();
  const {
    items,
    filteredItems,
    dateFilteredItems,
    searchFilteredItems,
    actorPickerList,
    actorPickerLoading,
    loading,
    listError: loadError,
    pagination,
    setListFilters,
    loadActorDirectory,
    fetchAllEntries,
  } = m;
  const { data: defaultCompany } = useDefaultCompany();
  const companyNameAr = defaultCompany?.nameAr ?? '';
  const companyNameEn = defaultCompany?.nameEn ?? '';

  const { values } = usePageFilters([
    { key: 'q', label: 'بحث', type: 'text', placeholder: 'مرجع، اسم المُعدّل، محتوى…' },
  ]);
  const qRaw = (values.q as string) ?? '';
  const q = qRaw.trim().toLowerCase();

  const [catFilter, setCatFilter] = React.useState<CatFilter>('all');
  const [selectedActorIds, setSelectedActorIds] = React.useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [viewMode, setViewMode] = React.useState<DisciplineViewMode>('list');
  const { dateBounds, dateMeta, setDateBounds, onDateBoundsChange, onDateFilterMetaChange } = useDisciplineDateFilterState();
  const filterToolbarRef = React.useRef<ListFilterBarHandle>(null);
  const [pdfOpen, setPdfOpen] = React.useState(false);
  const [expandedSnapshots, setExpandedSnapshots] = React.useState<Set<string>>(() => new Set());

  const toggleSnapshot = React.useCallback((id: string) => {
    setExpandedSnapshots((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  React.useEffect(() => {
    setListFilters({
      q,
      catFilter,
      selectedActorIds: [...selectedActorIds],
      statusFilter,
      dateFrom: dateBounds.from,
      dateTo: dateBounds.to,
    });
  }, [q, catFilter, selectedActorIds, statusFilter, dateBounds.from, dateBounds.to, setListFilters]);

  React.useEffect(() => {
    void loadActorDirectory();
  }, [loadActorDirectory]);

  const listFiltered = filteredItems;

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: dateFilteredItems.length };
    for (const a of AUDIT_ACTION_FILTER_ORDER) counts[a] = 0;
    for (const e of dateFilteredItems) counts[e.actionType] = (counts[e.actionType] ?? 0) + 1;
    return counts;
  }, [dateFilteredItems]);

  const dateRangeActive = dateMeta.hasRestriction;
  const activeFilterCount =
    (selectedActorIds.size > 0 ? 1 : 0)
    + (statusFilter !== 'all' ? 1 : 0)
    + (catFilter !== 'all' ? 1 : 0)
    + (dateRangeActive ? 1 : 0);

  const inlineSelects = React.useMemo((): ListFilterInlineSelect[] => [
    {
      id: 'category',
      value: catFilter,
      onChange: (v) => setCatFilter(v as CatFilter),
      placeholder: 'فئة السجل',
      className: 'w-[9.5rem]',
      options: [
        { value: 'all', label: 'كل الفئات' },
        { value: 'violation_case', label: AUDIT_CATEGORY_LABELS_AR.violation_case },
        { value: 'investigation', label: AUDIT_CATEGORY_LABELS_AR.investigation },
        { value: 'appeal', label: AUDIT_CATEGORY_LABELS_AR.appeal },
      ],
    },
  ], [catFilter]);

  type AuditExportRow = {
    occurredAtDisplay: string; actorNameAr: string; categoryAr: string;
    actionAr: string; recordRefAr: string; statusAfterAr: string;
  };
  // Exports cover every entry matching the current filters (all pages), not just the visible page.
  const [pdfRows, setPdfRows] = React.useState<AuditExportRow[]>([]);
  const [exporting, setExporting] = React.useState(false);

  const fetchAllForExport = React.useCallback(async (): Promise<AuditExportRow[] | null> => {
    setExporting(true);
    try {
      const all = await fetchAllEntries();
      return all.map((e) => ({
        occurredAtDisplay: formatOccurred(e.occurredAt),
        actorNameAr: e.actorNameAr,
        categoryAr: AUDIT_CATEGORY_LABELS_AR[e.category],
        actionAr: AUDIT_ACTION_LABELS_AR[e.actionType],
        recordRefAr: e.recordRefAr,
        statusAfterAr: e.recordStatusAfterAr,
      }));
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'audit-logs.export');
      toast.error(displayMessage || 'تعذّر تحميل سجل العمليات للتصدير.');
      return null;
    } finally {
      setExporting(false);
    }
  }, [fetchAllEntries]);

  const handleExportPdf = useLatestCallback(async () => {
    if (exporting) return;
    const all = await fetchAllForExport();
    if (!all) return;
    if (all.length === 0) { toast.error('لا توجد عمليات للتصدير ضمن الفلاتر الحالية.'); return; }
    setPdfRows(all);
    setPdfOpen(true);
  });

  const handleExportExcel = useLatestCallback(async () => {
    if (exporting) return;
    const all = await fetchAllForExport();
    if (!all) return;
    if (all.length === 0) { toast.error('لا توجد عمليات للتصدير ضمن الفلاتر الحالية.'); return; }
    const rows: XlsxCell[][] = [
      ['التاريخ والوقت', 'المُعدّل', 'الفئة', 'العملية', 'المرجع', 'الحالة بعد العملية'],
      ...all.map((r) => [r.occurredAtDisplay, r.actorNameAr, r.categoryAr, r.actionAr, r.recordRefAr, r.statusAfterAr]),
    ];
    await downloadXlsxFromAoA('discipline-audit-log.xlsx', 'سجل العمليات', rows);
    toast.success('تم تنزيل ملف Excel.');
  });

  const printable = React.useMemo(
    () => pdfRows.length === 0 ? null : (
      <DisciplineAuditLogPrintHtml
        companyNameAr={companyNameAr}
        companyNameEn={companyNameEn}
        titleAr="سجل عمليات الانضباط الوظيفي"
        rows={pdfRows}
      />
    ),
    [pdfRows, companyNameAr, companyNameEn],
  );


  useEntityFilterSlot(
    () => (
      <ListFilterBar
        ref={filterToolbarRef}
        inlineSelects={inlineSelects}
        empPickerEmployees={actorPickerList}
        employeePickerLoading={actorPickerLoading}
        employeePickerRequirePermission={null}
        onEmployeePickerOpen={() => { void loadActorDirectory(); }}
        selectedEmpIds={selectedActorIds}
        onSelectedEmpIdsChange={setSelectedActorIds}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => setStatusFilter(v as StatusFilter)}
        statusOrder={AUDIT_ACTION_FILTER_ORDER}
        statusLabels={AUDIT_ACTION_LABELS_AR as unknown as Record<string, string>}
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
    [
      actorPickerList,
      actorPickerLoading,
      selectedActorIds,
      statusFilter,
      statusCounts,
      viewMode,
      inlineSelects,
      loadActorDirectory,
      onDateBoundsChange,
      onDateFilterMetaChange,
    ],
  );

  const columns = React.useMemo((): ColumnDef<AuditLogEntry>[] => [
    {
      key: 'occurredAt',
      title: 'التاريخ والوقت',
      className: 'text-xs whitespace-nowrap',
      render: (e) => <TableDateCell value={e.occurredAt} mode="datetime" />,
    },
    {
      key: 'actor',
      title: 'المُعدّل',
      className: 'text-xs font-medium max-w-[140px] truncate',
      render: (e) => <span title={e.actorNameAr}>{e.actorNameAr}</span>,
    },
    {
      key: 'category',
      title: 'الفئة',
      className: 'text-[11px]',
      render: (e) => AUDIT_CATEGORY_LABELS_AR[e.category],
    },
    {
      key: 'action',
      title: 'العملية',
      className: 'text-[11px] text-primary font-medium',
      render: (e) => AUDIT_ACTION_LABELS_AR[e.actionType],
    },
    {
      key: 'recordRef',
      title: 'المرجع',
      className: 'font-mono text-[11px]',
      render: (e) => e.recordRefAr,
    },
    {
      key: 'statusAfter',
      title: 'الحالة بعد العملية',
      className: 'text-xs text-muted-foreground max-w-[220px]',
      render: (e) => <span className=" " title={e.recordStatusAfterAr}>{e.recordStatusAfterAr}</span>,
    },
    {
      key: 'compare',
      title: 'المقارنة',
      className: 'whitespace-nowrap',
      headerClassName: 'w-[140px]',
      render: (e) => {
        const expanded = expandedSnapshots.has(e.id);
        return (
          <div className="space-y-2">
            <CompareToggle compact expanded={expanded} onToggle={() => toggleSnapshot(e.id)} />
            {expanded ? (
              <SnapshotComparisonTable previousSnapshotAr={e.previousSnapshotAr} currentSnapshotAr={e.currentSnapshotAr} />
            ) : null}
          </div>
        );
      },
    },
  ], [expandedSnapshots, toggleSnapshot]);

  const tools = useListTools<AuditLogEntry>({
    section: 'hr',
    page: 'discipline-audit-log',
    columns,
    rows: items,
    fetchAll: fetchAllEntries,
    resetKey: JSON.stringify([q, catFilter, [...selectedActorIds], statusFilter, dateBounds]),
    fields: {
      occurredAt: { kind: 'date', text: (e) => e.occurredAt, group: (e) => e.occurredAt.slice(0, 10) },
      actor: { kind: 'name', text: (e) => e.actorNameAr, group: (e) => e.actorNameAr },
      category: { text: (e) => AUDIT_CATEGORY_LABELS_AR[e.category], group: (e) => AUDIT_CATEGORY_LABELS_AR[e.category] },
      action: { text: (e) => AUDIT_ACTION_LABELS_AR[e.actionType], group: (e) => AUDIT_ACTION_LABELS_AR[e.actionType] },
      recordRef: { kind: 'code', text: (e) => e.recordRefAr },
      statusAfter: { kind: 'status', text: (e) => e.recordStatusAfterAr, group: (e) => e.recordStatusAfterAr },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        <FoldedHeaderTool>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 w-8 shrink-0" aria-label="تصدير سجل العمليات" disabled={exporting} aria-busy={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem disabled={exporting} onSelect={() => void handleExportPdf()}>
                <FileDown className="h-4 w-4" />
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exporting} onSelect={() => void handleExportExcel()}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </FoldedHeaderTool>
      </div>
    ),
    [activeFilterCount, exporting, handleExportPdf, handleExportExcel, tools.depsKey],
  );

  const renderEntryCard = (e: AuditLogEntry) => {
    const expanded = expandedSnapshots.has(e.id);
    return (
      <EntityActionCard
        key={e.id}
        reference={formatOccurred(e.occurredAt)}
        title={`المُعدّل: ${e.actorNameAr ?? '—'}`}
        subtitle={
          <>
            المرجع: <span className="font-mono text-foreground">{e.recordRefAr}</span>
            <span className="mx-1 text-border">·</span>
            <span className="font-mono text-[10px]">{e.recordId}</span>
          </>
        }
        status={{ label: AUDIT_ACTION_LABELS_AR[e.actionType], tone: 'info' }}
        chips={
          <EntityActionCardChip>{AUDIT_CATEGORY_LABELS_AR[e.category]}</EntityActionCardChip>
        }
      >
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1">حالة السجل بعد العملية</p>
          <p className="text-sm rounded-lg bg-muted/50 border border-border px-3 py-2">{e.recordStatusAfterAr}</p>
        </div>
        <CompareToggle expanded={expanded} onToggle={() => toggleSnapshot(e.id)} />
        {expanded ? (
          <SnapshotComparisonTable previousSnapshotAr={e.previousSnapshotAr} currentSnapshotAr={e.currentSnapshotAr} />
        ) : (
          <p className="text-[11px] text-muted-foreground border border-dashed border-border/70 rounded-lg px-3 py-2 bg-muted/15">
            القيم السابقة والجديدة مخفية. استخدم «عرض جدول المقارنة» لإظهارها في جدول.
          </p>
        )}
      </EntityActionCard>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PdfPreviewExportDialog open={pdfOpen} onOpenChange={setPdfOpen} title="معاينة تصدير سجل العمليات" fileName="discipline-audit-log.pdf" printable={printable} />

      <DisciplineListViewport>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-muted/30" />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{loadError}</div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground px-0.5">
            عرض فقط — سجل مرجعي للعمليات على المخالفات والتحقيقات والتظلمات. القيم التفصيلية السابقة والجديدة تظهر عند الطلب من جدول المقارنة.
          </p>

          {searchFilteredItems.length === 0 ? (
            <EmptyState title="لا توجد عمليات مطابقة للبحث أو المُعدّلين أو الفئة." />
          ) : dateFilteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-14 text-center px-4">
              <p className="text-sm text-muted-foreground">لا توجد عمليات ضمن الفترة المحددة.</p>
              {dateRangeActive ? (
                <Button variant="link" size="sm" className="mt-2 text-xs" onClick={() => setDateBounds({ from: '', to: '' })}>
                  عرض كل الفترات
                </Button>
              ) : null}
            </div>
          ) : listFiltered.length === 0 ? (
            <EmptyState title="لا توجد عمليات مطابقة لنوع العملية المحدد." />
          ) : (
            <ListToolsTable tools={tools} keyExtractor={(e) => e.id}>
            <DisciplinePaginatedList pagination={tools.pagination(pagination)}>
              {viewMode === 'cards' ? (
              <EntityActionCardGrid className="sm:grid-cols-2 lg:grid-cols-3">
                {tools.rows.map(renderEntryCard)}
              </EntityActionCardGrid>
              ) : (
              <DataTable
                variant="directory"
                alwaysShowTable
                tableClassName="min-w-[860px]"
                columns={tools.columns}
                {...tools.tableSort}
                data={tools.rows}
                keyExtractor={(e) => e.id}
              />
              )}
            </DisciplinePaginatedList>
            </ListToolsTable>
          )}
        </>
      )}
      </DisciplineListViewport>
    </div>
  );
}
