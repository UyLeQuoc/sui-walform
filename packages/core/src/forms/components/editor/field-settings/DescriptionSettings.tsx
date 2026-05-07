'use client';

import type { FormField } from '../../../../types';
import { TextAlignToggle } from './TextAlignToggle';

interface DescriptionSettingsProps {
  field: FormField;
}

/**
 * The description block is edited inline on the canvas, so the settings
 * sheet only exposes non-text options (currently just text alignment).
 */
export function DescriptionSettings({ field }: DescriptionSettingsProps) {
  return <TextAlignToggle field={field} />;
}
