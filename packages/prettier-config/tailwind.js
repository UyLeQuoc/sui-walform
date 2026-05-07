import base from './base.js';

/** @type {import('prettier').Config} */
const config = {
  ...base,
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindFunctions: ['clsx', 'cn', 'cva', 'tw', 'twMerge'],
};

export default config;
