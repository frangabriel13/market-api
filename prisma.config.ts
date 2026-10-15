import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Vacía al construir la imagen de Docker: `prisma generate` no la usa.
    url: process.env.DATABASE_URL ?? '',
  },
});
