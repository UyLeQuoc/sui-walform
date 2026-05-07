import type { FormSchema, StoredForm } from '../../types';

/**
 * Current shape version for `FormSchema`. Bump whenever a breaking change
 * is made to the field shape, settings, or schema envelope. Each bump
 * MUST add a corresponding case in {@link migrateStoredForm}.
 *
 * Versioning is consumed by both ends of the pipeline:
 *  - IndexedDB drafts: `useStoredForm` runs migrations on load.
 *  - On-chain forms (future): the deserializer can refuse unknown future
 *    versions instead of casting blindly.
 */
export const SCHEMA_VERSION = 1;

export type MigrationResult =
  | { ok: true; form: StoredForm; migrated: boolean }
  | { ok: false; reason: 'future-version'; foundVersion: number };

/**
 * Bring a `StoredForm` loaded from IDB up to the current schema shape.
 *
 * Legacy records (no `version`) are treated as version 0 and migrated
 * forward. Records with a version newer than what this build understands
 * are refused so we never render against an unknown shape.
 */
export function migrateStoredForm(stored: StoredForm): MigrationResult {
  const found = stored.schema.version ?? 0;

  if (found > SCHEMA_VERSION) {
    return { ok: false, reason: 'future-version', foundVersion: found };
  }

  if (found === SCHEMA_VERSION) {
    return { ok: true, form: stored, migrated: false };
  }

  // Legacy → v1: stamp a version. No structural change yet.
  const schema: FormSchema = { ...stored.schema, version: SCHEMA_VERSION };
  return {
    ok: true,
    form: { ...stored, schema, rev: stored.rev ?? 0 },
    migrated: true,
  };
}

/** Stamp the current version onto a freshly-built schema. */
export function stampSchemaVersion(schema: FormSchema): FormSchema {
  return { ...schema, version: SCHEMA_VERSION };
}
