'use client';

import { useState } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { toast } from 'sonner';
import { getSealClient, sealDecryptFormSchema } from '../../crypto';
import { useOriginalPackageId } from '../../sui/package-id';
import type { FormSchema } from '../../types';
import { useFormAllowlist } from './use-form-allowlist';
import { useSealSession } from './use-seal-session';

export interface UseSealedSchemaDecryptInput {
  formObjectId: string;
  ciphertext: Uint8Array;
}

export interface UseSealedSchemaDecryptResult {
  decrypted: FormSchema | null;
  pending: boolean;
  error: string | null;
  decrypt: () => Promise<void>;
}

/**
 * Owns the Seal v2 schema-decrypt flow: ensures session key, fetches the
 * per-form Allowlist, calls Seal, parses JSON, and exposes the result.
 *
 * Expected access policy (enforced server-side by Seal key servers): only
 * the form creator and allowlist members can decrypt. The first call pops
 * one `signPersonalMessage` prompt to bootstrap the session key (cached for
 * 30 min in component state).
 */
export function useSealedSchemaDecrypt(
  input: UseSealedSchemaDecryptInput,
): UseSealedSchemaDecryptResult {
  const { formObjectId, ciphertext } = input;
  const suiClient = useSuiClient();
  const originalPackageId = useOriginalPackageId();
  const allowlistQuery = useFormAllowlist(formObjectId);
  const sealSession = useSealSession();

  const [decrypted, setDecrypted] = useState<FormSchema | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decrypt = async () => {
    if (!originalPackageId) {
      toast.error('walform package not configured for this network.');
      return;
    }
    if (!allowlistQuery.allowlist) {
      toast.error('No allowlist found for this form. The creator may need to re-publish.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const sessionKey = await sealSession.ensureSession();
      const seal = getSealClient(suiClient);
      const plaintextBytes = await sealDecryptFormSchema({
        seal,
        sessionKey,
        client: suiClient,
        packageId: originalPackageId,
        formObjectId,
        allowlistObjectId: allowlistQuery.allowlist.allowlistId,
        ciphertext,
      });
      const text = new TextDecoder().decode(plaintextBytes);
      setDecrypted(JSON.parse(text) as FormSchema);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return { decrypted, pending, error, decrypt };
}
