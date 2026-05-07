import { DEFAULT_BORDER_RADIUS, DEFAULT_FORM_COLOR_KEY } from './form-appearance';
import { DEFAULT_FORM_FONT_KEY } from './form-fonts';
import { SCHEMA_VERSION } from './schema-version';
import type { StoredForm } from '../../types';

export function createStoredForm(title = 'Untitled Form'): StoredForm {
  const id = crypto.randomUUID();
  const now = Date.now();
  return {
    id,
    schema: {
      id,
      version: SCHEMA_VERSION,
      title,
      description: '',
      fields: [],
      settings: {
        submitLabel: 'Submit',
        successMessage: 'Thank you for your response!',
        submitAlignment: 'center',
        fontFamily: DEFAULT_FORM_FONT_KEY,
        borderRadius: DEFAULT_BORDER_RADIUS,
        primaryColor: DEFAULT_FORM_COLOR_KEY,
      },
    },
    past: [],
    future: [],
    currentLabel: 'Initial state',
    createdAt: now,
    updatedAt: now,
    rev: 0,
  };
}
