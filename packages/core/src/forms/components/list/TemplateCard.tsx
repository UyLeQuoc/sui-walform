'use client';

import { useSuiClientContext } from '@mysten/dapp-kit';
import { Badge } from '../../../ui/badge';
import { Card, CardContent } from '../../../ui/card';
import type { OnChainTemplate } from '../../hooks/use-on-chain-forms';
import { ExplorerLink } from './list-shared';

interface TemplateCardProps {
  template: OnChainTemplate;
}

export function TemplateCard({ template }: TemplateCardProps) {
  const { network } = useSuiClientContext();
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 min-w-0 flex-1 truncate text-sm font-semibold">
            {template.title}
          </h3>
          <Badge variant="secondary">Template</Badge>
        </div>
        {template.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{template.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{template.cloneCount} clones</Badge>
          {template.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline">
              #{tag}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <ExplorerLink network={network} kind="object" id={template.templateId} label="Template" />
        </div>
      </CardContent>
    </Card>
  );
}
