import { Suspense } from 'react';
import { SettlementsPage } from '@/features/expenses/components/settlements-page';

export default function Page() {
  return (
    <Suspense>
      <SettlementsPage />
    </Suspense>
  );
}
