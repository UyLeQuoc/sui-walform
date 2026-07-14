import { z } from 'zod';
import { formatFileSizeCap, resolveMaxFileBytes } from '../file-attachment';
import type { FormField } from '../../../types';

/**
 * Per-field overrides used when generating a Zod schema for a specific
 * subset of fields (e.g. one page) under active conditional logic.
 *
 *  - `hiddenFieldIds` — fields removed entirely from validation.
 *  - `requiredOverrides` — flip a field's `required` flag without mutating it.
 *
 * Both are optional; omitting them yields the same behavior as before.
 */
export interface FieldSchemaOverrides {
  hiddenFieldIds?: ReadonlySet<string>;
  requiredOverrides?: ReadonlyMap<string, boolean>;
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function buildFieldSchema(field: FormField): z.ZodTypeAny {
  switch (field.type) {
    case 'short_text':
    case 'long_text': {
      let str = z.string();
      const { minLength, maxLength } = field.validation ?? {};

      if (field.required && !minLength) str = str.min(1, 'This field is required');
      if (minLength)
        str = str.min(minLength, `At least ${minLength} character${minLength === 1 ? '' : 's'}`);
      if (maxLength)
        str = str.max(maxLength, `At most ${maxLength} character${maxLength === 1 ? '' : 's'}`);
      return field.required ? str : str.optional();
    }
    case 'email': {
      if (field.required) {
        return z.string().min(1, 'This field is required').email('Enter a valid email address');
      }
      // Allow empty string (no entry) OR a valid email; reject malformed input.
      return z.union([z.literal(''), z.string().email('Enter a valid email address')]);
    }
    case 'phone': {
      const base = z.string();
      return field.required ? base.min(1, 'This field is required') : base.optional();
    }
    case 'url': {
      const domains = field.allowedDomains ?? [];
      const urlBase = z.string().url('Enter a valid URL');
      if (domains.length === 0) {
        if (field.required) return urlBase.min(1, 'This field is required');
        // RHF default is '' — `.optional()` would accept undefined but not '',
        // so add an empty-literal branch (same pattern as `email`).
        return z.union([z.literal(''), urlBase]);
      }
      const validated = urlBase.refine(
        (val) => {
          try {
            const { hostname } = new URL(val);
            return domains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
          } catch {
            return false;
          }
        },
        { message: `URL must be from: ${domains.join(', ')}` },
      );
      return field.required ? validated : z.union([z.literal(''), validated]);
    }
    case 'number': {
      let base = z.coerce.number();
      if (field.validation?.min !== undefined) base = base.min(field.validation.min);
      if (field.validation?.max !== undefined) base = base.max(field.validation.max);
      return field.required ? base : base.optional();
    }
    case 'date': {
      let base = z.coerce.date();
      if (field.validation?.minDate)
        base = base.min(
          new Date(field.validation.minDate),
          `Date must be on or after ${field.validation.minDate}`,
        );
      if (field.validation?.maxDate)
        base = base.max(
          new Date(field.validation.maxDate),
          `Date must be on or before ${field.validation.maxDate}`,
        );
      return field.required ? base : base.optional();
    }
    case 'time': {
      const base = z.string().regex(TIME_REGEX, 'Enter a valid time (HH:MM)');
      if (field.required) return base.min(1, 'This field is required');
      // RHF default is '' but the regex rejects empty — accept either.
      return z.union([z.literal(''), base]);
    }
    case 'code': {
      let str = z.string();
      const { maxLength, maxLines } = field.validation ?? {};
      if (field.required) str = str.min(1, 'This field is required');
      if (maxLength)
        str = str.max(maxLength, `At most ${maxLength} character${maxLength === 1 ? '' : 's'}`);
      if (maxLines) {
        const limit = maxLines;
        const refined = str.refine((val) => val.split(/\r\n|\r|\n/).length <= limit, {
          message: `At most ${limit} line${limit === 1 ? '' : 's'}`,
        });
        return field.required ? refined : refined.optional();
      }
      return field.required ? str : str.optional();
    }
    case 'single_choice': {
      const values = (field.options ?? []).map((o) => o.value);
      if (values.length < 1) {
        return field.required ? z.string().min(1, 'Select an option') : z.string().optional();
      }
      const enumSchema = z.enum(values as [string, ...string[]]);
      return field.required ? enumSchema : enumSchema.optional();
    }
    case 'multiple_choice': {
      const values = (field.options ?? []).map((o) => o.value);
      if (values.length < 1) {
        const base = z.array(z.string());
        return field.required ? base.min(1, 'Select at least one option') : base.optional();
      }
      const base = z.array(z.enum(values as [string, ...string[]]));
      return field.required ? base.min(1, 'Select at least one option') : base.optional();
    }
    case 'select': {
      const values = (field.options ?? []).map((o) => o.value);
      if (values.length < 1) {
        return field.required ? z.string().min(1, 'Select an option') : z.string().optional();
      }
      const enumSchema = z.enum(values as [string, ...string[]]);
      return field.required ? enumSchema : enumSchema.optional();
    }
    case 'rating': {
      const max = field.validation?.max ?? 5;
      const base = z.coerce.number().min(1).max(max);
      return field.required
        ? base.refine((v) => v >= 1, 'This field is required')
        : base.optional();
    }
    case 'yes_no': {
      const enumSchema = z.enum(['yes', 'no']);
      return field.required ? enumSchema : enumSchema.optional();
    }
    case 'linear_scale': {
      const from = field.validation?.scaleFrom ?? 1;
      const to = field.validation?.scaleTo ?? 5;
      const base = z.coerce.number().min(from).max(to);
      return field.required
        ? base.refine((v) => v !== undefined, 'This field is required')
        : base.optional();
    }
    case 'file': {
      // Three accepted shapes for a file field value:
      //   - `File` instance: just picked, pending Walrus upload at submit.
      //   - `FileAttachmentValue`: post-upload rich object.
      //   - `string`: legacy URL value, or empty string (initial state).
      // The submit flow swaps `File` → `FileAttachmentValue` after uploading
      // to Walrus, so Zod has to accept the pending shape too — otherwise
      // RHF reports "Invalid input" before the upload step even runs.
      const attachment = z.object({
        url: z.string().min(1),
        name: z.string(),
        size: z.number().int().nonnegative(),
        type: z.string(),
      });
      const fileInstance =
        typeof File !== 'undefined'
          ? z.instanceof(File)
          : z.custom<File>((v): v is File =>
              typeof v === 'object' && v !== null && 'name' in v && 'size' in v,
            );
      const union = z.union([fileInstance, attachment, z.string()]);

      // Enforce the per-field upload cap. Both the pending `File` and the
      // uploaded attachment carry a byte `size`; strings (legacy/empty) have
      // none, so they pass this refine and are handled by the presence check.
      const maxBytes = resolveMaxFileBytes(field);
      const withinSize = (v: unknown): boolean => {
        if (!Number.isFinite(maxBytes)) return true;
        if (typeof File !== 'undefined' && v instanceof File) return v.size <= maxBytes;
        if (typeof v === 'object' && v !== null && typeof (v as { size?: unknown }).size === 'number')
          return (v as { size: number }).size <= maxBytes;
        return true;
      };
      const sizeMessage = `File exceeds the ${formatFileSizeCap(maxBytes)} limit`;
      const base = union.refine(withinSize, sizeMessage);

      if (!field.required) return base.optional();
      return base.refine(
        (v): boolean => {
          if (typeof v === 'string') return v.length > 0;
          if (typeof File !== 'undefined' && v instanceof File) return v.size > 0;
          return typeof v === 'object' && v !== null && 'url' in v && (v as { url: string }).url.length > 0;
        },
        'Attach a file to submit',
      );
    }
    case 'divider':
    case 'space':
    case 'heading':
    case 'description':
    case 'markdown':
      return z.never();
  }
}

export function generateZodSchema(
  fields: FormField[],
  overrides?: FieldSchemaOverrides,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const hidden = overrides?.hiddenFieldIds;
  const requiredOverrides = overrides?.requiredOverrides;
  for (const field of fields) {
    if (
      field.type === 'divider' ||
      field.type === 'space' ||
      field.type === 'heading' ||
      field.type === 'description' ||
      field.type === 'markdown'
    )
      continue;
    if (hidden?.has(field.id)) continue;
    const effective =
      requiredOverrides?.has(field.id)
        ? { ...field, required: requiredOverrides.get(field.id)! }
        : field;
    shape[field.id] = buildFieldSchema(effective);
  }

  return z.object(shape);
}

export function generateDefaultValues(fields: FormField[]): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of fields) {
    if (
      field.type === 'divider' ||
      field.type === 'space' ||
      field.type === 'heading' ||
      field.type === 'description' ||
      field.type === 'markdown'
    )
      continue;
    switch (field.type) {
      case 'short_text':
      case 'long_text':
      case 'email':
      case 'phone':
      case 'url':
      case 'time':
      case 'code':
      case 'file':
        defaults[field.id] = field.defaultValue ?? '';
        break;
      case 'number':
        defaults[field.id] =
          field.defaultValue !== undefined ? Number(field.defaultValue) : undefined;
        break;
      case 'single_choice':
      case 'select':
        defaults[field.id] = field.defaultValue;
        break;
      case 'rating':
        defaults[field.id] =
          field.defaultValue !== undefined ? Number(field.defaultValue) : undefined;
        break;
      case 'linear_scale':
        defaults[field.id] =
          field.defaultValue !== undefined ? Number(field.defaultValue) : undefined;
        break;
      case 'multiple_choice':
        defaults[field.id] = field.defaultValues ?? [];
        break;
      case 'date':
        defaults[field.id] = field.defaultValue ? new Date(field.defaultValue) : undefined;
        break;
      case 'yes_no':
        defaults[field.id] = field.defaultValue as 'yes' | 'no' | undefined;
        break;
    }
  }
  return defaults;
}
