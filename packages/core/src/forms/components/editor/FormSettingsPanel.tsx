'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, FileText, ListOrdered, Move, Trash2, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../ui/alert-dialog';
import { Button } from '../../../ui/button';
import { Field, FieldGroup, FieldLabel } from '../../../ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { Slider } from '../../../ui/slider';
import { Switch } from '../../../ui/switch';
import { DEFAULT_NAVIGATION } from '../../lib/pages';
import type { NavigationSettings } from '../../../types';
import { FORM_FONTS, getFormFont, groupFontsByCategory } from '../../lib/form-fonts';
import {
  BORDER_RADIUS_LABELS,
  BORDER_RADIUS_VALUES,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_FORM_COLOR_KEY,
  FORM_COLORS,
} from '../../lib/form-appearance';
import { formDb } from '../../services/form-db';
import { useFormBuilderStore } from '../../store/form-builder-store';
import { cn } from '../../../lib/utils';
import type { FormFont } from '../../lib/form-fonts';
import type { FormSchema } from '../../../types';

type DisplayMode = NonNullable<FormSchema['settings']['displayMode']>;

interface DisplayModeDef {
  key: DisplayMode;
  label: string;
  icon: LucideIcon;
  hint: string;
}

const DISPLAY_MODES: readonly DisplayModeDef[] = [
  { key: 'card', label: 'Card', icon: CreditCard, hint: 'Bordered surface' },
  { key: 'page', label: 'Page', icon: FileText, hint: 'Full-bleed, no chrome' },
];

const FONT_CATEGORIES: readonly FormFont['category'][] = ['Sans', 'Serif', 'Display', 'Mono'];

const FONT_GROUPS_PRECOMPUTED = groupFontsByCategory(FORM_FONTS);

/**
 * Plain-content form settings. Rendered inline in the right sidebar —
 * used to live inside a Sheet; the Sheet chrome is now owned by
 * `RightSidebar`.
 */
