'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { Button } from '../../../ui/button';
import { WalletConnectModal } from '../../../sui/wallet-ui/WalletConnectModal';
import { useDraftCoverDataUrl } from '../../hooks/use-draft-cover-data-url';
import { usePublishForm } from '../../hooks/use-publish-form';
import { formsRoute } from '../../lib/routes';
import { useFormBuilderStore } from '../../store/form-builder-store';
import { PublishDialog } from '../publish/PublishDialog';

interface EditorPublishButtonProps {
  formId: string;
}

// Stable empty array so the Zustand selector returns referentially-equal
// snapshots on every render when schema.tags is undefined. A fresh `[]`
// literal inside the selector triggers React's getSnapshot infinite loop.
const EMPTY_TAGS: string[] = [];

export function EditorPublishButton({ formId }: EditorPublishButtonProps) {
  const navigate = useNavigate();
  const formTitle = useFormBuilderStore((s) => s.schema.title);
  const formDescription = useFormBuilderStore((s) => s.schema.description ?? '');
  const formTags = useFormBuilderStore((s) => s.schema.tags ?? EMPTY_TAGS);
  const { isConnected } = useCurrentWallet();
  const { coverDataUrl, refresh: refreshCover } = useDraftCoverDataUrl(formId);
  const { isSubmitting, publish, isReady, steps: txSteps } = usePublishForm({ formId });

  const [connectOpen, setConnectOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openDialog = async () => {
    await refreshCover();
    setDialogOpen(true);
  };

  const handleClick = () => {
    if (isConnected) {
      void openDialog();
    } else {
      setConnectOpen(true);
    }
  };

  const handleSubmit = async (options: Parameters<typeof publish>[0]) => {
    const result = await publish(options);
    setDialogOpen(false);
    if (result?.mode === 'on-chain') {
      navigate(formsRoute.results(result.formObjectId));
    }
  };

  return (
    <>
      <Button
        variant="default"
        onClick={handleClick}
        disabled={!isReady || isSubmitting}
        title={!isReady ? 'walform package is not configured for this network' : 'Publish form'}
        className="gap-1.5"
      >
        <Send className="h-4 w-4" />
        {isSubmitting ? 'Publishing…' : 'Publish'}
      </Button>

      <WalletConnectModal
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={() => void openDialog()}
      />

      <PublishDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        formTitle={formTitle}
        formDescription={formDescription}
        formTags={formTags}
        coverImageDataUrl={coverDataUrl}
        isSubmitting={isSubmitting}
        txSteps={txSteps.steps}
        onSubmit={handleSubmit}
      />
    </>
  );
}
