'use client';

import { useCallback, useRef } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClientContext,
} from '@mysten/dapp-kit';
import type { WalrusClient } from '@mysten/walrus';
import { useSuiGrpcClient } from '../sui/grpc/use-grpc-client';
import { useCoreTransactionExecutor } from '../sui/use-core-executor';
import { WalrusWalletSigner } from '../sui/wallet-signer';
import {
  getWalrusAggregatorUrl,
  getWalrusUploadRelayHost,
  getWalrusUploadRelayTipMaxMist,
} from '../sui/env-network';

export interface WalletUploadResult {
  blobId: string;
  url: string;
}

export interface QuiltFileInput {
  /** Identifier within the Quilt — must be unique per upload. Conventionally `/path/like/this`. */
  identifier: string;
  /** Raw bytes for this file. */
  bytes: Uint8Array;
}

export interface QuiltFileResult {
  /** Logical identifier passed in (preserved 1:1 with input). */
  identifier: string;
  /** Per-file quilt patch id — used to fetch this specific file from the aggregator. */
  patchId: string;
  /** Aggregator URL pointing at this exact patch — direct fetch target. */
  url: string;
}

export interface QuiltUploadResult {
  /** The single underlying Walrus blob id holding every file in the Quilt. */
  quiltBlobId: string;
  /** Per-file results in INPUT order. */
  files: QuiltFileResult[];
}

export interface UseWalrusWalletUploadResult {
  /** Push raw bytes to Walrus as a standalone blob, signed + paid by the connected wallet. */
  uploadBlob: (
    bytes: Uint8Array,
    options?: { epochs?: number; deletable?: boolean },
  ) => Promise<WalletUploadResult>;
  /**
   * Bundle N files into a single Walrus Quilt — one registration tx + one storage
   * reservation. Returns one result per input file in the SAME order as input.
   * Use this whenever you'd otherwise loop over `uploadBlob` for related files
   * (e.g. form submission with attachments + encrypted body).
   */
  uploadQuilt: (
    files: QuiltFileInput[],
    options?: { epochs?: number; deletable?: boolean },
  ) => Promise<QuiltUploadResult>;
  /** True iff a wallet is connected on a Walrus-supported network. */
  isReady: boolean;
}

/**
 * Browser-side Walrus uploader that signs the registration tx + WAL payment
 * with the user's connected wallet via `WalrusWalletSigner`.
 *
 * Two operations:
 *   - `uploadBlob` — single blob, one registration tx.
 *   - `uploadQuilt` — N files in one Quilt, one registration tx total. Reuses
 *     the same signer/client cache as `uploadBlob`, so consecutive Quilt
 *     writes from the same wallet skip re-init.
 *
 * Walrus only runs on testnet/mainnet — devnet returns isReady=false.
 */
