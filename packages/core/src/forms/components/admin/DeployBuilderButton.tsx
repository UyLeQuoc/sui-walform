'use client';

import { useEffect, useState } from 'react';
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
import { builderSiteCache, type PendingBuilderDeploy } from '../../services/builder-site-cache';
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
  // Resume state for partial deploys. Stored in IDB keyed on the connected
  // wallet so a different wallet starting from scratch doesn't see a foreign
  // cache entry.
  const [pending, setPending] = useState<PendingBuilderDeploy | null>(null);
  // Track an ageMin once at load time — re-rendering Date.now() in JSX violates
  // react-hooks purity.
  const [pendingAgeMin, setPendingAgeMin] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    if (!account?.address) {
      setPending(null);
      return;
    }
    builderSiteCache
      .get()
      .then((entry) => {
        if (cancelled) return;
        if (!entry) {
          setPending(null);
          return;
        }
        // Only surface the resume option if it matches the active wallet AND
        // network — otherwise the user can't sign for the same Site anyway.
        if (entry.signer !== account.address || entry.network !== net) {
          setPending(null);
          return;
        }
        setPending(entry);
        setPendingAgeMin(Math.max(1, Math.round((Date.now() - entry.createdAt) / 60000)));
      })
      .catch(() => {
        // IDB unavailable; just don't offer resume.
      });
    return () => {
      cancelled = true;
    };
  }, [account?.address, net]);

  const disabled = !sitePackageId || !account;
  const inProgress =
    stage === 'loading-bundle' || stage === 'uploading-walrus' || stage === 'deploying';

  /**
   * Resume-aware deploy. When `resumeFrom` is supplied, skips already-paid-for
   * steps:
   *   - `resumeFrom.manifest` set → skip bundle hashing + Walrus upload.
   *   - `resumeFrom.siteObjectId` set + `chunksCompleted ≥ 1` → skip chunks
   *     that already ran on-chain, resume from `chunksCompleted`.
   *
   * Checkpoints are persisted to IDB (`builderSiteCache`) after each step:
   * Walrus upload (manifest), then after each Sui PTB. A failed step leaves
   * the cache with the last successful checkpoint, surfacing a Resume CTA on
   * next mount.
   */
  const handleDeploy = async (resumeFrom?: PendingBuilderDeploy) => {
    if (!account || !sitePackageId) return;
    setErrMsg(null);
    setProgress(null);
    try {
      let manifest: WalrusSiteManifest;
      let walrusUploadDigest = resumeFrom?.walrusUploadDigest ?? '';

      if (resumeFrom?.manifest) {
        manifest = resumeFrom.manifest;
      } else {
        // ── Step 1: load bundle + hash ─────────────────────────────────────
        setStage('loading-bundle');
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
        // comparison, byte-wise for ASCII). `localeCompare` can produce a
        // different ordering and mis-align `results[i]` with `walrusFiles[i]`
        // → portal returns 422 "Hash mismatch".
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
          blobHashesU256.push(sha256LeU256(new Uint8Array(digest)));
          walrusFiles.push(WalrusFile.from({ contents: bytes, identifier: f.path }));
          setProgress({ done: i + 1, total: sortedFiles.length });
        }

        // ── Step 2: Walrus upload (1 wallet prompt) ────────────────────────
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
            // Capture the registration digest for the resume cache so a
            // failed-later deploy still records which Walrus tx was paid for.
            walrusUploadDigest = r.digest;
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
        manifest = {
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

        // CHECKPOINT 1: persist manifest BEFORE the first Sui PTB so a
        // wallet rejection / network drop on the next step is resumable.
        const allChunks: WalrusSiteManifest['files'][] = [];
        for (let i = 0; i < manifest.files.length; i += BUILDER_CHUNK_SIZE) {
          allChunks.push(manifest.files.slice(i, i + BUILDER_CHUNK_SIZE));
        }
        try {
          await builderSiteCache.put({
            manifest,
            walrusUploadDigest,
            network: net,
            signer: account.address,
            chunksCompleted: 0,
            chunkCount: allChunks.length,
          });
        } catch (e) {
          console.warn('[deploy-builder] cache put after Walrus failed:', e);
        }
      }

      // ── Step 3: Sui PTB chunks (1+ wallet prompts) ───────────────────────
      setStage('deploying');
      const chunks: WalrusSiteManifest['files'][] = [];
      for (let i = 0; i < manifest.files.length; i += BUILDER_CHUNK_SIZE) {
        chunks.push(manifest.files.slice(i, i + BUILDER_CHUNK_SIZE));
      }
      const startChunk = resumeFrom?.chunksCompleted ?? 0;
      let siteId: string | null = resumeFrom?.siteObjectId ?? null;
      setChunkProgress({ done: startChunk, total: chunks.length });

      for (let i = startChunk; i < chunks.length; i++) {
        const isLast = i === chunks.length - 1;
        const isFirst = i === 0;
        const tx = isFirst
          ? buildBuilderSiteFirstChunk({
              sitePackageId,
              name: 'WalForm builder',
              recipient: account.address,
              manifest,
              filesChunk: chunks[i]!,
              // Routes only go on the LAST chunk so a partial deploy doesn't
              // leave a site with routes pointing at resources not yet added.
              routes: isLast ? WALFORM_BUILDER_ROUTES : undefined,
              transfer: true,
            })
          : buildBuilderSiteAddChunk({
              sitePackageId,
              siteObjectId: siteId!,
              manifest,
              filesChunk: chunks[i]!,
              routes: isLast ? WALFORM_BUILDER_ROUTES : undefined,
            });

        const { digest } = await signAndExecuteTransaction({
          transaction: tx,
          chain: `sui:${net}`,
        });

        if (isFirst) {
          siteId = await extractWalrusSiteId(suiClient, digest, sitePackageId);
          if (!siteId)
            throw new Error('First chunk succeeded but Site object id missing from effects');
        }
        const completed = i + 1;
        setChunkProgress({ done: completed, total: chunks.length });

        // CHECKPOINT N: update progress after each successful chunk.
        try {
          await builderSiteCache.put({
            manifest,
            walrusUploadDigest,
            network: net,
            signer: account.address,
            siteObjectId: siteId ?? undefined,
            chunksCompleted: completed,
            chunkCount: chunks.length,
          });
        } catch (e) {
          console.warn('[deploy-builder] cache update failed:', e);
        }
      }

      // All chunks done — clear the resume cache.
      try {
        await builderSiteCache.clear();
      } catch (e) {
        console.warn('[deploy-builder] cache clear failed:', e);
      }
      setPending(null);

      setSiteObjectId(siteId!);
      const pubUrl = walrusSitePublicUrl(siteId!, '', net).replace(/#\/f\/$/, '');
      setSiteUrl(pubUrl);
      setStage('done');
      toast.success('Builder deployed to Walrus Site');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrMsg(msg);
      setStage('error');
      toast.error(`Deploy failed: ${msg}`);
      // Refresh resume state so the UI shows what's recoverable.
      builderSiteCache
        .get()
        .then((entry) => {
          if (entry && entry.signer === account.address && entry.network === net) {
            setPending(entry);
            setPendingAgeMin(Math.max(1, Math.round((Date.now() - entry.createdAt) / 60000)));
          }
        })
        .catch(() => {});
    }
  };

  const handleDiscardPending = async () => {
    try {
      await builderSiteCache.clear();
    } catch {
      /* ignore */
    }
    setPending(null);
    setStage('idle');
    setErrMsg(null);
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

        {stage === 'idle' && !pending && (
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

        {stage === 'idle' && pending && (
          <div className="border-primary/30 bg-primary/5 flex flex-col gap-2 rounded-md border p-3 text-xs">
            <div className="font-medium">Resume a previous deploy?</div>
            <p className="text-muted-foreground">
              {pending.chunksCompleted === 0
                ? `Walrus upload completed ${pendingAgeMin}m ago. Resume to skip re-uploading (~${(pending.manifest.files.reduce((s, f) => s + f.sizeBytes, 0) / 1024 / 1024).toFixed(1)} MB / ${pending.manifest.files.length} files) and only sign the remaining ${pending.chunkCount} Sui PTB${pending.chunkCount === 1 ? '' : 's'}.`
                : `Last attempt completed ${pending.chunksCompleted}/${pending.chunkCount} Sui PTBs (${pendingAgeMin}m ago). Resume to sign only the remaining ${pending.chunkCount - pending.chunksCompleted}.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void handleDeploy(pending)}
                disabled={disabled}
                className="h-7"
              >
                <Globe className="mr-1 h-3 w-3" />
                Resume deploy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleDiscardPending()}
                className="h-7"
                title="Drop the cached manifest. Next deploy starts fresh (re-uploads + pays WAL again)."
              >
                <X className="mr-1 h-3 w-3" />
                Discard
              </Button>
            </div>
          </div>
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
