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
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
}));
