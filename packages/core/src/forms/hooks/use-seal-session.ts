'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { SessionKey } from '@mysten/seal';
import { useCurrentAccount, useSignPersonalMessage, useSuiClient } from '@mysten/dapp-kit';
import { useOriginalPackageId } from '../../sui/package-id';

const DEFAULT_TTL_MIN = 30;

interface SealSessionState {
  sessionKey: SessionKey | null;
  isInitializing: boolean;
  error: Error | null;
}

/**
 * One-time-per-session helper to create a Seal `SessionKey` bound to the
 * connected wallet. Decrypt UIs (Results dashboard, submitter receipt) call
 * `ensureSession()` lazily on first decrypt — wallet pops a personal-message
 * signature once, then the key sits in component state for the rest of the
 * session.
 *
 * Not persisted. Refreshing the page or switching wallets requires re-signing.
 */
export function useSealSession(packageIdOverride?: string) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const originalPackageId = useOriginalPackageId();
  const packageId = packageIdOverride ?? originalPackageId;
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [state, setState] = useState<SealSessionState>({
    sessionKey: null,
    isInitializing: false,
    error: null,
  });
  // Refs hold the *current* session/in-flight promise so concurrent
  // `ensureSession` calls dedupe — without these, two parallel decrypts
  // (e.g. "Decrypt all" + a row click) each see `state.sessionKey === null`
  // through their own captured closure and pop two signature prompts.
  const sessionRef = useRef<SessionKey | null>(null);
  const inFlightRef = useRef<Promise<SessionKey> | null>(null);

  const ensureSession = useCallback(async (): Promise<SessionKey> => {
    const cached = sessionRef.current;
    if (cached && !cached.isExpired()) return cached;
    if (inFlightRef.current) return inFlightRef.current;
    if (!account) throw new Error('Connect a wallet to decrypt responses');
    if (!packageId) throw new Error('walform package not configured');
    setState((s) => ({ ...s, isInitializing: true, error: null }));
    const promise = (async () => {
      try {
        // Cast to satisfy SealClient's SealCompatibleClient bound; the
        // SuiJsonRpcClient exposes the `core` extension already.
        const sk = await SessionKey.create({
          address: account.address,
          packageId,
          ttlMin: DEFAULT_TTL_MIN,
          suiClient: suiClient as unknown as Parameters<typeof SessionKey.create>[0]['suiClient'],
        });
        const personalMessage = sk.getPersonalMessage();
        const { signature } = await signPersonalMessage({ message: personalMessage });
        await sk.setPersonalMessageSignature(signature);
        sessionRef.current = sk;
        setState({ sessionKey: sk, isInitializing: false, error: null });
        return sk;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        sessionRef.current = null;
        setState({ sessionKey: null, isInitializing: false, error: e });
        throw e;
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = promise;
    return promise;
  }, [account, packageId, signPersonalMessage, suiClient]);

  return useMemo(
    () => ({
      sessionKey: state.sessionKey,
      isInitializing: state.isInitializing,
      error: state.error,
      ensureSession,
    }),
    [state, ensureSession],
  );
}
