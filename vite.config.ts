import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  // The Tailwind v4 Vite plugin is REQUIRED — without it, the
  // `@import "tailwindcss"` directive in src/index.css is treated as a
  // literal CSS @import and silently produces an empty stylesheet. The app
  // will render but every element will be unstyled. See issue #48.
  plugins: [react(), tailwindcss()],
  server: { port: 3000 },
  build: {
    // Inline images as base64 data URLs so they render reliably inside the
    // Power Apps host iframe. A normally-emitted hashed asset file must be
    // fetched through the storage proxy at runtime, which can silently fail.
    // Returning `undefined` keeps Vite's default 4KB threshold for everything else.
    assetsInlineLimit: (filePath: string) =>
      /\.png$/i.test(filePath) ? true : undefined,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
}));
