import type { FormSchema } from '../../types';
import { formsRoute } from './routes';

/** Where the deployed site hands control off to for actual submissions. */
export const DEFAULT_APP_ORIGIN = 'https://walform.app';

export interface WalrusSiteFile {
  /** Site-relative path, no leading slash. e.g. `index.html`, `assets/app.js`. */
  path: string;
  /** UTF-8 text content. The bundle is plaintext-only — no binary assets. */
  content: string;
  /** UTF-8 byte length — convenience for size badges in the preview UI. */
  bytes: number;
}

export interface WalrusSiteBundle {
  /** Pretty title used in HTML <title> + zip filename slug. */
  siteName: string;
  /** Sum of all file content byte-lengths. Surfaced for the size badge. */
  totalBytes: number;
  /** Where Submit redirects to. `${appOrigin}/f?formId=${formObjectId}`, or empty if formObjectId omitted. */
  submitUrl: string;
  files: WalrusSiteFile[];
}

interface GenerateInput {
  schema: FormSchema;
  /** Optional `0x…` Form object id. Drives the redirect target on Submit. */
  formObjectId?: string;
  /** Override for `DEFAULT_APP_ORIGIN`. Trimmed; trailing slash stripped. */
  appOrigin?: string;
}

/**
 * Build a static bundle the user can `unzip && site-builder deploy`.
 *
 * The bundle is intentionally minimal: a single `index.html` that previews
 * the form fields read-only, plus a Submit button that hands off to the
 * full WalForm app at `${appOrigin}/f?formId=${formObjectId}`. Submission, Seal
 * encryption, allowlist gating, etc. all live in the main app — the Walrus
 * Site is just a SuiNS-friendly entry point.
 *
 * Stays string-pure so the same code can run in the browser preview iframe
 * (via `srcDoc`) and the CLI export tool without DOM/Node split.
 */
export function generateWalrusSiteBundle(input: GenerateInput): WalrusSiteBundle {
  const schema = input.schema;
  const formObjectId = (input.formObjectId ?? '').trim();
  const origin = stripTrailingSlash((input.appOrigin ?? '').trim() || DEFAULT_APP_ORIGIN);
  const submitUrl = formObjectId ? `${origin}${formsRoute.submit(formObjectId)}` : '';
  const siteName = schema.title || 'WalForm';
  const settings = schema.settings ?? {};

  const rawFiles: Array<{ path: string; content: string }> = [
    { path: 'index.html', content: renderIndexHtml(schema, submitUrl) },
    { path: '404.html', content: render404Html(siteName) },
    {
      path: 'assets/styles.css',
      content: renderCss(settings as unknown as Record<string, unknown>),
    },
    { path: 'assets/app.js', content: renderAppJs(submitUrl) },
    { path: 'ws-resources.json', content: renderWsResources(siteName) },
    { path: 'README.md', content: renderReadme(siteName, submitUrl) },
  ];
  const files: WalrusSiteFile[] = rawFiles.map((f) => ({
    ...f,
    bytes: byteLength(f.content),
  }));

  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
  return { siteName, totalBytes, submitUrl, files };
}

/**
 * Serialise a list of `{path, content}` entries into a STORED-only ZIP blob.
 *
 * "Stored" = no compression. Easier than DEFLATE because we don't need to
 * pull pako, and a static form bundle hits ~5 KB total — compression saves
 * <1 KB at most. The ZIP is fully spec-compliant per the APPNOTE.TXT
 * `version needed = 20` baseline, accepted by every unzip tool we tested.
 */
