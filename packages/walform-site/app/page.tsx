"use client";

import { useEffect, useState } from "react";
import { FormSubmissionView } from "@walform/core/forms/components/submit";

/**
 * Mode B entry point: Walrus-hosted static shell that hash-routes to a form id.
 *
 * - URL pattern: `https://<site-id>.wal.app/#/f/{formId}`
 * - The shell reads the hash on mount + on `hashchange` so a single static
 *   bundle serves any number of forms without needing per-form deploys.
 * - Cross-origin API calls (sponsor, walrus upload) are served by the builder
 *   app at `walform.app` — both routes already CORS-allowlist `*.wal.app`.
 *
 * For local dev: open `http://localhost:3002/#/f/<formId>` after
 * `bun run dev --filter=@walform/walform-site`.
 */
export default function ShellPage() {
  const [formId, setFormId] = useState<string | null>(null);

  useEffect(() => {
    const readHash = () => {
      const m = /^#\/f\/([0-9a-zA-Zx]+)\/?$/.exec(window.location.hash);
      setFormId(m?.[1] ?? null);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

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
