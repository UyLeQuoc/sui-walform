'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FormSubmissionView } from '@walform/core/forms/components/submit';

function Inner() {
  const params = useSearchParams();
  const formId = params.get('formId');
  if (!formId) {
    return (
      <div className="bg-muted/30 flex min-h-screen items-center justify-center px-6">
        <div className="bg-card w-full max-w-md rounded-xl border p-6 text-center shadow-lg">
          <p className="text-base font-semibold">No form selected</p>
          <p className="text-muted-foreground mt-2 text-sm">
            This URL is missing <code className="font-mono">?formId=…</code>. Get the link from
            whoever shared the form with you.
          </p>
        </div>
      </div>
    );
  }
  return <FormSubmissionView formId={formId} />;
}

export default function PublicSubmitPage() {
  return (
    <Suspense fallback={<div className="bg-muted/30 min-h-screen animate-pulse" />}>
      <Inner />
    </Suspense>
  );
}
