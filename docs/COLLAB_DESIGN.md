# WalForm — Realtime Collaborative Editor Design

**Status:** Design v2.0 (server-based pivot — supersedes the P2P v1.1 design)
**Last updated:** 2026-06-15
**Target submission:** Sui Overflow 2026 Hackathon (<https://overflow.sui.io>)
**Scope:** Realtime multi-user editing of form **drafts** with live cursors, presence colors,
and per-field focus highlights. A **shared draft lives on a realtime document server** until the
owner publishes (then it goes on-chain); an **unshared draft never touches the network** and
behaves exactly like today. Companion to [`PRD.md`](PRD.md) and [`PROGRESS.md`](PROGRESS.md);
read [`CODE_RULES.md`](CODE_RULES.md) before implementing.

**Chosen architecture (locked):**
- **Transport:** Yjs CRDT over a **realtime document server** — **PartyKit** (`y-partykit`),
  one room per `formId`, Cloudflare-hosted. Replaces the v1.1 `y-webrtc` peer mesh.
- **Persistence:** the server **persists each room's Y doc** (PartyKit Durable Object storage),
  so a session survives with nobody online — no "seed peer" requirement. The draft lives on the
  server while shared; on publish it goes on-chain and the room is retired.
- **Access:** a **share token** embedded in the invite link. Anyone with the link may edit (the
  user's stated v1 model — "we'll improve later"). The server gates connections on the token in
  `onBeforeConnect`. No on-chain ACL and no Seal in v1; wallet-signed membership is the documented
  hardening path (§4.4, §9).
- **Identity:** **anonymous by default** (a stable local name + color), upgraded to a
  **wallet identity** (address-derived color, truncated `0x…`, optional SuiNS) when a wallet is
  connected. Either can edit.

---

## 0. TL;DR — Decision Summary

| Open question | Decision | Rationale |
| --- | --- | --- |
| **Why pivot off P2P?** | A **server** holds the doc | P2P's "a seed peer must be online or edits are stranded" hole is fatal for "share a link, edit later." A server persists the draft so anyone can open it anytime. The user asked for this directly. |
| **What merges concurrent edits?** | **Yjs CRDT** (unchanged from v1.1) | Two people editing at once must merge, not clobber. Already built in `collab-schema.ts`; the pivot keeps it verbatim. |
| **Realtime transport** | **PartyKit + `y-partykit`** (Yjs over WebSocket) | One room per `formId`, ~30-line server, `npx partykit deploy` to Cloudflare. Server-side persistence + `onBeforeConnect` access hook in one place. |
| **Persistence / availability** | **Server persists the Y doc per room**; each client keeps a `y-indexeddb` cache for instant load + offline edits | No seed-peer requirement. A collaborator can open the link and edit even if the owner is offline. |
| **Who may edit** | **Share token in the link** (`?formId=…&t=…`) | Matches the requested "whoever has the link can edit." The token is the capability; the server validates it. No on-chain ACL in v1. |
| **Identity** | **Anonymous (local name+color) or wallet** | A user without a wallet still gets a colored cursor + label; connecting a wallet upgrades the label to the address (+ SuiNS later). |
| **Unshared drafts** | **Stay 100% local (IDB), zero network** | If the owner never clicks Share, there is no room and no server connection — identical to today's behavior. |
| **Invitee's forms list** | **"Shared with me"** surface, backed by the server (+ a local "joined rooms" record) | An invitee has no IDB draft, so the list entry is resolved from the room: title from the live doc, persisted locally as "recently joined." |
| **Field focus highlight** | **Colored border + avatar badge** on the block another user has selected (Canva/Docs style) | `selectedFieldId` already rides Awareness; this is a render in `FieldBlock.tsx`. |
| **Publishing** | **Owner-only** (`FormOwnerCap`); on publish → on-chain, room retired | Unchanged from the existing publish flow. |
| **Editor source of truth** | **Y doc authoritative; `StoredForm` snapshot is a derived projection** | Keeps Drafts list (`useForms()`) + publish flow working unchanged. Unchanged from v1.1. |

---

## 1. The shift from v1.1

v1.1 chose **P2P (`y-webrtc`) + on-chain `CollabRoom` + Seal-gated room key** to keep WalForm
"serverless." That bought maximal decentralization at three real costs:

1. **No durable doc.** With no server, the document only exists in connected peers' browsers. If
   the owner (seed peer) is offline, an invitee opening the link gets an empty form, and edits made
   while alone are stranded in one browser's `y-indexeddb` until peers reconnect. For a "share a
   link, edit whenever" product that is the wrong tradeoff.
2. **Heavy access machinery.** Enforcing access without a gatekeeper required E2E-encrypting all
   WebRTC traffic with a Seal-released room key, an on-chain `CollabRoom` ACL, a mutual-auth
   handshake, and group-key rotation on revoke. Large surface, low demo visibility, and the user
   explicitly wants the simpler "anyone with the link can edit" model for now.
3. **NAT/TURN fragility.** ~10–20% of networks can't establish P2P without a TURN relay.

**The pivot is small.** Only the **transport layer** was ever peer-to-peer. The CRDT data model,
the Zustand bridge, presence/awareness, cursors, and identity are all transport-agnostic and carry
over unchanged. We replace `y-webrtc` + the signaling broker with a PartyKit Yjs document server,
delete the Seal/`CollabRoom`/handshake/rotation plan, and gain server persistence + a trivial
link-token gate.

```
                    v1.1 (P2P)                         v2.0 (server)
  data        Yjs CRDT  ───────────────────────────►  Yjs CRDT            (KEEP, verbatim)
  bridge      Zustand ↔ Y + UndoManager ────────────► same                (KEEP)
  presence    Awareness: cursors, selection ────────► same                (KEEP, extend)
  identity    wallet color/label ───────────────────► + anonymous         (EXTEND)
  ───────────────────────────────────────────────────────────────────────────────────
  transport   y-webrtc mesh + signaling broker  ─✗──► PartyKit Yjs server (REPLACE)
  access      on-chain CollabRoom + Seal key ────✗──► share token in link (REPLACE)
  durability  peer y-indexeddb only ─────────────✗──► server persists doc (NEW)
```

---

## 2. Data layer — Yjs CRDT (unchanged)

The data model is already implemented in `packages/core/src/forms/lib/collab-schema.ts` and is
**kept as-is**. Summary (see that file for the authoritative shape):

- `FormSchema` maps onto a `Y.Doc` whose `Y.Map "form"` holds scalars (`id`, `title`,
  `description`, `coverImage`, `version`, `tags`), a `settings` `Y.Map` (per-key LWW), a `fields`
  `Y.Map` keyed by field id, and a `pages` `Y.Map` keyed by page id.
- **Order + page membership live ON each field** (`pageId` + a fractional-index `pos` string), so
  the flat `fields[]` and per-page `fieldIds[]` are **derived projections**, never two ordered
  structures the CRDT must keep in lockstep. Editing different fields never conflicts; editing
  different properties of the same field merges. This is what dissolves the reorder hazard.
- `reconcileSchemaIntoYDoc` / `yDocToSchema` are the only place that knows the doc's internal shape.

> **v2.0 note — rich text:** v1.1 planned `Y.XmlFragment` + `@tiptap/extension-collaboration` for
> per-character merging of titles/labels. The shipped `collab-schema.ts` models those as plain LWW
> strings, which is correct for the server-based MVP (two people rarely type the same label
> simultaneously; whole-field LWW is fine). Per-character text carets move to P3 and are **not**
> required for the demo. Don't add `Y.XmlFragment` until P3.

### 2.1 Bridge & undo (unchanged)

`use-collab-session.ts` already bridges the Y doc to the Zustand store in both directions
(`reconcileSchemaIntoYDoc` on store change → doc; `doc.on('update')` → `applyRemoteSchema`) and
swaps the snapshot undo stack for an origin-scoped `Y.UndoManager` while a session is active. The
pivot keeps this. The only change is *where updates come from* (the provider), not how they're
applied.

### 2.2 Persistence & the Drafts/publish reconciliation

- **Server (PartyKit):** the room's Y doc is persisted in Durable Object storage. This is the new
  durable home of a *shared* draft. It is the reason an invitee can open the link with the owner
  offline and still see the form.
- **Client `y-indexeddb`:** still used as a local cache → instant load, offline edits, sync on
  reconnect. Kept from the current `collab-providers.ts`.
- **Derived `StoredForm` snapshot:** still written to `form-db.ts` (debounced) so the Drafts list
  (`useForms()`), the `walform:forms-changed` event, and the publish flow keep working unchanged.
  The snapshot is a projection, not the source of truth.
- **Lifecycle on publish:** publishing stays owner-only (`FormOwnerCap`). On a successful publish
  the existing flow deletes the IDB draft; the collab room is then **retired** — the client
  disconnects and the server may evict the room's stored doc (it's now redundant with on-chain
  state). Document this as "publish ends the collaboration session."

---

## 3. Presence, cursors & field-focus highlights

All carried by **Yjs Awareness** (ephemeral, never persisted) — already wired in
`CollabProvider.tsx` / `use-presence.ts`. Three signals:

1. **Pointer cursors** — floating colored cursor + label following each user's mouse over the
   canvas. Already implemented (`CursorsOverlay.tsx`); coords broadcast relative to the form card.
2. **Field-focus highlights (the Canva/Docs effect the user asked for)** — when a remote peer's
   `selectedFieldId` matches a block, draw a **2px border in that peer's color** plus a small
   avatar/label badge in the block's corner. `selectedFieldId` is *already* broadcast via Awareness;
   the **only new work** is the render in `FieldBlock.tsx`:
   - subscribe to `usePresence(awareness)`, find peers whose `selectedFieldId === field.id`,
   - apply `style={{ outline: '2px solid ' + peer.user.color }}` (use `outline`, not `border`, to
     avoid shifting layout) + a badge with `peerLabel(...)`,
   - if multiple peers focus the same field, stack badges / use the most-recent peer's color.
3. **Text carets (P3 only)** — real per-user carets inside label editors via
   `@tiptap/extension-collaboration-cursor`. Deferred; needs the `Y.XmlFragment` model (§2 note).

---

## 4. Access control — share token in the link

### 4.1 Model (v1: "anyone with the link can edit")

The invite link is `?formId=<id>&t=<shareToken>` (the room is the `formId`, so a
separate `&room=` param is redundant and was dropped). The token **is** the edit capability.
The PartyKit server validates it in `onBeforeConnect`; a connection without a valid token for that
room is rejected before it can read or write the doc. This is exactly the requested model and is
the network-level gatekeeper that pure P2P could not have.

### 4.2 Where the token comes from (no app server required)

WalForm has no backend, so the token can't be minted/stored by an app server. Two options, in order
of preference:

- **Trust-on-first-use (TOFU) — recommended.** When the owner first enables sharing, the browser
  generates a random `shareToken` (e.g. `crypto.randomUUID()` × 2), stores it on the IDB draft
  (`StoredForm.collab.shareToken`), and includes it in the link. The PartyKit room records the
  **first token presented for that room** as canonical (in Durable Object storage) and requires all
  later connections to match. Because the owner is always the first to connect (they're the one
  sharing), TOFU binds the room to the owner's token with zero pre-registration. Document the
  caveat: whoever connects first sets the secret — fine because that's the owner opening their own
  draft.
- **Open room (absolute-minimum fallback).** Accept any connection to a known room id. Simplest,
  but the room id (= `formId`) is guessable; only acceptable as a stopgap. Prefer TOFU.

### 4.3 Anonymous vs wallet identity

- **Anonymous (default):** on first use the client generates a stable local identity —
  `{ id: uuid, name: "Anonymous " + animal, color }` — persisted in `localStorage` and reused across
  sessions. Carried in Awareness like any other peer. Lets a link recipient edit with no wallet.
- **Wallet (upgrade):** when `useCurrentAccount()` is set, override `name`/`color` with the
  address-derived values (`colorForAddress`, `truncateAddress`; SuiNS later). `PresenceUser.address`
  becomes optional (anonymous peers have none) — see §7 type change.

### 4.4 Hardening path (post-hackathon, the "improve later")

When access needs to be more than link-possession:
- **Wallet-signed membership** — collaborator signs a challenge with `signPersonalMessage`; the
  server (or a re-introduced on-chain allowlist) checks the recovered address against an editor
  list. This is the v1.1 `CollabRoom`/Seal idea, reframed against a server gatekeeper (much simpler
  than the P2P crypto version — the server can just reject the socket).
- **Revocation** — remove the address from the list; the server drops the connection and rotates
  the share token. Because there's now a gatekeeper, revocation is immediate (no key-rotation dance,
  no eventual-consistency window the P2P design had).

