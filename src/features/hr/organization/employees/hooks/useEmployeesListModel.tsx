'use client';

import { FoldedHeaderTool } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Download, FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSetPageTitle } from '@/components/layouts/page-title-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { EmployeesRegisterPrintHtml } from '@/components/pdf/print/employees-register-print-html';
import { downloadXlsxFromAoA, type XlsxCell } from '@/shared/export/download-xlsx';
import {
  CONTRACT_TYPE_AR,
  EMP_CONTRACT_STATUS_LABELS,
  EMP_CONTRACT_STATUS_ORDER,
} from '@/features/hr/organization/employees/constants/employees-list';
import { employeesApi, type EmployeeResponseDto } from '@/features/hr/organization/employees/lib/api/employees';
import { branchesApi, type BranchResponseDto } from '@/features/hr/organization/lib/api/branches';
import { departmentsApi, type DepartmentResponseDto } from '@/features/hr/organization/lib/api/departments';
import { jobTitlesApi, type JobTitleResponseDto } from '@/features/hr/organization/lib/api/jobTitles';
import { ListSortMenu, listSortQuery, useListSort, type ListSortOption } from '@/components/ui/list-sort';
import {
  dateListGroupOptions,
  ListGroupMenu,
  listGroupQuery,
  ORG_LIST_GROUP_OPTIONS,
  useGroupedList,
  useListGroup,
  type ListGroupOption,
} from '@/components/ui/list-group';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import {
  registerExportRows,
  visibleExportColumns,
  type RegisterExportColumn,
} from '@/components/pdf/lib/register-export-rows';
import { ListColumnsPicker, useColumnVisibility, type ListColumnOption } from '@/components/ui/list-columns-picker';
import type { RegisterRow } from '@/components/pdf/print/register-document';
import { EMPLOYEES_REGISTER_COLUMNS } from '@/components/pdf/print/employees-register-print-html';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { useActiveCompany } from '@/features/hr/organization/hooks/useActiveCompany';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { fetchAllPaginatedItems } from '@/features/hr/lib/api/client';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import { resolveDirectoryLoadFailure } from '@/features/hr/lib/api/directory-load-error';
import { usePagePermissions } from '@/features/auth/permissions';
import { useFilterPermission } from '@/features/auth/permissions/use-filter-permission';
import {
  EMPLOYEES_FILTER_PERMISSIONS,
  EMPLOYEES_PAGE_PERMISSIONS,
} from '@/features/hr/organization/employees/permissions';
import { useServerDirectoryPagination } from '@/components/ui/paged-list';
import {
  ORGANIZATION_ARCHIVE_SCOPE_DEFAULT,
  ORGANIZATION_ARCHIVE_SCOPE_OPTIONS,
  organizationActiveListArchiveQuery,
  organizationListArchiveQuery,
  type OrganizationArchiveScope,
} from '@/features/hr/organization/lib/archive-scope';
import {
  hrFiltersKey,
  usePersistedEmpIdSet,
  usePersistedFilterState,
} from '@/features/hr/lib/use-persisted-filter-state';

function empStartYmd(e: EmployeeResponseDto): string {
  const s = e.startDate;
  if (!s) return '';
  if (s.length >= 10) return s.slice(0, 10);
  try { return new Date(s).toISOString().slice(0, 10); } catch { return ''; }
}

/** Fields the employees list can be sorted by (server `sortBy` keys). */
export const EMPLOYEES_SORT_OPTIONS: readonly ListSortOption[] = [
  { key: 'name', label: 'الاسم' },
  { key: 'employeeCode', label: 'الرقم الوظيفي' },
  { key: 'position', label: 'المسمى' },
  { key: 'contractType', label: 'نوع العقد' },
  { key: 'contractStatus', label: 'حالة العقد' },
  { key: 'startDate', label: 'تاريخ الالتحاق' },
];

