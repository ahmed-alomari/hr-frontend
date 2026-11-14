'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import { Link2, Link2Off, Plus, Search, Trash2, Pencil, Users, MapPin, CalendarDays, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormFooterClass,
} from '@/components/ui/dialog';
import type { ContractStatus } from '@/features/hr/contracts/types';
import { cn } from '@/shared/utils';
import {
  CONTRACT_STATUS_AR,
} from '@/features/hr/attendance/checkpoint-links/constants/checkpoint-links-panel';
import { useCheckpointLinksPanelModel } from '@/features/hr/attendance/checkpoint-links/hooks/useCheckpointLinksPanelModel';
import { DirectoryPagedViews } from '@/components/ui/paged-list';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { EmptyStateCard } from '@/components/shared/empty-state-card';
import { ConfirmationModal } from '@/components/ui/shared-dialogs';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import type { RegisterColumn } from '@/components/pdf/print/register-document';
import { exportDate } from '@/features/hr/attendance/lib/attendance-export-format';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import {
  employeeStatusFilterLabelAr,
  isEmployeeStatusFilterActive,
} from '@/features/hr/lib/employee-status-filter';

const CHECKPOINT_LINK_EXPORT_COLUMNS: RegisterColumn[] = [
  { label: 'نقطة التسجيل', kind: 'text' },
  { label: 'الموظف', kind: 'name' },
  { label: 'الرقم الوظيفي', kind: 'code' },
  { label: 'ساري من', kind: 'date' },
  { label: 'الحالة', kind: 'status' },
];

type LinkBatch = ReturnType<typeof useCheckpointLinksPanelModel>['batches'][number];

type CheckpointLinkRow = {
  id: string;
  employeeName: string;
  employeeCode: string;
  linkActive: boolean;
};

function CheckpointLinkEmployeeRows({
  rows,
  onUnlink,
}: {
  rows: CheckpointLinkRow[];
  onUnlink: (linkId: string, employeeName: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">لا يوجد موظفون مرتبطون</p>;
  }

  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {row.employeeName.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{row.employeeName}</p>
            <p className="font-mono text-[10px] text-muted-foreground" dir="ltr">{row.employeeCode}</p>
          </div>
          <Badge variant={row.linkActive ? 'success' : 'secondary'} className="shrink-0 text-[10px]">
            {row.linkActive ? 'نشط' : 'غير نشط'}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => onUnlink(row.id, row.employeeName)}
          >
            <Link2Off className="h-3 w-3" />
            إلغاء الربط
          </Button>
        </div>
      ))}
    </div>
  );
}

