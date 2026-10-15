import 'dotenv/config';

// Sufijo _test obligatorio: los e2e vacían las tablas.
export function urlBaseDeTest(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('Falta DATABASE_URL_TEST en el .env');
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error('DATABASE_URL_TEST tiene que apuntar a una base *_test');
  }
  return url;
}
