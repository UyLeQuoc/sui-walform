import type { FieldType } from '../../types';

/**
 * Per-field-type config that drives the field-properties panel. Keeping
 * these flags in one table beats sprinkling type comparisons across the
 * panel JSX, and makes it easy to audit what each input shows.
 *
 *   - isLayout: heading / description / markdown / divider / space.
 *               These render via dedicated layout sub-panels, not the
 *               common label / placeholder / help-text fields.
 *   - showPlaceholder / showDefaultText: which CommonFields rows to render.
 *   - placeholderHint: the example placeholder shown beside the input.
 */
export interface FieldSettingsConfig {
  isLayout: boolean;
  showPlaceholder: boolean;
  showDefaultText: boolean;
  placeholderHint?: string;
}

const LAYOUT_TYPES = new Set<FieldType>(['heading', 'description', 'markdown', 'divider', 'space']);

const TEXT_LIKE_TYPES = new Set<FieldType>(['short_text', 'long_text', 'email', 'url', 'number']);

const NO_PLACEHOLDER_TYPES = new Set<FieldType>(['rating', 'yes_no', 'code']);

const PLACEHOLDER_HINTS: Partial<Record<FieldType, string>> = {
  email: 'e.g. your@email.com',
  url: 'e.g. https://example.com',
  phone: 'e.g. +1 (555) 000-0000',
  time: 'e.g. 09:00',
};

export function getFieldSettingsConfig(type: FieldType): FieldSettingsConfig {
  const isLayout = LAYOUT_TYPES.has(type);
  return {
    isLayout,
    showPlaceholder: !isLayout && !NO_PLACEHOLDER_TYPES.has(type),
    showDefaultText: TEXT_LIKE_TYPES.has(type),
    placeholderHint: PLACEHOLDER_HINTS[type],
  };
}
