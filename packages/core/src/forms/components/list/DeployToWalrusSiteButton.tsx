'use client';

import { useEffect, useState } from 'react';
import { Globe, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientContext,
} from '@mysten/dapp-kit';
import { WalrusClient, WalrusFile, blobIdToInt } from '@mysten/walrus';
import { Button } from '../../../ui/button';
import { useActivePackageId } from '../../../sui/package-id';
import {
  getWalrusAggregatorUrl,
  getWalrusUploadRelayHost,
  getWalrusUploadRelayTipMaxMist,
  useActiveWalrusSitePackageId,
} from '../../../sui/env-network';
import { useInvalidateChainQueries } from '../../../sui/use-invalidate-chain';
import {
  buildDeployWalrusSiteTx,
  quiltPatchInternalHex,
  type WalrusSiteManifest,
} from '../../../sui/tx/walrus-site';
import { WalrusWalletSigner } from '../../../sui/wallet-signer';
import {
  extractWalrusSiteId,
  getTxGasCost,
  isWalrusPortalLocal,
  walrusSitePublicUrl,
} from '../../../sui/tx/extract-walrus-site-id';
import { formSiteCache } from '../../services/form-site-cache';
import type { OnChainForm } from '../../hooks/use-on-chain-forms';
import { LinkSuinsPanel } from './LinkSuinsPanel';
import { WalrusSiteManageDialog } from './WalrusSiteManageDialog';

