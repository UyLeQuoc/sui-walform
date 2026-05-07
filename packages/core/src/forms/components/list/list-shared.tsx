'use client';

import { type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '../../../ui/button';
import { suivisionUrl, type ExplorerNetwork } from '../../../sui/explorer';
import { shortAddr } from '../../lib/format-address';

/** Three-card placeholder used for both Drafts and on-chain forms while loading. */
export function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-muted h-32 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="bg-muted rounded-full p-4">{icon}</div>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="py-12 text-center">
      <p className="text-destructive text-sm">Failed to load: {message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

interface ExplorerLinkProps {
  network: string;
  kind: 'object' | 'txblock';
  id: string;
  label: string;
}

const SUPPORTED_NETWORKS: ExplorerNetwork[] = ['testnet', 'mainnet', 'devnet'];

function normalizeNetwork(network: string): ExplorerNetwork {
  return SUPPORTED_NETWORKS.includes(network as ExplorerNetwork)
    ? (network as ExplorerNetwork)
    : 'testnet';
}

export function ExplorerLink({ network, kind, id, label }: ExplorerLinkProps) {
  return (
    <a
      href={suivisionUrl(normalizeNetwork(network), kind, id)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
      title={id}
    >
      <span className="font-medium">{label}:</span>
      <code className="font-mono">{shortAddr(id)}</code>
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