---

## 5. Invite / onboarding flow

```
Owner (draft open, local-only until now)
  1. Clicks "Share / Collaborate" (CollaborationPanel in RightSidebar).
  2. Browser mints a shareToken (if none), saves it on the IDB draft, opens the room:
     connects to PartyKit (wss://<host>/parties/main/<formId>?t=<token>) and seeds the
     server doc from the local schema if the room is empty.
  3. Copies the invite link: ?formId=<id>&t=<token>

Collaborator (opens link, no wallet needed)
  1. Gets/creates an anonymous identity (or connects a wallet to upgrade it).
  2. Connects to the same PartyKit room with t=<token> → server validates → doc syncs down.
  3. Edits immediately; cursor + color + field-focus highlight appear for everyone.
  4. The room is recorded locally as "shared with me" so it shows in their forms list.

Publish (owner only)
  1. Owner publishes → schema goes on-chain (existing flow), IDB draft deleted.
  2. Clients disconnect; the room is retired and its server doc may be evicted.
```

`createEmptyStoredForm(id)` (already in `form-builder-store.ts`) is the in-memory shell the
collaborator's editor mounts before the server doc syncs over it — unchanged.

---

## 6. "Shared with me" in the forms list

An invitee has **no IDB draft** for the form, so the Drafts tab (backed by `useForms()` → `formDb`)
won't show it. Add a **"Shared" surface**:

