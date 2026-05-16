'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Globe, Store, Send, Coins, ImageIcon, Wallet } from 'lucide-react';
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
import { Switch } from '../../../ui/switch';
import { Textarea } from '../../../ui/textarea';
import { Separator } from '../../../ui/separator';
import { cn } from '../../../lib/utils';
import { dataUrlToBytes, formatWal, useStorageCost } from '../../../walrus';
import { TxSteps, type TxStep } from '../shared/TxSteps';

export type PublishMode = 'on-chain' | 'marketplace';
export type PublishAccess = 'public' | 'private' | 'token' | 'paid';
export type MarketplacePricing = 'free' | 'paid';

export interface PublishOnChainOptions {
  mode: 'on-chain';
  access: PublishAccess;
  maxSubmissions: number;
  closesAtMs: number | null;
  allowlistAddresses: string[];
  /** ACCESS_TOKEN: full Move type tag (e.g. `0x2::sui::SUI`). UTF-8 bytes go on-chain. */
  tokenType: string;
  /** ACCESS_TOKEN: minimum balance the submitter must hold (raw u64 of base units). */
  tokenAmount: bigint;
  /** ACCESS_PAID: per-submission fee in MIST. */
  submissionFeeMist: bigint;
}

export interface PublishMarketplaceOptions {
  mode: 'marketplace';
  title: string;
  description: string;
  category: number;
  tags: string[];
  pricing: MarketplacePricing;
  priceSui: number;
}

export type PublishOptions = PublishOnChainOptions | PublishMarketplaceOptions;

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formTitle: string;
  /** Seeds the marketplace tab's description field. */
  formDescription?: string;
  /** Seeds the marketplace tab's tags input (joined by commas). */
  formTags?: string[];
  /**
   * Cover image as a `data:` URL (draft-state). When present, the dialog
   * shows a Walrus storage-cost estimate so the creator knows what the
   * upload-on-publish step will cost.
   */
  coverImageDataUrl?: string;
  isSubmitting?: boolean;
  /** Step-by-step publish progress from `usePublishForm().steps`. Rendered
   * above the dialog footer while `isSubmitting`. */
  txSteps?: TxStep[];
  onSubmit: (options: PublishOptions) => Promise<void> | void;
}

const CATEGORIES = [
  { value: 0, label: 'Survey' },
  { value: 1, label: 'NPS' },
  { value: 2, label: 'Event RSVP' },
  { value: 3, label: 'Lead form' },
  { value: 4, label: 'Other' },
];

