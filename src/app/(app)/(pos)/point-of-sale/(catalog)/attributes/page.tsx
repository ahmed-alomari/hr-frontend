import * as React from 'react';
import { AttributesListPage } from '@/features/catalog/attributes/components/attributes-list-page';

export default function Page() {
  return (
    <React.Suspense fallback={null}>
      <AttributesListPage />
    </React.Suspense>
  );
}
