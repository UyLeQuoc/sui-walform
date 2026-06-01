/**
 * Side-effect font loader — replaces `next/font/google`. Each import pulls the
 * variable-weight `@font-face` declarations (and woff2 files) through Vite's
 * CSS pipeline, which rebases the `url()`s and emits the font assets. The
 * matching CSS variables (`--font-sans`, `--font-form-*`, …) are declared in
 * `globals.css :root` so `forms/lib/form-fonts.ts` keeps resolving them.
 *
 * Imported once per app entry (`main.tsx`) so both the builder and the
 * walform-site shell get the same fonts.
 */
import '@fontsource-variable/inter';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/roboto';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/lora';
import '@fontsource-variable/merriweather';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/jetbrains-mono';
