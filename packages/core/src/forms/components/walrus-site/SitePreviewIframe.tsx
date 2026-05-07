'use client';

import { useMemo } from 'react';
import type { WalrusSiteFile } from '../../lib/walrus-site';

interface SitePreviewIframeProps {
  files: WalrusSiteFile[];
}

/**
 * Live preview of the rendered Walrus Site. Builds a single self-contained
 * HTML string — index.html with `<style>` and `<script>` blocks inlined —
 * and renders it via iframe `srcDoc`. Sandbox flags allow scripts but block
 * top-level navigation (no `allow-top-navigation`), so the handoff redirect
 * is safely contained: clicking Submit in the preview won't drag the host
 * page to walform.app.
 *
 * `allow-popups` is enabled so the user can manually right-click → open
 * footer links in a new tab while inspecting; without it the iframe's
 * sandbox blocks even target=_blank.
 */
export function SitePreviewIframe({ files }: SitePreviewIframeProps) {
  const srcDoc = useMemo(() => buildInlinedHtml(files), [files]);
  return (
    <iframe
      title="Walrus Site preview"
      srcDoc={srcDoc}
      // No `allow-same-origin` → the bundle's localStorage / fetch calls are
      // null-origin, which is fine because the static bundle doesn't make
      // any. `allow-forms` lets the form's submit handler run (we e.preventDefault).
      sandbox="allow-scripts allow-forms allow-popups"
      className="bg-background h-[70vh] w-full rounded-lg border"
    />
  );
}

function buildInlinedHtml(files: WalrusSiteFile[]): string {
  const indexFile = files.find((f) => f.path === 'index.html');
  const stylesFile = files.find((f) => f.path === 'assets/styles.css');
  const appJsFile = files.find((f) => f.path === 'assets/app.js');
  if (!indexFile) return '<!doctype html><meta charset="utf-8"><title>preview</title>';

  const styleTag = stylesFile
    ? `<style>${stylesFile.content.replace(/<\/style>/gi, '<\\/style>')}</style>`
    : '';
  const scriptTag = appJsFile
    ? `<script>${appJsFile.content.replace(/<\/script>/gi, '<\\/script>')}</script>`
    : '';

  // Strip the original <link> + <script src> tags and splice in inlined ones.
  // The portal would resolve those at runtime, but in srcDoc there's no
  // network fetch we can intercept.
  return indexFile.content
    .replace(/<link[^>]+href=["']\.\/assets\/styles\.css["'][^>]*>/i, styleTag)
    .replace(/<script[^>]+src=["']\.\/assets\/app\.js["'][^>]*><\/script>/i, scriptTag);
}
