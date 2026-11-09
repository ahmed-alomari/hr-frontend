'use client';

import { FoldedHeaderTool } from '@/components/layouts/phone-fold';
import { recruitmentGlobalRoutes } from '@/features/hr/recruitment/lib/recruitment-routes';
import type { ListToolsModel } from '@/components/ui/list-tools';
import type { ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews } from '@/components/ui/paged-list';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import {
  Briefcase, Plus, Pencil, Trash2, Share2, Power, Eye, ArrowUpRight, Users,
  ClipboardList, FileEdit, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AtsApplicant } from '@/features/hr/recruitment/lib/ats/types';
import type { AtsJob } from '@/features/hr/recruitment/lib/ats/types';
import { QRCodeDialog } from '@/features/hr/recruitment/shared/qr-code-dialog';
import { RecruitmentJobNav } from '@/features/hr/recruitment/ats/components/recruitment-job-nav';
import { recruitmentJobRoutes } from '@/features/hr/recruitment/lib/recruitment-routes';
import { JOB_TYPE_AR } from '@/features/hr/recruitment/ats/constants/ats-jobs-list';
import { ConfirmationModal, EmptyState } from '@/components/ui/shared-dialogs';
import type { AtsJobsListModel } from '@/features/hr/recruitment/ats/hooks/useAtsJobsListModel';

type Props = { model: AtsJobsListModel; tools: ListToolsModel<AtsJob> };

/** Columns, sort, grouping, export and the page header: stays mounted while the list loads. */
export function useAtsJobsListTools(model: AtsJobsListModel) {
  const { filtered, applicants, openCreateJob, activeFilterCount, exportSubtitleLines } = model;
  const statusOf = (job: AtsJob) =>
    [job.isActive ? 'نشطة' : 'متوقفة', job.isArchived ? 'مؤرشف' : null].filter(Boolean).join(' — ');
  const applicantsOf = (job: AtsJob) => applicants.filter((a) => a.jobId === job.id).length;
  const typeOf = (job: AtsJob) => JOB_TYPE_AR[job.type] ?? job.type;
  const columns: ColumnDef<AtsJob>[] = [
    { key: 'title', title: 'المسمى', render: (job) => job.title },
    { key: 'department', title: 'القسم', render: (job) => job.department || '—' },
    { key: 'location', title: 'الموقع', render: (job) => job.location || '—' },
    { key: 'type', title: 'النوع', render: typeOf },
    { key: 'status', title: 'الحالة', render: statusOf },
    { key: 'applicants', title: 'عدد المتقدمين', render: (job) => String(applicantsOf(job)) },
  ];
  const tools = useListTools<AtsJob>({
    section: 'recruitment',
    page: 'jobs',
    columns,
    rows: filtered,
    resetKey: exportSubtitleLines.join('|'),
    fields: {
      title: { kind: 'name', text: (job) => job.title },
      department: { text: (job) => job.department || '—', group: (job) => job.department || null },
      location: { text: (job) => job.location || '—', group: (job) => job.location || null },
      type: { kind: 'status', text: typeOf, group: typeOf },
      status: { kind: 'status', text: statusOf, group: statusOf },
      applicants: { text: (job) => String(applicantsOf(job)), sort: applicantsOf, sum: applicantsOf },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        {tools.exportMenu('سجل الوظائف', 'recruitment-jobs', exportSubtitleLines)}
        <Button variant="luxe" size="sm" className="h-8 gap-2" onClick={openCreateJob}>
          <Plus className="h-4 w-4" />
          وظيفة جديدة
        </Button>
        <FoldedHeaderTool>
          <Button variant="outline" size="sm" className="h-8 gap-2" asChild>
            <a href={recruitmentGlobalRoutes.careers} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              بوابة التوظيف
            </a>
          </Button>
        </FoldedHeaderTool>
      </div>
    ),
    [activeFilterCount, openCreateJob, exportSubtitleLines, tools.depsKey],
  );

  return tools;
}

export function AtsJobsListViews({ model, tools }: Props) {
  const {
    router,
    filtered,
    applicants,
    loading,
    listError,
    qrJob,
    setQrJob,
    deleteId,
    setDeleteId,
    handleDelete,
    handleToggle,
    openCreateJob,
    deletePending,
  } = model;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <RecruitmentJobNav />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-5 space-y-3">
                <div className="h-5 w-2/3 rounded-md bg-muted animate-pulse" />
                <div className="h-4 w-1/2 rounded-md bg-muted animate-pulse" />
                <div className="h-12 rounded-md bg-muted animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (listError) {
    return (
      <div className="space-y-6 animate-fade-in">
        <RecruitmentJobNav />
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {listError}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 animate-fade-in">
      <RecruitmentJobNav />

      <QRCodeDialog job={qrJob} open={!!qrJob} onOpenChange={() => setQrJob(null)} />

      <ConfirmationModal
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="تأكيد الأرشفة"
        description="سيتم أرشفة الوظيفة وإيقافها وأرشفة جميع المتقدمين المرتبطين بها. لا يُحذف شيء نهائياً."
        confirmLabel={deletePending ? 'جاري الأرشفة…' : 'أرشفة'}
        variant="destructive"
        onConfirm={handleDelete}
      />

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={Briefcase}
              title="لا توجد وظائف"
              description="أنشئ وظيفة جديدة أو عدّل الفلاتر"
            />
            <div className="flex justify-center pb-4">
              <Button variant="luxe" size="sm" className="gap-2" onClick={openCreateJob}>
                <Plus className="h-4 w-4" />
                إنشاء وظيفة
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ListToolsTable tools={tools} keyExtractor={(job) => job.id} onRowClick={(job) => router.push(recruitmentJobRoutes(job.id, job.slug).hub)}>
        <DirectoryPagedViews items={tools.rows} resetDeps={[tools.depsKey]}>
          {(pageItems) => (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((job) => (
            <AtsJobCard
              key={job.id}
              job={job}
              applicants={applicants}
              onOpenHub={(id) => router.push(recruitmentJobRoutes(id, job.slug).hub)}
              onToggle={() => void handleToggle(job)}
              onShare={() => setQrJob(job)}
              onEdit={() => router.push(`/hr/recruitment/ats-admin/jobs/create?edit=${job.id}`)}
              onArchive={() => setDeleteId(job.id)}
            />
          ))}
        </div>
          )}
        </DirectoryPagedViews>
        </ListToolsTable>
      )}
    </div>
  );
}

