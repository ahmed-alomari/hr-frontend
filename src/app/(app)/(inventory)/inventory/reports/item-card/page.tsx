import { Suspense } from 'react';
import { ItemCardReportPage } from '@/features/inventory/admin/reports/components/item-card-report-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ItemCardReportPage />
    </Suspense>
  );
}
