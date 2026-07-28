'use client';

import { useCallback, useMemo, useState } from 'react';
import { SessionKey } from '@mysten/seal';
import { useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import { useOriginalPackageId } from '../../sui/package-id';

const DEFAULT_TTL_MIN = 30;

interface SealSessionState {
  sessionKey: SessionKey | null;
  isInitializing: boolean;
  error: Error | null;
}

/**
 * Module-level session cache, keyed by `address:packageId`.
 *
 * Why not component state: the Results dashboard mounts TWO independent
 * consumers of this hook — `useSubmissionDecryption` (response bodies) and
 * `useSealedSchemaDecrypt` (the sealed schema). Each hook instance has its own
 * refs, so a per-instance cache pops a second `signPersonalMessage` prompt for
 * the same wallet in the same view. Hoisting the cache (and the in-flight
 * promise, so concurrent bootstraps dedupe across instances too) keeps the
 * "one signature unlocks everything" contract.
 *
 * Still not persisted — a page refresh or a wallet switch re-signs.
 */
const sessionCache = new Map<string, SessionKey>();
const inFlightCache = new Map<string, Promise<SessionKey>>();

/**
 * One-time-per-session helper to create a Seal `SessionKey` bound to the
 * connected wallet. Decrypt UIs (Results dashboard, submitter receipt) call
 * `ensureSession()` lazily on first decrypt — wallet pops a personal-message
 * signature once, then every other consumer reuses that key for the rest of
 * the session.
 */
export function useSealSession(packageIdOverride?: string) {
  const account = useCurrentAccount();
  const suiClient = useSuiGrpcClient();
  const originalPackageId = useOriginalPackageId();
  const packageId = packageIdOverride ?? originalPackageId;
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [state, setState] = useState<SealSessionState>({
    sessionKey: null,
    isInitializing: false,
    error: null,
  });
  // Cache key scopes the shared SessionKey to the exact (wallet, package)
  // pair it was signed for — switching wallets or networks must re-sign.
  const cacheKey = account && packageId ? `${account.address}:${packageId}` : null;

  const ensureSession = useCallback(async (): Promise<SessionKey> => {
    if (!account) throw new Error('Connect a wallet to decrypt responses');
    if (!packageId) throw new Error('walform package not configured');
    const key = `${account.address}:${packageId}`;
    const cached = sessionCache.get(key);
    if (cached && !cached.isExpired()) return cached;
    if (cached) sessionCache.delete(key);
    const inFlight = inFlightCache.get(key);
    if (inFlight) return inFlight;
    setState((s) => ({ ...s, isInitializing: true, error: null }));
    const promise = (async () => {
      try {
        const sk = await SessionKey.create({
          address: account.address,
          packageId,
          ttlMin: DEFAULT_TTL_MIN,
          suiClient,
        });
        const personalMessage = sk.getPersonalMessage();
        const { signature } = await signPersonalMessage({ message: personalMessage });
        await sk.setPersonalMessageSignature(signature);
        sessionCache.set(key, sk);
        setState({ sessionKey: sk, isInitializing: false, error: null });
        return sk;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        sessionCache.delete(key);
        setState({ sessionKey: null, isInitializing: false, error: e });
        throw e;
      } finally {
        inFlightCache.delete(key);
      }
    })();
    inFlightCache.set(key, promise);
    return promise;
  }, [account, packageId, signPersonalMessage, suiClient]);

  // A sibling hook instance may have bootstrapped the shared key already; surface
  // it so consumers that only read `sessionKey` (rather than calling
  // `ensureSession`) don't render a stale "locked" state.
  const sessionKey = state.sessionKey ?? (cacheKey ? (sessionCache.get(cacheKey) ?? null) : null);

  return useMemo(
    () => ({
      sessionKey,
      isInitializing: state.isInitializing,
      error: state.error,
      ensureSession,
    }),
    [sessionKey, state.isInitializing, state.error, ensureSession],
  );
}
