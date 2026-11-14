import { Suspense } from 'react';
import { SetupPage } from '@/features/expenses/components/setup-page';

export default function Page() {
  return (
    <Suspense>
      <SetupPage />
    </Suspense>
  );
}