export function CheckpointLinksPanel() {
  const m = useCheckpointLinksPanelModel();
  const [viewBatchId, setViewBatchId] = React.useState<string | null>(null);

  const viewBatch = viewBatchId ? m.batches.find((b) => b.batchId === viewBatchId) : null;

  React.useEffect(() => {
    if (viewBatchId && !viewBatch) setViewBatchId(null);
  }, [viewBatchId, viewBatch]);

  React.useEffect(() => {
    if (m.editOpen && !m.editBatch) m.setEditOpen(false);
  }, [m.editOpen, m.editBatch, m.setEditOpen]);

  const handleUnlink = React.useCallback(
    (linkId: string, employeeName: string) => {
      m.requestUnlink(linkId, employeeName);
    },
    [m],
  );

  const { loadAllForExport, employeeStatus, setEmployeeStatus } = m;
  const getExportRows = useLatestCallback(
    async () =>
      (await loadAllForExport()).flatMap((batch) =>
        batch.rows.map((row) => [
          batch.checkInPointName,
          row.employeeName,
          row.employeeCode || '—',
          exportDate(row.effectiveFrom),
          row.linkActive ? 'نشط' : 'غير نشط',
        ]),
      ),
  );
  const openBatchDialog = useLatestCallback(m.openBatchDialog);
  const activeOf = (b: LinkBatch) => b.rows.filter((row) => row.linkActive).length;
  const batchColumns: ColumnDef<LinkBatch>[] = [
    { key: 'checkpoint', title: 'نقطة التسجيل', render: (b) => b.checkInPointName },
    { key: 'total', title: 'الموظفون', render: (b) => String(b.rows.length) },
    { key: 'active', title: 'النشطون', render: (b) => String(activeOf(b)) },
  ];
  const tools = useListTools<LinkBatch>({
    section: 'attendance',
    page: 'checkpoint-links',
    columns: batchColumns,
    rows: m.batches,
    fetchAll: loadAllForExport,
    resetKey: m.pagination.resetKey,
    fields: {
      checkpoint: { kind: 'name', text: (b) => b.checkInPointName },
      total: { text: (b) => String(b.rows.length), sort: (b) => b.rows.length, sum: (b) => b.rows.length },
      active: { text: (b) => String(activeOf(b)), sort: activeOf, sum: activeOf },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={isEmployeeStatusFilterActive(employeeStatus) ? 1 : 0} />
        {tools.buttons}
        <RegisterExportMenu
          title="ربط نقاط التسجيل بالموظفين"
          fileName="checkpoint-links"
          columns={CHECKPOINT_LINK_EXPORT_COLUMNS}
          getRows={getExportRows}
          subtitleLines={[`حالة الموظفين: ${employeeStatusFilterLabelAr(employeeStatus)}`]}
        />
        <Button variant="luxe" size="sm" className="h-8 gap-1.5 px-3 text-xs" type="button" onClick={openBatchDialog}>
          <Plus className="h-3.5 w-3.5" /> ربط نقاط بموظفين
        </Button>
      </div>
    ),
    [employeeStatus, getExportRows, openBatchDialog, tools.depsKey],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        employeeStatus={employeeStatus}
        onEmployeeStatusChange={setEmployeeStatus}
      />
    ),
    [employeeStatus],
  );

  if (m.accessDenied) {
    return <ForbiddenState title="لا تملك صلاحية الوصول لربط نقاط التحقق" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">

      {/* ── Empty state ── */}
      {m.listError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{m.listError}</p>
      ) : null}

      {m.loading && m.batches.length === 0 ? null : m.batches.length === 0 && !m.loading ? (
        <EmptyStateCard
          icon={Link2}
          title="لا توجد دفعات ربط بعد"
          description='اضغط «ربط نقاط بموظفين» لإنشاء أول دفعة'
        >
          <Button variant="outline" size="sm" className="gap-1.5" type="button" onClick={m.openBatchDialog}>
            <Plus className="h-3.5 w-3.5" /> إنشاء دفعة
          </Button>
        </EmptyStateCard>
      ) : (
        <ListToolsTable tools={tools} keyExtractor={(b) => b.batchId} onRowClick={(b) => setViewBatchId(b.batchId)}>
        <DirectoryPagedViews items={tools.rows} serverPagination={tools.pagination(m.pagination)} loading={m.loading || tools.loading}>
          {(pageItems) => (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((batch) => {
            const visibleEmps = batch.rows.slice(0, 3);
            const overflow = batch.rows.length - visibleEmps.length;
            return (
              <div
                key={batch.batchId}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated"
                onClick={() => setViewBatchId(batch.batchId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setViewBatchId(batch.batchId)}
              >
                {/* coloured accent strip */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

                <div className="p-5">
                  {/* top row */}
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="subtle" className="gap-1 text-[10px]">
                        <Users className="h-3 w-3" />
                        <span className="number-ar">{batch.activeLinks}</span>/<span className="number-ar">{batch.totalLinks}</span>
                      </Badge>
                    </div>
                  </div>

                  {/* checkpoint name */}
                  <h3 className="mb-1 truncate font-display text-base font-bold leading-snug transition-colors group-hover:text-primary">
                    {batch.checkInPointName}
                  </h3>

                  {/* employee avatars */}
                  <div className="mb-3 flex items-center" style={{ gap: 0 }}>
                    {visibleEmps.map((row, i) => (
                      <div
                        key={row.id}
                        title={row.employeeName}
                        className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-primary/10 text-[10px] font-bold text-primary"
                        style={{ marginRight: i > 0 ? '-8px' : undefined, zIndex: 3 - i }}
                      >
                        {row.employeeName.slice(0, 1)}
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div
                        className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-bold text-muted-foreground"
                        style={{ marginRight: '-8px', zIndex: 0 }}
                      >
                        +{overflow}
                      </div>
                    )}
                  </div>

                  {/* effective date + actions */}
                  <div
                    className="flex items-center justify-between border-t border-border/60 pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span className="font-mono tabular-nums" dir="ltr">{batch.eff ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => m.openEditDialog(batch.batchId)}
                      >
                        <Pencil className="h-3 w-3" /> تعديل
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => m.setDeleteTarget(batch.batchId)}
                      >
                        <Trash2 className="h-3 w-3" /> حذف
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
          )}
        </DirectoryPagedViews>
        </ListToolsTable>
      )}

      {/* ── Detail dialog ── */}
      <Dialog open={!!viewBatch} onOpenChange={(o) => !o && setViewBatchId(null)}>
        <DialogContent className="max-w-lg border-border" dir="rtl">
          {viewBatch && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="font-display text-lg">{viewBatch.checkInPointName}</DialogTitle>
                    <DialogDescription className="flex items-center gap-1 text-xs">
                      <CalendarDays className="h-3 w-3" />
                      <span dir="ltr">{viewBatch.eff ?? '—'}</span>
                      <span className="mx-1">·</span>
                      <span>{viewBatch.activeLinks} نشط من {viewBatch.totalLinks}</span>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="max-h-[60vh] overflow-y-auto py-2">
                <CheckpointLinkEmployeeRows rows={viewBatch.rows} onUnlink={handleUnlink} />
              </div>

              <DialogFooter>
                <Button variant="luxe" onClick={() => { setViewBatchId(null); m.openEditDialog(viewBatch.batchId); }}>
                  <Pencil className="h-4 w-4" /> تعديل
                </Button>
                <Button variant="outline" onClick={() => setViewBatchId(null)}>إغلاق</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create batch dialog ── */}
      <Dialog open={m.open} onOpenChange={m.setOpen}>
        <DialogContent className="flex max-h-[80vh] h-[80vh] flex-col gap-0 overflow-visible border-border p-0 sm:max-w-5xl">
          {/* dialog header */}
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-display text-lg">ربط نقاط بموظفين</DialogTitle>
                <DialogDescription className="text-xs">
                  اختر الموظفين ونقاط التسجيل لإنشاء روابط الحضور دفعةً واحدة
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* body */}
          <div className="flex flex-1 flex-col gap-0 overflow-hidden">
            {/* two-column selector */}
            <div className="grid flex-1 grid-cols-2 divide-x divide-x-reverse divide-border overflow-hidden">

              {/* ── Employees column ── */}
              <div className="flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-primary/5 px-4 py-2.5">
                  <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">الموظفون</span>
                    {m.empSel.size > 0 && (
                      <Badge variant="subtle" className="number-ar text-[10px]">{m.empSel.size} محدد</Badge>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => {
                      const allIds = new Set(m.employeesFiltered.slice(0, 120).map((e) => e.id));
                      const allSelected = [...allIds].every((id) => m.empSel.has(id));
                      m.setEmpSel(allSelected ? new Set() : allIds);
                    }}
                  >
                    {[...m.employeesFiltered.slice(0, 120).map((e) => e.id)].every((id) => m.empSel.has(id)) ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                </div>

                {/* search */}
                <div className="border-b border-border px-3 py-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={m.eq}
                      onChange={(e) => m.setEq(e.target.value)}
                      placeholder="بحث بالاسم أو الرقم…"
                      className="h-8 bg-background pr-8 text-xs"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {m.employeesFiltered.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">لا يوجد موظف مطابق</p>
                  ) : (
                    m.employeesFiltered.slice(0, 120).map((e) => {
                      const st  = e.contractStatus as ContractStatus;
                      const sel = m.empSel.has(e.id);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => m.toggle(m.setEmpSel, e.id)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-right text-xs transition-colors',
                            sel ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50',
                          )}
                        >
                          <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all', sel ? 'border-primary bg-primary' : 'border-border')}>
                            {sel && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                            {e.avatar
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={e.avatar} alt={e.nameAr} className="h-full w-full object-cover" />
                              : <span className="text-[10px] font-bold">{e.nameAr.slice(0, 1)}</span>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{e.nameAr}</p>
                            <p className="font-mono text-[10px] text-muted-foreground" dir="ltr">{e.employeeCode}</p>
                          </div>
                          <Badge variant={st === 'active' ? 'success' : st === 'suspended' ? 'warning' : 'secondary'} className="shrink-0 px-1.5 py-0 text-[9px]">
                            {CONTRACT_STATUS_AR[st]?.split(' ')[0] ?? st}
                          </Badge>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ── Checkpoints column ── */}
              <div className="flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-warning/5 px-4 py-2.5">
                  <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-warning" />
                    <span className="text-sm font-semibold">نقاط التسجيل</span>
                    {m.cpSel.size > 0 && (
                      <Badge variant="subtle" className="number-ar text-[10px]">{m.cpSel.size} محدد</Badge>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-[11px] text-warning hover:underline"
                    onClick={() => {
                      const allIds = new Set(m.cps.map((c) => c.id));
                      const allSelected = [...allIds].every((id) => m.cpSel.has(id));
                      m.setCpSel(allSelected ? new Set() : allIds);
                    }}
                  >
                    {m.cps.every((c) => m.cpSel.has(c.id)) ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                </div>

                <div className="border-b border-border px-3 py-2.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={m.cq}
                      onChange={(e) => m.setCq(e.target.value)}
                      placeholder="اسم النقطة أو الإحداثيات…"
                      className="h-8 bg-background pr-8 text-xs"
                      aria-label="بحث في قائمة نقاط التسجيل"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {m.cps.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">لا توجد نقطة مطابقة</p>
                  ) : (
                    m.cps.map((c) => {
                      const sel = m.cpSel.has(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => m.toggle(m.setCpSel, c.id)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-right text-xs transition-colors',
                            sel ? 'bg-warning/10 text-warning' : 'hover:bg-muted/50',
                          )}
                        >
                          <div className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all',
                            sel ? 'border-warning bg-warning' : 'border-border',
                          )}>
                            {sel && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                            sel ? 'bg-warning/20' : 'bg-muted',
                          )}>
                            <MapPin className={cn('h-4 w-4', sel ? 'text-warning' : 'text-muted-foreground')} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{c.nameAr}</p>
                            <p className="font-mono text-[10px] text-muted-foreground" dir="ltr">
                              {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

            </div>{/* end two-column grid */}
          </div>{/* end body */}

          {/* ── Footer ── */}
          <div className="flex items-center justify-between gap-4 border-t border-border bg-muted/20 px-6 py-3">
            {/* actions — right side (RTL: rendered first) */}
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="luxe"
                type="button"
                onClick={m.submit}
                disabled={m.empSel.size === 0 || m.cpSel.size === 0}
              >
                <Link2 className="h-4 w-4" /> إنشاء الدفعة
              </Button>
              <Button variant="outline" type="button" onClick={() => m.setOpen(false)}>إلغاء</Button>
            </div>

            {/* ساري من + summary — left side */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Label className="shrink-0 text-sm text-muted-foreground">ساري من</Label>
                <div className="w-52">
                  <DatePickerInput value={m.eff} onChange={m.setEff} />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit batch dialog ── */}
      <Dialog open={m.editOpen} onOpenChange={m.setEditOpen}>
        <DialogContent className="max-w-lg border-border" dir="rtl">
          {m.editBatch && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="font-display text-lg">تعديل الربط — {m.editBatch.checkInPointName}</DialogTitle>
                    <DialogDescription className="text-xs">
                      عدّل تاريخ السريان والحالة، أو ألغِ ربط موظفين من هذه النقطة.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    ساري من
                  </Label>
                  <DatePickerInput value={m.editEff} onChange={m.setEditEff} />
                </div>

                <label className="flex cursor-pointer items-center justify-between rounded-xl border-2 px-4 py-3 transition-all border-border hover:bg-muted/20">
                  <span className="text-sm font-medium">الروابط مفعّلة</span>
                  <Checkbox
                    checked={m.editLinkActive}
                    onCheckedChange={(v) => m.setEditLinkActive(v === true)}
                  />
                </label>

                <div className="space-y-2">
                  <Label className="text-sm">الموظفون المرتبطون</Label>
                  <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-border/60 p-2">
                    <CheckpointLinkEmployeeRows rows={m.editBatch.rows} onUnlink={handleUnlink} />
                  </div>
                </div>
              </div>

              <DialogFooter className={dialogFormFooterClass}>
                <Button
                  variant="luxe"
                  type="button"
                  onClick={() => void m.submitEdit()}
                  disabled={!m.editBatch.rows.length}
                >
                  حفظ التعديلات
                </Button>
                <Button variant="outline" type="button" onClick={() => m.setEditOpen(false)}>إلغاء</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={!!m.unlinkTarget}
        onOpenChange={(open) => { if (!open && !m.unlinking) m.setUnlinkTarget(null); }}
        title="إلغاء ربط الموظف"
        description={
          m.unlinkTarget
            ? `هل أنت متأكد من إلغاء ربط «${m.unlinkTarget.employeeName}» بهذه النقطة؟ لا يمكن التراجع عن هذا الإجراء.`
            : ''
        }
        confirmLabel={m.unlinking ? 'جاري الإلغاء…' : 'إلغاء الربط'}
        variant="destructive"
        onConfirm={() => void m.confirmUnlink()}
      />

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={!!m.deleteTarget} onOpenChange={(o) => !o && m.setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> حذف دفعة الربط
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              هل أنت متأكد من حذف كل عناصر هذه الدفعة؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              variant="destructive"
              onClick={() => {
                if (m.deleteTarget) {
                  m.removeCheckpointLinkBatch(m.deleteTarget);
                  m.setDeleteTarget(null);
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> حذف
            </Button>
            <Button variant="outline" onClick={() => m.setDeleteTarget(null)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
