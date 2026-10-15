import { hashPassword } from '../../src/common/password.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';

export async function limpiarBase(prisma: PrismaService) {
  const [{ base }] = await prisma.$queryRaw<{ base: string }[]>`
    SELECT current_database() AS base`;
  if (!base.endsWith('_test')) {
    throw new Error(`Los e2e no pueden vaciar la base "${base}"`);
  }
  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tablas.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`,
  );
}

export const PASSWORD_DE_TEST = 'contraseña-de-test';

export async function crearMarca(prisma: PrismaService, slug: string) {
  return prisma.marca.create({
    data: { nombre: `Marca ${slug}`, slug, whatsapp: '5491100000000' },
  });
}

export async function crearUsuario(
  prisma: PrismaService,
  datos: { email: string; marcaId?: string; activo?: boolean },
) {
  return prisma.usuario.create({
    data: {
      email: datos.email,
      passwordHash: await hashPassword(PASSWORD_DE_TEST),
      rol: datos.marcaId ? 'FABRICANTE' : 'ADMIN',
      marcaId: datos.marcaId,
      activo: datos.activo,
    },
  });
}
