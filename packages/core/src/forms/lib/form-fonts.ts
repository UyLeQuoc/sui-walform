/**
 * Curated list of fonts the form author can pick from for the whole form.
 *
 * Each font is loaded as a CSS variable via `@fontsource-variable/*` imports
 * in `ui/fonts.ts` and referenced here by that variable name. The selected
 * font is stored in `FormSettings.fontFamily` by key.
 */

export interface FormFont {
  /** Stable key persisted in the form schema. */
  key: string;
  /** User-facing label shown in the settings select. */
  label: string;
  /**
   * CSS font-family value to apply at the form root.
   * Uses the CSS variable set up by `next/font` with a sensible fallback.
   */
  fontFamily: string;
  /** Short category tag shown next to the label. */
  category: 'Sans' | 'Serif' | 'Mono' | 'Display';
}

export const FORM_FONTS: FormFont[] = [
  {
    key: 'inter',
    label: 'Inter',
    fontFamily: 'var(--font-sans), system-ui, sans-serif',
    category: 'Sans',
  },
  {
    key: 'geist',
    label: 'Geist',
    fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
    category: 'Sans',
  },
  {
    key: 'roboto',
    label: 'Roboto',
    fontFamily: 'var(--font-form-roboto), system-ui, sans-serif',
    category: 'Sans',
  },
  {
    key: 'space-grotesk',
    label: 'Space Grotesk',
    fontFamily: 'var(--font-form-space-grotesk), system-ui, sans-serif',
    category: 'Sans',
  },
  {
    key: 'lora',
    label: 'Lora',
    fontFamily: 'var(--font-form-lora), Georgia, serif',
    category: 'Serif',
  },
  {
    key: 'merriweather',
    label: 'Merriweather',
    fontFamily: 'var(--font-form-merriweather), Georgia, serif',
    category: 'Serif',
  },
  {
    key: 'playfair',
    label: 'Playfair Display',
    fontFamily: 'var(--font-form-playfair), Georgia, serif',
    category: 'Display',
  },
  {
    key: 'jetbrains-mono',
    label: 'JetBrains Mono',
    fontFamily: 'var(--font-form-jetbrains-mono), ui-monospace, monospace',
    category: 'Mono',
  },
];

export const DEFAULT_FORM_FONT_KEY = 'inter';

export function getFormFont(key: string | undefined): FormFont {
  return (
    FORM_FONTS.find((f) => f.key === key) ??
    FORM_FONTS.find((f) => f.key === DEFAULT_FORM_FONT_KEY)!
  );
}

/**
 * Buckets fonts by category for grouped rendering in the settings
 * select. Returned shape always contains all four category keys, even
 * when empty, so consumers can iterate `Object.entries` safely.
 */
export function groupFontsByCategory(fonts: FormFont[]): Record<FormFont['category'], FormFont[]> {
  const groups: Record<FormFont['category'], FormFont[]> = {
    Sans: [],
    Serif: [],
    Display: [],
    Mono: [],
  };
  for (const font of fonts) groups[font.category].push(font);
  return groups;
}
