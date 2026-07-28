'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  SuiClientProvider,
  WalletProvider,
  createNetworkConfig,
  useSuiClientContext,
} from '@mysten/dapp-kit';
import { registerEnokiWallets, isEnokiNetwork } from '@mysten/enoki';
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { getSuiGrpcClient, getSuiGrpcUrl } from './grpc/client';
import '@mysten/dapp-kit/dist/index.css';

export type WalFormNetwork = 'testnet' | 'mainnet';

// `url` is inert — `createClient` below ignores it and builds a gRPC client
// instead. It stays populated because `createNetworkConfig` requires the field
// and because seeing the real endpoint here beats seeing a dead JSON-RPC URL.
const { networkConfig } = createNetworkConfig({
  testnet: {
    url: getSuiGrpcUrl('testnet'),
    network: 'testnet',
    variables: { network: 'testnet' as const },
  },
  mainnet: {
    url: getSuiGrpcUrl('mainnet'),
    network: 'mainnet',
    variables: { network: 'mainnet' as const },
  },
});

/**
 * Every read in the app goes through gRPC, not JSON-RPC — Sui decommissioned
 * public JSON-RPC (testnet already 404s, mainnet off 2026-07-31). See
 * `./grpc/client.ts`.
 *
 * The cast is a types-only concession: dApp Kit 1.1.5 declares its context
 * client as `SuiJsonRpcClient`, but nothing in this app calls a JSON-RPC-only
 * method on it. What it IS used for — `SessionKey.create`, `SealClient`,
 * `WalrusClient`, and `Transaction.build`/`toJSON` — all consume the shared
 * `core` API, which `SuiGrpcClient` implements. The one place dApp Kit itself
 * would reach for a JSON-RPC name is `useSignAndExecuteTransaction`'s default
 * executor (`client.executeTransactionBlock`); `useExecuteTransaction`
 * overrides that with a core-API executor.
 */
function createClient(network: string): SuiJsonRpcClient {
  return getSuiGrpcClient(network) as unknown as SuiJsonRpcClient;
}

export const NETWORK_STORAGE_KEY = 'walform:network';

function envDefaultNetwork(): WalFormNetwork {
  const v = process.env.NEXT_PUBLIC_DEFAULT_NETWORK;
  return v === 'mainnet' ? 'mainnet' : 'testnet';
}

function readStoredNetwork(): WalFormNetwork | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(NETWORK_STORAGE_KEY);
  if (v === 'mainnet' || v === 'testnet') return v;
  return null;
}

/**
 * Reads `localStorage[walform:network]` on mount and flips the active Sui
 * network to match — exactly once, before children render any
 * network-dependent UI. Rendered as a sibling of `<EnokiRegistrar>` inside
 * `<SuiClientProvider>` so it can call `selectNetwork`. Returns null because
 * it's a side-effect-only component.
 *
 * Why this pattern: the server-rendered HTML always shows the env default
 * (no `window` on the server), but a returning user's localStorage may have
 * a different value. Setting state in `useEffect` keeps the first client
 * render identical to the server HTML — no hydration mismatch — and only
 * flips afterwards.
 */
function StoredNetworkHydrator() {
  const { network, selectNetwork } = useSuiClientContext();
  useEffect(() => {
    const stored = readStoredNetwork();
    if (stored && stored !== network) {
      selectNetwork(stored);
    }
    // Run once on mount — `network` changing because of this very call
    // shouldn't re-fire the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function EnokiRegistrar() {
  const { client, network } = useSuiClientContext();
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_ENOKI_PUBLIC_KEY;
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!apiKey || !googleClientId) return;
    if (!isEnokiNetwork(network)) return;
    if (typeof window === 'undefined') return;

    // Pin the Google OAuth redirect to a fixed path so we only have to
    // register ONE url in the Google Cloud Console (any page can trigger
    // login — Enoki defaults to window.location.href which would require
    // registering every path).
    //
    // Resolution: explicit `NEXT_PUBLIC_ENOKI_REDIRECT_URL` wins. Otherwise
    // fall back to `${window.location.origin}/` so the same bundle works on
    // dev (localhost), preview, and production (walform.wal.app) without
    // rebuilding. Use `||` not `??` because Next inlines an empty env var
    // as `""` (not undefined), which `??` won't reject.
    const redirectUrl =
      process.env.NEXT_PUBLIC_ENOKI_REDIRECT_URL || `${window.location.origin}/`;

    const { unregister } = registerEnokiWallets({
      apiKey,
      network,
      client,
      providers: {
        google: {
          clientId: googleClientId,
          redirectUrl,
        },
      },
    });
    return () => unregister();
  }, [client, network]);
  return null;
}

export function SuiProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000 } },
      }),
  );
  // Always seed from env so server + client first render agree. The
  // localStorage value (if any) is applied via `StoredNetworkHydrator`
  // after mount, avoiding a hydration mismatch.
  const [defaultNetwork] = useState<WalFormNetwork>(envDefaultNetwork);

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider
        networks={networkConfig}
        createClient={(name) => createClient(String(name))}
        defaultNetwork={defaultNetwork}
        onNetworkChange={(net) => {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(NETWORK_STORAGE_KEY, net);
          }
        }}
      >
        <StoredNetworkHydrator />
        <EnokiRegistrar />
        <WalletProvider
          autoConnect
          slushWallet={{ name: 'WalForm' }}
          storageKey="walform:wallet"
          theme={null}
        >
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
