import { FormResultsView } from '@walform/core/forms/components/results';
import { FormsHeader } from '@walform/core/forms/components/list';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FormResultsPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="bg-background min-h-screen">
      <FormsHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <FormResultsView formId={id} />
      </main>
    </div>
  );
}
