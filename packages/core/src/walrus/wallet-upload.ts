'use client';

import { useCallback, useRef } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientContext,
} from '@mysten/dapp-kit';
import type { WalrusClient } from '@mysten/walrus';
import { WalrusWalletSigner } from '../sui/wallet-signer';
import { getWalrusAggregatorUrl } from './upload';

export interface WalletUploadResult {
  blobId: string;
  url: string;
}

export interface UseWalrusWalletUploadResult {
  /** Push raw bytes to Walrus, signed + paid by the connected wallet. */
  uploadBlob: (
    bytes: Uint8Array,
    options?: { epochs?: number; deletable?: boolean },
  ) => Promise<WalletUploadResult>;
  /** True iff a wallet is connected on a Walrus-supported network. */
  isReady: boolean;
}

/**
 * Browser-side Walrus uploader that signs the registration tx + WAL payment
 * with the user's connected wallet via `WalrusWalletSigner` — the same path
 * the Mode B Site deploy already uses, scaled down to single-blob writes.
 *
 * Replaces the previous server-paid `/api/walrus/upload` route. The user pays
 * SUI gas for the registration tx and WAL for storage; no operator key
 * required. Walrus only runs on testnet/mainnet — devnet returns isReady=false.
 */
export function useWalrusWalletUpload(): UseWalrusWalletUploadResult {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { network } = useSuiClientContext();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  // Cache the WalrusClient + signer across calls: WalrusClient construction
  // pulls in the WASM bundle, and we want one signer per account so polling
  // state inside it can warm up.
  const clientRef = useRef<WalrusClient | null>(null);
  const cachedSignerRef = useRef<{ address: string; signer: WalrusWalletSigner } | null>(null);

  const walrusNetwork: 'testnet' | 'mainnet' | null =
    network === 'testnet' || network === 'mainnet' ? network : null;
  const isReady = !!account && !!walrusNetwork;

  const uploadBlob = useCallback(
    async (
      bytes: Uint8Array,
      options: { epochs?: number; deletable?: boolean } = {},
    ): Promise<WalletUploadResult> => {
      if (!account) throw new Error('Connect a wallet to upload to Walrus.');
      if (!walrusNetwork) {
        throw new Error(`Walrus does not run on ${network}; switch to testnet or mainnet.`);
      }

      if (!clientRef.current) {
        const { WalrusClient } = await import('@mysten/walrus');
        const relayHost =
          (typeof process !== 'undefined' &&
            process.env.NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_HOST) ||
          'https://upload-relay.testnet.walrus.space';
        clientRef.current = new WalrusClient({
          network: walrusNetwork,
          suiClient,
          uploadRelay: {
            host: relayHost,
            sendTip: { max: 1_000_000 },
          },
        });
      }

      if (cachedSignerRef.current?.address !== account.address) {
        cachedSignerRef.current = {
          address: account.address,
          signer: new WalrusWalletSigner(account.address, async (args) => {
            const r = await signAndExecuteTransaction({
              transaction: args.transaction,
              chain: args.chain ?? `sui:${walrusNetwork}`,
            });
            return { digest: r.digest };
          }),
        };
      }

      const { blobId } = await clientRef.current.writeBlob({
        blob: bytes,
        deletable: options.deletable ?? false,
        epochs: options.epochs ?? 5,
        signer: cachedSignerRef.current.signer,
      });
      return {
        blobId,
        url: `${getWalrusAggregatorUrl()}/v1/blobs/${blobId}`,
      };
    },
    [account, walrusNetwork, network, suiClient, signAndExecuteTransaction],
  );

  return { uploadBlob, isReady };
}

export type WalrusBlobUploader = UseWalrusWalletUploadResult['uploadBlob'];
