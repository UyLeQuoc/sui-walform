import { useSearchParams } from 'react-router-dom';
import { FormResultsView } from '@walform/core/forms/components/results';
import { FormsHeader } from '@walform/core/forms/components/list';

export function FormResultsRoute() {
  const [params] = useSearchParams();
  const formId = params.get('formId');
  return (
    <div className="bg-background relative min-h-screen [--forms-dot:rgba(0,0,0,0.14)] dark:[--forms-dot:rgba(255,255,255,0.12)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--forms-dot) 1px, transparent 1.3px)',
          backgroundSize: '20px 20px',
          maskImage: 'radial-gradient(ellipse 100% 80% at 50% 0%, black 30%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 100% 80% at 50% 0%, black 30%, transparent 100%)',
        }}
      />
      <FormsHeader />
      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6">
        {formId ? (
          <FormResultsView formId={formId} />
        ) : (
          <div className="bg-card mx-auto mt-12 w-full max-w-md rounded-xl border p-6 text-center shadow-lg">
            <p className="text-base font-semibold">No form selected</p>
            <p className="text-muted-foreground mt-2 text-sm">
              Append <code className="font-mono">?formId=…</code> to view results.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
