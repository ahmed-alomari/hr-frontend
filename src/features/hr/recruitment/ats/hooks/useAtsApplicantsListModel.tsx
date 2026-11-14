'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import type { AtsPipelineStage } from '@/features/hr/recruitment/lib/ats/types';
import { RECRUITMENT_ARCHIVE_SCOPE_DEFAULT, RECRUITMENT_ARCHIVE_SCOPE_OPTIONS } from '@/features/hr/recruitment/lib/archive-scope';
import type { RecruitmentArchiveScope } from '@/features/hr/recruitment/lib/api/types';
import { ATS_APPLICANT_STAGE_LABELS, ATS_APPLICANT_STAGE_ORDER, type AtsApplicantStageFilter } from '@/features/hr/recruitment/ats/constants/ats-applicants-list';
import { useRecruitmentApplicant, useRecruitmentApplicantsList, useRecruitmentJobDetail, useRecruitmentJobFormsMap, useRecruitmentJobsList } from '@/features/hr/recruitment/hooks/useRecruitment';


export function useAtsApplicantsListModel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlJobId = searchParams.get('jobId') ?? '';
  const detailId = searchParams.get('detail') ?? '';

  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [stageFilter, setStageFilter] = React.useState<AtsApplicantStageFilter>('all');
  const [jobFilter, setJobFilter] = React.useState(urlJobId || 'all');
  const [dateBounds, setDateBounds] = React.useState({ from: '', to: '' });
  const [archiveScope, setArchiveScope] = React.useState<RecruitmentArchiveScope>(
    RECRUITMENT_ARCHIVE_SCOPE_DEFAULT,
  );

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    if (urlJobId) setJobFilter(urlJobId);
  }, [urlJobId]);

  const { data: jobsData } = useRecruitmentJobsList(undefined, RECRUITMENT_ARCHIVE_SCOPE_DEFAULT);
  const jobs = jobsData?.jobs ?? [];
  const { formById } = useRecruitmentJobFormsMap(jobs.map((j) => j.id));

  const jobSelectOptions = React.useMemo(
    () => [
      { value: 'all', label: 'جميع الوظائف' },
      ...jobs.map((j) => ({ value: j.id, label: j.title })),
    ],
    [jobs],
  );

  const listQuery = React.useMemo(() => ({
    jobId: jobFilter !== 'all' ? jobFilter : undefined,
    pipelineStage: stageFilter !== 'all' ? (stageFilter as AtsPipelineStage) : undefined,
    submittedFrom: dateBounds.from || undefined,
    submittedTo: dateBounds.to || undefined,
    search: debouncedSearch.trim() || undefined,
    archiveScope,
  }), [jobFilter, stageFilter, dateBounds.from, dateBounds.to, debouncedSearch, archiveScope]);

  const { data: applicants = [], isLoading } = useRecruitmentApplicantsList(listQuery);
  const { data: detailApplicantFromApi } = useRecruitmentApplicant(detailId || undefined);
  const detailApplicant = detailApplicantFromApi ?? applicants.find((a) => a.id === detailId);
  const { data: detailJobData } = useRecruitmentJobDetail(detailApplicant?.jobId);
  const detailForm = detailJobData?.form ?? (detailApplicant ? formById.get(detailApplicant.formId) : undefined);

  const updateJobFilter = React.useCallback((value: string) => {
    setJobFilter(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete('jobId');
    else params.set('jobId', value);
    params.delete('detail');
    const qs = params.toString();
    router.replace(qs ? `/hr/recruitment/ats-applicants?${qs}` : '/hr/recruitment/ats-applicants');
  }, [router, searchParams]);

  const openApplicantDetail = React.useCallback((applicantId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('detail', applicantId);
    if (jobFilter !== 'all') params.set('jobId', jobFilter);
    router.replace(`/hr/recruitment/ats-applicants?${params.toString()}`);
  }, [router, searchParams, jobFilter]);

  const closeApplicantDetail = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('detail');
    const qs = params.toString();
    router.replace(qs ? `/hr/recruitment/ats-applicants?${qs}` : '/hr/recruitment/ats-applicants');
  }, [router, searchParams]);

  const stageCounts = React.useMemo(() => {
    const counts: Record<AtsApplicantStageFilter, number> = {
      all: applicants.length,
      applied: 0,
      screening: 0,
      interview: 0,
      technical: 0,
      offer: 0,
      hired: 0,
      rejected: 0,
    };
    for (const applicant of applicants) {
      counts[applicant.pipelineStage] = (counts[applicant.pipelineStage] ?? 0) + 1;
    }
    return counts;
  }, [applicants]);

  const activeFilterCount =
    (search.trim() ? 1 : 0)
    + (stageFilter !== 'all' ? 1 : 0)
    + (jobFilter !== 'all' ? 1 : 0)
    + (dateBounds.from || dateBounds.to ? 1 : 0)
    + (archiveScope !== RECRUITMENT_ARCHIVE_SCOPE_DEFAULT ? 1 : 0);

  // Applicants are loaded whole for the current filters — export that same list.

  const exportSubtitleLines = React.useMemo(() => {
    const parts = [
      jobFilter !== 'all' ? `الوظيفة: ${jobSelectOptions.find((o) => o.value === jobFilter)?.label ?? ''}` : null,
      stageFilter !== 'all' ? `المرحلة: ${ATS_APPLICANT_STAGE_LABELS[stageFilter]}` : null,
      dateBounds.from || dateBounds.to ? `الفترة: ${dateBounds.from || '…'} — ${dateBounds.to || '…'}` : null,
      `العرض: ${RECRUITMENT_ARCHIVE_SCOPE_OPTIONS.find((o) => o.value === archiveScope)?.label ?? ''}`,
      debouncedSearch.trim() ? `بحث: ${debouncedSearch.trim()}` : null,
    ].filter(Boolean);
    return [parts.join(' — ')];
  }, [archiveScope, dateBounds.from, dateBounds.to, debouncedSearch, jobFilter, jobSelectOptions, stageFilter]);

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showEmployeePicker={false}
        leadingFilters={(
          <EntityFilterSearchField
            value={search}
            onChange={setSearch}
            placeholder="بحث بالاسم…"
          />
        )}
        inlineSelects={[
          {
            id: 'job',
            value: jobFilter,
            onChange: updateJobFilter,
            placeholder: 'الوظيفة',
            options: jobSelectOptions,
            className: 'w-[11rem] max-w-[11rem]',
          },
          {
            id: 'archive',
            value: archiveScope,
            onChange: (v) => setArchiveScope(v as RecruitmentArchiveScope),
            placeholder: 'العرض',
            options: RECRUITMENT_ARCHIVE_SCOPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          },
        ]}
        statusFilter={stageFilter}
        onStatusFilterChange={(v) => setStageFilter(v as AtsApplicantStageFilter)}
        statusOrder={ATS_APPLICANT_STAGE_ORDER}
        statusLabels={ATS_APPLICANT_STAGE_LABELS}
        statusCounts={stageCounts}
        defaultDateFilterTab="all"
        onDateBoundsChange={setDateBounds}
      />
    ),
    [
      search,
      jobFilter,
      archiveScope,
      stageFilter,
      stageCounts,
      jobSelectOptions,
      updateJobFilter,
      dateBounds.from,
      dateBounds.to,
    ],
  );

  return {
    activeFilterCount,
    exportSubtitleLines,
    listQuery,
    jobFilter,
    applicants,
    jobs,
    formById,
    loading: isLoading,
    stageFilter,
    detailApplicant,
    detailForm,
    detailId,
    openApplicantDetail,
    closeApplicantDetail,
  };
}

export type AtsApplicantsListModel = ReturnType<typeof useAtsApplicantsListModel>;
