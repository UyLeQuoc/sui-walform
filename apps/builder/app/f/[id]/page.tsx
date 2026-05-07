import { FormSubmissionView } from '@walform/core/forms/components/submit';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BuiltInFormPage({ params }: PageProps) {
  const { id } = await params;
  return <FormSubmissionView formId={id} />;
}
