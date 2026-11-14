'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import { Plus, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/utils';
import { themeAvatarClassFromKey } from '@/shared/theme-avatar-palette';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, dialogFormFooterClass } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { fetchAllPaginatedItems } from '@/features/hr/lib/api/client';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { leaveBalancesApi, type EmployeeLeaveBalanceGroupDto, type EmployeeLeaveBalanceTypeItemDto, type CreateLeaveBalanceDto } from '@/features/hr/leaves/lib/api/leave-balances';
import type { LeaveTypeResponseDto } from '@/features/hr/leaves/leave-types/lib/api/leave-types';
import { loadCompanyLeaveTypes, resolveDefaultLeaveTypeId } from '@/features/hr/leaves/lib/leave-types-utils';
import { DirectoryPagedViews, useServerDirectoryPagination } from '@/components/ui/paged-list';
import { employeesApi, type EmployeeResponseDto } from '@/features/hr/organization/employees/lib/api/employees';

// ─── helpers ──────────────────────────────────────────────────────────────────

function pct(used: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.round((used / total) * 100), 100);
}

function BalanceBar({ used, total, color }: { used: number; total: number; color: string }) {
  const p = pct(used, total);
  const danger = p >= 90;
  const warn = p >= 70;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', danger ? 'bg-destructive' : warn ? 'bg-warning' : color)}
          style={{ width: `${p}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground" dir="ltr">
        {used}/{total}
      </span>
    </div>
  );
}

// ─── Create / Edit dialog ─────────────────────────────────────────────────────

type DialogMode = { mode: 'create'; employeeId?: string };

function BalanceFormDialog({
  open,
  dialogMode,
  employees,
  leaveTypes,
  defaultLeaveTypeId,
  companyId,
  onClose,
  onSaved,
}: {
  open: boolean;
  dialogMode: DialogMode;
  employees: EmployeeResponseDto[];
  leaveTypes: LeaveTypeResponseDto[];
  defaultLeaveTypeId: string | null;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [employeeId, setEmployeeId] = React.useState('');
  const [leaveTypeId, setLeaveTypeId] = React.useState('');
  const [totalDays, setTotalDays] = React.useState('');
  const [usedDays, setUsedDays] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setEmployeeId(dialogMode.employeeId ?? '');
    setLeaveTypeId(defaultLeaveTypeId ?? '');
    setTotalDays('');
    setUsedDays('0');
  }, [open, dialogMode, defaultLeaveTypeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = Number(totalDays);
    const used = Number(usedDays);
    if (!employeeId || !leaveTypeId || isNaN(total) || total < 0) {
      toast.error('يرجى تعبئة جميع الحقول بشكل صحيح');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateLeaveBalanceDto = { companyId, employeeId, leaveTypeId, totalDays: total, usedDays: used };
      await leaveBalancesApi.create(payload);
      toast.success('تم إنشاء الرصيد');
      onSaved();
      onClose();
    } catch { toast.error('حدث خطأ أثناء الحفظ'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md border-border">
        <DialogHeader>
          <DialogTitle className="text-right font-display text-base">
            إضافة رصيد إجازة
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* Employee */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">الموظف</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="اختر موظفاً..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.nameAr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Leave type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">نوع الإجازة</Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="اختر نوع الإجازة..." />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((lt) => (
                  <SelectItem key={lt.id} value={lt.id}>{lt.nameAr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">إجمالي الأيام</Label>
              <Input
                type="number"
                min="0"
                value={totalDays}
                onChange={(e) => setTotalDays(e.target.value)}
                className="h-9 text-sm"
                placeholder="21"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">أيام مستخدمة</Label>
              <Input
                type="number"
                min="0"
                value={usedDays}
                onChange={(e) => setUsedDays(e.target.value)}
                className="h-9 text-sm"
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter className={dialogFormFooterClass}>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              إنشاء الرصيد
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Employee group card ───────────────────────────────────────────────────────

function LeaveTypeRow({
  leaveType,
}: {
  leaveType: EmployeeLeaveBalanceTypeItemDto;
}) {
  const p = pct(leaveType.usedDays, leaveType.totalDays);
  const danger = p >= 90;
  const warn = p >= 70;

  return (
    <div className="border-t border-border/50 px-3.5 py-2.5 first:border-t-0">
      <div className="mb-2">
        <p className="truncate text-xs font-medium text-foreground">{leaveType.leaveTypeNameAr}</p>
      </div>

      <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border/60 rounded-lg border border-border/50 bg-muted/20">
        <div className="flex flex-col items-center gap-0 px-2 py-1.5">
          <span className="font-display text-sm font-bold tabular-nums text-foreground" dir="ltr">{leaveType.totalDays}</span>
          <span className="text-[9px] text-muted-foreground">الإجمالي</span>
        </div>
        <div className="flex flex-col items-center gap-0 px-2 py-1.5">
          <span className="font-display text-sm font-bold tabular-nums text-muted-foreground" dir="ltr">{leaveType.usedDays}</span>
          <span className="text-[9px] text-muted-foreground">المستخدم</span>
        </div>
        <div className="flex flex-col items-center gap-0 px-2 py-1.5">
          <span className={cn('font-display text-sm font-bold tabular-nums', danger ? 'text-destructive' : warn ? 'text-amber-500' : 'text-emerald-500')} dir="ltr">
            {leaveType.remainingDays}
          </span>
          <span className="text-[9px] text-muted-foreground">المتبقي</span>
        </div>
      </div>

      <div className="mt-2">
        <BalanceBar used={leaveType.usedDays} total={leaveType.totalDays} color="bg-emerald-500" />
      </div>
    </div>
  );
}

function EmployeeBalanceGroupCard({
  group,
  onAddType,
}: {
  group: EmployeeLeaveBalanceGroupDto;
  onAddType: (employeeId: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const initials = group.employeeNameAr.split(' ').map((w) => w[0]).slice(0, 2).join('');
  const avatarClass = themeAvatarClassFromKey(group.employeeId);
  const p = pct(group.usedDays, group.totalDays);
  const danger = group.totalDays > 0 && p >= 90;
  const warn = group.totalDays > 0 && p >= 70;

  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3.5 pt-3.5 pb-2.5 text-right transition-colors hover:bg-muted/20"
        aria-expanded={expanded}
      >
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            avatarClass,
          )}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{group.employeeNameAr}</p>
          <p className="text-[10px] text-muted-foreground">{group.leaveTypes.length} نوع إجازة</p>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border/60 border-t border-border/60 bg-muted/30">
        <div className="flex flex-col items-center gap-0 px-2 py-2">
          <span className="font-display text-lg font-bold tabular-nums text-foreground" dir="ltr">{group.totalDays}</span>
          <span className="text-[9px] text-muted-foreground">الإجمالي</span>
        </div>
        <div className="flex flex-col items-center gap-0 px-2 py-2">
          <span className="font-display text-lg font-bold tabular-nums text-muted-foreground" dir="ltr">{group.usedDays}</span>
          <span className="text-[9px] text-muted-foreground">المستخدم</span>
        </div>
        <div className="flex flex-col items-center gap-0 px-2 py-2">
          <span className={cn('font-display text-lg font-bold tabular-nums', danger ? 'text-destructive' : warn ? 'text-amber-500' : 'text-emerald-500')} dir="ltr">
            {group.remainingDays}
          </span>
          <span className="text-[9px] text-muted-foreground">المتبقي</span>
        </div>
      </div>

      <div className="px-3.5 py-2">
        <BalanceBar used={group.usedDays} total={group.totalDays} color="bg-primary" />
      </div>

      {expanded && (
        <div className="border-t border-border/50 bg-card/50">
          <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-2">
            <p className="text-[10px] font-medium text-muted-foreground">تفاصيل أنواع الإجازة</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[10px] text-muted-foreground hover:text-primary"
              onClick={() => onAddType(group.employeeId)}
            >
              <Plus className="h-3 w-3" />
              إضافة نوع
            </Button>
          </div>
          {group.leaveTypes.map((lt) => (
            <LeaveTypeRow
              key={lt.id}
              leaveType={lt}
            />
          ))}
        </div>
      )}
    </div>
  );
}


// ─── Main ─────────────────────────────────────────────────────────────────────

export function AnalyticsClient() {
  const companyId = useDefaultCompanyId() ?? '';

  const [leaveTypes, setLeaveTypes] = React.useState<LeaveTypeResponseDto[]>([]);
  const [defaultLeaveTypeId, setDefaultLeaveTypeId] = React.useState<string | null>(null);
  const [employees, setEmployees] = React.useState<EmployeeResponseDto[]>([]);
  const [metaLoading, setMetaLoading] = React.useState(true);

  const [selectedEmpIds, setSelectedEmpIds] = React.useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<DialogMode>({ mode: 'create' });

  React.useEffect(() => {
    if (!companyId) return;
    void (async () => {
      setMetaLoading(true);
      try {
        const [ltRes, empRes] = await Promise.all([
          loadCompanyLeaveTypes({ companyId, limit: 200, isActive: true }),
          employeesApi.getAll({ companyId, limit: 1000 }),
        ]);
        setLeaveTypes(ltRes.items);
        setDefaultLeaveTypeId(ltRes.defaultLeaveTypeId ?? resolveDefaultLeaveTypeId(ltRes.items));
        setEmployees(empRes.items);
      } catch { toast.error('فشل تحميل البيانات'); }
      finally { setMetaLoading(false); }
    })();
  }, [companyId]);

  const selectedEmpKey = React.useMemo(() => [...selectedEmpIds].sort().join(','), [selectedEmpIds]);
  const bulkMode = selectedEmpIds.size > 1;

  const applyEmployeeFilter = React.useCallback(
    (items: EmployeeLeaveBalanceGroupDto[]) => {
      if (selectedEmpIds.size <= 1) return items;
      return items.filter((g) => selectedEmpIds.has(g.employeeId));
    },
    [selectedEmpIds],
  );

  const loadPage = React.useCallback(async (page: number, pageSize: number) => {
    if (!companyId) return { items: [] as EmployeeLeaveBalanceGroupDto[], total: 0 };
    try {
      const res = await leaveBalancesApi.getAll({
        companyId,
        page,
        limit: pageSize,
        ...(selectedEmpIds.size === 1 ? { employeeId: [...selectedEmpIds][0] } : {}),
      });
      const items = applyEmployeeFilter(res.items);
      return { items, total: res.pagination.total };
    } catch {
      return { items: [], total: 0 };
    }
  }, [applyEmployeeFilter, companyId, selectedEmpIds]);

  const loadBulk = React.useCallback(async () => {
    if (!companyId) return { items: [] as EmployeeLeaveBalanceGroupDto[], total: 0 };
    try {
      const res = await fetchAllPaginatedItems((page, limit) =>
        leaveBalancesApi.getAll({
          companyId,
          page,
          limit,
          ...(selectedEmpIds.size === 1 ? { employeeId: [...selectedEmpIds][0] } : {}),
        }),
      );
      const items = applyEmployeeFilter(res.items);
      return { items, total: items.length };
    } catch {
      return { items: [], total: 0 };
    }
  }, [applyEmployeeFilter, companyId, selectedEmpIds]);

  const {
    items: groups,
    loading: listLoading,
    pagination,
    reload: reloadBalances,
  } = useServerDirectoryPagination<EmployeeLeaveBalanceGroupDto>(loadPage, {
    enabled: !!companyId && !metaLoading,
    bulkMode,
    loadBulk: bulkMode ? loadBulk : undefined,
    resetDeps: [companyId, selectedEmpKey],
  });

  const loading = metaLoading || listLoading;

  const handleSaved = async () => {
    await reloadBalances();
  };

  const openCreate = React.useCallback(() => { setDialogMode({ mode: 'create' }); setFormOpen(true); }, []);
  const openAddForEmployee = React.useCallback((employeeId: string) => {
    setDialogMode({ mode: 'create', employeeId });
    setFormOpen(true);
  }, []);

  const activeFilterCount = selectedEmpIds.size > 0 ? 1 : 0;

  const usageOf = (g: EmployeeLeaveBalanceGroupDto) => {
    if (g.totalDays <= 0) return 'بلا رصيد';
    const used = pct(g.usedDays, g.totalDays);
    return used >= 90 ? '90% فأكثر' : used >= 70 ? 'من 70% إلى 89%' : 'أقل من 70%';
  };
  const typesOf = (g: EmployeeLeaveBalanceGroupDto) =>
    g.leaveTypes.map((lt) => `${lt.leaveTypeNameAr || '—'}: ${lt.totalDays} / ${lt.usedDays} / ${lt.remainingDays}`).join(' · ') || '—';
  const columns: ColumnDef<EmployeeLeaveBalanceGroupDto>[] = [
    { key: 'employee', title: 'الموظف', render: (g) => g.employeeNameAr },
    { key: 'types', title: 'الأنواع (الإجمالي / المستخدم / المتبقي)', render: (g) => <span className="text-xs text-muted-foreground">{typesOf(g)}</span> },
    { key: 'total', title: 'الإجمالي', render: (g) => <span className="font-mono text-xs">{g.totalDays}</span> },
    { key: 'used', title: 'المستخدم', render: (g) => <span className="font-mono text-xs">{g.usedDays}</span> },
    { key: 'remaining', title: 'المتبقي', render: (g) => <span className="font-mono text-xs">{g.remainingDays}</span> },
    { key: 'usage', title: 'الاستهلاك', render: usageOf },
  ];
  const tools = useListTools<EmployeeLeaveBalanceGroupDto>({
    section: 'hr',
    page: 'leave-balances',
    columns,
    rows: groups,
    fetchAll: pagination.loadAll,
    resetKey: pagination.resetKey,
    fields: {
      employee: { kind: 'name', text: (g) => g.employeeNameAr },
      types: { text: typesOf, sortable: false },
      total: { text: (g) => String(g.totalDays), sort: (g) => g.totalDays, sum: (g) => g.totalDays },
      used: { text: (g) => String(g.usedDays), sort: (g) => g.usedDays, sum: (g) => g.usedDays },
      remaining: { text: (g) => String(g.remainingDays), sort: (g) => g.remainingDays, sum: (g) => g.remainingDays },
      usage: { kind: 'status', text: usageOf, sort: (g) => (g.totalDays > 0 ? pct(g.usedDays, g.totalDays) : -1), group: usageOf },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        {tools.exportMenu('أرصدة الإجازات', 'leave-balances')}
        <Button type="button" variant="luxe" size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          إضافة رصيد
        </Button>
      </div>
    ),
    [activeFilterCount, openCreate, tools.depsKey],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        companyId={companyId}
        selectedEmpIds={selectedEmpIds}
        onSelectedEmpIdsChange={setSelectedEmpIds}
        onDateBoundsChange={() => {}}
      />
    ),
    [selectedEmpKey, companyId],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {loading && groups.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {pagination.total === 0 ? 'لا توجد أرصدة إجازات مسجّلة' : 'لا نتائج تطابق الفلاتر الحالية'}
          </p>
        </div>
      ) : (
        <ListToolsTable tools={tools} keyExtractor={(g) => g.employeeId}>
        <DirectoryPagedViews items={tools.rows} serverPagination={tools.pagination(pagination)} loading={loading || tools.loading} resetDeps={[selectedEmpKey]}>
          {(pageItems) => (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((group) => (
            <EmployeeBalanceGroupCard
              key={group.employeeId}
              group={group}
              onAddType={openAddForEmployee}
            />
          ))}
        </div>
          )}
        </DirectoryPagedViews>
        </ListToolsTable>
      )}

      <BalanceFormDialog
        open={formOpen}
        dialogMode={dialogMode}
        employees={employees}
        leaveTypes={leaveTypes}
        defaultLeaveTypeId={defaultLeaveTypeId}
        companyId={companyId}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
