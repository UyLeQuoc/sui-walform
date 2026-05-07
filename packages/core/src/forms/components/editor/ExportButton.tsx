'use client';

import { ChevronDown, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import { generateTsTypes } from '../../lib/schema-gen/ts';
import { useFormBuilderStore } from '../../store/form-builder-store';

export function ExportButton() {
  const schema = useFormBuilderStore((s) => s.schema);
  const json = JSON.stringify(schema, null, 2);

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(json);
    toast.success('JSON copied to clipboard');
  };

  const handleDownloadJson = () => {
    const slug = schema.title.toLowerCase().replace(/\s+/g, '-') || 'form';
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTypes = async () => {
    const types = generateTsTypes(schema.fields);
    await navigator.clipboard.writeText(types);
    toast.success('TypeScript types copied to clipboard');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          Export
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-fit">
        <DropdownMenuItem onClick={handleCopyJson}>
          <Copy className="mr-2 h-4 w-4" />
          Copy JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadJson}>
          <Download className="mr-2 h-4 w-4" />
          Download JSON
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyTypes}>
          <Copy className="mr-2 h-4 w-4" />
          Copy TypeScript types
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