const GENDER_AR: Record<string, string> = { male: 'ذكر', female: 'أنثى' };
const MONTH_GROUP = dateListGroupOptions().find((o) => o.key === 'month')!;

/** Fields the employees list can be grouped by (server `groupBy` keys). */
export const EMPLOYEES_GROUP_OPTIONS: readonly ListGroupOption[] = [
  ...ORG_LIST_GROUP_OPTIONS,
  { key: 'contractType', label: 'نوع العقد', formatKey: (k) => CONTRACT_TYPE_AR[k] ?? k, emptyLabel: 'غير محدد' },
  { key: 'contractStatus', label: 'حالة العقد', formatKey: (k) => EMP_CONTRACT_STATUS_LABELS[k] ?? k },
  { key: 'nationality', label: 'الجنسية', emptyLabel: 'غير محددة' },
  { key: 'gender', label: 'الجنس', formatKey: (k) => GENDER_AR[k.toLowerCase()] ?? k, emptyLabel: 'غير محدد' },
  {
    key: 'startMonth',
    label: 'شهر الالتحاق',
    orderByKey: true,
    formatKey: MONTH_GROUP.formatKey,
    emptyLabel: 'بدون تاريخ',
  },
  { key: 'startYear', label: 'سنة الالتحاق', orderByKey: true, emptyLabel: 'بدون تاريخ' },
];

/** Columns the user may hide (the employee and the actions always show). */
export const EMPLOYEES_COLUMN_OPTIONS: readonly ListColumnOption[] = [
  { key: 'position', label: 'المسمى' },
  { key: 'contractType', label: 'نوع العقد' },
  { key: 'contractStatus', label: 'حالة العقد' },
  { key: 'startDate', label: 'تاريخ الالتحاق' },
  { key: 'nationality', label: 'الجنسية' },
];

/** The screen column each register column mirrors (the name and code always print). */
const EXPORT_COLUMN_KEYS = [undefined, undefined, 'position', 'contractType', 'startDate', 'contractStatus'];

/** The register's cells for an employee (PDF and Excel). */
const EMPLOYEE_EXPORT_COLUMNS: RegisterExportColumn<EmployeeResponseDto>[] = EMPLOYEES_REGISTER_COLUMNS.map(
  (col, i) => ({
    ...col,
    key: EXPORT_COLUMN_KEYS[i],
    value: (emp: EmployeeResponseDto) =>
      [
        emp.nameAr,
        emp.employeeCode,
        emp.position ?? '—',
        CONTRACT_TYPE_AR[emp.contractType ?? ''] ?? emp.contractType ?? '—',
        empStartYmd(emp),
        EMP_CONTRACT_STATUS_LABELS[emp.contractStatus ?? ''] ?? emp.contractStatus ?? '—',
      ][i],
  }),
);

const EMPTY_STATUS_COUNTS = { all: 0, active: 0, suspended: 0, ended: 0 };

