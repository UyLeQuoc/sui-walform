export interface FormColor {
  key: string;
  label: string;
  hex: string;
  primary: string | null;
  primaryForeground: string;
  ring: string;
}

export const FORM_COLORS: FormColor[] = [
  {
    // "Default" intentionally has no `primary` override — it passes through
    // whatever `--primary` the app's globals.css currently defines. Swatch
    // rendering should read the CSS variable (`var(--primary)`), not this
    // `hex` field, which is only a fallback for consumers that need a raw
    // color string (dashboard tiles, form list cards, etc.).
    key: 'default',
    label: 'Default',
    hex: 'var(--primary)',
    primary: null,
    primaryForeground: '',
    ring: '',
  },
  {
    key: 'violet',
    label: 'Violet',
    hex: '#7c3aed',
    primary: 'oklch(0.491 0.274 277.0)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.491 0.274 277.0)',
  },
  {
    key: 'blue',
    label: 'Blue',
    hex: '#2563eb',
    primary: 'oklch(0.546 0.243 264.4)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.546 0.243 264.4)',
  },
  {
    key: 'cyan',
    label: 'Cyan',
    hex: '#0891b2',
    primary: 'oklch(0.584 0.154 207.5)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.584 0.154 207.5)',
  },
  {
    key: 'green',
    label: 'Green',
    hex: '#16a34a',
    primary: 'oklch(0.543 0.169 143.2)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.543 0.169 143.2)',
  },
  {
    key: 'orange',
    label: 'Orange',
    hex: '#ea580c',
    primary: 'oklch(0.650 0.213 38.5)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.650 0.213 38.5)',
  },
  {
    key: 'red',
    label: 'Red',
    hex: '#dc2626',
    primary: 'oklch(0.556 0.231 28.3)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.556 0.231 28.3)',
  },
  {
    key: 'rose',
    label: 'Rose',
    hex: '#e11d48',
    primary: 'oklch(0.544 0.222 354.4)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.544 0.222 354.4)',
  },
  {
    key: 'pink',
    label: 'Pink',
    hex: '#db2777',
    primary: 'oklch(0.567 0.239 330.7)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.567 0.239 330.7)',
  },
  {
    key: 'black',
    label: 'Black',
    hex: '#09090b',
    primary: 'oklch(0.153 0.006 107.1)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.153 0.006 107.1)',
  },
  {
    key: 'white',
    label: 'White',
    hex: '#ffffff',
    primary: 'oklch(1 0 0)',
    primaryForeground: 'oklch(0.153 0.006 107.1)',
    ring: 'oklch(0.93 0.007 106.5)',
  },
];

export const DEFAULT_FORM_COLOR_KEY = 'default';

export function getFormColor(key: string): FormColor {
  return FORM_COLORS.find((c) => c.key === key) ?? FORM_COLORS[0]!;
}

export const BORDER_RADIUS_VALUES = ['0rem', '0.2rem', '0.375rem', '0.5rem', '0.625rem'] as const;

export const BORDER_RADIUS_LABELS = ['None', 'XS', 'SM', 'MD', 'LG'] as const;

export const DEFAULT_BORDER_RADIUS = 0;

export function buildFormAreaStyle(
  fontFamily: string,
  borderRadius: number,
  primaryColor: string,
): React.CSSProperties {
  const color = getFormColor(primaryColor);
  const radius = BORDER_RADIUS_VALUES[borderRadius] ?? '0.625rem';

  const style: Record<string, string> = {
    fontFamily,
    '--radius': radius,
  };

  if (color.primary) {
    style['--primary'] = color.primary;
    style['--primary-foreground'] = color.primaryForeground;
    style['--ring'] = color.ring;
  }

  return style as React.CSSProperties;
}
