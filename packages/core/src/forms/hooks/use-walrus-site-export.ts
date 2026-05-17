'use client';

import { useMemo, useState } from 'react';
import {
  buildZipBlob,
  DEFAULT_APP_ORIGIN,
  generateWalrusSiteBundle,
  type WalrusSiteBundle,
} from '../lib/walrus-site';
import type { FormSchema } from '../../types';

export type WalrusSiteExportState =
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ready'; bundle: WalrusSiteBundle };

export interface UseWalrusSiteExportResult {
  /** Raw text in the JSON paste box. */
  jsonInput: string;
  setJsonInput: (value: string) => void;
  /** On-chain Form object id (the `0x…` from `walform.wal.app/f/{id}`). */
  formObjectId: string;
  setFormObjectId: (value: string) => void;
  /** WalForm app origin the static site hands off to. */
  appOrigin: string;
  setAppOrigin: (value: string) => void;
  /** Parsed/validated state. Re-runs whenever any input changes. */
  state: WalrusSiteExportState;
  /** Trigger a download of the bundle as a single .zip. No-op when not ready. */
  downloadZip: () => void;
}

const SAMPLE_SCHEMA: FormSchema = {
  id: 'sample',
  title: 'Sample WalForm',
  description: 'Paste your own form JSON above to replace this sample.',
  fields: [
    {
      id: 'name',
      type: 'short_text',
      label: 'Your name',
      required: true,
      placeholder: 'Jane Doe',
    },
    {
      id: 'feedback',
      type: 'long_text',
      label: 'How can we improve?',
      placeholder: 'Tell us what you think…',
      required: false,
    },
    {
      id: 'rating',
      type: 'rating',
      label: 'Overall experience',
      required: true,
      validation: { max: 5 },
    },
  ],
  settings: {
    submitLabel: 'Continue to submit',
    submitAlignment: 'left',
    successMessage: 'Thanks!',
    primaryColor: 'blue',
    fontFamily: 'inter',
    borderRadius: 8,
    displayMode: 'card',
  },
};

/**
 * Drive the JSON-paste → bundle preview → download flow. Pure derivation: any
 * change to the inputs immediately re-builds the bundle and surfaces parse
 * errors. The component layer just renders state — no logic lives there.
 */
export function useWalrusSiteExport(): UseWalrusSiteExportResult {
  const [jsonInput, setJsonInput] = useState<string>(() => JSON.stringify(SAMPLE_SCHEMA, null, 2));
  const [formObjectId, setFormObjectId] = useState<string>('');
  const [appOrigin, setAppOrigin] = useState<string>(DEFAULT_APP_ORIGIN);

  const state = useMemo<WalrusSiteExportState>(() => {
    const trimmed = jsonInput.trim();
    if (!trimmed) return { status: 'empty' };
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      return { status: 'error', message: parseErrorMessage(err) };
    }
    const validation = validateSchema(parsed);
    if (!validation.ok) {
      return { status: 'error', message: validation.message };
    }
    try {
      const bundle = generateWalrusSiteBundle({
        schema: validation.schema,
        formObjectId: formObjectId.trim() || undefined,
        appOrigin: appOrigin.trim() || undefined,
      });
      return { status: 'ready', bundle };
    } catch (err) {
      return { status: 'error', message: parseErrorMessage(err) };
    }
  }, [jsonInput, formObjectId, appOrigin]);

  const downloadZip = () => {
    if (state.status !== 'ready') return;
    const blob = buildZipBlob(
      state.bundle.files.map((f) => ({ path: f.path, content: f.content })),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(state.bundle.siteName)}-walrus-site.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    jsonInput,
    setJsonInput,
    formObjectId,
    setFormObjectId,
    appOrigin,
    setAppOrigin,
    state,
    downloadZip,
  };
}

interface SchemaValidation {
  ok: true;
  schema: FormSchema;
}
interface SchemaValidationError {
  ok: false;
  message: string;
}

/**
 * Lightweight runtime check — we don't pull `zod` here because that would
 * couple the export tool to a specific schema version. Instead we assert the
 * minimal shape the generator depends on and lean on TypeScript at the call
 * site for the full structural contract.
 */
function validateSchema(input: unknown): SchemaValidation | SchemaValidationError {
  if (!input || typeof input !== 'object') {
    return { ok: false, message: 'JSON must be an object with `title`, `fields`, and `settings`.' };
  }
  const obj = input as Record<string, unknown>;
  if (typeof obj.title !== 'string') {
    return { ok: false, message: '`title` must be a string.' };
  }
  if (!Array.isArray(obj.fields)) {
    return { ok: false, message: '`fields` must be an array.' };
  }
  if (!obj.settings || typeof obj.settings !== 'object') {
    return { ok: false, message: '`settings` must be an object.' };
  }
  for (let i = 0; i < obj.fields.length; i++) {
    const field = obj.fields[i];
    if (!field || typeof field !== 'object') {
      return { ok: false, message: `Field at index ${i} must be an object.` };
    }
    const f = field as Record<string, unknown>;
    if (typeof f.id !== 'string' || !f.id) {
      return { ok: false, message: `Field at index ${i} is missing a non-empty \`id\`.` };
    }
    if (typeof f.type !== 'string') {
      return { ok: false, message: `Field "${f.id}" is missing a string \`type\`.` };
    }
  }
  return { ok: true, schema: obj as unknown as FormSchema };
}

function parseErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'walform'
  );
}