export function PublishDialog({
  open,
  onOpenChange,
  formTitle,
  formDescription,
  formTags,
  coverImageDataUrl,
  isSubmitting,
  txSteps,
  onSubmit,
}: PublishDialogProps) {
  const [mode, setMode] = useState<PublishMode>('on-chain');
  const [access, setAccess] = useState<PublishAccess>('public');
  const [limitEnabled, setLimitEnabled] = useState<boolean>(false);
  const [maxSubmissions, setMaxSubmissions] = useState<string>('100');
  const [deadlineEnabled, setDeadlineEnabled] = useState<boolean>(false);
  const [closesAt, setClosesAt] = useState<string>('');
  const [allowlistRaw, setAllowlistRaw] = useState<string>('');
  const [tokenType, setTokenType] = useState<string>('0x2::sui::SUI');
  const [tokenAmount, setTokenAmount] = useState<string>('1');
  const [feeSui, setFeeSui] = useState<string>('0.1');

  const [title, setTitle] = useState<string>(formTitle || 'Untitled template');
  const [description, setDescription] = useState<string>(formDescription ?? '');
  const [category, setCategory] = useState<number>(0);
  const [tagsRaw, setTagsRaw] = useState<string>((formTags ?? []).join(', '));
  const [pricing, setPricing] = useState<MarketplacePricing>('free');
  const [priceSui, setPriceSui] = useState<string>('2');

  // Re-seed marketplace fields each time the dialog opens. Mid-edit prop
  // changes don't clobber the user's in-flight values.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (!wasOpenRef.current && open) {
      setTitle(formTitle || 'Untitled template');
      setDescription(formDescription ?? '');
      setTagsRaw((formTags ?? []).join(', '));
    }
    wasOpenRef.current = open;
  }, [open, formTitle, formDescription, formTags]);

  const allowlist = useMemo(
    () =>
      // Permissive parser: accept comma, semicolon, any whitespace (newline,
      // tab, space). Strip surrounding quotes/brackets/angle-brackets so
      // pastes like `["0x…", "0x…"]` or `<0x…>` Just Work. Dedup case-
      // sensitively (Sui addresses are lowercase).
      Array.from(
        new Set(
          allowlistRaw
            .split(/[\s,;]+/)
            .map((s) => s.trim().replace(/^[\[\]"'<>(){}]+|[\[\]"'<>(){}]+$/g, ''))
            .filter((s) => s.startsWith('0x') && s.length >= 3),
        ),
      ),
    [allowlistRaw],
  );

  // Decode the data URL once to get the byte count for the cost estimator.
  // useStorageCost handles the case where bytes==0 (returns null).
  const coverBytes = useMemo(() => {
    if (!coverImageDataUrl) return 0;
    try {
      return dataUrlToBytes(coverImageDataUrl).byteLength;
    } catch {
      return 0;
    }
  }, [coverImageDataUrl]);
  const storageCost = useStorageCost(coverBytes, 5);
  const tags = useMemo(
    () =>
      Array.from(
        new Set(
          tagsRaw
            .split(/[\s,;]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ),
    [tagsRaw],
  );

  const handleSubmit = () => {
    if (mode === 'on-chain') {
      const parsedMax = Number(maxSubmissions);
      const max = limitEnabled && Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 0;
      const closesAtMs = deadlineEnabled && closesAt ? new Date(closesAt).getTime() : null;
      // Token: amount stored in u64 base units (assume the user enters whole
      // units and the contract treats it raw — caller is responsible for the
      // display↔base conversion since we don't fetch coin metadata in the
      // dialog. SUI = 1e9 mist, USDC = 1e6, etc.).
      const tokenAmountRaw = parseBigIntSafe(tokenAmount);
      const feeMist = parseSuiToMist(feeSui);
      void onSubmit({
        mode: 'on-chain',
        access,
        maxSubmissions: max,
        closesAtMs,
        allowlistAddresses: allowlist,
        tokenType: tokenType.trim(),
        tokenAmount: tokenAmountRaw,
        submissionFeeMist: feeMist,
      });
    } else {
      const price = Number(priceSui);
      void onSubmit({
        mode: 'marketplace',
        title,
        description,
        category,
        tags,
        pricing,
        priceSui: Number.isFinite(price) ? price : 0,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Publish form</DialogTitle>
          <DialogDescription>
            Choose how others will interact with &ldquo;{formTitle || 'your form'}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <ModeTile
            icon={<Send className="h-4 w-4" />}
            title="Publish on-chain"
            subtitle="Accept submissions"
            active={mode === 'on-chain'}
            onClick={() => setMode('on-chain')}
          />
          <ModeTile
            icon={<Store className="h-4 w-4" />}
            title="Publish to Marketplace"
            subtitle="Sell or share as template"
            active={mode === 'marketplace'}
            onClick={() => setMode('marketplace')}
          />
        </div>

        <Separator />

        {mode === 'on-chain' ? (
          <OnChainFields
            access={access}
            setAccess={setAccess}
            limitEnabled={limitEnabled}
            setLimitEnabled={setLimitEnabled}
            maxSubmissions={maxSubmissions}
            setMaxSubmissions={setMaxSubmissions}
            deadlineEnabled={deadlineEnabled}
            setDeadlineEnabled={setDeadlineEnabled}
            closesAt={closesAt}
            setClosesAt={setClosesAt}
            allowlistRaw={allowlistRaw}
            setAllowlistRaw={setAllowlistRaw}
            allowlistCount={allowlist.length}
            tokenType={tokenType}
            setTokenType={setTokenType}
            tokenAmount={tokenAmount}
            setTokenAmount={setTokenAmount}
            feeSui={feeSui}
            setFeeSui={setFeeSui}
          />
        ) : (
          <MarketplaceFields
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            category={category}
            setCategory={setCategory}
            tagsRaw={tagsRaw}
            setTagsRaw={setTagsRaw}
            pricing={pricing}
            setPricing={setPricing}
            priceSui={priceSui}
            setPriceSui={setPriceSui}
          />
        )}

        {coverBytes > 0 && (
          <CostEstimateRow
            bytes={coverBytes}
            cost={storageCost.cost}
            isLoading={storageCost.isLoading}
            error={storageCost.error}
          />
        )}

        {isSubmitting && txSteps && txSteps.length > 0 && (
          <div className="bg-muted/30 rounded-md border p-3">
            <p className="text-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
              Publishing your form
            </p>
            <TxSteps steps={txSteps} />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? 'Publishing…'
              : mode === 'on-chain'
                ? 'Publish on-chain'
                : 'List template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeTile({
  icon,
  title,
  subtitle,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors',
        active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <span className="text-muted-foreground text-xs">{subtitle}</span>
    </button>
  );
}

function OnChainFields({
  access,
  setAccess,
  limitEnabled,
  setLimitEnabled,
  maxSubmissions,
  setMaxSubmissions,
  deadlineEnabled,
  setDeadlineEnabled,
  closesAt,
  setClosesAt,
  allowlistRaw,
  setAllowlistRaw,
  allowlistCount,
  tokenType,
  setTokenType,
  tokenAmount,
  setTokenAmount,
  feeSui,
  setFeeSui,
}: {
  access: PublishAccess;
  setAccess: (v: PublishAccess) => void;
  limitEnabled: boolean;
  setLimitEnabled: (v: boolean) => void;
  maxSubmissions: string;
  setMaxSubmissions: (v: string) => void;
  deadlineEnabled: boolean;
  setDeadlineEnabled: (v: boolean) => void;
  closesAt: string;
  setClosesAt: (v: string) => void;
  allowlistRaw: string;
  setAllowlistRaw: (v: string) => void;
  allowlistCount: number;
  tokenType: string;
  setTokenType: (v: string) => void;
  tokenAmount: string;
  setTokenAmount: (v: string) => void;
  feeSui: string;
  setFeeSui: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Access</Label>
        <div className="grid grid-cols-2 gap-2">
          <AccessTile
            icon={<Globe className="h-4 w-4" />}
            title="Public"
            subtitle="Anyone with the link can submit"
            active={access === 'public'}
            onClick={() => setAccess('public')}
          />
          <AccessTile
            icon={<Lock className="h-4 w-4" />}
            title="Private"
            subtitle="Allowlist-gated submit"
            active={access === 'private'}
            onClick={() => setAccess('private')}
          />
          <AccessTile
            icon={<Coins className="h-4 w-4" />}
            title="Token-gated"
            subtitle="Holders of Coin<T> only"
            active={access === 'token'}
            onClick={() => setAccess('token')}
          />
          <AccessTile
            icon={<Wallet className="h-4 w-4" />}
            title="Paid"
            subtitle="Charge per submission"
            active={access === 'paid'}
            onClick={() => setAccess('paid')}
          />
        </div>
      </div>

      {access === 'private' && (
        <div className="flex flex-col gap-1.5">
          <Label>Allowlist</Label>
          <Textarea
            value={allowlistRaw}
            onChange={(e) => setAllowlistRaw(e.target.value)}
            placeholder={'Paste addresses in any format — separated by commas, spaces, or new lines.\n0xabc…\n0xdef…'}
            rows={4}
            className="font-mono text-xs"
          />
          <span className="text-muted-foreground text-xs">
            {allowlistCount} {allowlistCount === 1 ? 'address' : 'addresses'} · separators:
            commas, spaces, or new lines (quotes/brackets stripped)
          </span>
        </div>
      )}

      {access === 'token' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="token-type">Coin type</Label>
            <Input
              id="token-type"
              value={tokenType}
              onChange={(e) => setTokenType(e.target.value)}
              placeholder="0x2::sui::SUI"
              className="font-mono text-xs"
            />
            <span className="text-muted-foreground text-xs">
              Full type tag of the gating coin. Defaults to SUI.
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="token-amount">Minimum balance (whole units)</Label>
            <Input
              id="token-amount"
              type="number"
              min={0}
              step={1}
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
              placeholder="1"
            />
            <span className="text-muted-foreground text-xs">
              Whole units. Token-gating is enforced client-side pre-submit (the contract trusts the
              wallet check) — fine for v1 hackathon scope.
            </span>
          </div>
        </div>
      )}

      {access === 'paid' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fee-sui">Submission fee (SUI)</Label>
          <Input
            id="fee-sui"
            type="number"
            min={0}
            step={0.01}
            value={feeSui}
            onChange={(e) => setFeeSui(e.target.value)}
            placeholder="0.1"
          />
          <span className="text-muted-foreground text-xs">
            Each submitter pays this fee into the form&apos;s on-chain treasury. You can withdraw
            via the My Forms card after responses come in.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="limit-toggle" className="cursor-pointer">
              Limit submissions
            </Label>
            <Switch id="limit-toggle" checked={limitEnabled} onCheckedChange={setLimitEnabled} />
          </div>
          {limitEnabled ? (
            <Input
              id="max-submissions"
              type="number"
              min={1}
              value={maxSubmissions}
              onChange={(e) => setMaxSubmissions(e.target.value)}
              placeholder="100"
            />
          ) : (
            <p className="text-muted-foreground text-xs">
              Off — accepts unlimited submissions until you close the form.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="deadline-toggle" className="cursor-pointer">
              Set a deadline
            </Label>
            <Switch
              id="deadline-toggle"
              checked={deadlineEnabled}
              onCheckedChange={setDeadlineEnabled}
            />
          </div>
          {deadlineEnabled ? (
            <Input
              id="closes-at"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          ) : (
            <p className="text-muted-foreground text-xs">
              Off — form stays open indefinitely until you close it manually.
            </p>
          )}
        </div>
      </div>

      {access === 'private' && (
        <p className="text-muted-foreground text-xs">
          Schema encryption (via Seal) lands when the contracts ship the v2 policy; for now, private
          forms gate submissions but keep the schema readable on-chain.
        </p>
      )}
    </div>
  );
}

function CostEstimateRow({
  bytes,
  cost,
  isLoading,
  error,
}: {
  bytes: number;
  cost: { storageCost: bigint; writeCost: bigint; totalCost: bigint } | null;
  isLoading: boolean;
  error: Error | null;
}) {
  const sizeKb = (bytes / 1024).toFixed(1);
  return (
    <div className="bg-muted/40 flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs">
      <ImageIcon className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-medium">Cover image · {sizeKb} KB → Walrus</span>
          {isLoading ? (
            <span className="text-muted-foreground">estimating cost…</span>
          ) : error ? (
            <span className="text-destructive">cost unavailable</span>
          ) : cost ? (
            <span className="font-mono">
              {formatWal(cost.totalCost)} WAL
              <span className="text-muted-foreground"> (15 epochs · ~3 months)</span>
            </span>
          ) : null}
        </div>
        <span className="text-muted-foreground">
          Uploaded to Walrus before the on-chain publish — the schema only stores the aggregator
          URL. WAL is paid by the platform admin keypair.
        </span>
        {cost && (
          <span className="text-muted-foreground/80 font-mono">
            storage {formatWal(cost.storageCost)} WAL · write {formatWal(cost.writeCost)} WAL
          </span>
        )}
      </div>
    </div>
  );
}

function parseBigIntSafe(s: string): bigint {
  const trimmed = s.trim();
  if (!trimmed) return 0n;
  try {
    return BigInt(trimmed);
  } catch {
    return 0n;
  }
}

function parseSuiToMist(s: string): bigint {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return 0n;
  // 1 SUI = 1e9 MIST. Round to integer to avoid float drift.
  return BigInt(Math.round(n * 1_000_000_000));
}

function AccessTile({
  icon,
  title,
  subtitle,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition-colors',
        active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <span className="text-muted-foreground text-xs">{subtitle}</span>
    </button>
  );
}

function MarketplaceFields({
  title,
  setTitle,
  description,
  setDescription,
  category,
  setCategory,
  tagsRaw,
  setTagsRaw,
  pricing,
  setPricing,
  priceSui,
  setPriceSui,
}: {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  category: number;
  setCategory: (v: number) => void;
  tagsRaw: string;
  setTagsRaw: (v: string) => void;
  pricing: MarketplacePricing;
  setPricing: (v: MarketplacePricing) => void;
  priceSui: string;
  setPriceSui: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tpl-title">Template title</Label>
        <Input
          id="tpl-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Hackathon feedback v2"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tpl-desc">Description</Label>
        <Textarea
          id="tpl-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What this template is useful for…"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-category">Category</Label>
          <select
            id="tpl-category"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(Number(e.target.value))}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-tags">Tags (comma-separated)</Label>
          <Input
            id="tpl-tags"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="feedback, event, short"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Pricing</Label>
        <div className="grid grid-cols-2 gap-2">
          <AccessTile
            icon={<Globe className="h-4 w-4" />}
            title="Free"
            subtitle="Anyone can clone"
            active={pricing === 'free'}
            onClick={() => setPricing('free')}
          />
          <AccessTile
            icon={<Store className="h-4 w-4" />}
            title="Paid"
            subtitle="Kiosk listing + 10% royalty"
            active={pricing === 'paid'}
            onClick={() => setPricing('paid')}
          />
        </div>
        {pricing === 'paid' && (
          <div className="mt-2 flex flex-col gap-1.5">
            <Label htmlFor="tpl-price">Price (SUI)</Label>
            <Input
              id="tpl-price"
              type="number"
              min={0}
              step={0.1}
              value={priceSui}
              onChange={(e) => setPriceSui(e.target.value)}
            />
            <span className="text-muted-foreground text-xs">
              Buyers pay price + 10% royalty to the WalForm platform treasury.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
