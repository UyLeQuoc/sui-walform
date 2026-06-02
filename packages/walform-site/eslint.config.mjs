import react from '@walform/eslint-config/react';

export default [
  ...react,
  {
    ignores: ['dist/**', 'src/vite-env.d.ts'],
  },
];
