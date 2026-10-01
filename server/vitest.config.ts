import { defineConfig } from 'vitest/config';
import path from 'path';
import { config as loadDotenv } from 'dotenv';

// Load .env before any test module is imported so Prisma picks up DATABASE_URL
loadDotenv({ path: path.resolve(__dirname, '../.env') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      '@resumeiq/shared': path.resolve(__dirname, '../shared/dist/index'),
    },
  },
});