- **Record on join.** When a collaborator successfully joins a room, persist a lightweight record
  locally — `{ formId, room, token, title, lastOpenedAt }` — in a new IDB store (e.g.
  `shared-forms` in `form-db.ts`, or a sibling `shared-forms-db.ts`). Title is read from the live Y
  doc (`form.title`) and refreshed on each open.
- **Surface it.** A `useSharedForms()` hook reads those records; the forms list (`FormsListClient`)
  gets a **"Shared with me"** tab (alongside Drafts / My Forms / Marketplace) listing them, each
  linking back to `?formId=…&t=…`.
- **Wallet-indexed (optional, later).** For connected wallets, the PartyKit server can also index
  rooms by address so "shared with me" follows the wallet across devices. Local records cover the
  anonymous + single-device case for the MVP.

> The owner's own shared drafts still live in **Drafts** (they have the IDB draft); "Shared with me"
> is specifically for forms someone else shared with you.

---

## 7. Integration map (concrete files)

| Concern | Files | Action |
| --- | --- | --- |
| CRDT doc model | `forms/lib/collab-schema.ts` (+ `.test.ts`) | **KEEP** verbatim |
| Zustand ↔ Y bridge + UndoManager | `forms/hooks/use-collab-session.ts` | **MODIFY** — connect via PartyKit provider; host seeds if server doc empty; use provider `synced` event instead of the peer-sync timeout dance |
| Transport provider | `forms/services/collab-providers.ts` | **REPLACE** — swap `y-webrtc` + `BroadcastChannel` for `YPartyKitProvider`; keep `y-indexeddb` cache |
| Presence / awareness | `forms/hooks/use-presence.ts`, `editor/CollabProvider.tsx` | **KEEP** (CollabProvider: also publish anonymous identity, not just wallet) |
| Pointer cursors | `editor/CursorsOverlay.tsx` | **KEEP** |
| **Field-focus highlight** | `editor/FieldBlock.tsx` | **NEW render** — colored outline + badge for peers whose `selectedFieldId === field.id` |
| Identity | `forms/lib/collab-identity.ts` | **EXTEND** — anonymous name/color generator + `localStorage` persistence |
| Share / invite UI | `editor/CollaborationPanel.tsx` | **MODIFY** — mint/show token; copy reflects "lives on the server, edit anytime" (drop the P2P "keep this tab open" caveat) |
| Editor entry / join | `editor/FormEditorClient.tsx` | **MODIFY** — join path relies on server doc; record "shared with me" on join |
| Share token | new `forms/lib/collab-share-token.ts` | **NEW** — mint/store/read token on `StoredForm.collab` |
| "Shared with me" | new `forms/hooks/use-shared-forms.ts`; `forms/services/form-db.ts` (new store) ; list UI tab | **NEW** |
| Realtime server | new `party/collab.ts` + `partykit.json` | **NEW** — PartyKit Yjs server (`onConnect`→`y-partykit`, `onBeforeConnect`→token check, `persist: true`) |
| Types | `types/index.ts` | **MODIFY** — `PresenceUser.address?` optional; add `id`; `StoredForm.collab?: { shareToken; sharedAt }` |
| Retire P2P | `services/signaling/server.ts`, `package.json :: "signaling"` script, `y-webrtc` dep | **DELETE** |

