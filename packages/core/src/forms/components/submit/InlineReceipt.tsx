'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useSuiClient, useSuiClientContext } from '@mysten/dapp-kit';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Spinner } from '../../../ui/spinner';
import { useActivePackageId, useOriginalPackageId } from '../../../sui/package-id';
import { sealDecryptSubmission, useSealClient } from '../../../crypto';
import { decodeBodyPointer, fetchWalrusBlob } from '../../../walrus';
import { useSealSession } from '../../hooks/use-seal-session';
import type { SubmissionRow } from '../../hooks/use-form-submissions';
import type { FormField } from '../../../types';
import { QuestionCard } from '../results/QuestionCard';

interface InlineReceiptProps {
  formId: string;
  row: SubmissionRow;
  fields: FormField[];
}

/**
 * Decrypt-and-render-inline view of a submitter's own response. Reused in
 * the post-submit / already-submitted flow as the "View my response" panel.
 *
 * Decrypt requires one Seal signature on the first call (cached for 30 min
 * per session). The Walrus body-pointer is resolved transparently for
 * post-body-pivot submissions; legacy inline ciphertexts fall through.
 */
export function InlineReceipt({ formId, row, fields }: InlineReceiptProps) {
  const sealSession = useSealSession();
  const suiClient = useSuiClient();
  const seal = useSealClient();
  const { network } = useSuiClientContext();
  const net = network === 'mainnet' || network === 'devnet' ? network : 'testnet';
  const activePackageId = useActivePackageId();
  const originalPackageId = useOriginalPackageId();

  const [decrypted, setDecrypted] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleDecrypt = async () => {
    if (!originalPackageId || !seal) return;
    if (net !== 'testnet' && net !== 'mainnet') return;
    setPending(true);
    setError(null);
    try {
      const sessionKey = await sealSession.ensureSession();
      const blobId = decodeBodyPointer(row.ciphertext);
      const ciphertext = blobId ? await fetchWalrusBlob(blobId, net) : row.ciphertext;
      const runDecrypt = () =>
        sealDecryptSubmission({
          seal,
          sessionKey,
          client: suiClient,
          packageId: originalPackageId,
          formObjectId: formId,
          submissionObjectId: row.submissionId,
          ciphertext,
          nonce: row.nonce,
        });
      let plaintextBytes: Uint8Array;
      try {
        plaintextBytes = await runDecrypt();
      } catch (firstErr) {
        console.warn('[seal] first decrypt failed, retrying once', firstErr);
        plaintextBytes = await runDecrypt();
      }
      const text = new TextDecoder().decode(plaintextBytes);
      try {
        setDecrypted(JSON.parse(text) as Record<string, unknown>);
      } catch {
        setDecrypted({ _raw: text });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  if (!decrypted) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <Lock className="text-muted-foreground h-6 w-6" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Your response is encrypted</p>
            <p className="text-muted-foreground max-w-sm text-xs">
              Decrypt to view your answers. One wallet signature unlocks the rest of the session.
            </p>
          </div>
          <Button
            onClick={() => void handleDecrypt()}
            disabled={!activePackageId || !originalPackageId || pending}
            size="sm"
          >
            {pending ? (
              <Spinner className="mr-1.5 size-3" />
            ) : (
              <Lock className="mr-1.5 size-3" />
            )}
            Decrypt my response
          </Button>
          {error && <p className="text-destructive text-xs">Decrypt failed: {error}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.map((f, i) => (
        <QuestionCard key={f.id} index={i + 1} field={f} value={decrypted[f.id]} />
      ))}
      {fields.length === 0 && (
        <p className="text-muted-foreground py-6 text-center text-sm">
          This form has no input questions.
        </p>
      )}
    </div>
  );
}
