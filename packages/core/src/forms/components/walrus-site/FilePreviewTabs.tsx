'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import type { WalrusSiteFile } from '../../lib/walrus-site';

interface FilePreviewTabsProps {
  files: WalrusSiteFile[];
}

const TAB_LABEL: Record<string, string> = {
  'index.html': 'index.html',
  '404.html': '404.html',
  'assets/styles.css': 'styles.css',
  'assets/app.js': 'app.js',
  'ws-resources.json': 'ws-resources.json',
  'README.md': 'README.md',
};

/**
 * Per-file preview with a Copy-to-clipboard button. We render at most a
 * 3000-char window of each file so a 60 KB index doesn't lock the textarea
 * when the user is just scanning. The Copy button always copies the full
 * content regardless of the window.
 */
export function FilePreviewTabs({ files }: FilePreviewTabsProps) {
  const first = files[0]?.path ?? '';
  return (
    <Tabs defaultValue={first} className="flex flex-col gap-3">
      <TabsList className="w-fit">
        {files.map((f) => (
          <TabsTrigger key={f.path} value={f.path}>
            {TAB_LABEL[f.path] ?? f.path}
          </TabsTrigger>
        ))}
      </TabsList>
      {files.map((f) => (
        <TabsContent key={f.path} value={f.path}>
          <FileBlock file={f} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function FileBlock({ file }: { file: WalrusSiteFile }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable in some browsers — silently no-op */
    }
  };
  return (
    <div className="bg-muted/40 relative overflow-hidden rounded-lg border">
      <div className="bg-muted/60 flex items-center justify-between border-b px-3 py-1.5 text-xs">
        <code className="font-mono">{file.path}</code>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{formatBytes(file.bytes)}</span>
          <Button variant="ghost" onClick={() => void onCopy()} className="h-7 gap-1">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
      <pre className="max-h-[60vh] overflow-auto p-3 font-mono text-[12px] leading-relaxed">
        <code>{file.content}</code>
      </pre>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
