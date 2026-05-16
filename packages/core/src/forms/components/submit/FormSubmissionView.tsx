'use client';

import { useState } from 'react';
import { useDocumentTitle } from '../../hooks/use-document-title';
import { useFormOnChain } from '../../hooks/use-form-on-chain';
import { CenteredMessage } from './CenteredMessage';
import { SealedSchemaGate } from './SealedSchemaGate';
import { SubmitForm } from './SubmitForm';

interface FormSubmissionViewProps {
  formId: string;
}

/**
 * Thin gate that selects what to render for the `/f?formId=…` page based on the
 * on-chain Form's state: loading, terminal (closed/expired/full), sealed
 * schema (Seal v2), or the active submit shell.
 *
 * All flow + transaction logic lives in `SubmitForm` + `useFormSubmission`.
 */
export function FormSubmissionView({ formId }: FormSubmissionViewProps) {
  const { form, isLoading, error } = useFormOnChain(formId);
  useDocumentTitle(form?.title);
  // Capture mount time once so the render stays pure. If the user leaves the
  // page open past `closesAtMs` the on-chain submit will still reject; the
  // banner just won't auto-flip without a refresh.
  const [mountNowMs] = useState(() => Date.now());

  if (isLoading) {
    return <div className="bg-secondary/40 min-h-screen animate-pulse" />;
  }
  if (error) {
    return <CenteredMessage title="Failed to load form" description={error.message} />;
  }
  if (!form) {
    return (
      <CenteredMessage
        title="Form not found"
        description="The form id is invalid or hasn't been published yet."
      />
    );
  }
  if (form.closed) {
    return (
      <CenteredMessage
        title="Form closed"
        description="The creator has closed this form. New submissions are no longer accepted."
      />
    );
  }
  if (form.closesAtMs && mountNowMs >= form.closesAtMs) {
    return (
      <CenteredMessage
        title="Submission window ended"
        description={`This form stopped accepting responses at ${new Date(form.closesAtMs).toLocaleString()}.`}
      />
    );
  }
  if (form.maxSubmissions > 0 && form.submissionCount >= form.maxSubmissions) {
    return (
      <CenteredMessage
        title="Submission limit reached"
        description={`This form is capped at ${form.maxSubmissions} responses.`}
      />
    );
  }
  if (!form.schema) {
    // Private form + non-empty schemaRaw + parse failed = ciphertext (Seal v2).
    if (form.accessMode === 1 && form.schemaRaw.length > 1) {
      return <SealedSchemaGate form={form} />;
    }
    return (
      <CenteredMessage
        title="Form schema unavailable"
        description="The form's schema is empty or couldn't be parsed. The creator may need to re-publish."
      />
    );
  }

  return <SubmitForm form={{ ...form, schema: form.schema }} />;
}
