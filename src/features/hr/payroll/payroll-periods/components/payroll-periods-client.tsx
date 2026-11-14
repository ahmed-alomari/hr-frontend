'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, CalendarRange, BarChart2, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Badge } from '@/components/ui/badge';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageFilters } from '@/components/layouts/filter-panel-context';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { intervalOverlapsYmdRange } from '@/features/hr/discipline/lib/discipline-date-filter';
import { HRSettingsFormDrawer, FormField, ConfirmationModal, EmptyState } from '@/components/ui/shared-dialogs';
import { useHRPayrollPeriodsStore, PERIOD_STATUS_LABELS, PERIOD_STATUS_COLORS, PERIOD_STATUS_ORDER, REVIEW_STAGE_LABELS, REVIEW_STAGE_BADGE, REVIEW_COMPLETED_LABEL, isPayrollPeriodEditable, type HRPayrollPeriodDraft, type HRPayrollPeriodStatus } from '@/features/hr/payroll/lib/payroll-periods-store';
import { hrPayrollPeriodCompensationHref } from '@/features/hr/payroll/constants/routes';
import { DirectoryPagedViews, useServerDirectoryPagination } from '@/components/ui/paged-list';
import { fetchAllPaginatedItems } from '@/features/hr/lib/api/client';
import { payrollPeriodsApi } from '@/features/hr/payroll/lib/api/payroll-periods';
import { mapPayrollPeriodFromApi, type HRPayrollPeriodRecord } from '@/features/hr/payroll/lib/payroll-periods-store';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { ORGANIZATION_ARCHIVE_SCOPE_DEFAULT, ORGANIZATION_ARCHIVE_SCOPE_OPTIONS, payrollListArchiveQuery, type OrganizationArchiveScope } from '@/features/hr/organization/lib/archive-scope';
import { cn } from '@/shared/utils';

type StatusFilter = 'all' | HRPayrollPeriodStatus;


const EMPTY_DRAFT: HRPayrollPeriodDraft = {
  code: '', nameAr: '', nameEn: '',
  periodStart: '', periodEnd: '',
  status: 'draft',
  reviewStage: 'first_review',
  isReviewCompleted: false,
  reviewNotes: null,
  firstReviewedBy: null,
  firstReviewedAt: null,
  secondReviewedBy: null,
  secondReviewedAt: null,
  thirdReviewedBy: null,
  thirdReviewedAt: null,
  snapshotContractIds: [], employmentLines: [],
  linesMaterializedAt: null, employmentLineMonthlyInputs: {}, notes: '',
  includeOvertime: true,
  includeBonuses: true,
  includeAdvances: true,
  includeAbsence: true,
  includeLateness: true,
  includePenalties: true,
  includeManualInputs: true,
};