**Dependencies:** add `y-partykit` + `partykit` (dev). **Remove** `y-webrtc`. Keep `yjs`,
`y-indexeddb`, `y-protocols`.

**Env vars** (replace the P2P trio):
```
# v2.0 — PartyKit realtime collab
NEXT_PUBLIC_ENABLE_COLLAB=true
NEXT_PUBLIC_PARTYKIT_HOST=127.0.0.1:1999          # dev: `npx partykit dev`
# prod: walform-collab.<account>.partykit.dev      # `npx partykit deploy`
# (drop NEXT_PUBLIC_SIGNALING_URL + NEXT_PUBLIC_COLLAB_ROOM_PASSWORD)
```

### 7.1 PartyKit server (as shipped — `services/collab/src/server.ts`)

```ts
import type * as Party from 'partykit/server';
import { onConnect } from 'y-partykit';

const TOKEN_KEY = 'shareToken';
const tokenFromUrl = (url: string) => new URL(url).searchParams.get('t');

export default class CollabServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  // Edge pre-check ONLY: reject a missing token. The static onBeforeConnect
  // runs in an edge worker with NO access to room storage, so the canonical
  // TOFU check CANNOT live here.
  static async onBeforeConnect(req: Party.Request) {
    if (!tokenFromUrl(req.url)) return new Response('missing token', { status: 401 });
    return req;
  }

  // TOFU canonical check lives here, where `this.room.storage` exists.
  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const token = tokenFromUrl(ctx.request.url);
    if (!token) return conn.close(4401, 'missing token');
    const canonical = await this.room.storage.get<string>(TOKEN_KEY);
    if (!canonical) await this.room.storage.put(TOKEN_KEY, token); // first connect (owner) sets it
    else if (canonical !== token) return conn.close(4403, 'forbidden');
    await onConnect(conn, this.room, { persist: { mode: 'snapshot' } });
  }
}
```