export function useWalrusWalletUpload(): UseWalrusWalletUploadResult {
  const account = useCurrentAccount();
  const suiClient = useSuiGrpcClient();
  const { network } = useSuiClientContext();
  const broadcast = useCoreTransactionExecutor();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction({
    execute: broadcast,
  });
  // Cache the WalrusClient + signer across calls: WalrusClient construction
  // pulls in the WASM bundle, and we want one signer per account so polling
  // state inside it can warm up. Both refs key on (network, address) — when
  // the user flips networks via the dropdown, the old clients are stale (they
  // baked in the old aggregator/relay) and must be rebuilt.
  const clientRef = useRef<{ network: 'testnet' | 'mainnet'; client: WalrusClient } | null>(null);
  const cachedSignerRef = useRef<{
    address: string;
    network: 'testnet' | 'mainnet';
    signer: WalrusWalletSigner;
  } | null>(null);

  const walrusNetwork: 'testnet' | 'mainnet' | null =
    network === 'testnet' || network === 'mainnet' ? network : null;
  const isReady = !!account && !!walrusNetwork;

  const ensureClient = useCallback(async (): Promise<{
    client: WalrusClient;
    signer: WalrusWalletSigner;
    walrusNet: 'testnet' | 'mainnet';
  }> => {
    if (!account) throw new Error('Connect a wallet to upload to Walrus.');
    if (!walrusNetwork) {
      throw new Error(`Walrus does not run on ${network}; switch to testnet or mainnet.`);
    }

    if (!clientRef.current || clientRef.current.network !== walrusNetwork) {
      const { WalrusClient } = await import('@mysten/walrus');
      clientRef.current = {
        network: walrusNetwork,
        client: new WalrusClient({
          network: walrusNetwork,
          suiClient,
          uploadRelay: {
            host: getWalrusUploadRelayHost(walrusNetwork),
            sendTip: { max: getWalrusUploadRelayTipMaxMist(walrusNetwork) },
          },
        }),
      };
    }

    if (
      cachedSignerRef.current?.address !== account.address ||
      cachedSignerRef.current?.network !== walrusNetwork
    ) {
      cachedSignerRef.current = {
        address: account.address,
        network: walrusNetwork,
        signer: new WalrusWalletSigner(
          account.address,
          async (args) => {
            const r = await signAndExecuteTransaction({
              transaction: args.transaction,
              chain: args.chain ?? `sui:${walrusNetwork}`,
            });
            return { digest: r.digest };
          },
          walrusNetwork,
        ),
      };
    }

    return {
      client: clientRef.current.client,
      signer: cachedSignerRef.current.signer,
      walrusNet: walrusNetwork,
    };
  }, [account, walrusNetwork, network, suiClient, signAndExecuteTransaction]);

  const uploadBlob = useCallback(
    async (
      bytes: Uint8Array,
      options: { epochs?: number; deletable?: boolean } = {},
    ): Promise<WalletUploadResult> => {
      const { client, signer, walrusNet } = await ensureClient();
      const { blobId } = await client.writeBlob({
        blob: bytes,
        deletable: options.deletable ?? false,
        epochs: options.epochs ?? 15,
        signer,
      });
      return {
        blobId,
        url: `${getWalrusAggregatorUrl(walrusNet)}/v1/blobs/${blobId}`,
      };
    },
    [ensureClient],
  );

  const uploadQuilt = useCallback(
    async (
      files: QuiltFileInput[],
      options: { epochs?: number; deletable?: boolean } = {},
    ): Promise<QuiltUploadResult> => {
      if (files.length === 0) {
        throw new Error('uploadQuilt requires at least one file.');
      }
      const { client, signer, walrusNet } = await ensureClient();
      const { WalrusFile } = await import('@mysten/walrus');

      // CRITICAL: the SDK's `encodeQuilt` (utils/quilts.mjs) sorts inputs by
      // identifier before encoding, and `writeFiles` returns results in that
      // sorted order — NOT input order. Mirror that sort here so we can map
      // results back to caller's original input positions.
      const ordered = files
        .map((f, i) => ({ original: i, file: f }))
        .sort((a, b) =>
          a.file.identifier < b.file.identifier ? -1 : a.file.identifier > b.file.identifier ? 1 : 0,
        );

      const walrusFiles = ordered.map(({ file }) =>
        WalrusFile.from({
          contents: file.bytes,
          identifier: file.identifier,
        }),
      );

      const results = await client.writeFiles({
        files: walrusFiles,
        signer,
        epochs: options.epochs ?? 15,
        deletable: options.deletable ?? false,
      });

      const aggregator = getWalrusAggregatorUrl(walrusNet);
      const quiltBlobId = results[0]?.blobId;
      if (!quiltBlobId) {
        throw new Error('Walrus writeFiles returned no results');
      }

      // Re-map back to caller's input order.
      const outFiles: QuiltFileResult[] = new Array(files.length);
      ordered.forEach(({ original, file }, sortedIdx) => {
        const r = results[sortedIdx];
        if (!r) throw new Error(`writeFiles result missing for ${file.identifier}`);
        outFiles[original] = {
          identifier: file.identifier,
          patchId: r.id,
          url: `${aggregator}/v1/blobs/by-quilt-patch-id/${r.id}`,
        };
      });

      return { quiltBlobId, files: outFiles };
    },
    [ensureClient],
  );

  return { uploadBlob, uploadQuilt, isReady };
}

export type WalrusBlobUploader = UseWalrusWalletUploadResult['uploadBlob'];
export type WalrusQuiltUploader = UseWalrusWalletUploadResult['uploadQuilt'];
