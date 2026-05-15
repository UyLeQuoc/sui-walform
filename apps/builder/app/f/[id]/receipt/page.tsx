import { SubmitterReceiptView } from '@walform/core/forms/components/results';

export function generateStaticParams() {
  return [{ id: '_' }];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceiptPage({ params }: PageProps) {
  const { id } = await params;
  return <SubmitterReceiptView formId={id} />;
}
