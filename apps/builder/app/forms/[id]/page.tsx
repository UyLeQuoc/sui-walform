import { FormEditorClient } from '@walform/core/forms/components/editor';

// Static export emits only the `[id]='_'` placeholder; runtime IDs (in dev or
// on the deployed Walrus Site via routes-table rewrite) are read client-side
// via `useParams()`. We don't set `dynamic = 'force-static'` or
// `dynamicParams = false` so the dev server still serves arbitrary IDs.
export function generateStaticParams() {
  return [{ id: '_' }];
}

interface FormPageProps {
  params: Promise<{ id: string }>;
}

export default async function FormPage({ params }: FormPageProps) {
  const { id } = await params;
  return <FormEditorClient id={id} />;
}
