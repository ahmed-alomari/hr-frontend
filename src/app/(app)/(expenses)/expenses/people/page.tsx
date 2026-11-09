import { Suspense } from 'react';
import { PeoplePage } from '@/features/expenses/components/people-page';

export default function Page() {
  return (
    <Suspense>
      <PeoplePage />
    </Suspense>
  );
}
