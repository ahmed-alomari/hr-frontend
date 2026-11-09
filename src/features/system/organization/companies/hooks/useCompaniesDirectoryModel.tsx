'use client';

import * as React from 'react';
import { useSetPageTitle } from '@/components/layouts/page-title-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { usePagePermissions } from '@/features/auth/permissions';
import { COMPANIES_PAGE_PERMISSIONS } from '@/features/system/organization/companies/permissions';
import { toast } from 'sonner';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { resolveDirectoryLoadFailure } from '@/features/hr/lib/api/directory-load-error';
import { companiesApi, type CreateCompanyDto, type UpdateCompanyDto } from '@/features/hr/organization/lib/api/companies';
import { useServerDirectoryPagination } from '@/components/ui/paged-list';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import { slugify } from '@/features/hr/requests/lib/types';
import { formatDisplayDateTime } from '@/shared/utils';
import { COMPANY_EMPTY_FORM, companyToDraftForm, type CompanyDraftForm, type CompanyRow } from '@/features/system/organization/companies/constants/companies-directory';


export function useCompaniesDirectoryModel() {
  useSetPageTitle({
    titleAr: 'الشركات',
    descriptionAr: 'إدارة الشركات (جذور المستأجرين) وبياناتها التعريفية.',
    iconName: 'Building2',
  });

  const perms = usePagePermissions(COMPANIES_PAGE_PERMISSIONS);
  const [apiAccessDenied, setApiAccessDenied] = React.useState(false);
  const accessDenied = !perms.canRead || apiAccessDenied;

  const [listError, setListError] = React.useState<string | null>(null);
  const [layoutView, setLayoutView] = React.useState<'grid' | 'table'>('table');
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<CompanyDraftForm>(COMPANY_EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [viewRow, setViewRow] = React.useState<CompanyRow | null>(null);

  const loadPage = React.useCallback(async (page: number, pageSize: number) => {
    try {
      const res = await companiesApi.getAll({ page, limit: pageSize });
      setListError(null);
      setApiAccessDenied(false);
      return { items: res.items as CompanyRow[], total: res.pagination.total };
    } catch (err) {
      const failure = resolveDirectoryLoadFailure(err, 'companies.load');
      setApiAccessDenied(failure.accessDenied);
      setListError(failure.listError);
      return { items: [], total: 0 };
    }
  }, []);

  const {
    items: companies,
    loading,
    pagination,
    reload: reloadList,
  } = useServerDirectoryPagination<CompanyRow>(loadPage, { enabled: perms.canRead, resetDeps: [layoutView] });

  const patch = React.useCallback((p: Partial<CompanyDraftForm>) => {
    setForm((f) => ({ ...f, ...p }));
  }, []);

  const openCreate = useLatestCallback(() => {
    if (!perms.canCreate) return;
    setEditId(null);
    setForm(COMPANY_EMPTY_FORM);
    setError(null);
    setDrawerOpen(true);
  });

  const openEdit = React.useCallback((row: CompanyRow) => {
    if (!perms.canUpdate) return;
    setEditId(row.id);
    setForm(companyToDraftForm(row));
    setError(null);
    setDrawerOpen(true);
  }, [perms.canUpdate]);

  const handleSave = React.useCallback(async () => {
    if (editId ? !perms.canUpdate : !perms.canCreate) return;
    if (!form.nameAr.trim()) { setError('اسم الشركة مطلوب'); return; }
    const code = form.code.trim() || slugify(form.nameAr);

    setSaving(true);
    setError(null);
    try {
      const base = {
        code,
        nameAr: form.nameAr.trim(),
        commercialRegistrationNo: form.commercialRegistrationNo.trim() || null,
        taxNumber: form.taxNumber.trim() || null,
        isActive: form.isActive,
      };
      if (editId) {
        await companiesApi.update(editId, base as UpdateCompanyDto);
        toast.success('تم تحديث الشركة');
      } else {
        await companiesApi.create(base as CreateCompanyDto);
        toast.success('تم إنشاء الشركة');
      }
      await reloadList();
      setDrawerOpen(false);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'companies.save');
      setError(displayMessage);
    } finally {
      setSaving(false);
    }
  }, [editId, form, perms.canCreate, perms.canUpdate, reloadList]);

  const handleDelete = React.useCallback(async () => {
    if (!confirmId || !perms.canDelete) return;
    try {
      await companiesApi.remove(confirmId);
      await reloadList();
      setConfirmId(null);
      toast.success('تم حذف الشركة');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'companies.delete');
      toast.error(displayMessage);
      setConfirmId(null);
    }
  }, [confirmId, perms.canDelete, reloadList]);

  const formatDate = React.useCallback(
    (iso: string | null) => (iso ? formatDisplayDateTime(iso) : '—'),
    [],
  );


  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        onDateBoundsChange={() => {}}
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
    [layoutView],
  );

  return {
    perms,
    accessDenied,
    companies,
    loading,
    listError,
    pagination,
    layoutView,
    drawerOpen,
    setDrawerOpen,
    editId,
    form,
    patch,
    saving,
    error,
    confirmId,
    setConfirmId,
    viewRow,
    setViewRow,
    openCreate,
    openEdit,
    handleSave,
    handleDelete,
    formatDate,
  };
}

export type CompaniesDirectoryModel = ReturnType<typeof useCompaniesDirectoryModel>;
