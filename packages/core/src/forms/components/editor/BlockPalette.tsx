'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/popover';
import { useFormBuilderStore } from '../../store/form-builder-store';
import type { FieldType } from '../../../types';
import { FieldPaletteContent } from './FieldPaletteContent';

export function BlockPalette() {
  const addField = useFormBuilderStore((s) => s.addField);
  const [open, setOpen] = useState(false);

  const handleSelect = (type: FieldType) => {
    addField(type);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="text-muted-foreground hover:text-foreground w-full gap-2"
        >
          <Plus className="h-4 w-4" />
          Add field
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <FieldPaletteContent onSelect={handleSelect} />
      </PopoverContent>
    </Popover>
  );
}