> **Correction (2026-06-17, verified against PartyKit docs):** the original sketch put the TOFU
> storage check in `onBeforeConnect`. That method runs in an edge worker near the user and **has no
> access to `Party` room resources such as storage** — `lobby.parties.main.get(id)` returns an HTTP
> stub, not a storage handle. So the canonical-token read/write moves into the instance `onConnect`
> (which receives `ctx.request` for the URL and exposes `this.room.storage`); `onBeforeConnect` is
> kept only as a cheap edge reject for a *missing* token. The project lives at `services/collab/`
> (a workspace, mirroring the deleted `services/signaling`) so `turbo run dev` auto-starts it.

---

## 8. Phased delivery

- **P0 — Transport swap.** Replace `collab-providers.ts` internals with `YPartyKitProvider`; stand
  up `party/collab.ts` (open room, no token yet) + `npx partykit dev`. Prove sync across **two
  different browsers** (not just tabs) with the existing CRDT/bridge untouched. De-risks the one
  thing that actually changed.
- **P1 — Persistence + identity + the visible wins.** Server persistence (`persist`); draft survives
  with nobody online; **anonymous identity**; **share-token (TOFU)** gate; **field-focus borders**
  in `FieldBlock.tsx`; Share panel copy updated. This is the demo: open a link in an incognito
  window with no wallet, see live cursors + colored field borders.
- **P2 — "Shared with me" + lifecycle.** "Shared with me" list tab + local join records; wallet
  identity polish (SuiNS); publish → room retire; reconnect UX.
- **P3 — Hardening + text carets.** Wallet-signed membership + immediate revocation (§4.4);
  per-character TipTap collaborative carets (needs `Y.XmlFragment`, §2 note); wallet-indexed shared
  list across devices.

> **Cut line:** **P0 + P1 is the whole demo** — server-synced co-editing, anonymous join via link,
> live cursors, and the Canva-style colored field-focus borders. P2/P3 are polish and hardening.

---

## 9. Risks & open questions

1. **Share-token TOFU bootstrap (P1)** — the "first connection sets the canonical token" rule
   assumes the owner connects first. True in the normal flow (owner shares, then sends the link),
   but document it; a hostile first-connector could squat a room id. The hardening path (§4.4)
   removes this assumption.
2. **PartyKit persistence semantics** — confirm the `persist` mode (`snapshot` vs `history`), storage
   limits, and eviction behavior; verify a doc reloads correctly after the Durable Object hibernates.
