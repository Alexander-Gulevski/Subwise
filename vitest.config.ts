import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'e2e'],
    setupFiles: ['./vitest.setup.ts'],
    // Компонентные тесты помечают себя `// @vitest-environment jsdom`,
    // чтобы доменные тесты не платили за поднятие DOM.
    environmentMatchGlobs: [['src/components/**', 'jsdom']],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/server/**'],
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
