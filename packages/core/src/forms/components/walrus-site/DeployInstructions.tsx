'use client';

import { ExternalLink, Terminal } from 'lucide-react';

const STEPS = [
  {
    title: 'Install the Sui + Walrus toolchain',
    body: (
      <>
        Follow the official setup once per machine — Sui CLI for the wallet,{' '}
        <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">site-builder</code> for
        the Walrus Site upload itself, and a{' '}
        <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">
          sites-config.yaml
        </code>{' '}
        in{' '}
        <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">
          ~/.config/walrus/
        </code>
        .
      </>
    ),
    link: {
      href: 'https://docs.wal.app/docs/sites/getting-started/installing-the-site-builder',
      label: 'site-builder install guide',
    },
  },
  {
    title: 'Unzip the bundle',
    body: <>Drop the zip into a fresh directory and unpack it.</>,
    code: 'unzip your-form-walrus-site.zip -d form-site && cd form-site',
  },
  {
    title: 'Deploy',
    body: (
      <>
        <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">--epochs 53</code>{' '}
        requests max storage duration (≈ 53 days on testnet, ≈ 2 years on mainnet). The site object
        id gets written back into{' '}
        <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">
          ws-resources.json
        </code>{' '}
        — re-running the same command updates the site in place instead of publishing a new one.
      </>
    ),
    code: 'site-builder deploy --epochs 53 .',
  },
  {
    title: 'Visit your site',
    body: (
      <>
        Convert the printed object id to base36 to get the{' '}
        <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">
          &lt;base36&gt;.wal.app
        </code>{' '}
        subdomain.
      </>
    ),
    code: 'site-builder convert <object-id>',
  },
];

/**
 * Static deployment runbook. Steps are stable enough to live as a static
 * component; if Walrus changes the CLI interface we update here in one place.
 */
export function DeployInstructions() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4" />
        <h2 className="text-sm font-semibold">Deploy to Walrus</h2>
      </div>
      <ol className="flex flex-col gap-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="bg-muted text-foreground mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              {i + 1}
            </span>
            <div className="flex flex-col gap-1.5 text-sm">
              <strong className="font-medium">{step.title}</strong>
              <p className="text-muted-foreground">{step.body}</p>
              {step.code && (
                <pre className="bg-muted my-1 overflow-x-auto rounded-md p-2 font-mono text-[12px]">
                  <code>{step.code}</code>
                </pre>
              )}
              {step.link && (
                <a
                  href={step.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 self-start text-xs underline-offset-2 hover:underline"
                >
                  {step.link.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
