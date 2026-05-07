import type { FormField } from '../../../types';

const NON_DATA_TYPES = new Set(['divider', 'space', 'heading', 'description', 'markdown']);

function fieldTypeString(field: FormField): string {
  switch (field.type) {
    case 'short_text':
    case 'long_text':
    case 'email':
    case 'phone':
    case 'url':
    case 'time':
    case 'code':
    case 'file':
      return 'string';
    case 'number':
    case 'rating':
    case 'linear_scale':
      return 'number';
    case 'date':
      return 'Date';
    case 'yes_no':
      return '"yes" | "no"';
    case 'single_choice':
    case 'select': {
      const values = (field.options ?? []).map((o) => `'${o.value}'`).join(' | ');
      return values || 'string';
    }
    case 'multiple_choice': {
      const values = (field.options ?? []).map((o) => `'${o.value}'`).join(' | ');
      return values ? `Array<${values}>` : 'string[]';
    }
    case 'divider':
    case 'space':
    case 'heading':
    case 'description':
    case 'markdown':
      return '';
  }
}

export function generateTsTypes(fields: FormField[]): string {
  const dataFields = fields.filter((f) => !NON_DATA_TYPES.has(f.type));
  if (dataFields.length === 0) return 'export interface FormValues {}';

  const lines = dataFields.map((field) => {
    const type = fieldTypeString(field);
    const optional = field.required ? '' : '?';
    const comment = field.label ? ` // ${field.label}` : '';
    return `  ${field.id}${optional}: ${type}${comment}`;
  });

  return `export interface FormValues {\n${lines.join('\n')}\n}`;
}
