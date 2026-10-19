import { defineConfig } from 'vitest/config';
import { urlBaseDeTest } from './test/setup/url-base-de-test.js';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    env: {
      DATABASE_URL: urlBaseDeTest(),
      NODE_ENV: 'test',
      PLATFORM_DOMAIN: 'plataforma.test',
      // Todas explícitas: si no, se cuelan las del .env de desarrollo.
      STORAGE_ENDPOINT: 'https://almacenamiento.test/storage/v1/s3',
      STORAGE_REGION: 'sa-east-1',
      STORAGE_ACCESS_KEY_ID: 'clave-test',
      STORAGE_SECRET_ACCESS_KEY: 'secreto-test',
      STORAGE_BUCKET: 'bucket-test',
      STORAGE_PUBLIC_URL: 'https://imagenes.test',
    },
    // Los archivos comparten la base: de a uno.
    fileParallelism: false,
  },
});
