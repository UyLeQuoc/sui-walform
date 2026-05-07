# `/docs` — entry point for AI agents

This folder exists so an AI agent working in this repo can bootstrap context
quickly. **Read these two files before taking any action:**

| Read | When |
| --- | --- |
| **`PRD.md`** | Always, first. The full product spec + locked architectural decisions (v0.7). Treat Appendix A's decision log as binding — do not relitigate locked items without the user's explicit go-ahead. |
| **`PROGRESS.md`** | Always, second. What has shipped, what is stubbed, and the ordered next-step queue (mapped to PRD section numbers). Start planning from here. |

## Root README vs this file

- **Repo root `README.md`** — user/judge-facing. Tagline, demo URLs, getting-started.
  Written for humans arriving from GitHub. Don't edit it as part of routine feature
  work; update it when the pitch or top-level commands change.
- **`docs/README.md`** (this file) — AI-facing. Navigation only.
- **`docs/PRD.md`** — spec + decision log. Canonical source of truth for "what
  are we building and why."
- **`docs/PROGRESS.md`** — execution state. Canonical source of truth for "where
  are we and what's next."

## Conventions when you (the AI) update these files

1. Feature shipped → add a row to `PROGRESS.md` under "Done", move its entry out
   of "Next up", cross-reference the PRD section you implemented.
2. Architectural decision changes → append a new row to `PRD.md` Appendix A,
   bump the version (v0.7 → v0.8) in the header, reference it from
   `PROGRESS.md`.
3. Found a new blocker / risk → add under `PROGRESS.md` "Known issues &
   deferred items" with a one-line reason.
4. Do not duplicate spec prose between PRD and PROGRESS. PROGRESS links back to
   PRD sections; PRD does not track progress.

## Quick commands

```bash
bun install                          # workspace setup (covers all 4 workspaces)
bun run dev                          # boots builder :3000, renderer :3001, portal :8080
bun run dev --filter=builder         # just builder
bun run typecheck                    # must stay green before any merge
bun run build                        # must stay green before any merge
cd apps/contracts && sui move build  # contracts compile check (not part of turbo)
```
