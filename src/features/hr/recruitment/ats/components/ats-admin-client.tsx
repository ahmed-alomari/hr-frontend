'use client';

import { useAtsJobsListModel } from '@/features/hr/recruitment/ats/hooks/useAtsJobsListModel';
import { AtsJobsListViews, useAtsJobsListTools } from '@/features/hr/recruitment/ats/components/ats-jobs-list-views';

export function AtsAdminClient() {
  const model = useAtsJobsListModel();
  const tools = useAtsJobsListTools(model);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AtsJobsListViews model={model} tools={tools} />
    </div>
  );
}
