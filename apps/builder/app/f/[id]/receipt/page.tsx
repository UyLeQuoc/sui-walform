import { SubmitterReceiptView } from '@walform/core/forms/components/results';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceiptPage({ params }: PageProps) {
  const { id } = await params;
  return <SubmitterReceiptView formId={id} />;
}
