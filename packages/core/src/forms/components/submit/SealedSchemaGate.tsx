'use client';

import { Lock } from 'lucide-react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { Button } from '../../../ui/button';
import { Spinner } from '../../../ui/spinner';
import { WalletButton } from '../../../sui/wallet-ui/WalletButton';
import { useSealedSchemaDecrypt } from '../../hooks/use-sealed-schema-decrypt';
import type { FormOnChainDetail } from '../../hooks/use-form-on-chain';
import { SubmitForm } from './SubmitForm';

interface SealedSchemaGateProps {
  form: FormOnChainDetail;
}

/**
 * Sealed-schema (Seal v2) viewer gate. Pops a single signPersonalMessage
 * prompt to unlock the schema, then forwards to `SubmitForm` with the
 * decrypted schema spliced in. Only the form creator and allowlist members
 * can decrypt.
 */
export function SealedSchemaGate({ form }: SealedSchemaGateProps) {
  const { isConnected } = useCurrentWallet();
  const { decrypted, pending, error, decrypt } = useSealedSchemaDecrypt({
    formObjectId: form.formObjectId,
    ciphertext: form.schemaRaw,
  });

  if (decrypted) {
    return <SubmitForm form={{ ...form, schema: decrypted }} />;
  }

  return (
    <div className="bg-secondary/40 flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="bg-card flex max-w-md flex-col items-center gap-3 rounded-xl border p-8 text-center shadow-xl">
        <div className="bg-muted rounded-full p-3">
          <Lock className="text-muted-foreground h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold">{form.title}</h1>
        <p className="text-muted-foreground text-sm">
          This form&apos;s schema is encrypted with Seal. Only the creator and allowlist members can
          view + submit. Connect your wallet and sign once to decrypt.
        </p>
        {!isConnected ? (
          <WalletButton />
        ) : (
          <Button onClick={() => void decrypt()} disabled={pending}>
            {pending ? (
              <Spinner className="mr-1.5 size-3.5" />
            ) : (
              <Lock className="mr-1.5 h-3.5 w-3.5" />
            )}
            Decrypt to view form
          </Button>
        )}
        {error && <p className="text-destructive text-xs">Decrypt failed: {error}</p>}
      </div>
    </div>
  );
}