function AtsJobCard({
  job,
  applicants,
  onOpenHub,
  onToggle,
  onShare,
  onEdit,
  onArchive,
}: {
  job: AtsJob;
  applicants: AtsApplicant[];
  onOpenHub: (jobId: string) => void;
  onToggle: () => void;
  onShare: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const jobApps = applicants.filter((a) => a.jobId === job.id);
  const hired = jobApps.filter((a) => a.pipelineStage === 'hired').length;
  const routes = recruitmentJobRoutes(job.id, job.slug);

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-elevated">
      <div className={`absolute inset-y-0 right-0 w-1 ${job.isActive ? 'bg-emerald-400' : 'bg-muted-foreground/20'}`} />
      <CardContent className="p-5 pr-6">
        <button
          type="button"
          className="mb-3 flex w-full items-start justify-between gap-2 text-right"
          onClick={() => onOpenHub(job.id)}
        >
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-base leading-tight group-hover:text-primary transition-colors">{job.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{job.department} · {job.location}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {job.isArchived && (
              <Badge variant="outline" className="text-[10px] px-2 py-0 text-amber-700 border-amber-500/40">
                مؤرشف
              </Badge>
            )}
            <Badge variant={job.isActive ? 'default' : 'secondary'} className="text-[10px] px-2 py-0">
              {job.isActive ? 'نشطة' : 'متوقفة'}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-2 py-0 text-muted-foreground">
              {JOB_TYPE_AR[job.type] ?? job.type}
            </Badge>
          </div>
        </button>

        <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-3">{job.description}</p>

        <div className="mb-4 flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px] px-2.5" asChild>
            <a href={routes.applicants}>
              <Users className="h-3 w-3" />
              المتقدمون ({jobApps.length})
            </a>
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px] px-2.5" asChild>
            <a href={routes.pipeline}>
              <ClipboardList className="h-3 w-3" />
              المسار
            </a>
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px] px-2.5" asChild>
            <a href={routes.editForm}>
              <FileEdit className="h-3 w-3" />
              النموذج
            </a>
          </Button>
          {routes.publicApply && (
            <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px] px-2.5" asChild>
              <a href={routes.publicApply} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                التقديم
              </a>
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {hired > 0 && (
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <ArrowUpRight className="h-3.5 w-3.5" /> {hired} معيّن
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              <code className="text-[10px]">/f/{job.slug}</code>
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"
              title={job.isActive ? 'إيقاف' : 'تفعيل'}
              onClick={onToggle}
            >
              <Power className={`h-3.5 w-3.5 ${job.isActive ? 'text-emerald-500' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={onShare}>
              <Share2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive/60 hover:text-destructive" title="أرشفة الوظيفة" onClick={onArchive}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
