'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { sealDecryptFormSchema, useSealDecryptClient } from '../../crypto';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import { useActivePackageId } from '../../sui/package-id';
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
  const suiClient = useSuiGrpcClient();
  const sealFor = useSealDecryptClient();
  const packageId = useActivePackageId();
  const allowlistQuery = useFormAllowlist(formObjectId);
  const sealSession = useSealSession();

  const [decrypted, setDecrypted] = useState<FormSchema | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decrypt = async () => {
    // Resolve the client from the ciphertext itself: a form sealed before the
    // key-server migration must be opened by the server it names, not by
    // whatever is configured today.
    const seal = sealFor(ciphertext);
    if (!packageId || !seal) {
      toast.error('walform package or Seal not configured for this network.');
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
      const plaintextBytes = await sealDecryptFormSchema({
        seal,
        sessionKey,
        client: suiClient,
        packageId,
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
