'use client';

import { useState } from 'react';
import { Globe, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientContext,
} from '@mysten/dapp-kit';
import { WalrusClient, WalrusFile, blobIdToInt } from '@mysten/walrus';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Spinner } from '../../../ui/spinner';
import { WalrusWalletSigner } from '../../../sui/wallet-signer';
import {
  BUILDER_CHUNK_SIZE,
  buildBuilderSiteAddChunk,
  buildBuilderSiteFirstChunk,
  quiltPatchInternalHex,
  WALFORM_BUILDER_ROUTES,
  type WalrusSiteManifest,
} from '../../../sui/tx/walrus-site';
import {
  getWalrusAggregatorUrl,
  getWalrusUploadRelayHost,
  getWalrusUploadRelayTipMaxMist,
  useActiveWalrusSitePackageId,
} from '../../../sui/env-network';
import {
  extractWalrusSiteId,
  isWalrusPortalLocal,
  walrusSitePublicUrl,
} from '../../../sui/tx/extract-walrus-site-id';
import { LinkSuinsPanel } from '../list/LinkSuinsPanel';

interface BundleIndex {
  bundledAt: string;
  files: Array<{ path: string; contentType: string; sizeBytes: number }>;
}

type Stage = 'idle' | 'loading-bundle' | 'uploading-walrus' | 'deploying' | 'done' | 'error';

/**
 * Admin-side button that deploys the entire static-exported builder app to
 * a single Walrus Site, then offers an optional SuiNS link so the result is
 * reachable at `<name>.wal.app/` instead of `<base36>.wal.app/`.
 *
 * Pipeline:
 *   1. Fetch `/walform-builder-bundle/index.json` (produced by `bun run
 *      builder:export`).
 *   2. For each file: fetch bytes → SHA-256 → pack as u256.
 *   3. Walrus `writeFiles` (1 wallet prompt — registration tx).
 *   4. Build the site PTB with `WALFORM_BUILDER_ROUTES` → 1 wallet prompt.
 *   5. Extract Site object id, show public URL + LinkSuinsPanel.
 *
 * Routes are essential: the static export emits one bundle per dynamic
 * route at `[id]='_'`. Without the routes table the portal would 404 any
 * `/forms/<real-id>` request.
 */
