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
//   ALLOWED_ORIGIN       Comma-separated origins allowed to call this fn,
//                        e.g. "https://walform.app,http://localhost:3000".
//                        Leave UNSET (or "*") to allow any origin.
//
// Optional override envs — only set them if you upgrade the WalForm package
// and want the new packageId in the allowlist without redeploying the
// function. When unset, the bundled constants below are used.
//
//   WALFORM_PACKAGE_TESTNET, WALFORM_PACKAGE_MAINNET
//   WALRUS_SITE_PACKAGE_TESTNET, WALRUS_SITE_PACKAGE_MAINNET
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

const SUI_FRAMEWORK_FNS = ['0x2::transfer::public_share_object'];

// Default packageIds. Override via env at deploy time if you've upgraded.
const DEFAULT_PACKAGES = {
  testnet: {
    walform: '0x61074d22c927255c82ba5e54c3a30ffb25a2dd3d2ceb8edf874de820a2ff1fa7',
    walrusSite: '0x22b8c1496650eb45fbcca0f8f37fae77ed33b7d4eaab4da5f0bb9b62a8708dcb',
  },
  mainnet: {
    walform: '0xb0268669794e23d88eb07370735edcf6e70a0618fd31409834b1cd665d9c5303',
    walrusSite: '0x5a0c509a659ba982f91ff1189872b8d528f8c02b5f6285a3931fc4c2869ccc9c',
  },
} as const;

type Network = 'testnet' | 'mainnet';

function getPackages(net: Network) {
  return {
    walform:
      Deno.env.get(`WALFORM_PACKAGE_${net.toUpperCase()}`) || DEFAULT_PACKAGES[net].walform,
    walrusSite:
      Deno.env.get(`WALRUS_SITE_PACKAGE_${net.toUpperCase()}`) ||
      DEFAULT_PACKAGES[net].walrusSite,
  };
}

function buildAllowedTargets(net: Network): string[] {
  const pkgs = getPackages(net);
  return [
    ...WALFORM_FNS.map((fn) => `${pkgs.walform}::${fn}`),
    ...WALRUS_SITE_FNS.map((fn) => `${pkgs.walrusSite}::${fn}`),
    ...SUI_FRAMEWORK_FNS,
  ];
}

// ─── CORS ───────────────────────────────────────────────────────────────────

function corsHeaders(reqOrigin: string | null): HeadersInit {
  const raw = Deno.env.get('ALLOWED_ORIGIN')?.trim();
  // Unset or "*" → allow any. Otherwise comma-split + match.
  if (!raw || raw === '*') {
    return {
      'Access-Control-Allow-Origin': reqOrigin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
  }
  const allowed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const match = reqOrigin && allowed.includes(reqOrigin) ? reqOrigin : allowed[0];
  return {
    'Access-Control-Allow-Origin': match,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function isOriginAllowed(reqOrigin: string | null): boolean {
  const raw = Deno.env.get('ALLOWED_ORIGIN')?.trim();
  if (!raw || raw === '*') return true;
  if (!reqOrigin) return false;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(reqOrigin);
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
        allowedMoveCallTargets: buildAllowedTargets(network),
        allowedAddresses: [sender],
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
