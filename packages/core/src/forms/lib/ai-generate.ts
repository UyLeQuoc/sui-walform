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
  fields: z.array(aiFieldSchema).min(1).max(8),
});

export type AiFormPayload = z.infer<typeof aiFormSchema>;

/**
 * OpenRouter free model used by default. MiniMax M2.5 is fast on the free
 * tier and reliably emits raw JSON. The `:free` suffix routes the request
 * through OpenRouter's free tier — no per-token charge, light rate limits.
 * Override per-call via `GenerateOptions.model` for a paid model if higher
 * reliability is needed.
 */
export const DEFAULT_AI_MODEL = 'minimax/minimax-m2.5:free';

/**
 * Curated free-tier OpenRouter models that have been verified to emit clean
 * JSON for this prompt shape. The dialog renders this list so users can swap
 * when one model is rate-limited or offline (free tier is best-effort).
 */
export const FREE_MODEL_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'minimax/minimax-m2.5:free', label: 'MiniMax M2.5 (free)' },
  { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)' },
  { value: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek v3 (free)' },
  { value: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B (free)' },
  { value: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'Mistral Small 3.1 (free)' },
];

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

const SYSTEM_PROMPT = `You are a form-design assistant. Output ONLY a JSON object — no markdown fences, no commentary, no text before or after the object.

Schema:
{
  "title": string,
  "description"?: string,
  "fields": [
    {
      "type": "${FIELD_TYPES_LIST}",
      "label": string,
      "required"?: boolean,
      "placeholder"?: string,
      "helpText"?: string,
      "options"?: string[]
    }
  ]
}

Rules — keep the form MINIMAL:
1. 3 to 6 fields. HARD MAX 8. Fewer is better.
2. NO "heading" or "description" layout fields. Skip them entirely.
3. Use the most specific type. email / phone / url / number > short_text. rating or linear_scale > radio options for 1-N scoring.
4. single_choice for ≤5 options; select for 6+. MAX 6 options per field.
5. OMIT helpText, placeholder, and the form description unless they're strictly necessary to disambiguate. Default to omitting all three.
6. NO filler fields the user didn't ask for. NO "Any other feedback?", NO "Is there anything else?".
7. Labels are short and direct. "Email", not "What is your email address?".

Output the JSON object now.`;

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
  let text: string;
  try {
    const result = await generateText({
      model: provider(model),
      system: SYSTEM_PROMPT,
      prompt,
      abortSignal: signal,
    });
    text = result.text;
  } catch (err) {
    throw rewriteProviderError(err, model);
  }

  const parsed = parseAndValidate(text);
  return materialize(parsed);
}

/**
 * The AI SDK wraps provider failures in `AI_RetryError` whose `.message` is
 * just "Failed after 3 attempts. Last error: …" — the actual HTTP body from
 * OpenRouter (rate-limit, model offline, bad key) gets buried. Dig it out so
 * the toast actually tells the user what went wrong.
 */
interface ProviderErrorShape {
  responseBody?: unknown;
  message?: unknown;
  statusCode?: unknown;
  lastError?: ProviderErrorShape;
}

function rewriteProviderError(err: unknown, model: string): Error {
  if (!(err instanceof Error)) return new Error(String(err));
  const record = err as unknown as ProviderErrorShape;
  const inner: ProviderErrorShape = record.lastError ?? record;
  const status =
    typeof inner.statusCode === 'number' || typeof inner.statusCode === 'string'
      ? String(inner.statusCode)
      : null;
  const body =
    typeof inner.responseBody === 'string'
      ? inner.responseBody
      : typeof inner.message === 'string'
        ? inner.message
        : err.message;

  // OpenRouter "no endpoints" = model unreachable on free tier.
  if (typeof body === 'string' && /no endpoints found/i.test(body)) {
    return new Error(
      `Model "${model}" is offline on OpenRouter right now. Pick another model from the dropdown.`,
    );
  }
  if (status === '429' || (typeof body === 'string' && /rate.?limit/i.test(body))) {
    return new Error(
      `Rate-limited by OpenRouter on "${model}". Wait a moment or pick another free model.`,
    );
  }
  if (status === '401' || (typeof body === 'string' && /invalid.?api.?key|unauthorized/i.test(body))) {
    return new Error('OpenRouter rejected the API key. Paste a fresh one from openrouter.ai/keys.');
  }
  const detail = status ? `${status} ${body ?? ''}`.trim() : (body ?? err.message);
  return new Error(`OpenRouter (${model}): ${detail}`);
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
