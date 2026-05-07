import type { FieldType } from '../../types';

export type FieldTypeGroup = 'Inputs' | 'Choices' | 'Date & Time' | 'Layout';

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  description: string;
  examples: string;
  group: FieldTypeGroup;
}

/**
 * The user-facing ordering of groups. Palette, slash menu, and insert menu
 * all iterate this array to stay consistent.
 */
export const FIELD_TYPE_GROUPS: FieldTypeGroup[] = ['Inputs', 'Choices', 'Date & Time', 'Layout'];

export const FIELD_TYPES: FieldTypeMeta[] = [
  // ── Inputs ──
  {
    type: 'short_text',
    label: 'Short Text',
    description: 'A single-line free text input.',
    examples: 'Full name, Job title, City',
    group: 'Inputs',
  },
  {
    type: 'long_text',
    label: 'Long Text',
    description: 'A multi-line text area for longer responses.',
    examples: 'Bio, Feedback, Cover letter',
    group: 'Inputs',
  },
  {
    type: 'email',
    label: 'Email',
    description: 'Text input that validates email format.',
    examples: 'Work email, Contact address',
    group: 'Inputs',
  },
  {
    type: 'phone',
    label: 'Phone',
    description: 'International phone number with country code picker.',
    examples: 'Mobile number, Contact phone',
    group: 'Inputs',
  },
  {
    type: 'url',
    label: 'URL',
    description: 'Text input that validates a web address.',
    examples: 'Website, Portfolio, LinkedIn',
    group: 'Inputs',
  },
  {
    type: 'number',
    label: 'Number',
    description: 'Numeric input with optional min/max range.',
    examples: 'Age, Quantity, Score, Budget',
    group: 'Inputs',
  },
  {
    type: 'code',
    label: 'Code',
    description: 'Code editor with syntax highlighting for many languages.',
    examples: 'Snippet, SQL query, Shell command',
    group: 'Inputs',
  },
  {
    type: 'file',
    label: 'File',
    description: 'Attach a file. Uploads to Walrus and stores the blob URL.',
    examples: 'Resume, screenshot, PDF',
    group: 'Inputs',
  },

  // ── Choices ──
  {
    type: 'single_choice',
    label: 'Single Choice',
    description: 'Radio buttons or a dropdown — pick exactly one.',
    examples: 'Gender, Country, Priority level',
    group: 'Choices',
  },
  {
    type: 'multiple_choice',
    label: 'Multiple Choice',
    description: 'Checkboxes — pick one or more options.',
    examples: 'Interests, Skills, Dietary needs',
    group: 'Choices',
  },
  {
    type: 'select',
    label: 'Select',
    description: 'Compact dropdown for a single selection.',
    examples: 'Department, Language, Status',
    group: 'Choices',
  },
  {
    type: 'rating',
    label: 'Rating',
    description: 'Clickable star rating (1 to N stars).',
    examples: 'Product rating, Service quality',
    group: 'Choices',
  },
  {
    type: 'yes_no',
    label: 'Yes / No',
    description: 'Simple binary toggle — yes or no.',
    examples: 'Agree to terms, Subscribe, Attending',
    group: 'Choices',
  },
  {
    type: 'linear_scale',
    label: 'Linear Scale',
    description: 'Numeric scale between a min and max value.',
    examples: 'NPS score, Satisfaction (1–10)',
    group: 'Choices',
  },

  // ── Date & Time ──
  {
    type: 'date',
    label: 'Date',
    description: 'Date picker with optional min/max range.',
    examples: 'Birthdate, Deadline, Event date',
    group: 'Date & Time',
  },
  {
    type: 'time',
    label: 'Time',
    description: 'Time-of-day picker (HH:MM).',
    examples: 'Meeting time, Opening hours',
    group: 'Date & Time',
  },

  // ── Layout ──
  {
    type: 'heading',
    label: 'Heading',
    description: 'Non-input text block to label a section.',
    examples: 'Section title, Instructions',
    group: 'Layout',
  },
  {
    type: 'description',
    label: 'Description',
    description: 'Helper paragraph to explain a section or the next question.',
    examples: 'Section intro, Extra instructions',
    group: 'Layout',
  },
  {
    type: 'markdown',
    label: 'Markdown',
    description: 'Rich text block that renders markdown — bold, lists, links.',
    examples: 'Formatted instructions, Terms & conditions',
    group: 'Layout',
  },
  {
    type: 'divider',
    label: 'Divider',
    description: 'A horizontal line to visually separate sections.',
    examples: 'Between form sections',
    group: 'Layout',
  },
  {
    type: 'space',
    label: 'Space',
    description: 'Blank vertical gap with a customizable height.',
    examples: 'Breathing room between groups',
    group: 'Layout',
  },
];

const LAYOUT_FIELD_TYPES = new Set<FieldType>([
  'heading',
  'description',
  'markdown',
  'divider',
  'space',
]);

/**
 * True when the field collects user input (and therefore appears in submission
 * data + Results aggregates). Layout fields like heading, divider, and
 * markdown are pure presentation and never appear in submission JSON.
 */
export function isInputField(field: { type: FieldType }): boolean {
  return !LAYOUT_FIELD_TYPES.has(field.type);
}

/**
 * Returns the palette ordered by group, preserving the order of
 * `FIELD_TYPE_GROUPS` and the original array order within each group.
 */
export function getFieldTypesByGroup(): Record<FieldTypeGroup, FieldTypeMeta[]> {
  const grouped: Record<FieldTypeGroup, FieldTypeMeta[]> = {
    Inputs: [],
    Choices: [],
    'Date & Time': [],
    Layout: [],
  };
  for (const meta of FIELD_TYPES) grouped[meta.group].push(meta);
  return grouped;
}
