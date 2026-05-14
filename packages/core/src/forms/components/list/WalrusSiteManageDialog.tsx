'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Globe, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClientContext,
} from '@mysten/dapp-kit';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import { Spinner } from '../../../ui/spinner';
import { useInvalidateChainQueries } from '../../../sui/use-invalidate-chain';
import { useActiveWalrusSitePackageId } from '../../../sui/env-network';
import { buildUpdateSiteMetadataTx } from '../../../sui/tx/update-walrus-site-metadata';
import { walrusSitePublicUrl } from '../../../sui/tx/extract-walrus-site-id';
import { useFormSite } from '../../hooks/use-form-site';

interface WalrusSiteManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  formTitle: string;
  siteObjectId: string;
}

export function WalrusSiteManageDialog({
  open,
  onOpenChange,
  formId,
  formTitle,
  siteObjectId,
}: WalrusSiteManageDialogProps) {
  const account = useCurrentAccount();
  const { network } = useSuiClientContext();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const { site, isLoading } = useFormSite(siteObjectId);
  const sitePackageId = useActiveWalrusSitePackageId();
  const net = (network === 'mainnet' || network === 'devnet' ? network : 'testnet') as
    | 'testnet'
    | 'mainnet'
    | 'devnet';

  const [link, setLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [creator, setCreator] = useState('');
  const [hydratedSiteId, setHydratedSiteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Hydrate the form once the site fetch lands. Re-hydrate when the dialog
  // re-opens with a different site (e.g. user manages a different form back-
  // to-back). React's "adjusting state on prop change" pattern — done during
  // render so we don't bounce through an effect.
  if (site && hydratedSiteId !== site.siteId) {
    setHydratedSiteId(site.siteId);
    setLink(site.metadata.link ?? '');
    setImageUrl(site.metadata.imageUrl ?? '');
    setDescription(site.metadata.description ?? '');
    setProjectUrl(site.metadata.projectUrl ?? '');
    setCreator(site.metadata.creator ?? '');
  }

  const publicUrl = walrusSitePublicUrl(siteObjectId, formId, net);

  const copy = async (value: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(msg);
    } catch {
      toast.error('Copy failed');
    }
  };

  const handleSave = async () => {
    if (!account || !sitePackageId) return;
    setIsSaving(true);
    try {
      const tx = buildUpdateSiteMetadataTx({
        sitePackageId,
        siteObjectId,
        metadata: {
          link: link.trim() || null,
          imageUrl: imageUrl.trim() || null,
          description: description.trim() || null,
          projectUrl: projectUrl.trim() || null,
          creator: creator.trim() || null,
        },
      });
      // User-paid: walrus_sites is an external package, not a walform op, so
      // we sign + pay directly. Same pattern as DeployToWalrusSiteButton.
      const { digest } = await signAndExecuteTransaction({
        transaction: tx,
        chain: `sui:${net}`,
      });
      await invalidateChain(digest);
      toast.success('Walrus Site metadata updated');
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Update failed: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Manage Walrus Site — {formTitle || 'form'}
          </DialogTitle>
          <DialogDescription>
            Edit the metadata stored on the Walrus Site object. Changes are a single Sui tx via{' '}
            <code className="font-mono">site::update_metadata</code> — paid by your wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/40 flex flex-col gap-2 rounded-md border px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0">URL</span>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground truncate font-mono underline-offset-2 hover:underline"
              title={publicUrl}
            >
              {publicUrl}
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto size-6"
              onClick={() => void copy(publicUrl, 'URL copied')}
              aria-label="Copy URL"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button asChild type="button" variant="ghost" size="icon" className="size-6">
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0">Site object</span>
            <code className="truncate font-mono" title={siteObjectId}>
              {siteObjectId}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto size-6"
              onClick={() => void copy(siteObjectId, 'Site id copied')}
              aria-label="Copy site id"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {isLoading && !site ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading Walrus Site state…
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Field
              id="ws-link"
              label="Link"
              hint="Canonical URL the site points at (often the same form URL or a SuiNS subname)."
              value={link}
              onChange={setLink}
            />
            <Field
              id="ws-image"
              label="Image URL"
              hint="Preview image shown by the portal / SuiNS marketplace."
              value={imageUrl}
              onChange={setImageUrl}
            />
            <Field
              id="ws-desc"
              label="Description"
              multiline
              hint="Short blurb about the form — appears in social previews."
              value={description}
              onChange={setDescription}
            />
            <Field
              id="ws-project"
              label="Project URL"
              hint="Optional homepage / docs / repo."
              value={projectUrl}
              onChange={setProjectUrl}
            />
            <Field
              id="ws-creator"
              label="Creator"
              hint="Display name for the form's author."
              value={creator}
              onChange={setCreator}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving || !site}>
            {isSaving ? (
              <Spinner className="mr-1.5 size-3.5" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isSaving ? 'Saving…' : 'Save metadata'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  multiline,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : (
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );
}
