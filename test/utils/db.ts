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

export async function crearCategoria(prisma: PrismaService, slug: string) {
  return prisma.categoria.create({ data: { nombre: slug, slug } });
}

export async function crearProducto(
  prisma: PrismaService,
  datos: { marcaId: string; categoriaId: string; nombre?: string },
) {
  return prisma.producto.create({
    data: { nombre: 'Remera', precio: 1000, ...datos },
  });
}

// Pedido de retiro con un ítem, y su propia opción de entrega.
export async function crearPedido(
  prisma: PrismaService,
  datos: { marcaId: string; numero: number; compradorNombre?: string },
) {
  const opcion = await prisma.opcionEntrega.create({
    data: { marcaId: datos.marcaId, nombre: 'Retiro', tipo: 'RETIRO' },
  });
  return prisma.pedido.create({
    data: {
      compradorNombre: 'Juan',
      ...datos,
      opcionEntregaId: opcion.id,
      tipoEntrega: 'RETIRO',
      compradorTelefono: '5491155555555',
      total: 2000,
      items: {
        create: {
          nombreProducto: 'Remera',
          color: 'Negro',
          talle: 'M',
          cantidad: 2,
          precioUnitario: 1000,
        },
      },
    },
  });
}
