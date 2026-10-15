import { defineConfig } from 'vitest/config';
import { urlBaseDeTest } from './test/setup/url-base-de-test.js';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    env: { DATABASE_URL: urlBaseDeTest(), NODE_ENV: 'test' },
    // Los archivos comparten la base: de a uno.
    fileParallelism: false,
  },
});
