import 'dotenv/config';

// Los e2e usan DATABASE_URL_TEST. Se exige el sufijo _test porque los tests
// vacían las tablas.
export function urlBaseDeTest(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('Falta DATABASE_URL_TEST en el .env');
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error('DATABASE_URL_TEST tiene que apuntar a una base *_test');
  }
  return url;
}
