import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` no necesita la base: así se puede generar el cliente
    // sin DATABASE_URL (por ejemplo, al construir la imagen de Docker).
    url: process.env.DATABASE_URL ?? '',
  },
});
