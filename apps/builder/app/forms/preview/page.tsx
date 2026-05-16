'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FormPreviewClient } from '@walform/core/forms/components/preview';

function Inner() {
  const params = useSearchParams();
  const formId = params.get('formId');
  if (!formId) {
    return (
      <div className="bg-muted/30 flex min-h-screen items-center justify-center px-6">
        <div className="bg-card w-full max-w-md rounded-xl border p-6 text-center shadow-lg">
          <p className="text-base font-semibold">No form selected</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Append <code className="font-mono">?formId=…</code> to preview a draft.
          </p>
        </div>
      </div>
    );
  }
  return <FormPreviewClient id={formId} />;
}

export default function FormPreviewPage() {
  return (
    <Suspense fallback={<div className="bg-muted/30 min-h-screen animate-pulse" />}>
      <Inner />
    </Suspense>
  );
}
