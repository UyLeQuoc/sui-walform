"use client";

import { useEffect, useState } from "react";
import { useSuiClientContext } from "@mysten/dapp-kit";
import { FormSubmissionView } from "@walform/core/forms/components/submit";

type Network = "testnet" | "mainnet";

interface ShellConfig {
  formId: string;
  network?: Network;
}

/**
 * Mode B entry point: Walrus-hosted static shell.
 *
 * Production deploy flow:
 *   - User clicks Deploy in the builder.
 *   - Builder bakes `/config.json` with `{ formId, network }` into the bundle.
 *   - Bundle ships to Walrus, served at `<base36>.wal.app/` (or
 *     `<their-name>.wal.app/` once a SuiNS name is linked).
 *   - The form renders at the root path — no `/f/<id>`, no hash, just a clean
 *     URL the creator can share.
 *
 * Resolution order:
 *
 *  1. **`/config.json`** — the production path. Set by the Deploy button.
 *  2. **Hash route** `#/f/<formId>` — debugging only (e.g. dev server). Lets
 *     us point the same shell at any form without rebuilding.
 *  3. **Landing** — neither matched, show a help card.
 *
 * For local dev: open `http://localhost:3002/#/f/<formId>`.
 */
export default function ShellPage() {
  const { network: activeNetwork, selectNetwork } = useSuiClientContext();
  const [formId, setFormId] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const readHash = (): string | null => {
      const m = /^#\/f\/(0x[0-9a-fA-F]+)\/?$/.exec(window.location.hash);
      return m?.[1] ?? null;
    };

    const onHashChange = () => {
      const id = readHash();
      if (id) setFormId(id);
    };
    window.addEventListener("hashchange", onHashChange);

    const hashId = readHash();
    if (hashId) {
      setFormId(hashId);
      setResolved(true);
    } else {
      void fetch("/config.json", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<ShellConfig>) : null))
        .then((cfg) => {
          if (cancelled) return;
          if (cfg && typeof cfg.formId === "string" && cfg.formId.startsWith("0x")) {
            if (cfg.network && cfg.network !== activeNetwork) {
              selectNetwork(cfg.network);
            }
            setFormId(cfg.formId);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setResolved(true);
        });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", onHashChange);
    };
    // Only run once on mount — `selectNetwork` is stable, `activeNetwork`
    // changing should not retrigger fetch/setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!resolved) return null;
  if (!formId) return <Landing />;
  return <FormSubmissionView formId={formId} />;
}

function Landing() {
  return (
    <div className="bg-secondary/40 flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="bg-card flex max-w-md flex-col items-center gap-3 rounded-xl border p-8 text-center shadow-xl">
        <h1 className="text-lg font-semibold">WalForm — Mode B shell</h1>
        <p className="text-muted-foreground text-sm">
          This static bundle expects either a baked-in <code className="font-mono text-xs">config.json</code>{" "}
          (set by the Deploy button) or a hash-route form id:
          <br />
          <code className="font-mono text-xs">#/f/&lt;formId&gt;</code>
        </p>
        <p className="text-muted-foreground/70 text-xs">
          Hosted on Walrus. Network (testnet / mainnet) is baked in by Deploy.
        </p>
      </div>
    </div>
  );
}