export function FormSettingsPanel() {
  const router = useRouter();
  const schema = useFormBuilderStore((s) => s.schema);
  const updateSettings = useFormBuilderStore((s) => s.updateSettings);
  const { settings } = schema;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const formTitle = schema.title || 'Untitled Form';

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await formDb.delete(schema.id);
      toast.success('Form deleted');
      router.push('/forms');
    } catch (err) {
      setIsDeleting(false);
      toast.error(err instanceof Error ? err.message : 'Failed to delete form');
    }
  }, [router, schema.id]);

  const activeFont = useMemo(() => getFormFont(settings.fontFamily), [settings.fontFamily]);

  const borderRadius = settings.borderRadius ?? DEFAULT_BORDER_RADIUS;
  const primaryColor = settings.primaryColor ?? DEFAULT_FORM_COLOR_KEY;
  const radiusLabel = BORDER_RADIUS_LABELS[borderRadius] ?? 'LG';
  const radiusValue = BORDER_RADIUS_VALUES[borderRadius] ?? '0.625rem';
  const displayMode = settings.displayMode ?? 'card';

  const handleDisplayModeSelect = useCallback(
    (key: DisplayMode) => updateSettings({ displayMode: key }),
    [updateSettings],
  );

  const handleFontChange = useCallback(
    (value: string) => updateSettings({ fontFamily: value }),
    [updateSettings],
  );

  const handleRadiusChange = useCallback(
    ([value]: number[]) => updateSettings({ borderRadius: value }),
    [updateSettings],
  );

  const handleColorSelect = useCallback(
    (key: string) => updateSettings({ primaryColor: key }),
    [updateSettings],
  );

  const navigation = useMemo<NavigationSettings>(
    () => ({ ...DEFAULT_NAVIGATION, ...(settings.navigation ?? {}) }),
    [settings.navigation],
  );
  const handleNavMode = useCallback(
    (mode: NavigationSettings['mode']) =>
      updateSettings({ navigation: { ...navigation, mode } }),
    [navigation, updateSettings],
  );
  const handleAllowBack = useCallback(
    (allowBack: boolean) =>
      updateSettings({ navigation: { ...navigation, allowBack } }),
    [navigation, updateSettings],
  );
  const handleShowProgress = useCallback(
    (showProgress: boolean) =>
      updateSettings({ navigation: { ...navigation, showProgress } }),
    [navigation, updateSettings],
  );
  const pageCount = schema.pages?.length ?? 0;

  const radiusBadgeStyle = useMemo<React.CSSProperties>(
    () => ({
      borderRadius: radiusValue,
      border: '1.5px solid currentColor',
      padding: '1px 6px',
    }),
    [radiusValue],
  );

  const radiusSliderValue = useMemo(() => [borderRadius], [borderRadius]);

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Display as</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {DISPLAY_MODES.map((mode) => (
            <DisplayModeButton
              key={mode.key}
              mode={mode}
              active={displayMode === mode.key}
              onSelect={handleDisplayModeSelect}
            />
          ))}
        </div>
      </Field>

      <Field>
        <FieldLabel htmlFor="form-font">Font family</FieldLabel>
        <Select value={settings.fontFamily} onValueChange={handleFontChange}>
          <SelectTrigger
            id="form-font"
            className="w-full"
            style={{ fontFamily: activeFont.fontFamily }}
          >
            <SelectValue placeholder="Choose a font" />
          </SelectTrigger>
          <SelectContent>
            {FONT_CATEGORIES.map((category) => {
              const fonts = FONT_GROUPS_PRECOMPUTED[category];
              if (fonts.length === 0) return null;
              return (
                <SelectGroup key={category}>
                  <SelectLabel>{category}</SelectLabel>
                  {fonts.map((font) => (
                    <SelectItem
                      key={font.key}
                      value={font.key}
                      style={{ fontFamily: font.fontFamily }}
                    >
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <div className="mb-2 flex items-center justify-between">
          <FieldLabel>Border radius</FieldLabel>
          <span className="text-muted-foreground font-mono text-xs" style={radiusBadgeStyle}>
            {radiusLabel}
          </span>
        </div>
        <Slider
          min={0}
          max={4}
          step={1}
          value={radiusSliderValue}
          onValueChange={handleRadiusChange}
          className="bg-secondary h-1.5 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        />
        <div className="text-muted-foreground mt-1.5 flex text-xs">
          {BORDER_RADIUS_LABELS.map((label, i) => (
            <span
              key={label}
              className={cn(
                'flex-1',
                i === 0
                  ? 'text-left'
                  : i === BORDER_RADIUS_LABELS.length - 1
                    ? 'text-right'
                    : 'text-center',
              )}
            >
              {label}
            </span>
          ))}
        </div>
      </Field>

      <Field>
        <FieldLabel>Primary color</FieldLabel>
        <div className="mt-1 flex flex-wrap gap-2">
          {FORM_COLORS.map((color) => (
            <ColorSwatch
              key={color.key}
              colorKey={color.key}
              label={color.label}
              hex={color.hex}
              isSelected={primaryColor === color.key}
              onSelect={handleColorSelect}
            />
          ))}
        </div>
      </Field>

      <Field>
        <FieldLabel className="flex items-center gap-1.5">
          <ListOrdered className="h-3.5 w-3.5" />
          Page navigation
          {pageCount > 1 && (
            <span className="text-muted-foreground ml-auto text-[11px]">{pageCount} pages</span>
          )}
        </FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <NavModeButton
            mode="sequential"
            active={navigation.mode === 'sequential'}
            onSelect={handleNavMode}
            label="Sequential"
            hint="Validate before Next"
            icon={ListOrdered}
          />
          <NavModeButton
            mode="free"
            active={navigation.mode === 'free'}
            onSelect={handleNavMode}
            label="Free"
            hint="Jump anywhere"
            icon={Move}
          />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>Allow Previous button</span>
            <Switch
              aria-label="Allow Previous button"
              checked={navigation.allowBack}
              onCheckedChange={handleAllowBack}
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>Show progress bar</span>
            <Switch
              aria-label="Show progress bar"
              checked={navigation.showProgress}
              onCheckedChange={handleShowProgress}
            />
          </div>
        </div>
        {pageCount <= 1 && (
          <p className="text-muted-foreground/80 mt-2 text-[11px]">
            Add a page break in the canvas to split this form into multiple pages.
          </p>
        )}
      </Field>

      <Field>
        <FieldLabel>Danger zone</FieldLabel>
        <Button
          type="button"
          variant="outline"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/40 w-full justify-start"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete form
        </Button>
      </Field>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete form?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{formTitle}&rdquo; will be permanently deleted from this device. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FieldGroup>
  );
}

interface NavModeButtonProps {
  mode: NavigationSettings['mode'];
  active: boolean;
  onSelect: (mode: NavigationSettings['mode']) => void;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const NavModeButton = memo(function NavModeButton({
  mode,
  active,
  onSelect,
  label,
  hint,
  icon: Icon,
}: NavModeButtonProps) {
  const handleClick = useCallback(() => onSelect(mode), [onSelect, mode]);
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      className={cn(
        'group flex flex-col items-start gap-0.5 rounded-md border p-2.5 text-left transition-colors',
        active ? 'border-primary/60 bg-primary/5' : 'border-border hover:bg-accent/60',
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-muted-foreground')} />
        {label}
      </span>
      <span className="text-muted-foreground text-[11px]">{hint}</span>
    </button>
  );
});

interface DisplayModeButtonProps {
  mode: DisplayModeDef;
  active: boolean;
  onSelect: (key: DisplayMode) => void;
}

const DisplayModeButton = memo(function DisplayModeButton({
  mode,
  active,
  onSelect,
}: DisplayModeButtonProps) {
  const { key, label, icon: Icon, hint } = mode;
  const handleClick = useCallback(() => onSelect(key), [onSelect, key]);
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      className={cn(
        'group flex flex-col items-start gap-0.5 rounded-md border p-2.5 text-left transition-colors',
        active ? 'border-primary/60 bg-primary/5' : 'border-border hover:bg-accent/60',
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-muted-foreground')} />
        {label}
      </span>
      <span className="text-muted-foreground text-[11px]">{hint}</span>
    </button>
  );
});

interface ColorSwatchProps {
  colorKey: string;
  label: string;
  hex: string;
  isSelected: boolean;
  onSelect: (key: string) => void;
}

const ColorSwatch = memo(function ColorSwatch({
  colorKey,
  label,
  hex,
  isSelected,
  onSelect,
}: ColorSwatchProps) {
  // "Default" uses the app's live CSS token so it tracks whatever
  // globals.css defines; named colors render their own hex.
  const swatch = colorKey === 'default' ? 'var(--primary)' : hex;
  const needsBorder = colorKey === 'white';
  const handleClick = useCallback(() => onSelect(colorKey), [onSelect, colorKey]);
  const style = useMemo<React.CSSProperties>(
    () => ({
      backgroundColor: swatch,
      boxShadow: isSelected ? `0 0 0 2px var(--background), 0 0 0 4px ${swatch}` : undefined,
    }),
    [swatch, isSelected],
  );

  return (
    <button
      type="button"
      title={label}
      onClick={handleClick}
      className={cn(
        'size-7 rounded-full transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        needsBorder && 'border-border border',
      )}
      style={style}
      aria-label={label}
      aria-pressed={isSelected}
    />
  );
});
