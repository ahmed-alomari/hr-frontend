'use client';

import * as React from 'react';
import { useSetPageTitle } from '@/components/layouts/page-title-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { usePagePermissions } from '@/features/auth/permissions';
import { useFilterPermission } from '@/features/auth/permissions/use-filter-permission';
import { DEPARTMENTS_FILTER_PERMISSIONS, DEPARTMENTS_PAGE_PERMISSIONS } from '@/features/system/organization/departments/permissions';
import { branchesApi, type BranchResponseDto } from '@/features/hr/organization/lib/api/branches';
import { loadFilterOptions } from '@/features/hr/lib/load-filter-options';
import { useServerDirectoryPagination } from '@/components/ui/paged-list';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import type { DeptTreeNode } from '@/features/hr/requests/lib/hierarchy-utils';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { resolveDirectoryLoadFailure } from '@/features/hr/lib/api/directory-load-error';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { useDefaultCompany } from '@/features/hr/organization/hooks/useActiveCompany';
import type { CreateDepartmentDto, UpdateDepartmentDto } from '@/features/hr/organization/lib/api/departments';
import { buildDepartmentForest, flattenDepartmentsTree, getDescendantDepartmentIds } from '@/features/hr/requests/lib/hierarchy-utils';
import type { HRDepartmentEntity } from '@/features/hr/requests/lib/types';
import { generateEntityCode } from '@/features/hr/requests/lib/types';
import { DEPARTMENT_EMPTY_FORM, type DepartmentDraftForm, type DepartmentRecord } from '@/features/system/organization/departments/constants/departments-directory';
import { createDepartment, deleteDepartment, loadDepartmentsDirectory, updateDepartment } from '@/features/system/organization/departments/services/departments.service';
import { ORGANIZATION_ARCHIVE_SCOPE_DEFAULT, ORGANIZATION_ARCHIVE_SCOPE_OPTIONS, organizationActiveListStatusQuery, type OrganizationArchiveScope } from '@/features/hr/organization/lib/archive-scope';


