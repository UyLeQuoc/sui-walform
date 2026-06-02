import { Link, useSearchParams } from 'react-router-dom';
import { FormEditorClient } from '@walform/core/forms/components/editor';

export function FormEditRoute() {
  const [params] = useSearchParams();
  const formId = params.get('formId');
  if (!formId) {
    return (
      <div className="bg-muted/30 flex min-h-screen items-center justify-center px-6">
        <div className="bg-card w-full max-w-md rounded-xl border p-6 text-center shadow-lg">
          <p className="text-base font-semibold">No form selected</p>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Append <code className="font-mono">?formId=…</code> to this URL, or pick a form from{' '}
            <Link className="underline" to="/forms">
              the list
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }
  return <FormEditorClient id={formId} />;
}
