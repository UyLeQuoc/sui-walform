'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Lock, Send } from 'lucide-react';
import { Logo } from '../../../ui/logo';
import { FileAttachmentView } from './FileAttachmentView';
import {
  useCurrentAccount,
  useCurrentWallet,
  useSuiClient,
  useSuiClientContext,
} from '@mysten/dapp-kit';
import { Card, CardContent } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Spinner } from '../../../ui/spinner';
import { useActivePackageId, useOriginalPackageId } from '../../../sui/package-id';
import { suivisionUrl } from '../../../sui/explorer';
import { sealDecryptSubmission, getSealClient } from '../../../crypto';
import { useFormOnChain, useFormSubmissions, useSealSession } from '../../hooks';
import type { SubmissionRow } from '../../hooks';
import { WalletButton } from '../../../sui/wallet-ui/WalletButton';
import type { FormField } from '../../../types';

/**
 * Receipt page for the connected wallet's own submission to a given form.
 * Shows the most-recent submission's decrypted values. Seal whitelist policy
 * (`seal_approve_read_submission`) passes when caller == submitter, so the
 * submitter can re-read their answers any time.
 */
export function SubmitterReceiptView({ formId }: { formId: string }) {
  const { isConnected } = useCurrentWallet();
  const account = useCurrentAccount();
  const { form } = useFormOnChain(formId);
  const { rows, isLoading } = useFormSubmissions(formId);
  const sealSession = useSealSession();
  const suiClient = useSuiClient();
  const { network } = useSuiClientContext();
  const net = (network === 'mainnet' || network === 'devnet' ? network : 'testnet') as
    | 'testnet'
    | 'mainnet'
    | 'devnet';
  const activePackageId = useActivePackageId();
  const originalPackageId = useOriginalPackageId();

  const [decrypted, setDecrypted] = useState<Record<string, unknown> | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Track which (address, formId) the decrypted state belongs to. When the
  // identity key changes, reset state during render rather than in an effect
  // (avoids the cascading-render lint + matches React's "adjusting state on
  // prop change" pattern).
  const identityKey = `${account?.address ?? ''}::${formId}`;
  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey);
  if (prevIdentityKey !== identityKey) {
    setPrevIdentityKey(identityKey);
    setDecrypted(null);
    setDecryptError(null);
  }

  const myRow: SubmissionRow | undefined =
    rows.find((r: SubmissionRow) => !!account?.address && r.submitter === account.address) ??
    rows.find(
      (r: SubmissionRow) => !!account?.address && r.submitter === account.address.toLowerCase(),
    );
  // Note: address normalisation done in useFormSubmissions, account.address is
  // already lowercase + 0x-prefixed; equality should match. Keep both for safety.

  const handleDecrypt = async () => {
    if (!myRow || !originalPackageId) return;
    setPending(true);
    setDecryptError(null);
    try {
      const sessionKey = await sealSession.ensureSession();
      const seal = getSealClient(suiClient);
      const plaintextBytes = await sealDecryptSubmission({
        seal,
        sessionKey,
        client: suiClient,
        packageId: originalPackageId,
        formObjectId: formId,
        submissionObjectId: myRow.submissionId,
        ciphertext: myRow.ciphertext,
        nonce: myRow.nonce,
      });
      const text = new TextDecoder().decode(plaintextBytes);
      try {
        setDecrypted(JSON.parse(text) as Record<string, unknown>);
      } catch {
        setDecrypted({ _raw: text });
      }
    } catch (err) {
      setDecryptError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  if (!form) {
    return (
      <Centered>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">Form not found.</p>
          </CardContent>
        </Card>
      </Centered>
    );
  }
  if (!isConnected || !account) {
    return (
      <Centered>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Send className="text-muted-foreground h-6 w-6" />
            <h2 className="font-semibold">Receipt for {form.title}</h2>
            <p className="text-muted-foreground text-sm">
              Connect the wallet you submitted with to view your receipt.
            </p>
            <WalletButton />
          </CardContent>
        </Card>
      </Centered>
    );
  }
  if (isLoading) {
    return (
      <Centered>
        <div className="bg-muted h-32 animate-pulse rounded-xl" />
      </Centered>
    );
  }
  if (!myRow) {
    return (
      <Centered>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Send className="text-muted-foreground h-6 w-6" />
            <h2 className="font-semibold">No submission found</h2>
            <p className="text-muted-foreground text-sm">
              The connected wallet hasn&apos;t submitted to this form yet.
            </p>
            <Button asChild variant="outline">
              <a href={`/f/${formId}`}>Submit now</a>
            </Button>
          </CardContent>
        </Card>
      </Centered>
    );
  }

  const inputFields = (form.schema?.fields ?? []).filter(
    (f: FormField) =>
      f.type !== 'heading' &&
      f.type !== 'description' &&
      f.type !== 'markdown' &&
      f.type !== 'divider' &&
      f.type !== 'space',
  );

  return (
    <Centered>
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">{form.title}</h2>
              <p className="text-muted-foreground text-xs">
                Submitted {new Date(myRow.submittedAtMs).toLocaleString()}
              </p>
            </div>
            <Badge variant="outline">Encrypted on-chain</Badge>
          </div>

          {!decrypted && (
            <Button
              onClick={() => void handleDecrypt()}
              disabled={!activePackageId || !originalPackageId || pending}
              className="self-start"
            >
              {pending ? (
                <Spinner className="mr-1.5 size-3.5" />
              ) : (
                <Lock className="mr-1.5 h-3.5 w-3.5" />
              )}
              Decrypt my response
            </Button>
          )}
          {decryptError && (
            <p className="text-destructive text-sm">Decrypt failed: {decryptError}</p>
          )}
          {decrypted && (
            <dl className="flex flex-col gap-2 text-sm">
              {inputFields.map((f: FormField) => (
                <div key={f.id} className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-xs font-medium">{f.label || f.id}</dt>
                  <dd className="break-words">{renderCell(f, decrypted[f.id])}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="text-muted-foreground border-t pt-2 text-[11px]">
            <a
              href={suivisionUrl(net, 'object', myRow.submissionId)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground underline-offset-2 hover:underline"
            >
              View submission on Suivision
            </a>
          </div>
        </CardContent>
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-secondary/40 flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10">
      <Link href="/" aria-label="WalForm home" className="flex items-center gap-2">
        <Logo className="size-6" />
        <span className="text-foreground/80 text-sm font-semibold">WalForm</span>
      </Link>
      <div className="w-full max-w-xl">{children}</div>
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[11px] transition-colors"
      >
        <Logo className="size-3.5" />
        Made with <span className="font-medium">WalForm</span>
      </Link>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function renderCell(field: FormField, value: unknown): ReactNode {
  if (field.type === 'file') {
    if (!value) return <span className="text-muted-foreground/60">— not answered —</span>;
    return <FileAttachmentView value={value} />;
  }
  const formatted = formatCell(value);
  if (!formatted) {
    return <span className="text-muted-foreground/60">— not answered —</span>;
  }
  return formatted;
}
