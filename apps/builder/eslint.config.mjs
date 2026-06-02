import react from '@walform/eslint-config/react';

export default [
  ...react,
  {
    ignores: ['out/**', 'dist/**', 'public/walform-site-bundle/**', 'src/vite-env.d.ts'],
  },
];
