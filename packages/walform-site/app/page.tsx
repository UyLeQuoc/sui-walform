"use client";

import { useEffect, useState } from "react";
import { FormSubmissionView } from "@walform/core/forms/components/submit";

/**
 * Mode B entry point: Walrus-hosted static shell.
 *
 * Two routing modes:
 *
 *  1. **Hash routed (shared shell)** — `https://<site-id>.wal.app/#/f/{formId}`.
 *     A single bundle serves any form. The deploy button injects no config.
 *
 *  2. **Root routed (per-form site)** — `https://<creator-name>.wal.app/`.
 *     The deploy button bakes a `config.json` with `{formId}` into the bundle
 *     before pushing to Walrus. The shell loads that config on mount and
 *     renders the form at the root path — no slug, no hash, just the SuiNS
 *     subdomain. Falls back to the hash router if no config exists, so the
 *     same code path works for both modes.
 *
 * For local dev: open `http://localhost:3002/#/f/<formId>`.
 */
export default function ShellPage() {
  const [formId, setFormId] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const readHash = () => {
      const m = /^#\/f\/([0-9a-zA-Zx]+)\/?$/.exec(window.location.hash);
      if (m?.[1]) setFormId(m[1]);
    };
    // Hash always wins if present — lets a per-form site still serve other
    // forms via `?#/f/<otherId>` for debugging.
    readHash();
    window.addEventListener("hashchange", readHash);

    // No hash → try baked-in config.json.
    if (!window.location.hash) {
      void fetch("/config.json")
        .then((r) => (r.ok ? r.json() : null))
        .then((cfg) => {
          if (cancelled) return;
          if (cfg && typeof cfg.formId === "string" && cfg.formId.startsWith("0x")) {
            setFormId(cfg.formId);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setConfigLoaded(true);
        });
    } else {
      setConfigLoaded(true);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", readHash);
    };
  }, []);

  if (!configLoaded) return null;
  if (!formId) return <Landing />;
  return <FormSubmissionView formId={formId} />;
}

function Landing() {
  return (
    <div className="bg-secondary/40 flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="bg-card flex max-w-md flex-col items-center gap-3 rounded-xl border p-8 text-center shadow-xl">
        <h1 className="text-lg font-semibold">WalForm — Mode B shell</h1>
        <p className="text-muted-foreground text-sm">
          Append a form id to the URL to render it: <br />
          <code className="font-mono text-xs">#/f/{"<formId>"}</code>
        </p>
        <p className="text-muted-foreground/70 text-xs">
          This static bundle is hosted on Walrus and serves any WalForm form via
          the hash route.
        </p>
      </div>
    </div>
  );
}
