/**
 * Vitest configuration for @travelhub/ui component tests
 * (FRONTEND_ARCHITECTURE.md §35 — component tests via React Testing
 * Library + Vitest, exercising rendering, keyboard interaction, and ARIA
 * attributes for every ui/ primitive).
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    css: true,
    exclude: ['**/node_modules/**'],
  },
});
