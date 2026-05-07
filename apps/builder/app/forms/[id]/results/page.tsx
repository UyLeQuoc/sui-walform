import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { FormResultsView } from '@walform/core/forms/components/results';
import { Button } from '@walform/core/ui/button';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FormResultsPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="bg-background min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <Button variant="ghost" asChild className="gap-1.5">
            <Link href="/forms">
              <ArrowLeft className="h-4 w-4" />
              Forms
            </Link>
          </Button>
          <h1 className="text-base font-semibold">Responses</h1>
          <div />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <FormResultsView formId={id} />
      </main>
    </div>
  );
}