export function buildZipBlob(entries: ReadonlyArray<{ path: string; content: string }>): Blob {
  const enc = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.path);
    const contentBytes = enc.encode(entry.content);
    const crc = crc32(contentBytes);
    const size = contentBytes.length;
    const fileTime = 0; // 1980-01-01 00:00:00 — deterministic timestamps so re-runs produce identical zips.
    const fileDate = (1 << 5) | 1;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lhView = new DataView(localHeader.buffer);
    lhView.setUint32(0, 0x04034b50, true); // local file header signature
    lhView.setUint16(4, 20, true); // version needed
    lhView.setUint16(6, 0, true); // flags
    lhView.setUint16(8, 0, true); // method = stored
    lhView.setUint16(10, fileTime, true);
    lhView.setUint16(12, fileDate, true);
    lhView.setUint32(14, crc, true);
    lhView.setUint32(18, size, true); // compressed size = stored size
    lhView.setUint32(22, size, true); // uncompressed size
    lhView.setUint16(26, nameBytes.length, true);
    lhView.setUint16(28, 0, true); // extra length
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, contentBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const chView = new DataView(centralHeader.buffer);
    chView.setUint32(0, 0x02014b50, true); // central directory header signature
    chView.setUint16(4, 20, true); // version made by
    chView.setUint16(6, 20, true); // version needed
    chView.setUint16(8, 0, true); // flags
    chView.setUint16(10, 0, true); // method = stored
    chView.setUint16(12, fileTime, true);
    chView.setUint16(14, fileDate, true);
    chView.setUint32(16, crc, true);
    chView.setUint32(20, size, true);
    chView.setUint32(24, size, true);
    chView.setUint16(28, nameBytes.length, true);
    chView.setUint16(30, 0, true); // extra
    chView.setUint16(32, 0, true); // comment
    chView.setUint16(34, 0, true); // disk number start
    chView.setUint16(36, 0, true); // internal file attrs
    chView.setUint32(38, 0, true); // external file attrs
    chView.setUint32(42, offset, true); // relative offset of local header
    centralHeader.set(nameBytes, 46);

    centralChunks.push(centralHeader);
    offset += localHeader.length + contentBytes.length;
  }

  const centralSize = centralChunks.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const eView = new DataView(eocd.buffer);
  eView.setUint32(0, 0x06054b50, true); // EOCD signature
  eView.setUint16(4, 0, true); // disk number
  eView.setUint16(6, 0, true); // central dir disk
  eView.setUint16(8, entries.length, true); // entries on this disk
  eView.setUint16(10, entries.length, true); // total entries
  eView.setUint32(12, centralSize, true);
  eView.setUint32(16, offset, true);
  eView.setUint16(20, 0, true); // comment length

  // Cast through `BlobPart[]`: TS narrows `Uint8Array<ArrayBufferLike>` away
  // from the `BlobPart` union (which only accepts `Uint8Array<ArrayBuffer>`)
  // because `ArrayBufferLike` could legally be a `SharedArrayBuffer`. Our
  // arrays are all freshly-allocated `new Uint8Array(N)` so the underlying
  // buffer is always a plain `ArrayBuffer`.
  return new Blob([...localChunks, ...centralChunks, eocd] as BlobPart[], {
    type: 'application/zip',
  });
}

// ── Internal renderers ───────────────────────────────────────────────────────

function renderIndexHtml(schema: FormSchema, submitUrl: string): string {
  const title = escapeHtml(schema.title || 'WalForm');
  const description = schema.description ? escapeHtml(schema.description) : '';
  const submitLabel = escapeHtml(schema.settings?.submitLabel || 'Continue to submit');
  const fieldsHtml = (schema.fields ?? [])
    .map((field) => renderFieldPreview(field as unknown as Record<string, unknown>))
    .join('\n');
  const submitAttr = submitUrl ? ` data-submit-url="${escapeHtml(submitUrl)}"` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<link rel="stylesheet" href="./assets/styles.css" />
</head>
<body>
<main class="walform-shell">
<header>
<h1>${title}</h1>
${description ? `<p class="walform-desc">${description}</p>` : ''}
</header>
<form id="walform" novalidate${submitAttr}>
${fieldsHtml}
<button type="submit" class="walform-submit">${submitLabel}</button>
</form>
<footer>
<small>Hosted on Walrus · powered by <a href="https://walform.app" target="_blank" rel="noopener">WalForm</a></small>
</footer>
</main>
<script src="./assets/app.js"></script>
</body>
</html>
`;
}

function render404Html(siteName: string): string {
  const title = escapeHtml(siteName);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>404 — ${title}</title>
<link rel="stylesheet" href="./assets/styles.css" />
</head>
<body>
<main class="walform-shell">
<h1>404 — page not found</h1>
<p><a href="./index.html">Go back to the form</a></p>
</main>
</body>
</html>
`;
}

function renderCss(settings: Record<string, unknown>): string {
  const fontFamily = mapFont(typeof settings.fontFamily === 'string' ? settings.fontFamily : '');
  const radius = typeof settings.borderRadius === 'number' ? settings.borderRadius : 8;
  const primary = mapPrimaryColor(
    typeof settings.primaryColor === 'string' ? settings.primaryColor : '',
  );
  return `:root {
  --primary: ${primary};
  --radius: ${radius}px;
  --bg: #fff;
  --fg: #0a0a0a;
  --muted: #6b7280;
  --border: #e5e7eb;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: ${fontFamily};
  background: var(--bg);
  color: var(--fg);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.walform-shell {
  max-width: 640px;
  margin: 0 auto;
  padding: 32px 20px 80px;
}

h1 { font-size: 24px; margin: 0 0 8px; }
.walform-desc { color: var(--muted); margin: 0 0 24px; }

.walform-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.walform-field label {
  font-size: 14px;
  font-weight: 500;
}

.walform-field input,
.walform-field textarea,
.walform-field select {
  font: inherit;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--fg);
  width: 100%;
}

.walform-field textarea { min-height: 96px; resize: vertical; }

.walform-field input:focus,
.walform-field textarea:focus,
.walform-field select:focus {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
  border-color: var(--primary);
}

.walform-required { color: #dc2626; margin-left: 2px; }

.walform-submit {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--primary);
  color: #fff;
  border: 0;
  padding: 12px 20px;
  font: inherit;
  font-weight: 500;
  border-radius: var(--radius);
  cursor: pointer;
  margin-top: 8px;
}

.walform-submit:hover { filter: brightness(0.95); }
.walform-submit:disabled { opacity: 0.5; cursor: not-allowed; }

footer {
  color: var(--muted);
  font-size: 12px;
  text-align: center;
  margin-top: 48px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}

footer a { color: var(--muted); }
`;
}

