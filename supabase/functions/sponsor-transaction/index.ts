// Supabase Edge Function — WalForm sponsor.
//
// Single endpoint that wraps the Enoki sponsor API. Drops into a brand-new
// Supabase project as `supabase/functions/sponsor/index.ts`; no other files
// needed. Deploy with:
//
//     supabase functions deploy sponsor --no-verify-jwt
//
// Two required envs in the Supabase dashboard (Functions → sponsor → Secrets):
//
//   ENOKI_PRIVATE_KEY    Enoki app private key (works for testnet + mainnet
//                        from one key — Enoki dashboard configures both).
//   ALLOWED_ORIGIN       Comma-separated origins allowed to call this fn
//                        (`*` = one subdomain label, e.g. https://*.wal.app),
//                        e.g. "https://walform.wal.app,http://localhost:3000".
//                        Leave UNSET (or "*") to allow any origin.
//
// Optional override envs — only set them if you upgrade the WalForm package
// and want the new packageId in the allowlist without redeploying the
// function. When unset, the bundled constants below are used. The walform
// value may be a comma-separated list: every listed version is allowed, so an
// already-deployed site (calling an older version) keeps working next to a
// new build (calling the upgraded one).
//
//   WALFORM_PACKAGE_TESTNET, WALFORM_PACKAGE_MAINNET
//   WALRUS_SITE_PACKAGE_TESTNET, WALRUS_SITE_PACKAGE_MAINNET
//
// Walrus targets (pool-sponsored uploads: register / certify / share) are NOT
// pinned: the current Walrus package id is read from the Walrus System object
// (cached 10 min), because it changes on every Walrus upgrade. The upload
// relay's tip address is read from the relay and allowed as a recipient.
//
// Protocol — POST { action, ... } JSON:
//
//   { action: 'create', network, transactionKindBytes, sender }
//     → { bytes, digest }                  Enoki sponsor signature pre-baked
//
//   { action: 'execute', digest, signature }
//     → { digest }                         Final on-chain digest
//
// Client signs the `bytes` field returned from `create` with the user's
// wallet (signTransaction, NOT signAndExecute — the wallet should NOT pay
// gas here), then POSTs the resulting signature back as `execute`.
//
// Any error response is the client's cue to fall back to wallet-paid
// signAndExecuteTransaction. The fallback path is wired in
// packages/core/src/sui/use-execute-transaction.ts.

import { EnokiClient } from 'npm:@mysten/enoki@^1.0';

// ─── Allowlist of MoveCall targets ──────────────────────────────────────────
//
// Every entry function the WalForm app actually issues. Enoki rejects any
// transaction whose MoveCalls include a target NOT in this list — protects
// the sponsor wallet from being drained by an attacker building arbitrary
// transactions through the public sponsor route.
//
// `0x2::transfer::public_share_object` is the built-in sui::transfer call
// our `create_form` / `clone_paid_and_share` PTBs use to share the new
// Form/Template object. It must be allowed for sponsorship to cover those
// composed PTBs.
//
// Walrus Sites entry fns (`metadata::new_metadata`, `site::new_site`, etc.)
// live on a separate package (canonical Mysten testnet/mainnet ids below).
// We allow them so Mode B deploy is sponsorable end-to-end.

const WALFORM_FNS = [
  'form::new_settings',
  'form::create_form',
  'form::create_and_share',
  'form::share',
  'form::update_schema',
  'form::update_settings',
  'form::set_site_object_id',
  'form::set_site_object_id_obj',
  'form::set_cover_blob_id',
  'form::close_form',
  'allowlist::create',
  'allowlist::create_and_share',
  'allowlist::add',
  'allowlist::add_many',
  'allowlist::remove',
  'allowlist::share',
  'submission::submit',
  'submission::submit_and_share',
  'submission::submit_paid',
  'submission::submit_paid_and_share',
  'submission::share',
  'referral::submit_and_share',
  'referral::submit_paid_and_share',
  'template::publish_template',
  'template::create_listing',
  'template::create_listing_and_share',
  'template::update_listing_price',
  'template::clone_free',
  'template::clone_free_and_share',
  'template::clone_paid',
  'template::clone_paid_and_share',
  'template::purchase_template_only',
  'template::record_free_clone',
  'template::withdraw_platform',
  'voting::init_template_votes',
  'voting::upvote',
  'voting::downvote',
  'voting::clear_vote',
  'reviewers::create_and_share',
  'reviewers::add_reviewer',
  'reviewers::remove_reviewer',
  'payment::create',
  'payment::create_and_share',
  'payment::share',
  'payment::withdraw',
  'payment::withdraw_all',
  // Creator-funded Walrus sponsorship (added in the sponsor_pool upgrade).
  'sponsor_pool::create_pool',
  'sponsor_pool::create_pool_and_share',
  'sponsor_pool::share_pool',
  'sponsor_pool::deposit_wal',
  'sponsor_pool::deposit_sui',
  'sponsor_pool::withdraw_wal',
  'sponsor_pool::withdraw_sui',
  'sponsor_pool::set_limits',
  'sponsor_pool::set_enabled',
  'sponsor_pool::sweep_fees',
  'sponsor_pool::borrow',
  'sponsor_pool::take_relay_tip',
  'sponsor_pool::settle',
];

