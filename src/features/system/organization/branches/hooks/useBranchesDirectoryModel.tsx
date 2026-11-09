'use client';

import * as React from 'react';
import { useSetPageTitle } from '@/components/layouts/page-title-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { usePagePermissions } from '@/features/auth/permissions';
import { BRANCHES_PAGE_PERMISSIONS } from '@/features/system/organization/branches/permissions';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { resolveDirectoryLoadFailure } from '@/features/hr/lib/api/directory-load-error';
import { employeesApi, type EmployeeResponseDto } from '@/features/hr/organization/employees/lib/api/employees';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { useDefaultCompany } from '@/features/hr/organization/hooks/useActiveCompany';
import { branchesApi } from '@/features/hr/organization/lib/api/branches';
import { ORGANIZATION_ARCHIVE_SCOPE_DEFAULT, ORGANIZATION_ARCHIVE_SCOPE_OPTIONS, organizationListStatusQuery, type OrganizationArchiveScope } from '@/features/hr/organization/lib/archive-scope';
import { useServerDirectoryPagination } from '@/components/ui/paged-list';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import { createBranch, deleteBranch, updateBranch } from '@/features/system/organization/branches/services/branches.service';
import { mapBranchResponse } from '@/features/system/organization/branches/constants/branches-directory';
import { generateEntityCode } from '@/features/hr/requests/lib/types';
import { BRANCH_EMPTY_FORM, branchRowToDraftForm, draftFormToCreatePayload, draftFormToUpdatePayload, type BranchDraftForm, type BranchRow } from '@/features/system/organization/branches/constants/branches-directory';


