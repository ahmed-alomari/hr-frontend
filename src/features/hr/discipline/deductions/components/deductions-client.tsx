'use client';

import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import { Send } from 'lucide-react';
import {
  EntityActionCard,
  EntityActionCardChip,
  EntityActionCardGrid,
  EntityActionCardMetric,
  EntityActionCardMetricDivider,
  EntityActionCardMetricsRow,
  type WorkflowStatusTone,
} from '@/components/ui/entity-action-card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  EmptyState,
} from '@/components/ui/shared-dialogs';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { useDisciplinePayrollDeductionsDirectoryModel } from '@/features/hr/discipline/deductions/hooks/useDisciplinePayrollDeductionsDirectoryModel';
import {
  DEDUCTION_KIND_LABELS,
  DEDUCTION_STATUS_LABELS,
} from '@/features/hr/discipline/lib/types';
import type { HRDeductionStatus, HRViolationDeductionKind } from '@/features/hr/discipline/lib/types';
import { useDisciplineDateFilterState } from '@/features/hr/discipline/lib/use-discipline-date-filter-state';
import { cn, formatNumber } from '@/shared/utils';
import { STATUS_PILL } from '@/shared/status-pill-classes';
import {
  DisciplineFilterToolbar,
  type DisciplineFilterToolbarHandle,
  type DisciplineViewMode,
} from '@/features/hr/discipline/components/discipline-filter-toolbar';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { toast } from 'sonner';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { TableDateCell, TableRowActions, TableRowDetailDialog } from '@/components/ui/table-cells';
import { DisciplineListViewport, DisciplinePaginatedList } from '@/features/hr/discipline/components/discipline-paginated-list';
import type { HRDisciplinePayrollDeductionRecord } from '@/features/hr/discipline/lib/types';
import { RelatedEmployeeAttachments } from '@/features/hr/organization/employees/components/related-employee-attachments';
import { useDefaultCompany } from '@/features/hr/organization/hooks/useActiveCompany';
import { PdfPreviewExportDialog } from '@/components/pdf/pdf-preview-export-dialog';
import { PdfPreviewDownloadButton } from '@/components/pdf/pdf-preview-download-button';
import { DisciplineLetterPrintHtml } from '@/components/pdf/print/discipline-letter-print-html';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import type { RegisterColumn } from '@/components/pdf/print/register-document';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';

const DEDUCTION_STATUS_ORDER: readonly HRDeductionStatus[] = ['ready', 'posted', 'calculated', 'cancelled'];

const DEDUCTION_EXPORT_COLUMNS: RegisterColumn[] = [
  { label: 'القضية', kind: 'code' },
  { label: 'الموظف', kind: 'name' },
  { label: 'النوع', kind: 'text' },
  { label: 'الشهر', kind: 'date' },
  { label: 'الحالة', kind: 'status' },
  { label: 'المبلغ', kind: 'number', weight: 1.3 },
];

type KindFilter = 'all' | Exclude<HRViolationDeductionKind, 'none'>;

const KIND_FILTER_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'كل أنواع الاستقطاع' },
  ...(Object.entries(DEDUCTION_KIND_LABELS) as [HRViolationDeductionKind, string][])
    .filter(([k]) => k !== 'none')
    .map(([value, label]) => ({ value: value as Exclude<HRViolationDeductionKind, 'none'>, label })),
];

const STATUS_COLORS: Record<HRDeductionStatus, string> = {
  ready: STATUS_PILL.info,
  posted: STATUS_PILL.approved,
  calculated: STATUS_PILL.calculated,
  cancelled: STATUS_PILL.cancelled,
};

const DEDUCTION_STATUS_TONE: Record<HRDeductionStatus, WorkflowStatusTone> = {
  ready: 'info',
  posted: 'approved',
  calculated: 'warning',
  cancelled: 'muted',
};

