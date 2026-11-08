import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Files share one database when TEST_DATABASE_URL points at a real Postgres.
    fileParallelism: false,
    // One worker, shared module state: lets the in-process PGlite boot once.
    pool: 'forks',
    isolate: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
