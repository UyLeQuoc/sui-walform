import base from '@walform/eslint-config/base';

// Portal is a vendored copy of MystenLabs/walrus-sites/portal (server flavor)
// — see UPSTREAM.md. We re-sync from upstream periodically; running our
// stricter lint rules over their code would force an endless stream of
// non-functional churn. Skip the lot. If we ever add WalForm-specific glue
// outside the vendored tree, carve it out here.
export default [
  ...base,
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'lib/**',
      'src/**',
      'html_templates/**',
      'index.ts',
      'custom_logger.ts',
    ],
  },
];