export function useBranchesDirectoryModel() {
  useSetPageTitle({ titleAr: 'الفروع', descriptionAr: 'إدارة فروع الشركة وتوزيع الموظفين.', iconName: 'Building2' });

  const perms = usePagePermissions(BRANCHES_PAGE_PERMISSIONS);
  const [apiAccessDenied, setApiAccessDenied] = React.useState(false);
  const accessDenied = !perms.canRead || apiAccessDenied;

  const defaultCompanyId = useDefaultCompanyId();
  const { data: defaultCompany } = useDefaultCompany();

  const [archiveScope, setArchiveScope] = React.useState<OrganizationArchiveScope>(
    ORGANIZATION_ARCHIVE_SCOPE_DEFAULT,
  );
  const [layoutView, setLayoutView] = React.useState<'grid' | 'table'>('grid');
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<BranchDraftForm>(BRANCH_EMPTY_FORM);
  const [error, setError] = React.useState<string | null>(null);
  const [listError, setListError] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [viewBranch, setViewBranch] = React.useState<BranchRow | null>(null);
  const [employees, setEmployees] = React.useState<EmployeeResponseDto[]>([]);
  const [employeesLoading, setEmployeesLoading] = React.useState(false);

  const companyLabel = React.useCallback(
    (companyId: string) =>
      defaultCompany?.nameAr
      ?? defaultCompany?.code
      ?? companyId.slice(0, 8),
    [defaultCompany],
  );

  const loadPage = React.useCallback(async (page: number, pageSize: number) => {
    if (!defaultCompanyId) return { items: [] as BranchRow[], total: 0 };
    try {
      const res = await branchesApi.getAll({
        companyId: defaultCompanyId,
        page,
        limit: pageSize,
        ...organizationListStatusQuery(archiveScope),
      });
      setListError(null);
      setApiAccessDenied(false);
      return { items: res.items.map(mapBranchResponse), total: res.pagination.total };
    } catch (err) {
      const failure = resolveDirectoryLoadFailure(err, 'branches.load');
      setApiAccessDenied(failure.accessDenied);
      setListError(failure.listError);
      return { items: [], total: 0 };
    }
  }, [defaultCompanyId, archiveScope]);

  const {
    items: branches,
    loading,
    pagination,
    reload: reloadList,
  } = useServerDirectoryPagination<BranchRow>(loadPage, {
    enabled: !!defaultCompanyId && perms.canRead,
    resetDeps: [defaultCompanyId, layoutView, archiveScope],
  });

  React.useEffect(() => {
    if (!drawerOpen || !defaultCompanyId) {
      setEmployees([]);
      return;
    }
    let cancelled = false;
    setEmployeesLoading(true);
    void employeesApi
      .getAll({ companyId: defaultCompanyId, limit: 500 })
      .then((res) => {
        if (!cancelled) setEmployees(res.items);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      })
      .finally(() => {
        if (!cancelled) setEmployeesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [drawerOpen, defaultCompanyId]);

  const employeeOptions = React.useMemo(
    () => employees.map((e) => ({
      value: e.id,
      label: e.nameAr,
      sub: e.employeeCode ?? undefined,
    })),
    [employees],
  );

  const setManagerEmployee = React.useCallback((employeeId: string) => {
    if (!employeeId) {
      setForm((f) => ({ ...f, managerEmployeeId: '', managerName: '' }));
      return;
    }
    const employee = employees.find((e) => e.id === employeeId);
    setForm((f) => ({
      ...f,
      managerEmployeeId: employeeId,
      managerName: employee?.nameAr ?? '',
    }));
  }, [employees]);

  const filtered = branches;

  const patch = React.useCallback((p: Partial<BranchDraftForm>) => {
    setForm((f) => ({ ...f, ...p }));
  }, []);

  const openCreate = useLatestCallback(() => {
    if (!perms.canCreate) return;
    setEditId(null);
    setForm({
      ...BRANCH_EMPTY_FORM,
      companyId: defaultCompanyId ?? '',
    });
    setError(null);
    setDrawerOpen(true);
  });

  const openEdit = React.useCallback((b: BranchRow) => {
    if (!perms.canUpdate) return;
    setEditId(b.id);
    setForm(branchRowToDraftForm(b, employees));
    setError(null);
    setDrawerOpen(true);
  }, [employees, perms.canUpdate]);

  React.useEffect(() => {
    if (!drawerOpen || !editId) return;
    setForm((f) => {
      if (f.managerEmployeeId || !f.managerName) return f;
      const matched = employees.find((e) => e.nameAr.trim() === f.managerName.trim());
      return matched ? { ...f, managerEmployeeId: matched.id } : f;
    });
  }, [drawerOpen, editId, employees]);

  const handleSave = React.useCallback(async () => {
    if (editId ? !perms.canUpdate : !perms.canCreate) return;
    const companyId = defaultCompanyId ?? form.companyId;
    if (!form.name.trim()) {
      setError('اسم الفرع مطلوب');
      return;
    }
    if (!form.city.trim()) {
      setError('المدينة مطلوبة');
      return;
    }
    if (!companyId) {
      setError('لم يتم تحديد الشركة الافتراضية. سجّل الدخول مرة أخرى.');
      return;
    }

    setError(null);
    try {
      if (editId) {
        await updateBranch(editId, draftFormToUpdatePayload(form));
      } else {
        await createBranch(draftFormToCreatePayload(form, companyId, generateEntityCode(form.name.trim(), 'branch')));
      }
      await reloadList();
      setDrawerOpen(false);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'branches.save');
      setError(displayMessage);
    }
  }, [defaultCompanyId, editId, form, perms.canCreate, perms.canUpdate, reloadList]);

  const handleDelete = React.useCallback(async () => {
    if (!confirmId || !perms.canDelete) return;
    setError(null);
    try {
      await deleteBranch(confirmId);
      await reloadList();
      setConfirmId(null);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'branches.delete');
      setError(displayMessage);
    }
  }, [confirmId, perms.canDelete, reloadList]);


  const archiveScopeLabel =
    ORGANIZATION_ARCHIVE_SCOPE_OPTIONS.find((o) => o.value === archiveScope)?.label ?? '';

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        onDateBoundsChange={() => {}}
        inlineSelects={[
          {
            id: 'archive',
            value: archiveScope,
            onChange: (v) => setArchiveScope(v as OrganizationArchiveScope),
            placeholder: 'العرض',
            options: ORGANIZATION_ARCHIVE_SCOPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          },
        ]}
        dataView={{
          value: layoutView,
          onChange: (v) => setLayoutView(v as 'grid' | 'table'),
          options: [
            { value: 'table', label: 'جدول', icon: 'list' },
            { value: 'grid', label: 'شبكة', icon: 'layout-grid' },
          ],
        }}
      />
    ),
    [archiveScope, layoutView],
  );

  return {
    archiveScopeLabel,
    perms,
    accessDenied,
    layoutView,
    branches,
    filtered,
    loading,
    pagination,
    listError,
    drawerOpen,
    setDrawerOpen,
    editId,
    form,
    patch,
    error,
    confirmId,
    setConfirmId,
    viewBranch,
    setViewBranch,
    openCreate,
    openEdit,
    handleSave,
    handleDelete,
    companyLabel,
    employeeOptions,
    employeesLoading,
    setManagerEmployee,
  };
}

export type BranchesDirectoryModel = ReturnType<typeof useBranchesDirectoryModel>;
