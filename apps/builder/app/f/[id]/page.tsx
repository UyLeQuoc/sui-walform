import { FormSubmissionView } from '@walform/core/forms/components/submit';

export function generateStaticParams() {
  return [{ id: '_' }];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BuiltInFormPage({ params }: PageProps) {
  const { id } = await params;
  return <FormSubmissionView formId={id} />;
}
