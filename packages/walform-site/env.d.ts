// CSS side-effect imports come in via `@walform/core` (e.g. dApp Kit's
// `index.css`). The core package already declares this module but Next.js's
// build-time type check resolves from the consuming app's tsconfig, so we
// repeat the shim here.
declare module '*.css';
