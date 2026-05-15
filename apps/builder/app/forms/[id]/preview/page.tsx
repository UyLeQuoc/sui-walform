import { FormPreviewClient } from '@walform/core/forms/components/preview';

export function generateStaticParams() {
  return [{ id: '_' }];
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FormPreviewPage({ params }: Props) {
  const { id } = await params;
  return <FormPreviewClient id={id} />;
}
