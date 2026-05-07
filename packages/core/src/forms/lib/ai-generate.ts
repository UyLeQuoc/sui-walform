import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import type { FormField, FormSchema } from '../../types';

/**
 * AI form generation — BYOK against OpenRouter (`https://openrouter.ai/api/v1`).
 * The model returns a structured payload (title + description + fields) that
 * we drop into the existing form-builder schema; existing fields are replaced.
 *
 * Why OpenRouter: free tier has decent models (`openai/gpt-4o-mini`,
 * `mistralai/mixtral-8x7b-instruct`); user provides their own key so we don't
 * need server-side credentials. The provider is OpenAI-compatible so the
 * standard `@ai-sdk/openai-compatible` client works.
 */

const FIELD_TYPES = [
  'short_text',
  'long_text',
  'email',
  'phone',
  'url',
  'number',
  'single_choice',
  'multiple_choice',
  'select',
  'rating',
  'yes_no',
  'linear_scale',
  'date',
  'time',
  'heading',
  'description',
  'file',
] as const;

const aiFieldSchema = z.object({
  type: z.enum(FIELD_TYPES),
  label: z.string(),
  required: z.boolean().optional().default(false),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  /** For single_choice / multiple_choice / select. */
  options: z.array(z.string()).optional(),
});

const aiFormSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  fields: z.array(aiFieldSchema).min(1).max(40),
});

export type AiFormPayload = z.infer<typeof aiFormSchema>;

/**
 * OpenRouter free model used by default. The `:free` suffix routes the
 * request through OpenRouter's free tier (rate-limited but no per-token
 * charge). Override per-call via `GenerateOptions.model` for a paid model
 * if higher reliability is needed.
 */
export const DEFAULT_AI_MODEL = 'minimax/minimax-m2.5:free';

export interface GenerateOptions {
  prompt: string;
  apiKey: string;
  /** Defaults to {@link DEFAULT_AI_MODEL}. Any OpenRouter model id works. */
  model?: string;
  signal?: AbortSignal;
}

export interface GeneratedForm {
  title: string;
  description: string;
  fields: FormField[];
}

const FIELD_TYPES_LIST = FIELD_TYPES.join(' | ');

const SYSTEM_PROMPT = `You are a forms expert. Given a short prompt, design a clean, well-labeled form and return ONLY valid JSON matching this schema — no markdown fences, no commentary, no leading text:

{
  "title": string,
  "description": string (optional),
  "fields": [
    {
      "type": "${FIELD_TYPES_LIST}",
      "label": string,
      "required": boolean (optional, default false),
      "placeholder": string (optional),
      "helpText": string (optional),
      "options": string[] (only for single_choice / multiple_choice / select)
    }
  ]
}

Rules:
- Pick the smallest set of fields that captures the intent (5-10 typical).
- Use the most specific field type available — prefer email/phone/url over short_text when applicable.
- Use single_choice (radio) for ≤5 options, select (dropdown) for >5.
- For linear_scale or rating, no options array is needed — the renderer handles the scale.
- Add helpText only when the label is ambiguous.
- Group related questions; lead with a "heading" field when the form has multiple sections.
- Output JSON only. Do NOT wrap in \`\`\`json fences. Do NOT add any text before or after the JSON object.`;

export async function generateFormFromPrompt(opts: GenerateOptions): Promise<GeneratedForm> {
  const { prompt, apiKey, model = DEFAULT_AI_MODEL, signal } = opts;
  if (!apiKey.trim()) {
    throw new Error('OpenRouter API key is required');
  }
  // OpenRouter is OpenAI-compatible at the wire level. `createOpenAI` with
  // `compatibility: 'compatible'` strips OpenAI-specific knobs (streamOptions,
  // tool_choice extras) that 3rd-party providers reject.
  const provider = createOpenAI({
    name: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    compatibility: 'compatible',
  });
  // generateText (not generateObject) — many free OpenRouter models don't
  // support OpenAI-style tool calls or response_format=json_object reliably,
  // which is what generateObject's default mode expects. Asking for plain
  // text + parsing manually works across every model the catalog offers.
  const { text } = await generateText({
    model: provider(model),
    system: SYSTEM_PROMPT,
    prompt,
    abortSignal: signal,
  });

  const parsed = parseAndValidate(text);
  return materialize(parsed);
}

function parseAndValidate(text: string): AiFormPayload {
  const json = extractJson(text);
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Model returned non-JSON output: ${msg}. First 200 chars: ${text.slice(0, 200)}`,
      { cause: err },
    );
  }
  const result = aiFormSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Model output didn't match schema: ${result.error.message}. First 200 chars: ${text.slice(0, 200)}`,
    );
  }
  return result.data;
}

/**
 * Strip markdown code fences if the model wrapped its response in them despite
 * the prompt instructions, and trim any leading/trailing prose to the first
 * `{` ... last `}` window. Defensive — well-behaved models pass through.
 */
function extractJson(text: string): string {
  const trimmed = text.trim();
  // ```json ... ``` or ``` ... ```
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  // First { ... matching last } — handles "Here is your form: { ... }"
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function materialize(payload: AiFormPayload): GeneratedForm {
  const fields: FormField[] = payload.fields.map((f) => {
    const id = crypto.randomUUID();
    const base: FormField = {
      id,
      type: f.type,
      label: f.label,
      required: f.required ?? false,
    };
    if (f.placeholder) base.placeholder = f.placeholder;
    if (f.helpText) base.helpText = f.helpText;
    if (
      (f.type === 'single_choice' || f.type === 'multiple_choice' || f.type === 'select') &&
      f.options &&
      f.options.length > 0
    ) {
      base.options = f.options.map((opt) => ({
        id: crypto.randomUUID(),
        label: opt,
        value: opt,
      }));
    }
    return base;
  });
  return {
    title: payload.title,
    description: payload.description ?? '',
    fields,
  };
}

/**
 * Apply an AI-generated form onto an existing draft schema. Preserves the
 * form's settings (font, colors, submit label) — only title/description/fields
 * are replaced.
 */
export function applyGeneratedForm(current: FormSchema, generated: GeneratedForm): FormSchema {
  return {
    ...current,
    title: generated.title,
    description: generated.description,
    fields: generated.fields,
  };
}
