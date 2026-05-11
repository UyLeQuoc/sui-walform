'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { Button } from '../../../ui/button';
import { WalletConnectModal } from '../../../sui/wallet-ui/WalletConnectModal';
import { useDraftCoverDataUrl } from '../../hooks/use-draft-cover-data-url';
import { usePublishForm } from '../../hooks/use-publish-form';
import { useFormBuilderStore } from '../../store/form-builder-store';
import { PublishDialog } from '../publish/PublishDialog';

interface EditorPublishButtonProps {
  formId: string;
}

export function EditorPublishButton({ formId }: EditorPublishButtonProps) {
  const formTitle = useFormBuilderStore((s) => s.schema.title);
  const { isConnected } = useCurrentWallet();
  const { coverDataUrl, refresh: refreshCover } = useDraftCoverDataUrl(formId);
  const { isSubmitting, publish, isReady } = usePublishForm({ formId });

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
    await publish(options);
    setDialogOpen(false);
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
        coverImageDataUrl={coverDataUrl}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
    </>
  );
}
