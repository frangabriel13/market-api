import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { urlBaseDeTest } from './test/setup/url-base-de-test.js';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    // La app de los tests usa la base de test, no la de desarrollo.
    env: { DATABASE_URL: urlBaseDeTest(), NODE_ENV: 'test' },
    // Comparten la base: un archivo a la vez.
    fileParallelism: false,
  },
});
