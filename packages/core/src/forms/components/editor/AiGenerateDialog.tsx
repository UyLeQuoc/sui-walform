'use client';

import { useState } from 'react';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
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
import { DEFAULT_AI_MODEL, generateFormFromPrompt } from '../../lib/ai-generate';
import { useFormBuilderStore } from '../../store/form-builder-store';
import { getOpenRouterKey, setOpenRouterKey } from '../../services/ai-key-store';

interface AiGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXAMPLE_PROMPTS = [
  'Customer NPS survey for a SaaS product',
  'Hackathon team sign-up form',
  'Wedding RSVP with dietary preferences',
  'Job application — frontend engineer',
];

export function AiGenerateDialog({ open, onOpenChange }: AiGenerateDialogProps) {
  const replaceSchema = useFormBuilderStore((s) => s.replaceSchema);

  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKeyLocal] = useState(() => getOpenRouterKey() ?? '');
  const [showKey, setShowKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Describe the form you want to generate.');
      return;
    }
    if (!apiKey.trim()) {
      toast.error('Paste an OpenRouter API key.');
      return;
    }
    // Persist the key on first successful submit attempt — no need to
    // wait for completion; user explicitly clicked Generate so they
    // intend to keep it.
    setOpenRouterKey(apiKey);

    setIsGenerating(true);
    try {
      const generated = await generateFormFromPrompt({ prompt, apiKey });
      replaceSchema(
        {
          title: generated.title,
          description: generated.description,
          fields: generated.fields,
        },
        `Generated: ${truncate(prompt, 40)}`,
      );
      toast.success(`Generated ${generated.fields.length} fields`);
      onOpenChange(false);
      setPrompt('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AiGenerate] failed:', err);
      toast.error(`Generation failed: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Generate form with AI
          </DialogTitle>
          <DialogDescription>
            Describe the form you want. We&apos;ll replace the current draft&apos;s fields, title,
            and description. Theme + settings stay untouched.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-prompt">What should the form collect?</Label>
            <Textarea
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. customer feedback for a SaaS product, NPS rating + open comment + email."
              rows={4}
              disabled={isGenerating}
            />
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrompt(p)}
                  disabled={isGenerating}
                  className="border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-key">OpenRouter API key</Label>
            <div className="flex gap-1.5">
              <Input
                id="ai-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKeyLocal(e.target.value)}
                placeholder="sk-or-v1-…"
                className="font-mono text-xs"
                disabled={isGenerating}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowKey((v) => !v)}
                disabled={isGenerating}
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <span className="text-muted-foreground text-xs">
              Stored in your browser only. Get a free key at{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                openrouter.ai/keys
              </a>
              . Free model: <code className="font-mono">{DEFAULT_AI_MODEL}</code>.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={() => void handleGenerate()} disabled={isGenerating}>
            {isGenerating ? (
              <Spinner className="mr-1.5 size-3.5" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isGenerating ? 'Generating…' : 'Generate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1).trim()}…`;
}
