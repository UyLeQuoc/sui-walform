'use client';

import { Badge } from '../../../ui/badge';
import type { MarketplaceTemplate } from '../../hooks/use-marketplace-templates';

interface StatusBadgeProps {
  status: MarketplaceTemplate['status'];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 'free') return <Badge>Free</Badge>;
  if (status === 'paid') return <Badge variant="secondary">For sale</Badge>;
  if (status === 'kiosk') return <Badge variant="secondary">1-of-1</Badge>;
  if (status === 'owned') return <Badge variant="outline">Not listed</Badge>;
  return <Badge variant="outline">Unknown</Badge>;
}
