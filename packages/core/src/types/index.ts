export type FieldType =
  | 'short_text'
  | 'long_text'
  | 'single_choice'
  | 'multiple_choice'
  | 'number'
  | 'date'
  | 'select'
  | 'linear_scale'
  | 'divider'
  | 'space'
  | 'email'
  | 'phone'
  | 'url'
  | 'rating'
  | 'time'
  | 'yes_no'
  | 'heading'
  | 'description'
  | 'markdown'
  | 'code'
  | 'file';

export interface FormFieldOption {
  id: string;
  label: string;
  value: string;
}

export interface FormFieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  /** Maximum number of lines (newline-separated). Used by the `code` field. */
  maxLines?: number;
  minDate?: string;
  maxDate?: string;
  scaleFrom?: number;
  scaleTo?: number;
  scaleJump?: number;
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options?: FormFieldOption[];
  variant?: 'radio' | 'select';
  validation?: FormFieldValidation;
  defaultValue?: string;
  defaultValues?: string[];
  headingLevel?: 'h1' | 'h2' | 'h3';
  /**
   * Horizontal alignment for display-only blocks (heading, description).
   * Defaults to "left".
   */
  textAlign?: 'left' | 'center' | 'right';
  /** Default country code for phone fields (e.g. "US", "VN", "GB"). */
  defaultCountry?: string;
  /** Allowed domains for URL fields. Empty/undefined means any domain is accepted. */
  allowedDomains?: string[];
  /**
   * Language key (from CODE_LANGUAGES in `src/lib/code-languages.ts`) used
   * by the `code` field for syntax highlighting.
   */
  codeLanguage?: string;
  // ── Layout block styles (heading / description / markdown) ──
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontStrikethrough?: boolean;
  /** Pixel height for `space` fields. Defaults to 32 when absent. */
  height?: number;
}

export interface FormSettings {
  submitLabel: string;
  successMessage: string;
  submitAlignment: 'left' | 'center' | 'right';
  /**
   * Key from FORM_FONTS (see `src/lib/form-fonts.ts`) controlling the font
   * applied to the entire form (edit canvas + preview).
   */
  fontFamily: string;
  /** 0–5 index into BORDER_RADIUS_VALUES (none → full). Default 4. */
  borderRadius: number;
  /** Key from FORM_COLORS (see `src/lib/form-appearance.ts`). Default "default". */
  primaryColor: string;
  /**
   * Visual surface mode. `card` renders the form as a distinct bordered
   * surface with shadow; `page` removes the chrome so the form blends with
   * the page background. Default `card`.
   */
  displayMode?: 'card' | 'page';
}

export interface HistoryEntry {
  schema: FormSchema;
  label: string;
  timestamp: number;
}

export interface StoredForm {
  id: string;
  schema: FormSchema;
  past: HistoryEntry[];
  future: HistoryEntry[];
  currentLabel: string;
  createdAt: number;
  updatedAt: number;
  /**
   * Monotonic counter incremented on every successful IDB write. Used to
   * detect cross-tab clobbers: a save fails if the on-disk record's rev
   * has moved past the rev we last loaded. Missing on records written
   * before this field was introduced — treated as 0.
   */
  rev?: number;
}

// PublishedMeta was a transitional type when drafts tracked publish state in
// IDB; now publish promotes a draft by deleting the IDB entry and reading
// on-chain state via `useOnChainForms`. Kept for the zustand transient store.
export type PublishAccessMode = 'public' | 'private';
export type PublishKind = 'on-chain' | 'marketplace';

export interface PublishedMeta {
  kind: PublishKind;
  formObjectId: string;
  formOwnerCapId: string;
  publishDigest: string;
  publishedAt: number;
  network: 'testnet' | 'mainnet' | 'devnet';
  accessMode: PublishAccessMode;
  sealedSchema: boolean;
  maxSubmissions?: number;
  closesAtMs?: number;
  allowlistObjectId?: string;
  templateId?: string;
  templatePriceMist?: number;
  kioskId?: string;
  kioskOwnerCapId?: string;
  sealNonce?: string;
}

export interface FormSchema {
  id: string;
  /**
   * Schema-shape version. Bumped whenever a breaking change is made to
   * FormField / FormSettings / FormSchema. Drafts and published forms
   * carry this so loaders can migrate (or refuse) older / unknown shapes.
   * Missing on legacy forms saved before versioning was introduced.
   */
  version?: number;
  title: string;
  description?: string;
  fields: FormField[];
  settings: FormSettings;
  /**
   * Optional cover image rendered above the form title. Stored as a data URL
   * so the whole form (including its image) round-trips through IndexedDB via
   * the normal auto-save flow. Fixed banner aspect ratio (`aspect-cover`,
   * defined in globals.css), displayed wider than the form card.
   */
  coverImage?: string;
  /**
   * Suggested tags surfaced when publishing to Marketplace. Populated by AI
   * generation; user can edit in PublishDialog. Persisted in IDB with the
   * rest of the draft.
   */
  tags?: string[];
}
