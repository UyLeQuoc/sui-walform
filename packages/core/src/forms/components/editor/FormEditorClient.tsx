'use client';

import { notFound } from 'next/navigation';
import { useStoredForm } from '../../hooks/use-stored-form';
import { SCHEMA_VERSION } from '../../lib/schema-version';
import { FormBuilder } from './FormBuilder';

interface FormEditorClientProps {
  id: string;
}

export function FormEditorClient({ id }: FormEditorClientProps) {
  const state = useStoredForm(id);

  if (state.status === 'not-found') notFound();

  if (state.status === 'loading') {
    return <div className="bg-muted/30 min-h-screen animate-pulse" />;
  }

  if (state.status === 'unsupported-version') {
    return (
      <div className="bg-muted/30 flex min-h-screen items-center justify-center px-6">
        <div className="bg-card w-full max-w-md rounded-xl border p-6 text-center shadow-lg">
          <p className="text-base font-semibold">This form is from a newer version</p>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            The draft was saved by a newer build (schema v{state.foundVersion}). Update the app to v
            {SCHEMA_VERSION + 1}+ to open it. Editing it now would risk losing data.
          </p>
        </div>
      </div>
    );
  }

  // FormBuilder only mounts after the store has been populated, so
  // useAutoSave inside it subscribes after the initial load — no spurious write.
  return (
    <FormBuilder formId={id} createdAt={state.form.createdAt} initialRev={state.form.rev ?? 0} />
  );
}