export function PayrollPeriodsClient() {
  const router = useRouter();
  const companyId = useDefaultCompanyId();
  const {
    add, update, remove,
    open: openPeriod, close: closePeriod,
  } = useHRPayrollPeriodsStore();

  const { values, setValue } = usePageFilters([
    {
      key: 'status', label: 'الحالة', type: 'select',
      options: PERIOD_STATUS_ORDER.map(value => ({
        value,
        label: PERIOD_STATUS_LABELS[value],
      })),
    },
  ]);

  const statusFilter = (values.status as StatusFilter) || 'all';

  const [archiveScope, setArchiveScope] = React.useState<OrganizationArchiveScope>(
    ORGANIZATION_ARCHIVE_SCOPE_DEFAULT,
  );

  const [dateBounds, setDateBounds] = React.useState({ from: '', to: '' });
  const hasDateFilter = Boolean(dateBounds.from || dateBounds.to);
  const bulkMode = hasDateFilter;

  const loadPage = React.useCallback(async (page: number, pageSize: number) => {
    if (!companyId) return { items: [] as HRPayrollPeriodRecord[], total: 0 };
    const res = await payrollPeriodsApi.list({
      companyId,
      page,
      limit: pageSize,
      ...payrollListArchiveQuery(),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    });
    let items = res.items.map(mapPayrollPeriodFromApi);
    if (hasDateFilter) {
      items = items.filter((p) =>
        intervalOverlapsYmdRange(p.periodStart, p.periodEnd, dateBounds.from, dateBounds.to),
      );
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items, total: hasDateFilter ? items.length : res.pagination.total };
  }, [companyId, dateBounds.from, dateBounds.to, hasDateFilter, statusFilter, archiveScope]);

  const loadBulk = React.useCallback(async () => {
    if (!companyId) return { items: [] as HRPayrollPeriodRecord[], total: 0 };
    const res = await fetchAllPaginatedItems((page, limit) => payrollPeriodsApi.list({
      companyId,
      page,
      limit,
      ...payrollListArchiveQuery(),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    }));
    const items = res.items
      .map(mapPayrollPeriodFromApi)
      .filter((p) => intervalOverlapsYmdRange(p.periodStart, p.periodEnd, dateBounds.from, dateBounds.to))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items, total: items.length };
  }, [companyId, dateBounds.from, dateBounds.to, statusFilter, archiveScope]);

  const {
    items: filtered,
    loading: listLoading,
    pagination,
    reload: reloadList,
  } = useServerDirectoryPagination<HRPayrollPeriodRecord>(loadPage, {
    enabled: !!companyId,
    bulkMode,
    loadBulk: bulkMode ? loadBulk : undefined,
    resetDeps: [companyId, statusFilter, archiveScope, dateBounds.from, dateBounds.to],
  });

  const onDateBoundsChange = React.useCallback((b: { from: string; to: string }) => {
    setDateBounds((prev) => (prev.from === b.from && prev.to === b.to ? prev : b));
  }, []);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerContentEl, setDrawerContentEl] = React.useState<HTMLDivElement | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<HRPayrollPeriodDraft>(EMPTY_DRAFT);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const autoFilledEndRef = React.useRef(false);

  const archiveInlineSelects = React.useMemo(
    () => [
      {
        id: 'archive',
        value: archiveScope,
        onChange: (v: string) => setArchiveScope(v as OrganizationArchiveScope),
        placeholder: 'العرض',
        options: ORGANIZATION_ARCHIVE_SCOPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      },
    ],
    [archiveScope],
  );

  const openCreate = React.useCallback(() => {
    setEditId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    autoFilledEndRef.current = false;
    setDrawerOpen(true);
  }, []);

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: pagination.total };
    for (const status of PERIOD_STATUS_ORDER) {
      counts[status] = filtered.filter((p) => p.status === status).length;
    }
    return counts;
  }, [filtered, pagination.total]);

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (dateBounds.from || dateBounds.to ? 1 : 0);

  const reviewOf = (p: HRPayrollPeriodRecord) =>
    p.isReviewCompleted ? REVIEW_COMPLETED_LABEL : REVIEW_STAGE_LABELS[p.reviewStage];
  const columns: ColumnDef<HRPayrollPeriodRecord>[] = [
    { key: 'code', title: 'الرمز', render: (p) => <span className="font-mono text-xs">{p.code || '—'}</span> },
    { key: 'name', title: 'الاسم', render: (p) => p.nameAr },
    {
      key: 'status',
      title: 'الحالة',
      render: (p) => (
        <Badge className={cn('rounded-lg border px-2 py-0.5 text-[10px] font-semibold', PERIOD_STATUS_COLORS[p.status])}>
          {PERIOD_STATUS_LABELS[p.status]}
        </Badge>
      ),
    },
    { key: 'start', title: 'من', render: (p) => <span className="font-mono text-xs">{p.periodStart || '—'}</span> },
    { key: 'end', title: 'إلى', render: (p) => <span className="font-mono text-xs">{p.periodEnd || '—'}</span> },
    { key: 'review', title: 'المراجعة', render: reviewOf },
    { key: 'actions', title: '', isActions: true, render: (p) => <PeriodActions p={p} /> },
  ];
  const tools = useListTools<HRPayrollPeriodRecord>({
    section: 'hr',
    page: 'payroll-periods',
    columns,
    rows: filtered,
    // Same status, archive and date filters as the list; handles an empty date range too.
    fetchAll: async () => (await loadBulk()).items,
    resetKey: pagination.resetKey,
    fields: {
      code: { kind: 'code', text: (p) => p.code || '—' },
      name: { text: (p) => p.nameAr },
      status: { kind: 'status', text: (p) => PERIOD_STATUS_LABELS[p.status] ?? p.status, group: (p) => PERIOD_STATUS_LABELS[p.status] ?? p.status },
      start: { kind: 'date', text: (p) => p.periodStart || '—', group: (p) => (p.periodStart ? p.periodStart.slice(0, 4) : null) },
      end: { kind: 'date', text: (p) => p.periodEnd || '—' },
      review: { kind: 'status', text: reviewOf, group: reviewOf },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        {tools.exportMenu('سجل فترات الراتب', 'payroll-periods')}
        <Button variant="luxe" size="sm" className="h-8 gap-1.5 px-3 text-xs shadow-sm shrink-0" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          فترة جديدة
        </Button>
      </div>
    ),
    [activeFilterCount, openCreate, tools.depsKey],
  );
  const openEdit   = (id: string) => {
    const p = filtered.find(x => x.id === id);
    if (!p) return;
    setEditId(id);
    setDraft({
      code: p.code, nameAr: p.nameAr, nameEn: p.nameEn,
      periodStart: p.periodStart, periodEnd: p.periodEnd,
      status: p.status,
      reviewStage: p.reviewStage,
      isReviewCompleted: p.isReviewCompleted,
      reviewNotes: p.reviewNotes,
      firstReviewedBy: p.firstReviewedBy,
      firstReviewedAt: p.firstReviewedAt,
      secondReviewedBy: p.secondReviewedBy,
      secondReviewedAt: p.secondReviewedAt,
      thirdReviewedBy: p.thirdReviewedBy,
      thirdReviewedAt: p.thirdReviewedAt,
      snapshotContractIds: p.snapshotContractIds, employmentLines: p.employmentLines,
      linesMaterializedAt: p.linesMaterializedAt, employmentLineMonthlyInputs: p.employmentLineMonthlyInputs,
      notes: p.notes,
      includeOvertime: p.includeOvertime,
      includeBonuses: p.includeBonuses,
      includeAdvances: p.includeAdvances,
      includeAbsence: p.includeAbsence,
      includeLateness: p.includeLateness,
      includePenalties: p.includePenalties,
      includeManualInputs: p.includeManualInputs,
    });
    autoFilledEndRef.current = false;
    setError(null); setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!draft.nameAr.trim()) { setError('الاسم العربي مطلوب'); return; }
    if (!draft.periodStart || !draft.periodEnd) { setError('تواريخ الفترة مطلوبة'); return; }
    if (editId) { await update(editId, draft); } else { await add(draft); }
    setDrawerOpen(false);
    await reloadList();
  };

  const set = (patch: Partial<HRPayrollPeriodDraft>) => setDraft(d => ({ ...d, ...patch }));

  const lastDayOfMonthYmd = (ymd: string) => {
    const [y, m] = ymd.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  };

  const onPeriodStartChange = (ymd: string) => {
    if (!ymd) { set({ periodStart: ymd }); return; }
    if (!draft.periodEnd || autoFilledEndRef.current) {
      autoFilledEndRef.current = true;
      set({ periodStart: ymd, periodEnd: lastDayOfMonthYmd(ymd) });
    } else {
      set({ periodStart: ymd });
    }
  };

  const onPeriodEndChange = (ymd: string) => {
    autoFilledEndRef.current = false;
    set({ periodEnd: ymd });
  };

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showEmployeePicker={false}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => setValue('status', v)}
        statusOrder={PERIOD_STATUS_ORDER}
        statusLabels={PERIOD_STATUS_LABELS}
        statusCounts={statusCounts}
        onDateBoundsChange={onDateBoundsChange}
        inlineSelects={archiveInlineSelects}
        trailingActions={undefined}
      />
    ),
    [statusFilter, archiveScope, dateBounds.from, dateBounds.to],
  );

  const PeriodActions = ({ p }: { p: HRPayrollPeriodRecord }) => (
    <div className="flex items-center gap-1 flex-wrap">
      <Link href={hrPayrollPeriodCompensationHref(p.id)}>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
          <BarChart2 className="h-3 w-3" />تقرير
        </Button>
      </Link>
      {p.status === 'draft' && <Button size="sm" variant="ghost" className="h-7 text-xs text-success hover:text-success" onClick={async () => { await openPeriod(p.id); await reloadList(); }}>فتح</Button>}
      {p.status === 'open'  && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={async () => { await closePeriod(p.id); await reloadList(); }}>إغلاق</Button>}
      {isPayrollPeriodEditable(p.status) && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(p.id)}>تعديل</Button>}
      {p.status === 'draft' && <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setConfirmId(p.id)}>حذف</Button>}
    </div>
  );

  return (
    <>
      <SetPageTitle titleAr="فترات الراتب" descriptionAr="إنشاء وإدارة فترات الرواتب الشهرية." iconName="CalendarRange" />

      {!listLoading && filtered.length === 0 && pagination.total === 0 ? (
        <EmptyState icon={CalendarRange} title="لا توجد فترات" description="أنشئ فترة راتب جديدة للبدء." />
      ) : (
        <ListToolsTable tools={tools} keyExtractor={(p) => p.id} onRowClick={(p) => router.push(hrPayrollPeriodCompensationHref(p.id))}>
        <DirectoryPagedViews items={tools.rows} serverPagination={tools.pagination(pagination)} loading={listLoading || tools.loading}>
          {(pageItems) => (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map(p => (
            <div
              key={p.id}
              className={cn(
                'rounded-xl border border-border bg-card p-5 shadow-soft space-y-3 flex flex-col cursor-pointer',
              )}
              onClick={() => router.push(hrPayrollPeriodCompensationHref(p.id))}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-muted-foreground">{p.code}</p>
                  <p className="font-semibold truncate mt-0.5">{p.nameAr}</p>
                </div>
                <Badge className={cn('shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-semibold', PERIOD_STATUS_COLORS[p.status])}>
                  {PERIOD_STATUS_LABELS[p.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
                <CalendarRange className="h-3 w-3 shrink-0" />
                <span className="font-mono">{p.periodStart}</span>
                <ChevronRight className="h-3 w-3 opacity-40" />
                <span className="font-mono">{p.periodEnd}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">حالة المراجعة</span>
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                  p.isReviewCompleted
                    ? 'bg-success/10 text-success border-success/25'
                    : REVIEW_STAGE_BADGE[p.reviewStage],
                )}>
                  {p.isReviewCompleted && <CheckCircle2 className="h-3 w-3" />}
                  {p.isReviewCompleted ? REVIEW_COMPLETED_LABEL : REVIEW_STAGE_LABELS[p.reviewStage]}
                </span>
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-end gap-1 border-t border-border pt-3" onClick={e => e.stopPropagation()}>
                <PeriodActions p={p} />
              </div>
            </div>
          ))}
        </div>
          )}
        </DirectoryPagedViews>
        </ListToolsTable>
      )}

      <HRSettingsFormDrawer
        open={drawerOpen} onOpenChange={setDrawerOpen}
        title={editId ? 'تعديل فترة الراتب' : 'فترة راتب جديدة'}
        onSave={handleSave} error={error}
        contentRef={setDrawerContentEl}
      >
        <FormField label="الاسم العربي" required>
          <Input value={draft.nameAr} onChange={e => set({ nameAr: e.target.value })} placeholder="يناير 2025" />
        </FormField>
        <FormField label="الاسم الإنجليزي">
          <Input value={draft.nameEn} onChange={e => set({ nameEn: e.target.value })} placeholder="January 2025" />
        </FormField>
        <FormField label="بداية الفترة" required>
          <DatePickerInput
            value={draft.periodStart}
            onChange={onPeriodStartChange}
            maxDate={draft.periodEnd || undefined}
            popoverContainer={drawerContentEl}
          />
        </FormField>
        <FormField label="نهاية الفترة" required>
          <DatePickerInput
            value={draft.periodEnd}
            onChange={onPeriodEndChange}
            minDate={draft.periodStart || undefined}
            popoverContainer={drawerContentEl}
          />
        </FormField>
        <FormField label="ملاحظات" span2>
          <Input value={draft.notes} onChange={e => set({ notes: e.target.value })} placeholder="ملاحظات اختيارية…" />
        </FormField>
      </HRSettingsFormDrawer>

      <ConfirmationModal
        open={!!confirmId}
        onOpenChange={v => { if (!v) setConfirmId(null); }}
        title="حذف فترة الراتب"
        description="هل أنت متأكد من حذف هذه الفترة؟ لا يمكن التراجع."
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={async () => { if (confirmId) { await remove(confirmId); setConfirmId(null); await reloadList(); } }}
      />
    </>
  );
}
