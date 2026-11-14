'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import type { AtsJob } from '@/features/hr/recruitment/lib/ats/types';
import { RECRUITMENT_ARCHIVE_SCOPE_DEFAULT, RECRUITMENT_ARCHIVE_SCOPE_OPTIONS } from '@/features/hr/recruitment/lib/archive-scope';
import type { RecruitmentArchiveScope } from '@/features/hr/recruitment/lib/api/types';
import { recruitmentGlobalRoutes } from '@/features/hr/recruitment/lib/recruitment-routes';
import { ATS_JOB_STATUS_LABELS, ATS_JOB_STATUS_ORDER, ATS_JOB_TYPE_LABELS, ATS_JOB_TYPE_ORDER, type AtsJobStatusFilter, type AtsJobTypeFilter } from '@/features/hr/recruitment/ats/constants/ats-jobs-list';
import { useRecruitmentApplicantsList, useRecruitmentJobsList, useRecruitmentMutations } from '@/features/hr/recruitment/hooks/useRecruitment';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';


export function useAtsJobsListModel() {
  const router = useRouter();

  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [archiveScope, setArchiveScope] = React.useState<RecruitmentArchiveScope>(
    RECRUITMENT_ARCHIVE_SCOPE_DEFAULT,
  );
  const [typeFilter, setTypeFilter] = React.useState<AtsJobTypeFilter>('all');
  const [statusFilter, setStatusFilter] = React.useState<AtsJobStatusFilter>('all');
  const [qrJob, setQrJob] = React.useState<AtsJob | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data: jobsData,
    isLoading,
    isError,
    error,
    refetch: reloadJobs,
  } = useRecruitmentJobsList(debouncedSearch.trim() || undefined, archiveScope);
  const { data: applicants = [] } = useRecruitmentApplicantsList({});
  const { deleteJob, toggleJobActive } = useRecruitmentMutations();

  const jobs = jobsData?.jobs ?? [];

  const statusCounts = React.useMemo(() => {
    const counts: Record<AtsJobStatusFilter, number> = { all: jobs.length, active: 0, inactive: 0 };
    for (const job of jobs) {
      if (job.isActive) counts.active += 1;
      else counts.inactive += 1;
    }
    return counts;
  }, [jobs]);

  const filtered = React.useMemo(() => jobs.filter((job) => {
    if (typeFilter !== 'all' && job.type !== typeFilter) return false;
    if (statusFilter === 'active' && !job.isActive) return false;
    if (statusFilter === 'inactive' && job.isActive) return false;
    return true;
  }), [jobs, typeFilter, statusFilter]);

  const activeFilterCount =
    (search.trim() ? 1 : 0)
    + (archiveScope !== RECRUITMENT_ARCHIVE_SCOPE_DEFAULT ? 1 : 0)
    + (typeFilter !== 'all' ? 1 : 0)
    + (statusFilter !== 'all' ? 1 : 0);

  const listError = isError
    ? handleApiError(error, 'recruitment.jobs.list').displayMessage
    : null;

  const handleDelete = React.useCallback(async () => {
    if (!deleteId) return;
    try {
      await deleteJob.mutateAsync(deleteId);
      setDeleteId(null);
      toast.success('تم أرشفة الوظيفة ومتقدميها');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'recruitment.jobs.delete');
      toast.error(displayMessage);
    }
  }, [deleteId, deleteJob]);

  const handleToggle = React.useCallback(async (job: AtsJob) => {
    try {
      await toggleJobActive.mutateAsync(job.id);
      toast.success(
        job.isActive
          ? 'تم إيقاف الوظيفة وأرشفة متقدميها'
          : 'تم تفعيل الوظيفة',
      );
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'recruitment.jobs.toggle');
      toast.error(displayMessage);
    }
  }, [toggleJobActive]);

  const openCreateJob = React.useCallback(() => {
    router.push(recruitmentGlobalRoutes.createJob);
  }, [router]);


  const exportSubtitleLines = React.useMemo(() => {
    const parts = [
      `العرض: ${RECRUITMENT_ARCHIVE_SCOPE_OPTIONS.find((o) => o.value === archiveScope)?.label ?? ''}`,
      typeFilter !== 'all' ? `النوع: ${ATS_JOB_TYPE_LABELS[typeFilter]}` : null,
      statusFilter !== 'all' ? `الحالة: ${ATS_JOB_STATUS_LABELS[statusFilter]}` : null,
      debouncedSearch.trim() ? `بحث: ${debouncedSearch.trim()}` : null,
    ].filter(Boolean);
    return [parts.join(' — ')];
  }, [archiveScope, debouncedSearch, statusFilter, typeFilter]);

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showEmployeePicker={false}
        leadingFilters={(
          <EntityFilterSearchField
            value={search}
            onChange={setSearch}
            placeholder="بحث بالوظيفة أو القسم…"
          />
        )}
        inlineSelects={[
          {
            id: 'archive',
            value: archiveScope,
            onChange: (v) => setArchiveScope(v as RecruitmentArchiveScope),
            placeholder: 'العرض',
            options: RECRUITMENT_ARCHIVE_SCOPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          },
          {
            id: 'type',
            value: typeFilter,
            onChange: (v) => setTypeFilter(v as AtsJobTypeFilter),
            placeholder: 'نوع الوظيفة',
            options: ATS_JOB_TYPE_ORDER.map((key) => ({ value: key, label: ATS_JOB_TYPE_LABELS[key] })),
          },
        ]}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => setStatusFilter(v as AtsJobStatusFilter)}
        statusOrder={ATS_JOB_STATUS_ORDER}
        statusLabels={ATS_JOB_STATUS_LABELS}
        statusCounts={statusCounts}
        onDateBoundsChange={() => {}}
      />
    ),
    [search, archiveScope, typeFilter, statusFilter, statusCounts],
  );

  return {
    activeFilterCount,
    exportSubtitleLines,
    router,
    filtered,
    applicants,
    loading: isLoading,
    listError,
    qrJob,
    setQrJob,
    deleteId,
    setDeleteId,
    handleDelete,
    handleToggle,
    openCreateJob,
    reloadJobs,
    deletePending: deleteJob.isPending,
  };
}

export type AtsJobsListModel = ReturnType<typeof useAtsJobsListModel>;
