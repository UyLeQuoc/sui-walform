'use client';

import { Download, FileJson, Globe, Layers } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { useWalrusSiteExport } from '../../hooks/use-walrus-site-export';
import { DeployInstructions } from './DeployInstructions';
import { FilePreviewTabs } from './FilePreviewTabs';
import { SitePreviewIframe } from './SitePreviewIframe';

/**
 * Form-JSON-in → Walrus-Site-bundle-out tool. Two columns:
 *   Left  — paste schema, optional formObjectId, optional appOrigin override.
 *   Right — Preview / Files / Deploy tabs over the generated bundle.
 *
 * Everything below this component is dumb presentation; the bundle build,
 * validation, and zip download live in `useWalrusSiteExport`.
 */
export function WalrusSiteExportClient() {
  const {
    jsonInput,
    setJsonInput,
    formObjectId,
    setFormObjectId,
    appOrigin,
    setAppOrigin,
    state,
    downloadZip,
  } = useWalrusSiteExport();

  return (
    <div className="bg-background min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Walrus Site export</h1>
          </div>
          <Button asChild variant="ghost">
            <Link href="/forms">Back to forms</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[400px_1fr]">
        <section className="flex flex-col gap-4">
          <SectionHeader
            icon={<FileJson className="h-4 w-4" />}
            title="1. Paste the form JSON"
            description="The same shape the builder writes to IndexedDB. Copy from a draft or export an on-chain form's schema."
          />
          <Textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            spellCheck={false}
            rows={18}
            className="font-mono text-[12px]"
            aria-label="Form schema JSON"
          />

          <SectionHeader
            icon={<Layers className="h-4 w-4" />}
            title="2. Optional handoff"
            description="If the form is published on-chain, paste its Form object id so Submit redirects to the real /f/[id] page. Otherwise the bundle ships as preview-only."
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="form-id" className="text-xs">
              Form object id (0x…)
            </Label>
            <Input
              id="form-id"
              value={formObjectId}
              onChange={(e) => setFormObjectId(e.target.value)}
              placeholder="0xabc…"
              className="font-mono text-xs"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="origin" className="text-xs">
              App origin
            </Label>
            <Input
              id="origin"
              value={appOrigin}
              onChange={(e) => setAppOrigin(e.target.value)}
              placeholder="https://walform.app"
              className="font-mono text-xs"
            />
          </div>

          {state.status === 'error' && (
            <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-3 text-xs">
              <strong className="text-destructive">Couldn&apos;t generate bundle.</strong>
              <p className="text-destructive/80 mt-1 leading-relaxed">{state.message}</p>
            </div>
          )}

          <Button
            onClick={downloadZip}
            disabled={state.status !== 'ready'}
            size="lg"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download .zip{' '}
            {state.status === 'ready' && (
              <span className="text-primary-foreground/70 text-xs">
                ({formatBytes(state.bundle.totalBytes)})
              </span>
            )}
          </Button>
        </section>

        <section>
          {state.status === 'ready' ? (
            <BundleResult bundle={state.bundle} />
          ) : (
            <EmptyState
              message={state.status === 'error' ? state.message : 'Awaiting valid JSON…'}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function BundleResult({
  bundle,
}: {
  bundle: ReturnType<typeof useWalrusSiteExport>['state'] extends infer S
    ? S extends { status: 'ready'; bundle: infer B }
      ? B
      : never
    : never;
}) {
  return (
    <Tabs defaultValue="preview" className="flex flex-col gap-3">
      <TabsList className="w-fit">
        <TabsTrigger value="preview">Preview</TabsTrigger>
        <TabsTrigger value="files">Files ({bundle.files.length})</TabsTrigger>
        <TabsTrigger value="deploy">Deploy</TabsTrigger>
      </TabsList>
      <TabsContent value="preview">
        <SitePreviewIframe files={bundle.files} />
        <p className="text-muted-foreground mt-2 text-[11px]">
          Iframe sandbox blocks top-level navigation, so clicking Submit here just validates — the
          live site will redirect to {bundle.submitUrl || 'walform.app/f/<formId>'}.
        </p>
      </TabsContent>
      <TabsContent value="files">
        <FilePreviewTabs files={bundle.files} />
      </TabsContent>
      <TabsContent value="deploy">
        <DeployInstructions />
      </TabsContent>
    </Tabs>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-muted/30 flex h-[60vh] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
      <Globe className="text-muted-foreground h-8 w-8" />
      <p className="text-muted-foreground text-sm">{message}</p>
      <p className="text-muted-foreground/70 max-w-sm text-xs">
        Paste a valid <code className="font-mono">FormSchema</code> JSON on the left and the bundle
        will appear here in real time.
      </p>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
