'use client';

import * as React from 'react';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { resolveDirectoryLoadFailure } from '@/features/hr/lib/api/directory-load-error';
import { useServerDirectoryPagination } from '@/components/ui/paged-list';
import { fetchAllPaginatedItems } from '@/features/hr/lib/api/client';
import { publicHolidaysApi } from '@/features/hr/leaves/public-holidays/lib/api/public-holidays';
import { resolveOrganizationScope } from '@/features/hr/organization/lib/api/organization-context';
import type { HRPublicHolidayRecord } from '@/features/hr/leaves/public-holidays/types';
import { slugify } from '@/features/hr/requests/lib/types';
import {
  createPublicHoliday,
  deletePublicHoliday,
  mapPublicHolidayResponse,
  updatePublicHoliday,
} from '@/features/hr/leaves/public-holidays/services/public-holidays.service';

export type PublicHolidayDraft = Omit<HRPublicHolidayRecord, 'id' | 'updatedAt'>;

const EMPTY_DRAFT: PublicHolidayDraft = {
  code: '',
  nameAr: '',
  nameEn: '',
  date: '',
  recurring: true,
  startDate: null,
  endDate: null,
  sortOrder: 0,
  isActive: true,
};

export function usePublicHolidaysPanelModel() {
  const [listError, setListError] = React.useState<string | null>(null);
  const [apiAccessDenied, setApiAccessDenied] = React.useState(false);
  const [companyId, setCompanyId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<PublicHolidayDraft>(EMPTY_DRAFT);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);

  const loadPage = React.useCallback(async (page: number, pageSize: number) => {
    setListError(null);
    try {
      const scope = await resolveOrganizationScope();
      const cid = scope.companyId ?? null;
      setCompanyId(cid);
      const res = await publicHolidaysApi.getAll(
        cid ? { companyId: cid, page, limit: pageSize } : { page, limit: pageSize },
      );
      const mapped = res.items.map(mapPublicHolidayResponse).sort((a, b) => a.sortOrder - b.sortOrder);
      setApiAccessDenied(false);
      return { items: mapped, total: res.pagination.total };
    } catch (err) {
      const failure = resolveDirectoryLoadFailure(err, 'public-holidays.load');
      setApiAccessDenied(failure.accessDenied);
      setListError(failure.listError);
      return { items: [], total: 0 };
    }
  }, []);

  const {
    items: sorted,
    loading,
    pagination,
    reload,
    total,
  } = useServerDirectoryPagination<HRPublicHolidayRecord>(loadPage);

  /** All public holidays (all pages) — for PDF / Excel export. */
  const loadAllForExport = React.useCallback(async (): Promise<HRPublicHolidayRecord[]> => {
    const scope = await resolveOrganizationScope();
    const cid = scope.companyId ?? null;
    const res = await fetchAllPaginatedItems((page, limit) =>
      publicHolidaysApi.getAll(cid ? { companyId: cid, page, limit } : { page, limit }),
    );
    return res.items.map(mapPublicHolidayResponse).sort((a, b) => a.sortOrder - b.sortOrder);
  }, []);

  const openCreate = useLatestCallback(() => {
    setEditId(null);
    setDraft({ ...EMPTY_DRAFT, sortOrder: total + 1 });
    setError(null);
    setOpen(true);
  });

  const openEdit = React.useCallback((item: HRPublicHolidayRecord) => {
    setEditId(item.id);
    setDraft({
      code: item.code,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      date: item.date,
      recurring: item.recurring,
      startDate: item.startDate,
      endDate: item.endDate,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    });
    setError(null);
    setOpen(true);
  }, []);

  const patch = React.useCallback(<K extends keyof PublicHolidayDraft>(k: K, v: PublicHolidayDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
  }, []);

  const save = React.useCallback(async () => {
    if (!draft.nameAr.trim()) {
      setError('الاسم مطلوب');
      return;
    }
    // A recurring holiday repeats on a month-day; any other (Eid moves every
    // year) needs its dates, from and to.
    if (draft.recurring && !draft.date.match(/^\d{2}-\d{2}$/)) {
      setError('التاريخ يجب أن يكون بصيغة MM-DD (مثال: 09-23)');
      return;
    }
    if (!draft.recurring && !draft.startDate) {
      setError('حدّد أول يوم في العطلة');
      return;
    }
    if (!draft.recurring && draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
      setError('آخر يوم في العطلة قبل أول يوم');
      return;
    }
    const monthDay = draft.recurring ? draft.date : (draft.startDate ?? '').slice(5);
    const startDate = draft.recurring ? null : draft.startDate;
    const endDate = draft.recurring ? null : draft.endDate || draft.startDate;
    if (!companyId) {
      setError('تعذر تحديد الشركة');
      return;
    }
    setError(null);
    try {
      const nameAr = draft.nameAr.trim();
      if (editId) {
        await updatePublicHoliday(editId, {
          nameAr,
          nameEn: nameAr,
          monthDay,
          recurring: draft.recurring,
          startDate,
          endDate,
          sortOrder: draft.sortOrder,
          isActive: draft.isActive,
        });
      } else {
        await createPublicHoliday({
          companyId,
          code: slugify(nameAr) || `hol-${Date.now().toString(36)}`,
          nameAr,
          nameEn: nameAr,
          monthDay,
          recurring: draft.recurring,
          startDate,
          endDate,
          sortOrder: draft.sortOrder,
          isActive: draft.isActive,
        });
      }
      await reload();
      setOpen(false);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'public-holidays.save');
      setError(displayMessage);
    }
  }, [companyId, draft, editId, reload]);

  const remove = React.useCallback(async () => {
    if (!confirmId) return;
    try {
      await deletePublicHoliday(confirmId);
      setConfirmId(null);
      await reload();
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'public-holidays.delete');
      setError(displayMessage);
    }
  }, [confirmId, reload]);

  return {
    sorted,
    loading,
    pagination,
    listError,
    accessDenied: apiAccessDenied,
    open,
    setOpen,
    editId,
    draft,
    error,
    confirmId,
    setConfirmId,
    openCreate,
    openEdit,
    patch,
    save,
    remove,
    loadAllForExport,
  };
}