export function DeployBuilderButton() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { network } = useSuiClientContext();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const sitePackageId = useActiveWalrusSitePackageId();
  const net = (network === 'mainnet' ? 'mainnet' : 'testnet') as 'testnet' | 'mainnet';

  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [chunkProgress, setChunkProgress] = useState<{ done: number; total: number } | null>(null);
  const [siteObjectId, setSiteObjectId] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const disabled = !sitePackageId || !account;
  const inProgress =
    stage === 'loading-bundle' || stage === 'uploading-walrus' || stage === 'deploying';

  const handleDeploy = async () => {
    if (!account || !sitePackageId) return;
    setStage('loading-bundle');
    setErrMsg(null);
    setProgress(null);
    try {
      const indexRes = await fetch('/walform-builder-bundle/index.json');
      if (!indexRes.ok) {
        throw new Error(
          `Bundle not found (HTTP ${indexRes.status}). Run \`bun run --cwd apps/builder builder:export\` first.`,
        );
      }
      const index = (await indexRes.json()) as BundleIndex;
      if (index.files.length === 0) throw new Error('Bundle is empty');

      // CRITICAL: byte-wise sort, NOT localeCompare. Walrus SDK's `encodeQuilt`
      // sorts blobs by identifier using JS string `<`/`>` (UTF-16 code unit
      // comparison, byte-wise for ASCII), and `writeFiles` returns results in
      // that order. `localeCompare` can produce a different ordering (e.g. for
      // mixed `_`/letters), which mis-aligns `results[i]` with `walrusFiles[i]`
      // → portal returns 422 "Hash mismatch" because the bytes pulled from the
      // aggregator hash to a different value than the on-chain `blob_hash`.
      const sortedFiles = [...index.files].sort((a, b) =>
        a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
      );
      const blobHashesU256: string[] = [];
      const walrusFiles: WalrusFile[] = [];

      for (let i = 0; i < sortedFiles.length; i++) {
        const f = sortedFiles[i]!;
        const res = await fetch(`/walform-builder-bundle${f.path}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch ${f.path} (HTTP ${res.status})`);
        }
        const bytes = new Uint8Array(await res.arrayBuffer());
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const u256 = sha256LeU256(new Uint8Array(digest));
        blobHashesU256.push(u256);
        walrusFiles.push(WalrusFile.from({ contents: bytes, identifier: f.path }));
        setProgress({ done: i + 1, total: sortedFiles.length });
      }

      setStage('uploading-walrus');
      const walrus = new WalrusClient({
        network: net,
        suiClient,
        uploadRelay: {
          host: getWalrusUploadRelayHost(net),
          sendTip: { max: getWalrusUploadRelayTipMaxMist(net) },
        },
      });
      const walrusSigner = new WalrusWalletSigner(
        account.address,
        async (args) => {
          const r = await signAndExecuteTransaction({
            transaction: args.transaction,
            chain: args.chain ?? `sui:${net}`,
          });
          return { digest: r.digest };
        },
        net,
      );
      const results = await walrus.writeFiles({
        files: walrusFiles,
        signer: walrusSigner,
        epochs: 15,
        deletable: false,
      });
      const quiltBlobId = results[0]?.blobId;
      if (!quiltBlobId) throw new Error('Walrus writeFiles returned no results');
      const quiltBlobIdU256 = blobIdToInt(quiltBlobId).toString();
      const aggregator = getWalrusAggregatorUrl(net);
      const manifest: WalrusSiteManifest = {
        publishedAt: new Date().toISOString(),
        network: net,
        epochs: 15,
        signer: account.address,
        quiltBlobId,
        quiltBlobIdU256,
        files: sortedFiles.map((f, i) => ({
          path: f.path,
          patchId: results[i]!.id,
          quiltPatchInternalIdHex: quiltPatchInternalHex(results[i]!.id),
          url: `${aggregator}/v1/blobs/by-quilt-patch-id/${results[i]!.id}`,
          sizeBytes: f.sizeBytes,
          contentType: f.contentType,
          blobHashU256: blobHashesU256[i]!,
        })),
      };

      setStage('deploying');
      // Chunk per Sui PTB 1024-command cap. 6 commands per file resource +
      // ~5 fixed → 150 files/tx leaves safe headroom. For ~209 files this is
      // 2 wallet prompts; for larger bundles it scales linearly.
      const chunks: WalrusSiteManifest['files'][] = [];
      for (let i = 0; i < manifest.files.length; i += BUILDER_CHUNK_SIZE) {
        chunks.push(manifest.files.slice(i, i + BUILDER_CHUNK_SIZE));
      }
      setChunkProgress({ done: 0, total: chunks.length });

      // First tx: create site + first chunk of files + transfer. Routes go
      // onto the LAST chunk so partial deploys (e.g. user rejects later
      // wallet prompts) don't end up with a site that has routes pointing
      // at resources that don't exist yet.
      const singleChunk = chunks.length === 1;
      const firstTx = buildBuilderSiteFirstChunk({
        sitePackageId,
        name: 'WalForm builder',
        recipient: account.address,
        manifest,
        filesChunk: chunks[0]!,
        routes: singleChunk ? WALFORM_BUILDER_ROUTES : undefined,
        transfer: true,
      });
      const { digest } = await signAndExecuteTransaction({
        transaction: firstTx,
        chain: `sui:${net}`,
      });
      const siteId = await extractWalrusSiteId(suiClient, digest, sitePackageId);
      if (!siteId) throw new Error('Deploy succeeded but Site object id missing from effects');
      setChunkProgress({ done: 1, total: chunks.length });

      // Subsequent chunks add more resources to the (now-owned) site.
      for (let i = 1; i < chunks.length; i++) {
        const isLast = i === chunks.length - 1;
        const chunkTx = buildBuilderSiteAddChunk({
          sitePackageId,
          siteObjectId: siteId,
          manifest,
          filesChunk: chunks[i]!,
          routes: isLast ? WALFORM_BUILDER_ROUTES : undefined,
        });
        await signAndExecuteTransaction({
          transaction: chunkTx,
          chain: `sui:${net}`,
        });
        setChunkProgress({ done: i + 1, total: chunks.length });
      }

      setSiteObjectId(siteId);
      // Builder app has no specific form path — public URL is just the root.
      const pubUrl = walrusSitePublicUrl(siteId, '', net).replace(/#\/f\/$/, '');
      setSiteUrl(pubUrl);
      setStage('done');
      toast.success('Builder deployed to Walrus Site');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrMsg(msg);
      setStage('error');
      toast.error(`Deploy failed: ${msg}`);
    }
  };

  const reset = () => {
    setStage('idle');
    setProgress(null);
    setChunkProgress(null);
    setSiteObjectId(null);
    setSiteUrl(null);
    setErrMsg(null);
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Deploy builder to Walrus Site</div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Push the entire builder app to a single Walrus Site (Mode A). You pay WAL for
              storage (~0.05–0.5 WAL for typical bundles) and SUI gas for two txs.
            </p>
          </div>
          {stage === 'done' && (
            <Button size="sm" variant="ghost" onClick={reset} className="h-7 px-2">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {stage === 'idle' && (
          <Button
            onClick={() => void handleDeploy()}
            disabled={disabled}
            className="self-start"
            title={!sitePackageId ? `Walrus Sites packageId not set for ${net}` : undefined}
          >
            <Globe className="mr-1.5 h-3.5 w-3.5" />
            Deploy now
          </Button>
        )}

        {inProgress && (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Spinner className="size-3" />
            {stage === 'loading-bundle' &&
              (progress
                ? `Hashing files… ${progress.done}/${progress.total}`
                : 'Loading bundle…')}
            {stage === 'uploading-walrus' && 'Uploading to Walrus (1 wallet prompt)…'}
            {stage === 'deploying' &&
              (chunkProgress && chunkProgress.total > 1
                ? `Sui PTB chunk ${chunkProgress.done}/${chunkProgress.total} (${chunkProgress.total} wallet prompts total)…`
                : 'Creating Site object on Sui (1 wallet prompt)…')}
          </div>
        )}

        {stage === 'error' && errMsg && (
          <>
            <p className="text-destructive text-xs">{errMsg}</p>
            <Button size="sm" variant="outline" onClick={reset} className="self-start">
              Try again
            </Button>
          </>
        )}

        {stage === 'done' && siteUrl && siteObjectId && (
          <div className="flex flex-col gap-3">
            <div className="border-border bg-muted/30 rounded-md border px-3 py-2 text-xs">
              <p className="font-medium">Live at:</p>
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-1 inline-flex items-center gap-1 break-all font-mono underline-offset-2 hover:underline"
              >
                {siteUrl}
              </a>
              {isWalrusPortalLocal(net) && (
                <p className="text-muted-foreground mt-1 text-[11px]">
                  Run a local portal: <code className="font-mono">bun run --cwd apps/portal dev</code>
                </p>
              )}
            </div>
            <LinkSuinsPanel siteObjectId={siteObjectId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Pack a 32-byte SHA-256 digest as a little-endian u256 decimal string —
 * what Walrus Sites `site::new_resource` expects for `blob_hash`. Same impl
 * as the per-form deploy uses.
 */
function sha256LeU256(bytes: Uint8Array): string {
  let n = 0n;
  for (let i = 31; i >= 0; i--) {
    n = (n << 8n) | BigInt(bytes[i] ?? 0);
  }
  return n.toString();
}
