import react from '@walform/eslint-config/react';

export default [
  ...react,
  {
    // `src/ui/**` is shadcn primitives copied verbatim from upstream — same
    // policy as `src/sui/**` codegen. Linting them surfaces upstream patterns
    // (a11y on input-group focus delegation, anchor children spread via
    // `{...props}`, intentional cascading effects in carousel, etc.) that
    // create churn on every shadcn re-sync without improving the surface.
    ignores: ['dist/**', 'src/sui/**', 'src/ui/**', '**/*.test.ts'],
  },
];
