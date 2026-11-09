import { Suspense } from 'react';
import { ApprovalsPage } from '@/features/expenses/components/approvals-page';

export default function Page() {
  return (
    <Suspense>
      <ApprovalsPage />
    </Suspense>
  );
}