3. **Cost / quota** — PartyKit free tier limits (connections, storage, requests). Fine for a
   hackathon; note the ceiling before calling it production.
4. **"Shared with me" durability** — local IDB records are per-device for anonymous users; clearing
   storage loses the list (the link still works). Wallet-indexing (P3) fixes cross-device.
5. **Source-of-truth split** — Y doc authoritative vs `StoredForm` derived: confirm the snapshot
   cadence and that publish always reads the latest Y-doc projection (carried over from v1.1).
6. **Edit/cursor authenticity** — within a room, edits and cursor labels are *trusted*, not
   cryptographically attributable. A malicious member could spoof another's label. Acceptable for
   invite-only rooms; per-op signing is out of scope. (Same posture as v1.1 §4.5, minus the P2P
   handshake.)
7. **Vendor dependency** — PartyKit (now Cloudflare) is the new always-on infra in a "static →
   Walrus Sites" product. Honest framing: shared collaboration is the one feature that needs a
   server; unshared drafts remain 100% static/local. Hocuspocus self-host is the documented exit if
   we ever want to drop the vendor.

---

## Appendix A — Decision log

| Date | Decision | Notes |
| --- | --- | --- |
| 2026-06-15 | **Pivot: P2P → server.** Transport = **PartyKit (`y-partykit`)**, one room per `formId` | Supersedes v1.1's `y-webrtc`. A server persists the draft so "share a link, edit anytime" works without a seed peer. Only the transport layer changes; CRDT/bridge/presence/cursors carry over. |
| 2026-06-15 | **Access = share token in the link** (TOFU), not on-chain `CollabRoom`/Seal | Matches the requested "anyone with the link can edit." The server is the gatekeeper P2P lacked. Wallet-signed membership is the documented hardening path. |
| 2026-06-15 | **Identity = anonymous-by-default, wallet-upgrade** | Link recipients edit with no wallet; connecting a wallet upgrades the label/color. |
| 2026-06-15 | **Unshared drafts stay 100% local; publish retires the room** | No server contact unless the owner shares; on publish the schema goes on-chain and the room is torn down. |
| 2026-06-15 *(retired)* | ~~Transport = `y-webrtc` P2P; access = on-chain `CollabRoom` + Seal-gated room key + key rotation~~ | v1.1 design. Retired: no durable doc, heavy low-visibility crypto, NAT/TURN fragility. CRDT data layer from v1.1 is retained. |
| 2026-06-15 | Editor source of truth = Y doc; `StoredForm` = derived snapshot | Unchanged from v1.1. Keeps Drafts list + publish flow intact. |
| 2026-06-17 | **P0+P1 implemented.** PartyKit project at `services/collab/` (workspace ⇒ `turbo run dev` auto-starts it). `y-webrtc` + `services/signaling` + the `simple-peer` browser polyfill removed. | TOFU moved from `onBeforeConnect` → `onConnect` (edge worker has no storage; see §7.1 correction). Token minted in `CollaborationPanel` "Start collaboration", persisted on `StoredForm.collab`, read from the URL by `FormEditorClient` for both host and join. Env: `NEXT_PUBLIC_PARTYKIT_HOST` replaces the signaling trio. P2 ("Shared with me") + P3 (hardening, text carets) still pending. |
| 2026-06-20 | **P1 review hardening.** (1) Collab is now keyed on the **share token** alone — the redundant `&room=` link param was dropped and opening the Collaborate panel no longer starts a session, so an unshared draft keeps its snapshot undo stack (dual-mode `Y.UndoManager` engages only once a token is in the URL). (2) **Autosave is disabled for a joined session** (`FormBuilder autoSave={mode==='host'}`) — an invitee no longer writes a stray IDB draft (honors §6 until "Shared with me" lands). (3) **Published-form guard** — `FormEditorClient` resolves on-chain status even on a collab link, so reopening a now-published form's invite redirects to results/submit instead of rejoining the retired room. (4) **Perf** — `useFocusPeer` replaces per-`FieldBlock` `usePresence`, holding a stable snapshot so a field re-renders only when its own focus owner changes, not on every cursor tick. (5) Undo/redo buttons reflect the real `Y.UndoManager` stack; `Referrer-Policy` keeps the token out of cross-origin `Referer`; `.partykit/` gitignored. |
</content>
</invoke>
