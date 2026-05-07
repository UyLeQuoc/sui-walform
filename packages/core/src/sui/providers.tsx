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
import { getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import '@mysten/dapp-kit/dist/index.css';

export type WalFormNetwork = 'testnet' | 'mainnet' | 'devnet';

const { networkConfig } = createNetworkConfig({
  testnet: {
    url: getJsonRpcFullnodeUrl('testnet'),
    network: 'testnet',
    variables: { network: 'testnet' as const },
  },
  mainnet: {
    url: getJsonRpcFullnodeUrl('mainnet'),
    network: 'mainnet',
    variables: { network: 'mainnet' as const },
  },
  devnet: {
    url: getJsonRpcFullnodeUrl('devnet'),
    network: 'devnet',
    variables: { network: 'devnet' as const },
  },
});

export const NETWORK_STORAGE_KEY = 'walform:network';

function readStoredNetwork(): WalFormNetwork {
  if (typeof window === 'undefined') return 'testnet';
  const v = window.localStorage.getItem(NETWORK_STORAGE_KEY);
  return v === 'mainnet' || v === 'testnet' || v === 'devnet' ? v : 'testnet';
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
    // registering every path). Override with NEXT_PUBLIC_ENOKI_REDIRECT_URL
    // in production (e.g. https://walform.app/).
    const redirectUrl = process.env.NEXT_PUBLIC_ENOKI_REDIRECT_URL ?? `${window.location.origin}/`;

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
  const [defaultNetwork] = useState<WalFormNetwork>(() => readStoredNetwork());

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider
        networks={networkConfig}
        defaultNetwork={defaultNetwork}
        onNetworkChange={(net) => {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(NETWORK_STORAGE_KEY, net);
          }
        }}
      >
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
