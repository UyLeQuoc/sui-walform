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

export interface NavigationSettings {
  /**
   * `sequential` (default): respondents must satisfy the current page's
   * visible required fields before "Next" advances. `free`: navigation
   * is always available; validation only runs on final submit.
   */
  mode: 'sequential' | 'free';
  /** When false, the Previous button is hidden — respondents can't revisit. */
  allowBack: boolean;
  /** Renders a horizontal progress bar above the form. */
  showProgress: boolean;
}

export interface FormSettings {
  submitLabel: string;
  /** Label for the Next button shown on multi-page forms. Defaults to "Next". */
  nextLabel?: string;
  /** Label for the Previous button shown on multi-page forms. Defaults to "Previous". */
  previousLabel?: string;
  successMessage: string;
  /**
   * Alignment of the form's action buttons row. `center` makes the buttons
   * span the full row (Submit goes `w-full`; Previous + Next split 50/50).
   * `left`/`right` keep their natural width and align to that edge.
   */
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
  /**
   * Multi-page navigation behavior. Absent → defaults to
   * `{ mode: 'sequential', allowBack: true, showProgress: true }`.
   * Only consulted by renderers when `schema.pages.length > 1`.
   */
  navigation?: NavigationSettings;
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
  /**
   * Provenance: set when this draft was materialised from a marketplace
   * template (`useCloneTemplateToDraft`). Drives the editor banner + Drafts
   * tab pill. Never sent on-chain — purely IDB metadata.
   *
   * - `purchaseDigest` is present iff the user paid (paid template);
   *   absent for free clones.
   * - Cleared when the user dismisses the banner.
   */
  sourceTemplate?: {
    templateId: string;
    originalTitle: string;
    originalCreator: string;
    purchaseDigest?: string;
    purchasedAtMs?: number;
  };
  /**
   * Realtime-collab sharing state. Set when the owner first enables sharing:
   * `shareToken` is the invite-link capability (the PartyKit room gates on it,
   * TOFU). Stored so re-opening the Share panel reproduces the same link.
   * Absent on drafts that were never shared (those never touch the network).
   */
  collab?: {
    shareToken: string;
    sharedAt: number;
  };
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

/**
 * A logical page of the form — groups a subset of `schema.fields` for
 * rendering. Pages are an optional layer on top of the flat field array:
 * if `schema.pages` is missing or empty, the renderer treats the whole
 * form as a single implicit page. When present, every field in
 * `schema.fields` MUST appear in exactly one page's `fieldIds`.
 */
export interface FormPage {
  id: string;
  title?: string;
  description?: string;
  fieldIds: string[];
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
  /**
   * Optional page partition. Absent (or empty) means "single implicit page".
   * Every field id in `fields` should appear in exactly one page's `fieldIds`
   * when this is populated. `normalizeSchema()` reconciles drift.
   */
  pages?: FormPage[];
}

/**
 * Rich attachment payload stored as a FileField submission value. Replaces
 * the legacy URL-only string so the viewer can show filename + size + type
 * without hitting the network for a HEAD probe. Legacy string values still
 * decode for back-compat — viewers should accept `string | FileAttachmentValue`.
 */
export interface FileAttachmentValue {
  /** Walrus aggregator URL of the blob. */
  url: string;
  /** Original filename from the picker (e.g. "demo.mp4"). */
  name: string;
  /** Byte size, captured at upload time. */
  size: number;
  /** MIME content-type from the File object (e.g. "video/mp4"). May be empty. */
  type: string;
}

// ── Realtime collaboration (presence) ──

export type CollabSessionStatus = 'idle' | 'connecting' | 'synced';

export interface PresenceUser {
  address: string;
  color: string;
  name?: string;
}

/** Pointer position as a fraction (0–1) of the form card, so cursors align
 *  across viewers whose cards differ in size. */
export interface PresenceCursor {
  x: number;
  y: number;
}

/** Local Awareness state broadcast by this client (never persisted). */
export interface CollabLocalState {
  user: PresenceUser;
  selectedFieldId: string | null;
  activePageId: string | null;
  cursor: PresenceCursor | null;
}

/** A remote collaborator derived from Awareness. */
export interface PresencePeer {
  clientId: number;
  user: PresenceUser;
  selectedFieldId: string | null;
  cursor: PresenceCursor | null;
}
