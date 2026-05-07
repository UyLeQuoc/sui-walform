import { z } from 'zod';

// Placeholder FormSchemaV1 — real spec in docs/PRD.md §10.
// This stub is here so builder + renderer can import types from day one;
// we flesh it out in the contracts / builder-UI implementation plans.

export const FormSchemaV1 = z.object({
  version: z.literal('1.0'),
  id: z.string(),
  title: z.string(),
});

export type FormSchemaV1 = z.infer<typeof FormSchemaV1>;
