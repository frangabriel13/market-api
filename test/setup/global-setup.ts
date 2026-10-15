// Prepara la base de los e2e: la crea si no existe y le aplica las
// migraciones. Nunca toca la base de desarrollo.
import { execSync } from 'node:child_process';
import pg from 'pg';
import { urlBaseDeTest } from './url-base-de-test.js';

export default async function globalSetup() {
  const url = urlBaseDeTest();
  const nombre = new URL(url).pathname.slice(1);

  const urlAdmin = new URL(url);
  urlAdmin.pathname = '/postgres';
  const cliente = new pg.Client({ connectionString: urlAdmin.toString() });
  await cliente.connect();
  try {
    const { rowCount } = await cliente.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [nombre],
    );
    if (!rowCount) await cliente.query(`CREATE DATABASE "${nombre}"`);
  } finally {
    await cliente.end();
  }

  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  });
}
