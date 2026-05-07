# CODE_RULES.md

Binding rules for any code change in this repo. These are not aspirations — they reflect the patterns already enforced in `packages/core` and `apps/builder`. **When a new file or change conflicts with a rule here, the rule wins.**

If a pattern below contradicts something you find in the codebase, the codebase has drifted: fix the new code to match this doc, not the other way around. If the rule itself looks wrong, raise it before changing it.

---

## 1. UI / logic split (the most important rule)

Three layers, each with one job. Do not collapse them.

| Layer | Lives in | Allowed to do | Forbidden |
| --- | --- | --- | --- |
| **Components** | `forms/components/**`, `ui/**` | JSX, layout, composition, event-handler wiring (call hook outputs) | `fetch`, `localStorage`, `indexedDB`, `signTransaction`, async work, schema mutation |
| **Hooks** | `forms/hooks/**`, `sui/**` (use-*) | `useState`, `useEffect`, `useQuery`, `useMutation`, side effects, IDB, RPC, wallet sign-and-execute | Returning JSX |
| **Lib / services** | `forms/lib/**` (pure), `forms/services/**` (I/O) | Pure transforms (`lib/`), DB / network adapters (`services/`) | Importing React, calling hooks |

**A component never reaches into IDB, the Sui client, Seal, or Walrus directly.** It calls a hook (`useForms`, `usePublishForm`, `useFormSubmissions`, …) that returns `{ data, status, execute }`-shaped values.

A hook returning `{ execute, isPending, error }` is the canonical "action" shape (see `usePublishForm`, `useCloseForm`, `useCreateDraft`). Match it for new mutation hooks.

**Pure transforms go in `forms/lib/*`** (e.g. `aggregate-submissions.ts`, `crop-image.ts`). If a function does not need React or I/O, it must not be inside a hook or component file.

---

## 2. State management — pick the right bucket

Four state buckets. Putting state in the wrong one is a bug.

1. **Local component state** (`useState`) — UI-only, unshared (open/closed, hover, draft input before commit).
2. **Zustand** (`forms/store/form-builder-store.ts`) — editor schema, undo/redo, field selection. **One store.** Do not create a second Zustand store for forms work; extend the existing one.
3. **React Query via `useSuiClientQuery`** — every read of on-chain state. Query keys follow dApp Kit's `[network, method, params]` shape automatically; never hand-roll a key that bypasses the `[network]` prefix.
4. **IndexedDB via `formDb`** (`forms/services/form-db.ts`) — draft forms only. Any IDB access goes through `formDb`; do not open `indexedDB` directly. After mutating, dispatch the existing `walform:forms-changed` event so `useForms()` refreshes.

**Never put on-chain state in IDB and never put draft-only state on chain.** The `publishedMeta` field on `StoredForm` is dead — drafts get deleted on publish.

**After every successful on-chain mutation, call `await invalidateChain(digest)`** (`sui/use-invalidate-chain.ts`). Without this, the UI shows stale data until next focus.

---

## 3. Memoization — sparing, justified, never reflexive

Default: **don't memoize.** React 19 + Next 15 are fast enough that wrapping every value in `useMemo` is noise.

Memoize only when one of these is true:

- The value is a **dependency of another `useEffect` / `useMemo` / `useCallback`** and recomputing it would re-fire that effect every render.
- The value is the **`value` prop of a Context provider** (see `form-appearance-context.tsx` line 22 — required).
- The computation is **measurably expensive** (loops over hundreds of items, parses, hashes). "It's a `.map`" is not expensive.
- The function is **passed to a memoized child** that genuinely benefits.

**Do not** add `React.memo` to leaf components. We don't use it anywhere in `forms/components/` and we don't need to.

**Do not** wrap event handlers in `useCallback` by default. Inline arrow functions are fine when passed to native DOM elements (`<button onClick={...}>`). Wrap only when the handler crosses a memoization boundary or is a hook dependency.

When you do memoize, the dep array must be exhaustive. No `// eslint-disable react-hooks/exhaustive-deps`.

---

## 4. File & folder layout

- **Files: `kebab-case.ts(x)`.** Exports inside: `PascalCase` for components/types, `camelCase` for functions/hooks, `SCREAMING_SNAKE_CASE` for constants. Example: `use-marketplace-templates.ts` exports `useMarketplaceTemplates`.
- **Barrel files (`index.ts`) at every public boundary** — `forms/hooks/index.ts`, `forms/components/list/index.ts`, etc. New hook → add it to the nearest barrel.
- **`lib/` = pure, `services/` = I/O.** Don't introduce a `utils/` folder. If it does I/O (DB, network, crypto with side effects), it's a service.
- **Domain-first folders, not type-first.** Group by feature (`forms/`, `sui/`, `crypto/`), not by kind (`components/`, `hooks/`) at the top level. The kind split lives one level down inside the domain folder.

---

## 5. TypeScript

- **Domain types live in `packages/core/src/types/index.ts`.** New shared shape → add it there and re-export, not in a per-feature `types.ts`.
- **`interface` for object shapes, `type` for unions / aliases / mapped types.** Match what's already in `types/index.ts`.
- **`tsconfig.base.json` has `noUncheckedIndexedAccess: true`.** Treat `arr[i]` as `T | undefined`. Don't paper over it with `!`; narrow it. The exception is `sui/gen/utils/index.ts` which has manual non-null patches that survive codegen — re-apply them if `bun run contracts:codegen` overwrites.
- **Imports use the `@walform/core/*` alias.** No `../../` relative imports across feature folders. Inside the same folder, relative is fine.
- **No `any`.** Use `unknown` and narrow. If a third-party type is wrong, declare a local `type` that fixes it; don't cast through `any`.
- **No non-null assertions (`!`) on values you didn't just check.** A guard above the use site is fine; sprinkling `!` is not.