export function DeductionsClient() {
  const m = useDisciplinePayrollDeductionsDirectoryModel();
  const { setListFilters, items, pagination, filteredItems, dateFilteredItems, sourceDeductions } = m;

  const [selectedEmpIds, setSelectedEmpIds] = React.useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = React.useState<DisciplineViewMode>('cards');
  const [statusFilter, setStatusFilter] = React.useState<'all' | HRDeductionStatus>('all');
  const [kindFilter, setKindFilter] = React.useState<KindFilter>('all');
  const { dateBounds, dateMeta, onDateBoundsChange, onDateFilterMetaChange } = useDisciplineDateFilterState();
  const filterToolbarRef = React.useRef<DisciplineFilterToolbarHandle>(null);
  const [detailRow, setDetailRow] = React.useState<HRDisciplinePayrollDeductionRecord | null>(null);
  const [letterOpen, setLetterOpen] = React.useState(false);
  const { data: defaultCompany } = useDefaultCompany();
  const companyNameAr = defaultCompany?.nameAr ?? '';
  const companyNameEn = defaultCompany?.nameEn ?? '';

  React.useEffect(() => {
    setListFilters({
      selectedEmpIds: [...selectedEmpIds],
      statusFilter,
      kindFilter,
      dateFrom: dateBounds.from,
      dateTo: dateBounds.to,
    });
  }, [selectedEmpIds, statusFilter, kindFilter, dateBounds.from, dateBounds.to, setListFilters]);

  const selectedEmpKey = React.useMemo(() => [...selectedEmpIds].sort().join(','), [selectedEmpIds]);

  const dateFiltered = dateFilteredItems;
  const listFiltered = filteredItems;

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: dateFiltered.length };
    for (const s of DEDUCTION_STATUS_ORDER) counts[s] = 0;
    for (const d of dateFiltered) counts[d.status] = (counts[d.status] ?? 0) + 1;
    return counts;
  }, [dateFiltered]);

  const dateRangeActive = dateMeta.hasRestriction;

  const letterPrintable = React.useMemo(
    () =>
      detailRow ? (
        <DisciplineLetterPrintHtml
          companyNameAr={companyNameAr}
          companyNameEn={companyNameEn}
          titleAr={`استقطاع ${detailRow.caseNumber}`}
          rows={[
            { label: 'القضية', value: detailRow.caseNumber },
            { label: 'الموظف', value: detailRow.employeeNameAr },
            { label: 'النوع', value: DEDUCTION_KIND_LABELS[detailRow.deductionKind] },
            { label: 'الشهر', value: detailRow.month },
            { label: 'الحالة', value: DEDUCTION_STATUS_LABELS[detailRow.status] },
            { label: 'المبلغ', value: formatNumber(detailRow.amount) },
          ]}
          bodyAr={detailRow.reasonAr?.trim() || undefined}
        />
      ) : null,
    [detailRow, companyNameAr, companyNameEn],
  );

  const activeFilterCount = (selectedEmpIds.size > 0 ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (kindFilter !== 'all' ? 1 : 0) + (dateMeta.hasRestriction ? 1 : 0);

  const { loadAllForExport } = m;
  const getExportRows = useLatestCallback(
    async () =>
      (await loadAllForExport()).map((d) => [
        d.caseNumber,
        d.employeeNameAr,
        DEDUCTION_KIND_LABELS[d.deductionKind],
        d.month,
        DEDUCTION_STATUS_LABELS[d.status],
        formatNumber(d.amount),
      ]),
  );


  const handleSendToPayroll = React.useCallback(
    async (id: string) => {
      try {
        await m.sendToPayroll(id);
        toast.success('تم إرسال الاستقطاع إلى الرواتب');
      } catch (err) {
        const { displayMessage } = handleApiError(err, 'discipline-payroll-deductions.send');
        toast.error(displayMessage);
      }
    },
    [m],
  );

  const columns = React.useMemo((): ColumnDef<HRDisciplinePayrollDeductionRecord>[] => [
    {
      key: 'caseNumber',
      title: 'القضية',
      className: 'font-mono text-xs text-muted-foreground',
      render: (d) => d.caseNumber,
    },
    {
      key: 'employee',
      title: 'الموظف',
      className: 'font-medium',
      render: (d) => d.employeeNameAr,
    },
    {
      key: 'kind',
      title: 'النوع',
      className: 'text-muted-foreground',
      render: (d) => DEDUCTION_KIND_LABELS[d.deductionKind],
    },
    {
      key: 'month',
      title: 'الشهر',
      className: 'font-mono text-xs',
      render: (d) => d.month,
    },
    {
      key: 'status',
      title: 'الحالة',
      render: (d) => (
        <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium', STATUS_COLORS[d.status])}>
          {DEDUCTION_STATUS_LABELS[d.status]}
        </span>
      ),
    },
    {
      key: 'amount',
      title: 'المبلغ',
      className: 'font-semibold tabular-nums',
      render: (d) => formatNumber(d.amount),
    },
    {
      key: 'actions',
      title: 'إجراءات',
      isActions: true,
      render: (d) => (
        d.status === 'ready' ? (
          <TableRowActions
            primaryActions={[
              {
                label: 'إرسال للرواتب',
                variant: 'primary',
                icon: <Send className="h-3.5 w-3.5" />,
                onClick: () => void handleSendToPayroll(d.id),
              },
            ]}
          />
        ) : null
      ),
    },
  ], [handleSendToPayroll]);

  const tools = useListTools<HRDisciplinePayrollDeductionRecord>({
    section: 'hr',
    page: 'discipline-deductions',
    columns,
    rows: items,
    fetchAll: loadAllForExport,
    resetKey: JSON.stringify([[...selectedEmpIds], statusFilter, kindFilter, dateBounds]),
    fields: {
      caseNumber: { kind: 'code', text: (d) => d.caseNumber },
      employee: { kind: 'name', text: (d) => d.employeeNameAr, group: (d) => d.employeeNameAr },
      kind: { text: (d) => DEDUCTION_KIND_LABELS[d.deductionKind], group: (d) => DEDUCTION_KIND_LABELS[d.deductionKind] },
      month: { kind: 'date', text: (d) => d.month, group: (d) => d.month },
      status: { kind: 'status', text: (d) => DEDUCTION_STATUS_LABELS[d.status], group: (d) => DEDUCTION_STATUS_LABELS[d.status] },
      amount: { kind: 'number', text: (d) => formatNumber(d.amount), sort: (d) => d.amount, sum: (d) => d.amount, formatSum: formatNumber },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        <RegisterExportMenu
          title="سجل الاستقطاعات"
          fileName="discipline-deductions"
          columns={DEDUCTION_EXPORT_COLUMNS}
          getRows={getExportRows}
        />
      </div>
    ),
    [activeFilterCount, getExportRows, tools.depsKey],
  );

  const kindSelect = (
    <div className="flex min-w-0 items-center gap-2">
      <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as KindFilter)}>
        <SelectTrigger id="deduction-kind-filter" className="h-8 max-w-56 text-xs" dir="rtl">
          <SelectValue placeholder="النوع" />
        </SelectTrigger>
        <SelectContent>
          {KIND_FILTER_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  useEntityFilterSlot(
    () => (
      <DisciplineFilterToolbar
        ref={filterToolbarRef}
        showPrimaryAction={false}
        primaryActionLabel=""
        onPrimaryAction={() => {}}
        beforeEmployeePicker={kindSelect}
        companyId={m.companyId}
        selectedEmpIds={selectedEmpIds}
        onSelectedEmpIdsChange={setSelectedEmpIds}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => setStatusFilter(v as 'all' | HRDeductionStatus)}
        statusOrder={DEDUCTION_STATUS_ORDER}
        statusLabels={DEDUCTION_STATUS_LABELS as unknown as Record<string, string>}
        statusCounts={statusCounts}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onDateBoundsChange={onDateBoundsChange}
        onDateFilterMetaChange={onDateFilterMetaChange}
      />
    ),
    [
      m.companyId,
      selectedEmpKey,
      statusFilter,
      kindFilter,
      statusCounts,
      viewMode,
      dateFiltered.length,
      onDateBoundsChange,
      onDateFilterMetaChange,
    ],
  );

  if (m.accessDenied) {
    return <ForbiddenState title="لا تملك صلاحية الوصول لاستقطاعات الرواتب" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PdfPreviewExportDialog
        open={letterOpen}
        onOpenChange={setLetterOpen}
        title="معاينة الاستقطاع"
        fileName={detailRow ? `deduction-${detailRow.caseNumber}.pdf` : 'deduction.pdf'}
        printable={letterPrintable}
      />
      {m.listError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive whitespace-pre-wrap">
          {m.listError}
        </p>
      ) : null}

      <DisciplineListViewport>
      {m.loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">جاري التحميل...</p>
      ) : (
        <>
          {sourceDeductions.length === 0 ? (
            <EmptyState title="لا توجد استقطاعات" />
          ) : dateFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-14 text-center px-4">
              <p className="text-sm text-muted-foreground">
                {dateMeta.tab === 'today'
                  ? 'لا توجد استقطاعات بتاريخ التسجيل ضمن اليوم ضمن النتائج الحالية.'
                  : dateMeta.tab === 'week'
                    ? 'لا توجد استقطاعات ضمن هذا الأسبوع ضمن النتائج الحالية.'
                    : dateMeta.tab === 'month'
                      ? 'لا توجد استقطاعات ضمن هذا الشهر ضمن النتائج الحالية.'
                      : dateMeta.tab === 'custom' && dateRangeActive
                        ? 'لا توجد استقطاعات ضمن نطاق التاريخ المخصص مع عوامل التصفية الحالية.'
                        : 'لا توجد استقطاعات ضمن الفترة المحددة.'}
              </p>
              {dateRangeActive ? (
                <Button variant="link" size="sm" className="mt-2 text-xs" onClick={() => filterToolbarRef.current?.resetDateFilter()}>
                  عرض كل الفترات
                </Button>
              ) : null}
            </div>
          ) : listFiltered.length === 0 ? (
            <EmptyState title="لا توجد استقطاعات مطابقة للفلاتر المحددة." />
          ) : (
            <ListToolsTable tools={tools} keyExtractor={(d) => d.id} onRowClick={(d) => setDetailRow(d)}>
            <DisciplinePaginatedList pagination={tools.pagination(pagination)}>
              {viewMode === 'list' ? (
              <DataTable
                variant="directory"
                alwaysShowTable
                tableClassName="min-w-[640px]"
                columns={tools.columns}
                {...tools.tableSort}
                data={tools.rows}
                keyExtractor={(d) => d.id}
                onRowClick={(d) => setDetailRow(d)}
              />
              ) : (
              <EntityActionCardGrid>
                {tools.rows.map((d) => (
                <EntityActionCard
                  key={d.id}
                  reference={d.caseNumber}
                  title={d.employeeNameAr ?? '—'}
                  status={{
                    label: DEDUCTION_STATUS_LABELS[d.status],
                    tone: DEDUCTION_STATUS_TONE[d.status],
                  }}
                  description={d.reasonAr}
                  chips={
                    <>
                      <EntityActionCardChip>{DEDUCTION_KIND_LABELS[d.deductionKind]}</EntityActionCardChip>
                      <EntityActionCardChip className="font-mono tabular-nums">{d.month}</EntityActionCardChip>
                    </>
                  }
                  metrics={
                    <EntityActionCardMetricsRow>
                      <EntityActionCardMetric label="المبلغ" value={formatNumber(d.amount)} />
                      <EntityActionCardMetricDivider />
                      <EntityActionCardMetric label="الشهر" value={d.month} dir="ltr" />
                    </EntityActionCardMetricsRow>
                  }
                  onClick={() => setDetailRow(d)}
                  extraFooter={
                    d.status === 'ready' ? (
                      <Button size="sm" variant="outline" className="h-7 w-full text-[11px]" onClick={() => handleSendToPayroll(d.id)}>
                        <Send className="h-3.5 w-3.5 me-1" />
                        إرسال للرواتب
                      </Button>
                    ) : undefined
                  }
                />
                ))}
              </EntityActionCardGrid>
              )}
            </DisciplinePaginatedList>
            </ListToolsTable>
          )}
        </>
      )}
      </DisciplineListViewport>

      <TableRowDetailDialog
        open={detailRow != null}
        onOpenChange={(o) => !o && setDetailRow(null)}
        title="تفاصيل الاستقطاع"
        fields={detailRow ? [
          { label: 'القضية', value: detailRow.caseNumber },
          { label: 'الموظف', value: detailRow.employeeNameAr },
          { label: 'النوع', value: DEDUCTION_KIND_LABELS[detailRow.deductionKind] },
          { label: 'الشهر', value: detailRow.month },
          { label: 'الحالة', value: DEDUCTION_STATUS_LABELS[detailRow.status] },
          { label: 'المبلغ', value: formatNumber(detailRow.amount) },
          { label: 'السبب', value: detailRow.reasonAr || '—' },
          { label: 'تاريخ التسجيل', value: <TableDateCell value={detailRow.createdAt} mode="datetime" /> },
          { label: 'آخر تحديث', value: <TableDateCell value={detailRow.updatedAt} mode="datetime" /> },
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
            companyId={m.companyId}
            preset="discipline"
          />
        ) : null}
      </TableRowDetailDialog>
    </div>
  );
}