// Walrus calls a pool-sponsored upload makes (the SDK's registerBlob +
// quilt attributes, certifyBlob, and wrapping into a SharedBlob), plus the
// creator's "extend storage" (fund + extend a SharedBlob).
const WALRUS_FNS = [
  'system::reserve_space',
  'system::register_blob',
  'system::certify_blob',
  'metadata::new',
  'blob::add_metadata',
  'blob::insert_or_update_metadata_pair',
  'shared_blob::new',
  'shared_blob::fund',
  'shared_blob::extend',
];

const WALRUS_SITE_FNS = [
  'metadata::new_metadata',
  'site::new_site',
  'site::new_range_option',
  'site::new_resource',
  'site::add_header',
  'site::add_resource',
  'site::create_routes',
  'site::fill_routes',
  'site::update_metadata',
];

// `coin::destroy_zero` closes out the WAL splits the Walrus SDK makes.
const SUI_FRAMEWORK_FNS = ['0x2::transfer::public_share_object', '0x2::coin::destroy_zero'];

// Default packageIds. Override via env at deploy time if you've upgraded.
// Every walform package version a live client may target, oldest first — see
// apps/contracts/PACKAGES.md. Keep the previous version listed after an
// upgrade until no deployed site calls it anymore.
const DEFAULT_PACKAGES = {
  testnet: {
    walform: [
      '0x61074d22c927255c82ba5e54c3a30ffb25a2dd3d2ceb8edf874de820a2ff1fa7', // v5
      '0x3246afeaca7a3bd45c03c36061ca68e572f0544150740c3bd90402d13c02db43', // v6 sponsor_pool
      '0x506b81ee7b86fc937bdcd9d719c6ed6dfd8e4acea157191245a9267d9b666536', // v7 referral
    ],
    walrusSite: '0x22b8c1496650eb45fbcca0f8f37fae77ed33b7d4eaab4da5f0bb9b62a8708dcb',
  },
  mainnet: {
    walform: [
      '0xb0268669794e23d88eb07370735edcf6e70a0618fd31409834b1cd665d9c5303', // v2
      '0xeddb1e70fa8bc39c39afb2974f1335db66f08ff28054b8f6bc9a915bcaad7213', // v3 sponsor_pool
      '0x221ecc1e966e81225e1becc6fb720ba3a34612c6b5dc3b0c33ad589794330277', // v4 referral
    ],
    walrusSite: '0x5a0c509a659ba982f91ff1189872b8d528f8c02b5f6285a3931fc4c2869ccc9c',
  },
} as const;

const WALRUS_SYSTEM_OBJECT = {
  testnet: '0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af',
  mainnet: '0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2',
} as const;

const UPLOAD_RELAY = {
  testnet: 'https://upload-relay.testnet.walrus.space',
  mainnet: 'https://upload-relay.mainnet.walrus.space',
} as const;

type Network = 'testnet' | 'mainnet';

function getPackages(net: Network) {
  const override = Deno.env.get(`WALFORM_PACKAGE_${net.toUpperCase()}`);
  return {
    walform: override
      ? override.split(',').map((s) => s.trim()).filter(Boolean)
      : [...DEFAULT_PACKAGES[net].walform],
    walrusSite:
      Deno.env.get(`WALRUS_SITE_PACKAGE_${net.toUpperCase()}`) ||
      DEFAULT_PACKAGES[net].walrusSite,
  };
}

// Per-isolate cache of values that change rarely (Walrus upgrades, relay config).
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: string | null }>();

async function cached(key: string, load: () => Promise<string | null>): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  try {
    const value = await load();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    console.warn(`[sponsor] ${key} lookup failed:`, err);
    return hit?.value ?? null;
  }
}