---

## 6. Components

- **Function components only.** No class components anywhere.
- **No `forwardRef` in feature components.** The shadcn primitives in `ui/` already handle refs; consumers don't need them.
- **Wrap shadcn primitives, don't fork them.** New variants → extend via `cn()` and props. Don't copy a primitive to add one prop.
- **`'use client'` at the very top of any file using hooks, browser APIs, or event handlers.** Every file in `forms/hooks/` and most in `forms/components/` starts with it. Server components stay in `apps/builder/app/**/page.tsx`; they import client components.
- **Keep components under ~200 lines.** If a component grows past that, the logic almost certainly belongs in a hook.
- **No prop drilling beyond two levels.** Use the Zustand store or `FormAppearanceContext` instead.
- **No CSS-in-JS, no inline `style={{}}` for anything Tailwind can express.** Use `cn()` for conditional classes.

---

## 7. Async / data fetching

- **Reads of chain state go through `useSuiClientQuery`** (or a hook built on it). Don't call `client.getObject` from a component.
- **Writes go through `useExecuteTransaction`** (`sui/use-execute-transaction.ts`), which wraps dApp Kit's `useSignAndExecuteTransaction`. Pass a freshly built `Transaction` instance per call; the user's wallet signs and pays gas. There is no app-level sponsorship.
- **Error states are explicit.** Hooks return discriminated unions like `{ status: 'loading' | 'success' | 'error', ... }` (see `useForms`). Don't return `{ data, error, loading }` triples — match the existing shape.
- **No optimistic updates** unless explicitly requested. Wait for the digest, invalidate, re-render.
- **User feedback uses `sonner` toasts.** Don't roll your own toast.

---

## 8. Event handlers

- **Multi-line handlers are named functions inside the component**, not inline arrows. Pattern: `const handleCopyJson = () => {...}` then `<Button onClick={handleCopyJson} />` (see `ExportButton.tsx`).
- **One-line handlers can be inline.** `onClick={() => setOpen(false)}` is fine.
- **`handleX` for the function, `onX` for the prop.** Component prop = `onSubmit`; internal handler = `handleSubmit`.

---

## 9. Sui / Seal / Walrus specifics (testnet)

- Use **`SuiJsonRpcClient` and `getJsonRpcFullnodeUrl`** from `@mysten/sui/jsonRpc`. The v1 names from `@mysten/sui/client` are only for codegen type imports.
- **`useActivePackageId()` for MoveCall targets.** **`useOriginalPackageId()` for Seal `packageId` and for matching `objectType` strings** — Sui RPC always reports types under the original package ID regardless of upgrades.
- **Normalize Sui addresses with `normalizeSuiAddress`** before string equality. `0x2 !== 0x000…002` for naive comparisons.
- **`MoveCall` allowlist matching uses `validate-move-calls.ts :: normalizeTarget`** on both sides. Don't bypass it.
- **Pass a `Transaction` instance (not a base64 string) to `useSignTransaction`.** Some wallets rebuild gas data on serialise; the transport relies on the full object to detect and recover.

---

## 10. Imports & ordering

Order, top to bottom, separated by a blank line:

1. React / Next built-ins.
2. Third-party (`@mysten/*`, `@tanstack/*`, `lucide-react`, `sonner`, …).
3. `@walform/core/*` aliased imports.
4. Sibling relative imports (`./foo`, `../bar`).
5. Type-only imports last in each group, prefixed with `import type`.

Don't shotgun-import from a barrel when one symbol is needed inside the same folder — use the relative path. Crossing folder boundaries → use `@walform/core/*`.

---

## 11. Things this codebase does not do

If you find yourself reaching for any of these, stop and reconsider:

- Class components, HOCs, render props.
- Redux, Recoil, Jotai, MobX. (Zustand is the only store.)
- `axios`, `swr`, `react-query` directly. (Use dApp Kit's `useSuiClientQuery` which is React Query underneath.)
- CSS modules, styled-components, emotion. (Tailwind + `cn()` only.)
- `localStorage` for app state. (IDB via `formDb`, or Zustand. SessionKey is component state, not persisted.)
- Direct `indexedDB` / `fetch` / `document.cookie` access from components.
- A `utils/` folder.
- `// @ts-expect-error` or `as any` to silence strict mode.
- `eslint-disable` lines.

---

## 12. Before you finish a change

- `bun run typecheck` is green.
- `bun run lint` is green (no `disable` comments added).
- `bun run build` is green if you touched anything in `apps/builder/`.
- New on-chain action → tx builder under `packages/core/src/sui/tx/*.ts`, wired through a hook that calls `execute({ transaction })` from `useExecuteTransaction`.
- New on-chain mutation site → calls `invalidateChain(digest)` after the tx resolves.
- New hook → exported from the nearest barrel (`forms/hooks/index.ts`, etc.).
- New shared type → in `packages/core/src/types/index.ts`, not co-located.
- No new comments explaining what code does. Only why, only when non-obvious.