export function DeployToWalrusSiteButton({ form }: { form: OnChainForm }) {
  const account = useCurrentAccount();
  const packageId = useActivePackageId();
  const suiClient = useSuiClient();
  const { network } = useSuiClientContext();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const [stage, setStage] = useState<
    'idle' | 'loading-bundle' | 'uploading-walrus' | 'deploying' | 'done' | 'error'
  >('idle');
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [costInfo, setCostInfo] = useState<{ deployMist: bigint; fileCount: number } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // When `rootPath` is on, the bundle gets a `config.json` injected with this
  // form's id, and the deployed Walrus Site renders that form at the root
  // path `/` (no `#/f/<id>` slug). Lets a creator link a SuiNS name so the
  // form is reachable at `https://<their-name>.wal.app/`.
  const [rootPath, setRootPath] = useState(false);
  const [deployedSiteId, setDeployedSiteId] = useState<string | null>(null);
  // Partial-state recovery: if a previous deploy attempt finished Walrus
  // upload but failed/got rejected at the Sui PTB stage, the manifest is
  // cached in IDB. We surface a "Resume" branch so the user doesn't pay WAL
  // again. Loaded once per form id; cleared on successful deploy or explicit
  // discard.
  const [pendingDeploy, setPendingDeploy] = useState<{
    manifest: WalrusSiteManifest;
    walrusUploadDigest: string;
    /** Pre-computed at load time — `Date.now()` in render breaks react-hooks/purity. */
    ageMin: number;
  } | null>(null);
  // Walrus Sites packageId resolves per-active-network via env-network helpers;
  // testnet defaults to the canonical Mysten id so a missing/stale env doesn't
  // silently route deploys to the older `0xf99aee…` package.
  const sitePackageId = useActiveWalrusSitePackageId();
  const net = (network === 'mainnet' || network === 'devnet' ? network : 'testnet') as
    | 'testnet'
    | 'mainnet'
    | 'devnet';

  // If the form already has a site_object_id mirrored on chain, skip deploy
  // entirely and offer Manage instead. Falls back to deploy when missing.
  const existingSiteId = form.siteObjectId;

  // Load any cached partial deploy on mount. Skip when already deployed —
  // a stale cache entry from a previous attempt is harmless but irrelevant.
  useEffect(() => {
    if (existingSiteId) return;
    let cancelled = false;
    formSiteCache
      .get(form.formId)
      .then((entry) => {
        if (cancelled || !entry) return;
        setPendingDeploy({
          manifest: entry.manifest,
          walrusUploadDigest: entry.walrusUploadDigest,
          ageMin: Math.max(1, Math.round((Date.now() - entry.createdAt) / 60000)),
        });
      })
      .catch(() => {
        // IDB unavailable / permission denied — silently skip resume offer.
      });
    return () => {
      cancelled = true;
    };
  }, [form.formId, existingSiteId]);

  const disabled = !packageId || !sitePackageId || !account;

  /**
   * Deploy flow:
   *   1. fetch + hash bundle (skipped when resuming with cached manifest)
   *   2. user wallet signs Walrus blob upload (registration tx) — costs WAL.
   *      Manifest is persisted to IDB BEFORE the next step so a failed/rejected
   *      atomic PTB can be retried without re-paying for storage.
   *   3. user wallet signs the atomic Sui PTB (site::new_site + per-file
   *      resources + form::set_site_object_id_obj + transferObjects). Costs
   *      SUI gas only. On success, IDB cache is cleared.
   */
  const handleDeploy = async (resume?: { manifest: WalrusSiteManifest; uploadDigest: string }) => {
    if (!account || !packageId || !sitePackageId) return;
    setErrMsg(null);
    setProgress(null);
    // Surface the live env value so a stale dev-server bundle is obvious in
    // the console — happens when .env.local changes without a full restart.
    console.info('[DeployToWalrusSite] sitePackageId =', sitePackageId, `(network=${net})`);
    try {
      let manifest: WalrusSiteManifest;

      if (resume) {
        // Resume path — Walrus bytes already on-chain, skip straight to the
        // atomic Sui PTB. Saves the user a second WAL spend.
        manifest = resume.manifest;
        console.info(
          '[DeployToWalrusSite] resuming from cached manifest, walrus digest:',
          resume.uploadDigest,
        );
      } else {
        // Step 1 — fetch the lightweight bundle index.
        setStage('loading-bundle');
        const idxRes = await fetch('/walform-site-bundle/index.json', { cache: 'no-store' });
        if (!idxRes.ok) {
          throw new Error(
            `Bundle index not found at /walform-site-bundle/index.json (HTTP ${idxRes.status}). Run \`bun run --cwd packages/walform-site bundle:mirror\` after \`next build\`.`,
          );
        }
        const index = (await idxRes.json()) as {
          files: Array<{ path: string; contentType: string; sizeBytes: number }>;
        };
        if (!index.files || index.files.length === 0) {
          throw new Error('Bundle index has no files — re-run bundle:mirror.');
        }

        // CRITICAL: Walrus SDK's `encodeQuilt` (utils/quilts.mjs:70) sorts
        // input blobs alphabetically by identifier before encoding, and
        // `writeFiles` returns results in that sorted order — NOT input order.
        // Mirror that sort here so `results[i]` aligns with our local
        // `walrusFiles[i]` / `blobHashesU256[i]` / `sortedFiles[i]`. Mismatch
        // would map each on-chain Resource's `blob_hash` to a DIFFERENT file's
        // patch id → portal returns 422 "Hash mismatch" because the bytes it
        // pulls from the aggregator hash to a different value.
        // Inject a baked config so the shell can render the form at root path
        // when no hash is present. The on-disk file list doesn't have this —
        // it's synthesized per-form per-deploy and uploaded as one of the
        // quilt blobs.
        const synthFiles: Array<{
          path: string;
          contentType: string;
          sizeBytes: number;
          bytes?: Uint8Array;
        }> = [];
        if (rootPath) {
          const configBytes = new TextEncoder().encode(
            JSON.stringify({ formId: form.formId, network: net }),
          );
          synthFiles.push({
            path: '/config.json',
            contentType: 'application/json',
            sizeBytes: configBytes.byteLength,
            bytes: configBytes,
          });
        }
        const sortedFiles = [...index.files, ...synthFiles].sort((a, b) =>
          a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
        );

        // Step 2 — fetch each file + compute SHA-256 (u256 LE decimal).
        setProgress({ done: 0, total: sortedFiles.length });
        const walrusFiles: WalrusFile[] = [];
        const blobHashesU256: string[] = [];
        for (let i = 0; i < sortedFiles.length; i++) {
          const f = sortedFiles[i]!;
          let bytes: Uint8Array;
          const synthetic = (f as { bytes?: Uint8Array }).bytes;
          if (synthetic) {
            // Synthetic file (config.json) — bytes already in memory, no fetch.
            bytes = synthetic;
          } else {
            const fileRes = await fetch(`/walform-site-bundle${f.path}`, { cache: 'no-store' });
            if (!fileRes.ok) {
              throw new Error(
                `Failed to fetch /walform-site-bundle${f.path} (${fileRes.status}). Bundle is out of sync — re-run bundle:mirror.`,
              );
            }
            bytes = new Uint8Array(await fileRes.arrayBuffer());
          }
          const hash = await sha256ToU256DecimalLE(bytes);
          blobHashesU256.push(hash);
          // Match upstream `site-builder` exactly: identifier = "/path", NO
          // tags (BTreeMap::new() in resource.rs:547). Adding `content-type` as
          // a Walrus tag triggered portal "Hash mismatch" 422 — the tag bytes
          // change the patch slot framing the aggregator returns, breaking
          // SHA-256(content) parity with the on-chain `blob_hash`. Content-type
          // is delivered to the portal via the on-chain `add_header` call
          // instead, which is the canonical path.
          walrusFiles.push(
            WalrusFile.from({
              contents: bytes,
              identifier: f.path,
            }),
          );
          setProgress({ done: i + 1, total: sortedFiles.length });
        }

        // Step 3 — push to Walrus via the user's wallet. Bundles all files
        // into one Quilt blob (one Sui registration tx + one storage
        // reservation). User pays WAL + SUI gas; upload-relay auto-discovers
        // tip, capped at 1M MIST.
        setStage('uploading-walrus');
        const walrusNet: 'testnet' | 'mainnet' = net === 'mainnet' ? 'mainnet' : 'testnet';
        const walrus = new WalrusClient({
          network: walrusNet,
          suiClient,
          uploadRelay: {
            host: getWalrusUploadRelayHost(walrusNet),
            sendTip: { max: getWalrusUploadRelayTipMaxMist(walrusNet) },
          },
        });
        let walrusUploadDigest: string | null = null;
        const walrusSigner = new WalrusWalletSigner(
          account.address,
          async (args) => {
            const r = await signAndExecuteTransaction({
              transaction: args.transaction,
              chain: args.chain ?? `sui:${net}`,
            });
            walrusUploadDigest = r.digest;
            return { digest: r.digest };
          },
          walrusNet,
        );
        const results = await walrus.writeFiles({
          files: walrusFiles,
          signer: walrusSigner,
          epochs: 15,
          deletable: false,
        });
        const quiltBlobId = results[0]?.blobId;
        if (!quiltBlobId) {
          throw new Error('Walrus writeFiles returned no results');
        }
        const quiltBlobIdU256 = blobIdToInt(quiltBlobId).toString();
        const aggregator = getWalrusAggregatorUrl(walrusNet);
        manifest = {
          publishedAt: new Date().toISOString(),
          network: net === 'mainnet' ? 'mainnet' : 'testnet',
          epochs: 15,
          signer: account.address,
          quiltBlobId,
          quiltBlobIdU256,
          // Iterate `sortedFiles` (not `index.files`) so each manifest entry's
          // patchId / blobHash come from the same sorted slot — see the comment
          // above the `sortedFiles` declaration for the why.
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

        // Persist BEFORE the atomic Sui PTB so a fail/reject leaves a Resume
        // anchor. Best-effort — IDB unavailability shouldn't kill the deploy.
        try {
          await formSiteCache.put(form.formId, manifest, walrusUploadDigest ?? '');
        } catch (cacheErr) {
          console.warn('[DeployToWalrusSite] failed to persist resume cache:', cacheErr);
        }
      }

      // Step 4 — atomic Sui PTB: site creation + per-file resources +
      // form::set_site_object_id_obj + transferObjects, all user-paid.
      setStage('deploying');
      const deployTx = buildDeployWalrusSiteTx({
        sitePackageId,
        walformPackageId: packageId,
        formObjectId: form.formId,
        formOwnerCapId: form.capId,
        name: form.title || 'WalForm site',
        recipient: account.address,
        manifest,
      });
      const { digest: deployDigest } = await signAndExecuteTransaction({
        transaction: deployTx,
        chain: `sui:${net}`,
      });
      const siteObjectId = await extractWalrusSiteId(suiClient, deployDigest, sitePackageId);
      if (!siteObjectId) {
        throw new Error(
          'Deploy tx succeeded but Site objectId missing from effects. Check console for raw objectChanges.',
        );
      }
      await invalidateChain(deployDigest);
      const deployCost = await getTxGasCost(suiClient, deployDigest);

      // Atomic PTB succeeded — clear the resume cache.
      try {
        await formSiteCache.delete(form.formId);
      } catch {
        /* ignore */
      }
      setPendingDeploy(null);

      // Public URL form depends on the root-path toggle: rootPath = no hash,
      // shell reads form id from baked config.json. Default = hash routed.
      const hashUrl = walrusSitePublicUrl(siteObjectId, form.formId, net);
      const url = rootPath ? hashUrl.replace(/#\/f\/.+$/, '') : hashUrl;
      setSiteUrl(url);
      setDeployedSiteId(siteObjectId);
      setCostInfo({
        deployMist: deployCost?.netMist ?? 0n,
        fileCount: manifest.files.length,
      });
      setStage('done');
      toast.success('Deployed to Walrus Site');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrMsg(msg);
      setStage('error');
      toast.error(`Deploy failed: ${msg}`);
    }
  };

  const handleDiscardPending = async () => {
    try {
      await formSiteCache.delete(form.formId);
    } catch {
      /* ignore */
    }
    setPendingDeploy(null);
    setStage('idle');
    setErrMsg(null);
  };

  const label =
    stage === 'loading-bundle'
      ? progress
        ? `Loading bundle ${progress.done}/${progress.total}…`
        : 'Loading bundle…'
      : stage === 'uploading-walrus'
        ? 'Sign in wallet — Walrus upload…'
        : stage === 'deploying'
          ? 'Sign in wallet — atomic deploy…'
          : stage === 'done'
            ? 'Open Walrus URL'
            : 'Deploy to Walrus Site';

  const inProgress =
    stage === 'loading-bundle' || stage === 'uploading-walrus' || stage === 'deploying';

  // Already deployed — show open + manage + re-deploy.
  if (existingSiteId && !inProgress && stage !== 'done') {
    const publicUrl = walrusSitePublicUrl(existingSiteId, form.formId, net);
    const portalIsLocal = isWalrusPortalLocal(net);
    return (
      <div className="flex flex-col gap-2 border-t pt-3">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" title={publicUrl}>
              <Globe className="mr-1.5 h-3.5 w-3.5" />
              Open on Walrus
            </a>
          </Button>
          <Button variant="ghost" onClick={() => setManageOpen(true)}>
            Manage site
          </Button>
          <Button
            variant="ghost"
            onClick={() => void handleDeploy()}
            disabled={disabled}
            title="Re-upload bundle + create a new Site object. The Form's site_object_id will be overwritten to point at the new Site."
          >
            Re-deploy
          </Button>
        </div>
        {portalIsLocal && (
          <p className="text-muted-foreground text-[11px]">
            URL points at a local portal (<code className="font-mono">localhost:4000</code>). Start
            one with <code className="font-mono">bun run --cwd apps/portal dev</code> or see{' '}
            <a
              href="https://docs.wal.app/docs/sites/portals/deploy-locally"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground underline underline-offset-2"
            >
              Deploy a portal locally
            </a>
            .
          </p>
        )}
        <WalrusSiteManageDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          formId={form.formId}
          formTitle={form.title}
          siteObjectId={existingSiteId}
        />
      </div>
    );
  }

  // Resume branch — Walrus blob already uploaded, atomic Sui PTB pending.
  // Surface only when not already deployed and no upload is in flight.
  if (pendingDeploy && !existingSiteId && !inProgress && stage !== 'done') {
    return (
      <div className="flex flex-col gap-2 border-t pt-3">
        <p className="text-muted-foreground text-[11px]">
          Walrus blob uploaded {pendingDeploy.ageMin} min ago — finish the deploy without re-paying
          for storage.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="self-start"
            disabled={disabled}
            onClick={() =>
              void handleDeploy({
                manifest: pendingDeploy.manifest,
                uploadDigest: pendingDeploy.walrusUploadDigest,
              })
            }
            title="Resume the Walrus Site deploy with the cached manifest. Skips Walrus upload — only the atomic Sui PTB needs your signature."
          >
            <Globe className="mr-1.5 h-3.5 w-3.5" />
            Resume Walrus deploy
          </Button>
          <Button
            variant="ghost"
            onClick={() => void handleDiscardPending()}
            title="Drop the cached manifest. Next deploy starts fresh (re-uploads bundle + pays WAL again)."
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Discard
          </Button>
        </div>
        {stage === 'error' && errMsg && <p className="text-destructive text-[11px]">{errMsg}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      {stage === 'done' && siteUrl ? (
        <Button asChild variant="outline" className="self-start">
          <a href={siteUrl} target="_blank" rel="noopener noreferrer" title={siteUrl}>
            <Globe className="mr-1.5 h-3.5 w-3.5" />
            {label}
          </a>
        </Button>
      ) : (
        <Button
          variant="outline"
          className="self-start"
          disabled={disabled || inProgress}
          onClick={() => void handleDeploy()}
          title={
            !sitePackageId
              ? `Walrus Sites packageId not configured for ${net}`
              : 'Deploy this form as a Walrus Site (Mode B). Your wallet signs + pays for both the Walrus upload and the atomic Sui PTB.'
          }
        >
          <Globe className="mr-1.5 h-3.5 w-3.5" />
          {label}
        </Button>
      )}
      {costInfo && (
        <p className="text-muted-foreground text-[11px] tabular-nums">
          {costInfo.fileCount} files · deploy {formatSui(costInfo.deployMist)} SUI · paid by your
          wallet
        </p>
      )}
      {stage === 'done' && siteUrl && isWalrusPortalLocal(net) && (
        <p className="text-muted-foreground text-[11px]">
          URL points at a local portal (<code className="font-mono">localhost:4000</code>). Start
          one with <code className="font-mono">bun run --cwd apps/portal dev</code> or see{' '}
          <a
            href="https://docs.wal.app/docs/sites/portals/deploy-locally"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground underline underline-offset-2"
          >
            Deploy a portal locally
          </a>
          .
        </p>
      )}
      {stage === 'idle' && (
        <label className="text-muted-foreground flex items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={rootPath}
            onChange={(e) => setRootPath(e.target.checked)}
            className="size-3"
          />
          <span>
            Render at root path <code className="font-mono">/</code> (no{' '}
            <code className="font-mono">#/f/&lt;id&gt;</code>). Best paired with a SuiNS name so
            the URL is <code className="font-mono">your-name.wal.app</code>.
          </span>
        </label>
      )}
      {stage === 'done' && deployedSiteId && (
        <LinkSuinsPanel siteObjectId={deployedSiteId} />
      )}
      {stage === 'error' && errMsg && <p className="text-destructive text-[11px]">{errMsg}</p>}
    </div>
  );
}

function formatSui(mist: bigint): string {
  if (mist === 0n) return '0';
  const whole = mist / 1_000_000_000n;
  const frac = mist % 1_000_000_000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fracStr}`;
}

/**
 * SHA-256 hash of bytes, packed as little-endian u256 decimal — matches the
 * Walrus Sites Move side which expects `blob_hash: u256` per resource. Done
 * via Web Crypto so it works in any modern browser without dependencies.
 */
async function sha256ToU256DecimalLE(bytes: Uint8Array): Promise<string> {
  // Always copy into a fresh ArrayBuffer to satisfy crypto.subtle.digest's
  // BufferSource typing (rejects SharedArrayBuffer + view aliases).
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const hashBuffer = await crypto.subtle.digest('SHA-256', copy.buffer);
  const hash = new Uint8Array(hashBuffer);
  // Reverse for LE → BigInt(hex) parses big-endian.
  let n = 0n;
  for (let i = hash.length - 1; i >= 0; i--) {
    n = (n << 8n) | BigInt(hash[i]!);
  }
  return n.toString();
}
