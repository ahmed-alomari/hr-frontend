import { Suspense } from 'react';
import { CustodyPage } from '@/features/expenses/components/custody-page';

export default function Page() {
  return (
    <Suspense>
      <CustodyPage />
    </Suspense>
  );
}
