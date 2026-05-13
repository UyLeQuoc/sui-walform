import { FormResultsView } from '@walform/core/forms/components/results';
import { FormsHeader } from '@walform/core/forms/components/list';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FormResultsPage({ params }: PageProps) {
  const { id } = await params;
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
        <FormResultsView formId={id} />
      </main>
    </div>
  );
}
