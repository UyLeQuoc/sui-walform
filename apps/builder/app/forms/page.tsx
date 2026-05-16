import { Suspense } from 'react';
import { FormsListClient } from '@walform/core/forms/components/list';

export default function FormsPage() {
  return (
    <Suspense fallback={<div className="bg-muted/30 min-h-screen animate-pulse" />}>
      <FormsListClient />
    </Suspense>
  );
}