export function useDepartmentsDirectoryModel() {
  useSetPageTitle({ titleAr: 'الأقسام', descriptionAr: 'الهيكل التنظيمي وإدارة الأقسام', iconName: 'Building2' });

  const perms = usePagePermissions(DEPARTMENTS_PAGE_PERMISSIONS);
  const [apiAccessDenied, setApiAccessDenied] = React.useState(false);
  const accessDenied = !perms.canRead || apiAccessDenied;
  const branchFilterAccess = useFilterPermission(DEPARTMENTS_FILTER_PERMISSIONS.branch);

  const defaultCompanyId = useDefaultCompanyId();
  const { data: defaultCompany } = useDefaultCompany();

  const [departments, setDepartments] = React.useState<DepartmentRecord[]>([]);
  const [listError, setListError] = React.useState<string | null>(null);
  const [branches, setBranches] = React.useState<BranchResponseDto[]>([]);
  const [formBranches, setFormBranches] = React.useState<BranchResponseDto[]>([]);
  const [branchFilter, setBranchFilter] = React.useState('all');

  const companyLabel = React.useCallback(
    (companyId: string) =>
      defaultCompany?.nameAr
      ?? defaultCompany?.code
      ?? companyId.slice(0, 8),
    [defaultCompany],
  );

  const branchLabelFor = React.useCallback(
    (branchId: string) => {
      const branch = branches.find((b) => b.id === branchId);
      return branch?.nameAr ?? branch?.nameEn ?? branch?.code ?? undefined;
    },
    [branches],
  );

  const branchSelectOptions = React.useMemo(
    () => [
      { value: 'all', label: 'كل الفروع' },
      ...branches.map((b) => ({
        value: b.id,
        label: b.nameAr ?? b.nameEn ?? b.code ?? b.id.slice(0, 8),
      })),
    ],
    [branches],
  );

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [archiveScope, setArchiveScope] = React.useState<OrganizationArchiveScope>(
    ORGANIZATION_ARCHIVE_SCOPE_DEFAULT,
  );
  const [editId, setEditId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DepartmentDraftForm>(DEPARTMENT_EMPTY_FORM);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleteWarning, setDeleteWarning] = React.useState('');
  const [parentPickerDepartments, setParentPickerDepartments] = React.useState<DepartmentRecord[]>([]);
  const [parentPickerLoading, setParentPickerLoading] = React.useState(false);

  // Isolated from the departments load below: a denied/failed branches fetch
  // (e.g. missing branches.read) must not block the departments list itself.
  React.useEffect(() => {
    if (!defaultCompanyId) {
      setBranches([]);
      return;
    }
    void loadFilterOptions({
      loader: () =>
        branchesApi.getAll({
          companyId: defaultCompanyId,
          limit: 200,
          ...organizationActiveListStatusQuery(),
        }),
      fallback: () => ({ items: [] as BranchResponseDto[], pagination: { page: 1, limit: 0, total: 0, totalPages: 0 } }),
    }).then((res) => setBranches(res?.items ?? []));
  }, [defaultCompanyId]);

  const loadBulk = React.useCallback(async () => {
    if (!defaultCompanyId) {
      setDepartments([]);
      return { items: [] as DeptTreeNode[], total: 0 };
    }
    setListError(null);
    try {
      const data = await loadDepartmentsDirectory({
        companyId: defaultCompanyId,
        archiveScope,
        branchId: branchFilter === 'all' ? null : branchFilter,
      });
      setDepartments(data.departments);
      setApiAccessDenied(false);
      const flat = flattenDepartmentsTree(buildDepartmentForest(data.departments));
      return { items: flat, total: flat.length };
    } catch (err) {
      const failure = resolveDirectoryLoadFailure(err, 'departments.load');
      setApiAccessDenied(failure.accessDenied);
      setListError(failure.listError);
      return { items: [], total: 0 };
    }
  }, [archiveScope, branchFilter, defaultCompanyId]);

  const {
    items: filtered,
    loading,
    pagination,
    reload: reloadList,
  } = useServerDirectoryPagination<DeptTreeNode>(
    async () => ({ items: [], total: 0 }),
    { bulkMode: true, loadBulk, enabled: !!defaultCompanyId && perms.canRead, resetDeps: [defaultCompanyId, branchFilter, archiveScope] },
  );

  const loadFormBranches = React.useCallback(async (companyId: string | null) => {
    if (!companyId) {
      setFormBranches([]);
      return;
    }
    try {
      const branchRes = await branchesApi.getAll({
        companyId,
        limit: 200,
        ...organizationActiveListStatusQuery(),
      });
      setFormBranches(branchRes.items);
    } catch {
      setFormBranches([]);
    }
  }, []);

  React.useEffect(() => {
    if (!drawerOpen) return;
    void loadFormBranches(defaultCompanyId);
  }, [drawerOpen, defaultCompanyId, loadFormBranches]);

  const loadParentPickerDepartments = React.useCallback(async () => {
    if (!defaultCompanyId || !draft.branchId) {
      setParentPickerDepartments([]);
      return;
    }
    setParentPickerLoading(true);
    try {
      const data = await loadDepartmentsDirectory({
        companyId: defaultCompanyId,
        branchId: draft.branchId,
        archiveScope: 'active',
      });
      setParentPickerDepartments(data.departments);
    } catch {
      setParentPickerDepartments(departments.filter((d) => d.branchId === draft.branchId));
    } finally {
      setParentPickerLoading(false);
    }
  }, [defaultCompanyId, departments, draft.branchId]);

  React.useEffect(() => {
    if (!drawerOpen) return;
    void loadParentPickerDepartments();
  }, [drawerOpen, loadParentPickerDepartments]);

  const forest = React.useMemo(() => buildDepartmentForest(departments), [departments]);

  const openCreate = useLatestCallback(() => {
    if (!perms.canCreate) return;
    setEditId(null);
    setDraft({
      ...DEPARTMENT_EMPTY_FORM,
      companyId: defaultCompanyId ?? '',
      branchId: branchFilter !== 'all' ? branchFilter : '',
      sortOrder: departments.length + 1,
    });
    setFormError(null);
    setDrawerOpen(true);
  });

  const openEdit = React.useCallback((dept: HRDepartmentEntity) => {
    if (!perms.canUpdate) return;
    const record = dept as DepartmentRecord;
    setEditId(dept.id);
    setDraft({
      companyId: record.companyId,
      branchId: record.branchId,
      nameAr: dept.nameAr,
      parentId: dept.parentId ?? '',
      sortOrder: dept.sortOrder,
      isActive: dept.isActive,
    });
    setFormError(null);
    setDrawerOpen(true);
  }, [perms.canUpdate]);

  const patch = React.useCallback(<K extends keyof DepartmentDraftForm>(k: K, v: DepartmentDraftForm[K]) => {
    setDraft((d) => {
      if (k === 'branchId') {
        return { ...d, branchId: v as string, parentId: '' };
      }
      return { ...d, [k]: v };
    });
  }, []);

  const handleSave = React.useCallback(async () => {
    if (editId ? !perms.canUpdate : !perms.canCreate) return;
    const companyId = defaultCompanyId ?? draft.companyId;
    if (!draft.nameAr.trim()) {
      setFormError('اسم القسم مطلوب');
      return;
    }
    if (!companyId || !draft.branchId) {
      setFormError('اختر الفرع');
      return;
    }

    setFormError(null);
    try {
      if (editId) {
        const payload: UpdateDepartmentDto = {
          nameAr: draft.nameAr.trim(),
          parentDepartmentId: draft.parentId ? draft.parentId : null,
          isActive: draft.isActive,
        };
        await updateDepartment(editId, payload);
      } else {
        const payload: CreateDepartmentDto = {
          companyId,
          branchId: draft.branchId,
          code: generateEntityCode(draft.nameAr.trim(), 'dept'),
          nameAr: draft.nameAr.trim(),
          parentDepartmentId: draft.parentId ? draft.parentId : null,
          isActive: draft.isActive,
        };
        await createDepartment(payload);
      }
      await reloadList();
      setDrawerOpen(false);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'departments.save');
      setFormError(displayMessage);
    }
  }, [defaultCompanyId, draft, editId, perms.canCreate, perms.canUpdate, reloadList]);

  const confirmDelete = React.useCallback(
    (id: string) => {
      if (!perms.canDelete) return;
      const descendants = getDescendantDepartmentIds(departments, id).length;
      setDeleteWarning(
        descendants > 0
          ? `سيتم حذف ${descendants} قسم فرعي أيضاً وجميع أنواع الطلبات المرتبطة.`
          : 'سيتم حذف القسم وجميع أنواع الطلبات المرتبطة به.',
      );
      setDeleteId(id);
    },
    [departments, perms.canDelete],
  );

  const handleDelete = React.useCallback(async () => {
    if (!deleteId || !perms.canDelete) return;
    setFormError(null);
    try {
      await deleteDepartment(deleteId);
      await reloadList();
      setDeleteId(null);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'departments.delete');
      setFormError(displayMessage);
    }
  }, [deleteId, perms.canDelete, reloadList]);

  const excludeIds = editId
    ? new Set([editId, ...getDescendantDepartmentIds(departments, editId)])
    : new Set<string>();

  const parentOptions = React.useMemo(() => {
    const source = parentPickerDepartments.length > 0 ? parentPickerDepartments : departments;
    const scoped = draft.branchId
      ? source.filter((d) => d.branchId === draft.branchId)
      : source;
    const ordered = flattenDepartmentsTree(buildDepartmentForest(scoped));
    return [
      { value: '', label: '— بدون أصل (قسم رئيسي) —' },
      ...ordered
        .filter(({ dept }) => !excludeIds.has(dept.id))
        .map(({ dept, depth }) => ({
          value: dept.id,
          label: `${'　'.repeat(depth)}${dept.nameAr}`,
        })),
    ];
  }, [departments, draft.branchId, excludeIds, parentPickerDepartments]);

  // The directory is bulk-loaded for the current branch/archive filters, so the
  // export uses the complete list in the same tree order as the grid.

  const exportSubtitleLines = React.useMemo(() => {
    const branch = branchSelectOptions.find((o) => o.value === branchFilter)?.label ?? 'كل الفروع';
    const scope = ORGANIZATION_ARCHIVE_SCOPE_OPTIONS.find((o) => o.value === archiveScope)?.label ?? '';
    return [`الفرع: ${branch} — العرض: ${scope}`];
  }, [archiveScope, branchFilter, branchSelectOptions]);

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        onDateBoundsChange={() => {}}
        inlineSelects={[
          {
            id: 'branch',
            value: branchFilter,
            onChange: branchFilterAccess.guardOnChange(setBranchFilter),
            onOpen: branchFilterAccess.guardOnOpen(),
            placeholder: 'الفرع',
            options: branchSelectOptions,
          },
          {
            id: 'archive',
            value: archiveScope,
            onChange: (v) => setArchiveScope(v as OrganizationArchiveScope),
            placeholder: 'العرض',
            options: ORGANIZATION_ARCHIVE_SCOPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          },
        ]}
      />
    ),
    [archiveScope, branchFilter, branchSelectOptions, branchFilterAccess.allowed],
  );

  return {
    exportSubtitleLines,
    perms,
    accessDenied,
    departments,
    loading,
    pagination,
    listError,
    filtered,
    drawerOpen,
    setDrawerOpen,
    editId,
    draft,
    patch,
    formError,
    deleteId,
    setDeleteId,
    deleteWarning,
    parentOptions,
    parentPickerLoading,
    openCreate,
    openEdit,
    handleSave,
    confirmDelete,
    handleDelete,
    branchLabel: branchLabelFor,
    companyLabel,
    formBranches,
  };
}

export type DepartmentsDirectoryModel = ReturnType<typeof useDepartmentsDirectoryModel>;