function renderAppJs(submitUrl: string): string {
  // Single self-contained script. No bundler needed; the `srcDoc` preview
  // iframe and the deployed Walrus Site both run this verbatim.
  if (!submitUrl) {
    return `(() => {
  const form = document.getElementById('walform');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('No formObjectId configured — re-export with the on-chain id to enable submit handoff.');
  });
})();
`;
  }
  return `(() => {
  const form = document.getElementById('walform');
  if (!form) return;
  const url = form.dataset.submitUrl || ${JSON.stringify(submitUrl)};
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    window.location.href = url;
  });
})();
`;
}

function renderWsResources(siteName: string): string {
  return `${JSON.stringify(
    {
      site_name: siteName,
      headers: {
        '/*.html': { 'Cache-Control': 'public, max-age=300' },
        '/assets/*': { 'Cache-Control': 'public, max-age=86400, immutable' },
      },
      routes: { '/*': '/index.html' },
    },
    null,
    2,
  )}\n`;
}

function renderReadme(siteName: string, submitUrl: string): string {
  return `# ${siteName} — Walrus Site bundle

Static landing page that previews the form and hands off submissions to the
WalForm app${submitUrl ? ` at \`${submitUrl}\`` : ''}.

## Deploy

\`\`\`bash
unzip *-walrus-site.zip -d site && cd site
site-builder deploy --epochs 53 .
\`\`\`

The site object id is written back into \`ws-resources.json\` after the first
deploy; re-running the same command updates the existing site instead of
publishing a new one.

## Files

- \`index.html\` — read-only field preview + Submit button.
- \`404.html\` — fallback page wired up via \`routes\` in \`ws-resources.json\`.
- \`assets/styles.css\` — minimal styling derived from form theme settings.
- \`assets/app.js\` — Submit handler (redirects to the WalForm app).
- \`ws-resources.json\` — site-builder config (headers, routes).
`;
}

// ── Renderer helpers ─────────────────────────────────────────────────────────

function renderFieldPreview(field: Record<string, unknown>): string {
  const id = typeof field.id === 'string' ? field.id : '';
  const label = typeof field.label === 'string' ? field.label : id;
  const placeholder = typeof field.placeholder === 'string' ? field.placeholder : '';
  const required = field.required === true;
  const type = typeof field.type === 'string' ? field.type : 'short_text';
  const labelHtml = `<label for="f-${escapeHtml(id)}">${escapeHtml(label)}${
    required ? '<span class="walform-required" aria-hidden="true">*</span>' : ''
  }</label>`;
  const control = renderControl(id, type, placeholder, required, field);
  return `<div class="walform-field">${labelHtml}${control}</div>`;
}

function renderControl(
  id: string,
  type: string,
  placeholder: string,
  required: boolean,
  field: Record<string, unknown>,
): string {
  const idAttr = `id="f-${escapeHtml(id)}" name="${escapeHtml(id)}"`;
  const reqAttr = required ? ' required' : '';
  const phAttr = placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : '';

  switch (type) {
    case 'long_text':
    case 'paragraph':
      return `<textarea ${idAttr}${phAttr}${reqAttr}></textarea>`;
    case 'email':
      return `<input ${idAttr} type="email"${phAttr}${reqAttr} />`;
    case 'number':
    case 'rating':
    case 'linear_scale':
      return `<input ${idAttr} type="number"${phAttr}${reqAttr} />`;
    case 'date':
      return `<input ${idAttr} type="date"${reqAttr} />`;
    case 'single_choice':
    case 'multiple_choice':
    case 'select':
    case 'yes_no': {
      const opts = Array.isArray(field.options) ? (field.options as unknown[]) : [];
      const optionsHtml = opts
        .map((o) => {
          const value =
            typeof o === 'string'
              ? o
              : isRecord(o) && typeof o.value === 'string'
                ? o.value
                : isRecord(o) && typeof o.label === 'string'
                  ? o.label
                  : '';
          if (!value) return '';
          return `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`;
        })
        .filter(Boolean)
        .join('');
      return `<select ${idAttr}${reqAttr}><option value="">Choose…</option>${optionsHtml}</select>`;
    }
    default:
      return `<input ${idAttr} type="text"${phAttr}${reqAttr} />`;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function mapFont(slug: string): string {
  switch (slug) {
    case 'serif':
      return '"Times New Roman", Georgia, serif';
    case 'mono':
      return '"JetBrains Mono", "SF Mono", Menlo, monospace';
    case 'inter':
    default:
      return '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  }
}

function mapPrimaryColor(slug: string): string {
  switch (slug) {
    case 'red':
      return '#dc2626';
    case 'orange':
      return '#ea580c';
    case 'yellow':
      return '#ca8a04';
    case 'green':
      return '#16a34a';
    case 'teal':
      return '#0d9488';
    case 'purple':
      return '#9333ea';
    case 'pink':
      return '#db2777';
    case 'blue':
    default:
      return '#2563eb';
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

// ── CRC-32 (table-free, big-endian polynomial 0xEDB88320) ────────────────────

const CRC_TABLE: number[] = (() => {
  const t: number[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = (CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}
