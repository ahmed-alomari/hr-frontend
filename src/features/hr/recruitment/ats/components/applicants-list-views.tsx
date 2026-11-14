'use client';

import { exportDateTime } from '@/features/hr/requests/lib/list-export-format';
import type { AtsApplicant } from '@/features/hr/recruitment/lib/ats/types';
import type { ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews } from '@/components/ui/paged-list';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import { Users, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getApplicantName, getInitials } from '@/features/hr/recruitment/lib/ats/utils';
import { ATS_STAGE_BADGE, ATS_STAGE_TABS, scoreBarTone } from '@/features/hr/recruitment/lib/ats/stage-styles';
import { DisplayDate } from '@/components/ui/table-cells';
import { RecruitmentJobNav } from '@/features/hr/recruitment/ats/components/recruitment-job-nav';
import { AtsApplicantDetailDialog } from '@/features/hr/recruitment/ats/components/ats-applicant-detail-dialog';
import { EmptyState } from '@/components/ui/shared-dialogs';
import type { AtsApplicantsListModel } from '@/features/hr/recruitment/ats/hooks/useAtsApplicantsListModel';

type Props = { model: AtsApplicantsListModel };

function ScoreBar({ score }: { score: number }) {
  const { bar, text } = scoreBarTone(score);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[10px] font-bold tabular-nums ${text}`}>{score}</span>
    </div>
  );
}

export function ApplicantsListViews({ model }: Props) {
  const {
    jobFilter,
    applicants,
    jobs,
    formById,
    loading,
    stageFilter,
    detailApplicant,
    detailForm,
    detailId,
    openApplicantDetail,
    closeApplicantDetail,
    activeFilterCount,
    exportSubtitleLines,
    listQuery,
  } = model;

  const nameOf = (app: AtsApplicant) => {
    const form = formById.get(app.formId);
    return form ? getApplicantName(app, form.fields) : 'متقدم';
  };
  const jobOf = (app: AtsApplicant) => jobs.find((j) => j.id === app.jobId)?.title ?? '—';
  const stageOf = (app: AtsApplicant) => {
    const stage = ATS_STAGE_TABS.find((s) => s.key === app.pipelineStage)?.label ?? app.pipelineStage;
    return app.isArchived ? `${stage} — مؤرشف` : stage;
  };
  const scoreText = (app: AtsApplicant) => (app.score ? String(app.score.finalScore) : 'بدون تقييم');
  const columns: ColumnDef<AtsApplicant>[] = [
    { key: 'name', title: 'الاسم', render: nameOf },
    { key: 'job', title: 'الوظيفة', render: jobOf },
    { key: 'stage', title: 'المرحلة', render: stageOf },
    { key: 'submittedAt', title: 'تاريخ التقديم', render: (app) => <DisplayDate value={app.submittedAt} mode="datetime" className="text-xs" /> },
    { key: 'score', title: 'التقييم', render: (app) => (app.score ? <ScoreBar score={app.score.finalScore} /> : <span className="text-xs text-muted-foreground">بدون تقييم</span>) },
  ];
  const tools = useListTools<AtsApplicant>({
    section: 'recruitment',
    page: 'applicants',
    columns,
    rows: applicants,
    resetKey: JSON.stringify(listQuery),
    fields: {
      name: { kind: 'name', text: nameOf },
      job: { text: jobOf, group: jobOf },
      stage: { kind: 'status', text: stageOf, group: stageOf },
      submittedAt: { kind: 'date', text: (app) => exportDateTime(app.submittedAt), sort: (app) => app.submittedAt ?? '', group: (app) => (app.submittedAt ? app.submittedAt.slice(0, 7) : null) },
      score: { text: scoreText, sort: (app) => app.score?.finalScore ?? -1 },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        {tools.exportMenu('سجل المتقدمين', 'recruitment-applicants', exportSubtitleLines)}
      </div>
    ),
    [activeFilterCount, exportSubtitleLines, tools.depsKey],
  );

  const stageLabel = ATS_STAGE_TABS.find((s) => s.key === stageFilter)?.label ?? '';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 animate-fade-in">
      <RecruitmentJobNav
        jobId={jobFilter !== 'all' ? jobFilter : undefined}
        active="applicants"
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="h-4 w-2/3 rounded-md bg-muted animate-pulse" />
                <div className="h-3 w-1/2 rounded-md bg-muted animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : applicants.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              icon={Users}
              title={stageFilter !== 'all' ? `لا يوجد متقدمون في ${stageLabel}` : 'لا يوجد متقدمون'}
              description="جرّب تعديل معايير التصفية"
            />
          </CardContent>
        </Card>
      ) : (
        <ListToolsTable tools={tools} keyExtractor={(app) => app.id} onRowClick={(app) => openApplicantDetail(app.id)}>
        <DirectoryPagedViews items={tools.rows} resetDeps={[JSON.stringify(listQuery), tools.sort.sortKey]}>
          {(pageItems) => (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((app) => {
            const job = jobs.find((j) => j.id === app.jobId);
            const form = formById.get(app.formId);
            const name = form ? getApplicantName(app, form.fields) : 'متقدم';
            const initials = getInitials(name);
            const stageCfg = ATS_STAGE_TABS.find((s) => s.key === app.pipelineStage);
            return (
              <Card
                key={app.id}
                className="group cursor-pointer overflow-hidden transition-all hover:shadow-elevated hover:-translate-y-px"
                onClick={() => openApplicantDetail(app.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight">{name}</p>
                      <p className="truncate text-xs text-muted-foreground mt-0.5">{job?.title ?? '—'}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ATS_STAGE_BADGE[app.pipelineStage]}`}>
                        {stageCfg?.label}
                      </Badge>
                      {app.isArchived && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-700 border-amber-500/40">
                          مؤرشف
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <DisplayDate value={app.submittedAt} mode="datetime" className="text-[11px]" />
                    </div>
                    {app.score ? (
                      <ScoreBar score={app.score.finalScore} />
                    ) : (
                      <span className="text-[11px] text-muted-foreground/30">بدون تقييم</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
          )}
        </DirectoryPagedViews>
        </ListToolsTable>
      )}

      <AtsApplicantDetailDialog
        applicant={detailApplicant ?? null}
        form={detailForm}
        open={!!detailId && !!detailApplicant}
        onOpenChange={(open) => { if (!open) closeApplicantDetail(); }}
      />
    </div>
  );
}
