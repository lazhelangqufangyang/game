import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173,
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/.tmp/**',
        '**/.shots/**',
        '**/*.tmpdir/**',
        '**/*.tmp',
      ],
    },
  },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