export function useEmployeesListModel() {
  useSetPageTitle({ titleAr: 'الموظفين', descriptionAr: 'سجل وإدارة بيانات الموظفين', iconName: 'Users' });
  const router = useRouter();
  const companyId = useDefaultCompanyId();
  const perms = usePagePermissions(EMPLOYEES_PAGE_PERMISSIONS);
  const [apiAccessDenied, setApiAccessDenied] = React.useState(false);
  const accessDenied = !perms.canRead || apiAccessDenied;
  const branchFilterAccess = useFilterPermission(EMPLOYEES_FILTER_PERMISSIONS.branch);
  const deptFilterAccess = useFilterPermission(EMPLOYEES_FILTER_PERMISSIONS.department);
  // company details are optional (used only for PDF header); 403 is silently ignored
  const { data: activeCompany } = useActiveCompany();

  const [employees, setEmployees] = React.useState<EmployeeResponseDto[]>([]);
  const [branches, setBranches] = React.useState<BranchResponseDto[]>([]);
  const [departments, setDepartments] = React.useState<DepartmentResponseDto[]>([]);
  const [jobTitles, setJobTitles] = React.useState<JobTitleResponseDto[]>([]);
  const [listError, setListError] = React.useState<string | null>(null);
  const [statusCounts, setStatusCounts] = React.useState(EMPTY_STATUS_COUNTS);

  const [branchFilter, setBranchFilter] = usePersistedFilterState(
    hrFiltersKey('organization', 'employees', companyId, 'branchFilter'),
    'all',
  );
  const [deptFilter, setDeptFilter] = usePersistedFilterState(
    hrFiltersKey('organization', 'employees', companyId, 'deptFilter'),
    'all',
  );
  const [contractTypeFilter, setContractTypeFilter] = usePersistedFilterState(
    hrFiltersKey('organization', 'employees', companyId, 'contractType'),
    'all',
  );
  const [jobTitleFilter, setJobTitleFilter] = usePersistedFilterState(
    hrFiltersKey('organization', 'employees', companyId, 'jobTitle'),
    'all',
  );
  const [startDateBounds, setStartDateBounds] = usePersistedFilterState(
    hrFiltersKey('organization', 'employees', companyId, 'startDateBounds'),
    { from: '', to: '' },
  );
  const stateKeys = listStateKeys('organization', 'employees', companyId);
  const sort = useListSort(stateKeys.sort, EMPLOYEES_SORT_OPTIONS);
  const group = useListGroup(stateKeys.group, EMPLOYEES_GROUP_OPTIONS);
  const groupBy = group.groupBy;
  const columnVisibility = useColumnVisibility(
    hrFiltersKey('organization', 'employees', companyId, 'hiddenColumns'),
    EMPLOYEES_COLUMN_OPTIONS,
  );
  const exportColumns = React.useMemo(
    () => visibleExportColumns(EMPLOYEE_EXPORT_COLUMNS, columnVisibility.isVisible),
    [columnVisibility.isVisible],
  );
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [view, setView] = usePersistedFilterState<'table' | 'grid'>(
    hrFiltersKey('organization', 'employees', companyId, 'view'),
    'table',
  );
  const [newEmpOpen, setNewEmpOpen] = React.useState(false);
  // Active employees by default; another status on demand. A new key: the
  // old one stored "all" for everyone, so the new default would never show.
  const [toolbarStatus, setToolbarStatus] = usePersistedFilterState(
    hrFiltersKey('organization', 'employees', companyId, 'contractStatus'),
    'active',
  );
  const [archiveScope, setArchiveScope] = usePersistedFilterState<OrganizationArchiveScope>(
    hrFiltersKey('organization', 'employees', companyId, 'archiveScope'),
    ORGANIZATION_ARCHIVE_SCOPE_DEFAULT,
  );
  const [selectedEmpIds, setSelectedEmpIds] = usePersistedEmpIdSet(
    hrFiltersKey('organization', 'employees', companyId, 'selectedEmpIds'),
  );
  const [pdfOpen, setPdfOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  // Debounce search input to avoid firing a request on every keystroke
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load branches and departments eagerly so filter dropdowns are ready on open
  React.useEffect(() => {
    if (!companyId) return;
    void Promise.allSettled([
      branchesApi.getAll({ limit: 200, companyId, ...organizationActiveListArchiveQuery() }),
      departmentsApi.getAll({ limit: 200, companyId, ...organizationActiveListArchiveQuery() }),
      jobTitlesApi.getAll({ limit: 200, companyId, ...organizationActiveListArchiveQuery() }),
    ]).then(([branchesRes, deptsRes, jobTitlesRes]) => {
      if (branchesRes.status === 'fulfilled') setBranches(branchesRes.value.items);
      if (deptsRes.status === 'fulfilled') setDepartments(deptsRes.value.items);
      if (jobTitlesRes.status === 'fulfilled') setJobTitles(jobTitlesRes.value.items);
    });
  }, [companyId]);

  const selectedEmpKey = React.useMemo(() => [...selectedEmpIds].sort().join(','), [selectedEmpIds]);

  // Every filter except the status — the status counts are taken under these.
  const baseQuery = React.useMemo(() => ({
    companyId: companyId!,
    ...(branchFilter !== 'all' ? { branchId: branchFilter } : {}),
    ...(deptFilter !== 'all' ? { departmentId: deptFilter } : {}),
    ...(contractTypeFilter !== 'all' ? { contractType: contractTypeFilter } : {}),
    ...(jobTitleFilter !== 'all' ? { jobTitleId: jobTitleFilter } : {}),
    ...(startDateBounds.from ? { startDateFrom: startDateBounds.from } : {}),
    ...(startDateBounds.to ? { startDateTo: startDateBounds.to } : {}),
    ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    ...(selectedEmpIds.size > 0 ? { employeeIds: [...selectedEmpIds] } : {}),
    ...organizationListArchiveQuery(archiveScope),
  }), [
    companyId, branchFilter, deptFilter, contractTypeFilter, jobTitleFilter,
    startDateBounds.from, startDateBounds.to, debouncedSearch, archiveScope, selectedEmpIds,
  ]);

  const buildListQuery = React.useCallback((page: number, pageSize: number): Parameters<typeof employeesApi.getAll>[0] => ({
    page,
    limit: pageSize,
    ...baseQuery,
    ...(toolbarStatus !== 'all' ? { contractStatus: toolbarStatus } : {}),
    ...listSortQuery(sort.sort),
  }), [baseQuery, toolbarStatus, sort.sort]);

  // Counts for the status tabs come from the server, over every page — not
  // from the page on screen.
  React.useEffect(() => {
    if (!companyId || !perms.canRead) return;
    let cancelled = false;
    employeesApi.getStatusCounts(baseQuery)
      .then((counts) => {
        if (!cancelled) setStatusCounts(counts);
      })
      .catch(() => {
        if (!cancelled) setStatusCounts(EMPTY_STATUS_COUNTS);
      });
    return () => {
      cancelled = true;
    };
  }, [baseQuery, companyId, perms.canRead]);

  const loadPage = React.useCallback(async (page: number, pageSize: number) => {
    if (!companyId) return { items: [] as EmployeeResponseDto[], total: 0 };
    setListError(null);
    try {
      const res = await employeesApi.getAll(buildListQuery(page, pageSize));
      setEmployees(res.items);
      setApiAccessDenied(false);
      return { items: res.items, total: res.pagination.total };
    } catch (err) {
      const failure = resolveDirectoryLoadFailure(err, 'employees.load');
      setApiAccessDenied(failure.accessDenied);
      setListError(failure.listError);
      return { items: [], total: 0 };
    }
  }, [buildListQuery, companyId]);

  const {
    items: pagedEmployees,
    loading,
    pagination,
    reload: reloadEmployees,
  } = useServerDirectoryPagination<EmployeeResponseDto>(loadPage, {
    // Grouped, the rows load per group (useGroupedList), not as pages.
    enabled: !!companyId && perms.canRead && !groupBy,
    resetDeps: [
      companyId, branchFilter, deptFilter, toolbarStatus, archiveScope, debouncedSearch, selectedEmpKey, view,
      contractTypeFilter, jobTitleFilter, startDateBounds.from, startDateBounds.to, sort.sortKey,
    ],
  });

  const groupsQuery = React.useCallback(() => {
    const { page: _p, limit: _l, sortBy: _sb, sortDir: _sd, ...filters } = buildListQuery(1, 1) ?? {};
    return { ...filters, ...listGroupQuery(groupBy) };
  }, [buildListQuery, groupBy]);

  const grouped = useGroupedList<EmployeeResponseDto>({
    enabled: !!companyId && perms.canRead && !!groupBy,
    groupBy,
    resetKey: JSON.stringify(buildListQuery(1, 1)),
    fetchGroups: () => employeesApi.groups(groupsQuery()),
    fetchGroupRows: (groupValue, p, l) =>
      employeesApi.getAll({ ...buildListQuery(p, l), ...listGroupQuery(groupBy), groupValue }),
  });

  const reloadList = React.useCallback(async () => {
    if (groupBy) await grouped.reload();
    else await reloadEmployees();
  }, [groupBy, grouped, reloadEmployees]);

  const getBranch = React.useCallback(
    (id: string | null | undefined) => branches.find((b) => b.id === id),
    [branches],
  );
  const getDepartment = React.useCallback(
    (id: string | null | undefined) => departments.find((d) => d.id === id),
    [departments],
  );

  // Server applies all filters, including the multi-employee picker (employeeIds)
  const filtered = pagedEmployees;

  const contractStatusCounts = statusCounts;

  // Exports cover every record matching the current filters, not just the
  // visible page — grouped like the screen when it is grouped.
  const [exportRows, setExportRows] = React.useState<RegisterRow[]>([]);
  const [exporting, setExporting] = React.useState(false);

  const fetchAllForExport = useLatestCallback(async (): Promise<RegisterRow[] | null> => {
    if (!companyId) return null;
    setExporting(true);
    try {
      const { items } = await fetchAllPaginatedItems((page, limit) =>
        employeesApi.getAll({ ...buildListQuery(page, limit), ...listGroupQuery(groupBy) }),
      );
      if (!groupBy || !group.option || items.length === 0) {
        return items.map((emp) => exportColumns.map((c) => c.value(emp)));
      }
      const summary = await employeesApi.groups(groupsQuery());
      return registerExportRows({
        columns: exportColumns,
        rows: items,
        grouping: {
          fieldLabel: group.option.label,
          groups: group.sortGroups(summary.groups),
          labelOf: group.labelOf,
          groupKeyOf: (emp) => emp.groupKey,
        },
      });
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'employees.export');
      toast.error(displayMessage || 'تعذّر تحميل الموظفين للتصدير.');
      return null;
    } finally {
      setExporting(false);
    }
  });

  const handleExportPdf = useLatestCallback(async () => {
    if (exporting) return;
    const all = await fetchAllForExport();
    if (!all) return;
    if (all.length === 0) {
      toast.error('لا يوجد موظفون للتصدير ضمن الفلاتر الحالية.');
      return;
    }
    setExportRows(all);
    setPdfOpen(true);
  });

  const employeesFilterSummary = React.useMemo(() => {
    const parts: string[] = [];
    if (branchFilter !== 'all') parts.push(`فرع: ${branches.find((b) => b.id === branchFilter)?.nameAr ?? branchFilter}`);
    if (deptFilter !== 'all') parts.push(`قسم: ${departments.find((d) => d.id === deptFilter)?.nameAr ?? deptFilter}`);
    if (jobTitleFilter !== 'all') parts.push(`المسمى: ${jobTitles.find((j) => j.id === jobTitleFilter)?.nameAr ?? jobTitleFilter}`);
    if (contractTypeFilter !== 'all') parts.push(`نوع العقد: ${CONTRACT_TYPE_AR[contractTypeFilter] ?? contractTypeFilter}`);
    if (startDateBounds.from || startDateBounds.to) {
      parts.push(`الالتحاق: ${startDateBounds.from || '…'} — ${startDateBounds.to || '…'}`);
    }
    if (search.trim()) parts.push(`بحث: ${search.trim()}`);
    parts.push(selectedEmpIds.size === 0 ? 'الموظفون: الكل (ضمن الفلاتر)' : `الموظفون: ${selectedEmpIds.size} محدد من القائمة`);
    parts.push(`حالة العقد: ${toolbarStatus === 'all' ? 'الكل' : (EMP_CONTRACT_STATUS_LABELS[toolbarStatus] ?? toolbarStatus)}`);
    if (sort.label) parts.push(sort.label);
    if (group.label) parts.push(group.label);
    return parts.join(' · ');
  }, [
    branchFilter, deptFilter, search, selectedEmpIds.size, toolbarStatus, branches, departments,
    jobTitleFilter, jobTitles, contractTypeFilter, startDateBounds.from, startDateBounds.to, sort.label,
    group.label,
  ]);

  const handleDelete = React.useCallback(async () => {
    if (!deleteId) return;
    try {
      await employeesApi.remove(deleteId);
      setDeleteId(null);
      await reloadList();
      toast.success('تم حذف الموظف');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'employees.delete');
      toast.error(displayMessage);
    }
  }, [deleteId, reloadList]);

  const handleExportExcel = useLatestCallback(async () => {
    if (exporting) return;
    const all = await fetchAllForExport();
    if (!all) return;
    if (all.length === 0) {
      toast.error('لا يوجد موظفون للتصدير ضمن الفلاتر الحالية.');
      return;
    }
    const rows: XlsxCell[][] = [exportColumns.map((c) => c.label)];
    for (const row of all) {
      rows.push(Array.isArray(row) ? row : row.kind === 'group' ? [row.title] : row.cells);
    }
    await downloadXlsxFromAoA('employees-register.xlsx', 'الموظفون', rows);
    toast.success('تم تنزيل ملف Excel.');
  });

  const employeesPrintable = React.useMemo(
    () =>
      exportRows.length === 0 ? null : (
        <EmployeesRegisterPrintHtml
          companyNameAr={activeCompany?.nameAr ?? 'الشركة'}
          companyNameEn={activeCompany?.nameEn ?? ''}
          titleAr="سجل الموظفين"
          filterSummary={employeesFilterSummary}
          columns={exportColumns}
          rows={exportRows}
        />
      ),
    [exportRows, exportColumns, employeesFilterSummary, activeCompany],
  );

  const branchSelectOptions = React.useMemo(
    () => [{ value: 'all', label: 'كل الفروع' }, ...branches.map((b) => ({ value: b.id, label: b.nameAr }))],
    [branches],
  );
  const deptSelectOptions = React.useMemo(
    () => [{ value: 'all', label: 'كل الأقسام' }, ...departments.map((d) => ({ value: d.id, label: d.nameAr }))],
    [departments],
  );
  const jobTitleSelectOptions = React.useMemo(
    () => [{ value: 'all', label: 'كل المسميات' }, ...jobTitles.map((j) => ({ value: j.id, label: j.nameAr }))],
    [jobTitles],
  );
  const contractTypeSelectOptions = React.useMemo(
    () => [
      { value: 'all', label: 'كل أنواع العقود' },
      ...Object.entries(CONTRACT_TYPE_AR).map(([value, label]) => ({ value, label })),
    ],
    [],
  );
  // The status has its own tabs; everything else in the panel is counted.
  const activeFilterCount =
    (branchFilter !== 'all' ? 1 : 0)
    + (deptFilter !== 'all' ? 1 : 0)
    + (selectedEmpIds.size > 0 ? 1 : 0)
    + (contractTypeFilter !== 'all' ? 1 : 0)
    + (jobTitleFilter !== 'all' ? 1 : 0)
    + (startDateBounds.from || startDateBounds.to ? 1 : 0);

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <ListColumnsPicker model={columnVisibility} />
        <ListSortMenu model={sort} />
        <ListGroupMenu model={group} />
        <ListSavedViews storageKey={stateKeys.views} prefixes={stateKeys.prefixes} />
        <PageHeaderPrimaryButton icon={Plus} label="موظف جديد" onClick={() => setNewEmpOpen(true)}>
          موظف جديد
        </PageHeaderPrimaryButton>
        <FoldedHeaderTool>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 shrink-0"
                aria-label="تصدير سجل الموظفين"
                disabled={exporting}
                aria-busy={exporting}
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
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
    [
      exporting, handleExportPdf, handleExportExcel, sort.sortKey, activeFilterCount,
      group.groupKey, JSON.stringify(group.group?.order), stateKeys.views, columnVisibility.hiddenKey,
    ],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        optionalDateRange
        periodValue={startDateBounds}
        onPeriodChange={setStartDateBounds}
        onDateBoundsChange={setStartDateBounds}
        leadingFilters={(
          <EntityFilterSearchField
            value={search}
            onChange={setSearch}
            placeholder="بحث بالاسم، الرقم الوظيفي، الهوية / الإقامة…"
          />
        )}
        inlineSelects={[
          {
            id: 'archive',
            value: archiveScope,
            onChange: (v) => setArchiveScope(v as OrganizationArchiveScope),
            placeholder: 'العرض',
            options: ORGANIZATION_ARCHIVE_SCOPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          },
          {
            id: 'branch',
            value: branchFilter,
            onChange: branchFilterAccess.guardOnChange(setBranchFilter),
            onOpen: branchFilterAccess.guardOnOpen(),
            placeholder: 'الفرع',
            options: branchSelectOptions,
          },
          {
            id: 'dept',
            value: deptFilter,
            onChange: deptFilterAccess.guardOnChange(setDeptFilter),
            onOpen: deptFilterAccess.guardOnOpen(),
            placeholder: 'القسم',
            options: deptSelectOptions,
          },
          ...(jobTitles.length > 0 ? [{
            id: 'jobTitle',
            value: jobTitleFilter,
            onChange: setJobTitleFilter,
            placeholder: 'المسمى الوظيفي',
            options: jobTitleSelectOptions,
          }] : []),
          {
            id: 'contractType',
            value: contractTypeFilter,
            onChange: setContractTypeFilter,
            placeholder: 'نوع العقد',
            options: contractTypeSelectOptions,
          },
        ]}
        companyId={companyId}
        selectedEmpIds={selectedEmpIds}
        onSelectedEmpIdsChange={setSelectedEmpIds}
        statusFilter={toolbarStatus}
        onStatusFilterChange={setToolbarStatus}
        statusOrder={EMP_CONTRACT_STATUS_ORDER}
        statusLabels={EMP_CONTRACT_STATUS_LABELS}
        statusCounts={contractStatusCounts}
        dataView={{
          value: view,
          onChange: (v) => setView(v as 'table' | 'grid'),
          options: [
            { value: 'table', label: 'جدول', icon: 'list' },
            { value: 'grid', label: 'شبكة', icon: 'layout-grid' },
          ],
        }}
      />
    ),
    [
      archiveScope, search,
      branchFilter, deptFilter, view, toolbarStatus, selectedEmpKey,
      contractStatusCounts.all, contractStatusCounts.active,
      contractStatusCounts.suspended, contractStatusCounts.ended,
      companyId, branchSelectOptions, deptSelectOptions,
      jobTitles.length, jobTitleFilter, jobTitleSelectOptions, contractTypeFilter, contractTypeSelectOptions,
      startDateBounds.from, startDateBounds.to,
      branchFilterAccess.allowed, deptFilterAccess.allowed,
    ],
  );

  return {
    router,
    accessDenied,
    perms,
    employees,
    filtered,
    loading,
    pagination,
    listError,
    view,
    newEmpOpen,
    setNewEmpOpen,
    pdfOpen,
    setPdfOpen,
    employeesPrintable,
    getBranch,
    getDepartment,
    reloadEmployees: reloadList,
    sort,
    group,
    grouped,
    columnVisibility,
    deleteId,
    setDeleteId,
    handleDelete,
  };
}

export type EmployeesListModel = ReturnType<typeof useEmployeesListModel>;
