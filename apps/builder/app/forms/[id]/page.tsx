import { FormEditorClient } from '@walform/core/forms/components/editor';

interface FormPageProps {
  params: Promise<{ id: string }>;
}

export default async function FormPage({ params }: FormPageProps) {
  const { id } = await params;
  return <FormEditorClient id={id} />;
}
