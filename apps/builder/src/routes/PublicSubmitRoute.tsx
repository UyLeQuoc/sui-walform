import { useSearchParams } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { CenteredMessage, FormSubmissionView } from '@walform/core/forms/components/submit';

export function PublicSubmitRoute() {
  const [params] = useSearchParams();
  const formId = params.get('formId');
  if (!formId) {
    // Same header (logo + network + wallet) as the live submit page so this
    // doesn't look like a dead end — and the network switcher is one click away.
    return (
      <CenteredMessage
        title="No form selected"
        description="This URL is missing ?formId=… — get the link from whoever shared the form with you."
        icon={Inbox}
      />
    );
  }
  return <FormSubmissionView formId={formId} />;
}
