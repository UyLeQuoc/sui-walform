import { SCHEMA_VERSION } from './schema-version';
import type { FormSchema, StoredForm } from '../../types';

export interface CreateDraftFromTemplateInput {
  /** Source template's on-chain object id (provenance). */
  templateId: string;
  /** Source template's title, shown in the editor banner. */
  originalTitle: string;
  /** Source template's creator address (suivision link target). */
  originalCreator: string;
  /** Decoded schema from `useTemplateSchema`. */
  templateSchema: FormSchema;
  /** Digest from `purchase_template_only` — paid path only. */
  purchaseDigest?: string;
}

/**
 * Builds a fresh `StoredForm` from a marketplace template snapshot. The draft
 * gets a new uuid and a fresh `id` baked into the schema (the template's
 * schema.id refers to the template, not this draft). All other schema bits —
 * fields, settings, theme, coverImage, title — are copied verbatim so the user
 * can edit before publishing.
 */
export function createDraftFromTemplate(input: CreateDraftFromTemplateInput): StoredForm {
  const id = crypto.randomUUID();
  const now = Date.now();
  const schema: FormSchema = {
    ...input.templateSchema,
    id,
    version: SCHEMA_VERSION,
    title: input.templateSchema.title || input.originalTitle || 'Untitled Form',
  };
  return {
    id,
    schema,
    past: [],
    future: [],
    currentLabel: 'Cloned from template',
    createdAt: now,
    updatedAt: now,
    rev: 0,
    sourceTemplate: {
      templateId: input.templateId,
      originalTitle: input.originalTitle,
      originalCreator: input.originalCreator,
      purchaseDigest: input.purchaseDigest,
      purchasedAtMs: input.purchaseDigest ? now : undefined,
    },
  };
}
