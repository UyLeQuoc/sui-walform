'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { Button } from '../../../ui/button';
import { useDraftCoverDataUrl } from '../../hooks/use-draft-cover-data-url';
import { usePublishForm } from '../../hooks/use-publish-form';
import { WalletConnectModal } from '../../../sui/wallet-ui/WalletConnectModal';
import { PublishDialog } from '../publish/PublishDialog';

interface PublishFormButtonProps {
  formId: string;
  formTitle: string;
}

/**
 * Pure UI wrapper. Real flow lives in `usePublishForm` (cover upload →
 * publish PTB → sealed-schema follow-up → treasury follow-up → invalidate).
 * Pre-publish cover capture lives in `useDraftCoverDataUrl`.
 */
export function PublishFormButton({ formId, formTitle }: PublishFormButtonProps) {
  const router = useRouter();
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

  return (
    <>
      <Button
        variant="default"
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
        className="mt-2"
        disabled={!isReady}
        title={
          !isReady ? 'walform package is not configured for this network' : 'Publish this form'
        }
      >
        <Send className="mr-1.5 h-3.5 w-3.5" />
        Publish
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
        onSubmit={async (options) => {
          const result = await publish(options);
          setDialogOpen(false);
          if (result?.mode === 'on-chain') {
            router.push(`/forms/${result.formObjectId}/results`);
          }
        }}
      />
    </>
  );
}