/** Current Walrus package — the `package_id` field of the Walrus System object. */
function walrusPackage(net: Network): Promise<string | null> {
  return cached(`walrus-package:${net}`, async () => {
    const res = await fetch(`https://graphql.${net}.sui.io/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'query($id: SuiAddress!) { object(address: $id) { asMoveObject { contents { json } } } }',
        variables: { id: WALRUS_SYSTEM_OBJECT[net] },
      }),
    });
    const body = (await res.json()) as {
      data?: { object?: { asMoveObject?: { contents?: { json?: { package_id?: string } } } } };
    };
    return body.data?.object?.asMoveObject?.contents?.json?.package_id ?? null;
  });
}

/** Address the upload relay expects its tip at. */
function relayTipAddress(net: Network): Promise<string | null> {
  return cached(`relay-tip:${net}`, async () => {
    const res = await fetch(`${UPLOAD_RELAY[net]}/v1/tip-config`);
    const body = (await res.json()) as { send_tip?: { address?: string } | null };
    return body.send_tip?.address ?? null;
  });
}

async function buildAllowedTargets(net: Network): Promise<string[]> {
  const pkgs = getPackages(net);
  const walrus = await walrusPackage(net);
  return [
    ...pkgs.walform.flatMap((pkg) => WALFORM_FNS.map((fn) => `${pkg}::${fn}`)),
    ...WALRUS_SITE_FNS.map((fn) => `${pkgs.walrusSite}::${fn}`),
    ...(walrus ? WALRUS_FNS.map((fn) => `${walrus}::${fn}`) : []),
    ...SUI_FRAMEWORK_FNS,
  ];
}

async function buildAllowedAddresses(net: Network, sender: string): Promise<string[]> {
  const tip = await relayTipAddress(net);
  return tip ? [sender, tip] : [sender];
}

// ─── CORS ───────────────────────────────────────────────────────────────────

/**
 * Allowed origins from `ALLOWED_ORIGIN` (comma-separated). Unset or "*" → any.
 * An entry may use `*` for exactly one subdomain label — `https://*.wal.app`
 * covers per-form Mode B sites (`<name>.wal.app`) but not `a.b.wal.app` or
 * `wal.app.evil.com`. Origins are browser-enforced only (scripts can send any
 * Origin), so this keeps other websites off the sponsor; the Move-call
 * allowlist is what actually bounds spending.
 */
function originPolicy(): { any: boolean; exact: string[]; patterns: RegExp[] } {
  const raw = Deno.env.get('ALLOWED_ORIGIN')?.trim();
  if (!raw || raw === '*') return { any: true, exact: [], patterns: [] };
  const entries = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    any: false,
    exact: entries.filter((e) => !e.includes('*')),
    patterns: entries
      .filter((e) => e.includes('*'))
      .map(
        (e) =>
          new RegExp(
            '^' +
              e
                .split('*')
                .map((part) => part.replace(/[.+?^${}()|[\]\\/]/g, '\\$&'))
                .join('[a-z0-9-]+') +
              '$',
          ),
      ),
  };
}

function isOriginAllowed(reqOrigin: string | null): boolean {
  const policy = originPolicy();
  if (policy.any) return true;
  if (!reqOrigin) return false;
  return policy.exact.includes(reqOrigin) || policy.patterns.some((re) => re.test(reqOrigin));
}

function corsHeaders(reqOrigin: string | null): HeadersInit {
  const policy = originPolicy();
  const allowOrigin =
    policy.any || isOriginAllowed(reqOrigin)
      ? reqOrigin || '*'
      : (policy.exact[0] ?? 'null');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
  });
}

// ─── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, 405, origin);
  }
  if (!isOriginAllowed(origin)) {
    return json({ error: 'Origin not allowed' }, 403, origin);
  }

  const apiKey = Deno.env.get('ENOKI_PRIVATE_KEY');
  if (!apiKey) {
    return json({ error: 'ENOKI_PRIVATE_KEY not configured' }, 500, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, origin);
  }

  const enoki = new EnokiClient({ apiKey });
  const action = body.action;

  try {
    if (action === 'create') {
      const network = body.network as Network | undefined;
      const transactionKindBytes = body.transactionKindBytes as string | undefined;
      const sender = body.sender as string | undefined;
      if (network !== 'testnet' && network !== 'mainnet') {
        return json({ error: 'network must be testnet | mainnet' }, 400, origin);
      }
      if (!transactionKindBytes || !sender) {
        return json({ error: 'Missing transactionKindBytes or sender' }, 400, origin);
      }
      const result = await enoki.createSponsoredTransaction({
        network,
        transactionKindBytes,
        sender,
        allowedMoveCallTargets: await buildAllowedTargets(network),
        allowedAddresses: await buildAllowedAddresses(network, sender),
      });
      return json({ bytes: result.bytes, digest: result.digest }, 200, origin);
    }

    if (action === 'execute') {
      const digest = body.digest as string | undefined;
      const signature = body.signature as string | undefined;
      if (!digest || !signature) {
        return json({ error: 'Missing digest or signature' }, 400, origin);
      }
      const result = await enoki.executeSponsoredTransaction({ digest, signature });
      return json({ digest: result.digest }, 200, origin);
    }

    return json({ error: 'Unknown action — use "create" or "execute"' }, 400, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: 'Enoki call failed', detail: message }, 502, origin);
  }
});
