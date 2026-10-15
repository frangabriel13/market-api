// Seed: `pnpm prisma db seed`. Se puede correr varias veces: lo que ya
// existe no se toca.
//   - Siempre: categorías de ejemplo y el usuario ADMIN (Piter).
//   - Fuera de producción: una marca de prueba con su fabricante.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { hashPassword } from '../src/common/password.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

// En el .env, `VAR=` llega como string vacío: lo tratamos como no definida.
const opcional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const env = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    DATABASE_URL: z.string().min(1),
    SEED_ADMIN_EMAIL: z.email(),
    SEED_ADMIN_PASSWORD: z.string().min(12),
    SEED_FABRICANTE_EMAIL: opcional(z.email()),
    SEED_FABRICANTE_PASSWORD: opcional(z.string().min(12)),
  })
  .parse(process.env);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

// TODO(decision): lista de ejemplo; falta la lista real de categorías de Piter.
const CATEGORIAS: { nombre: string; subcategorias: string[] }[] = [
  { nombre: 'Mujer', subcategorias: ['Remeras', 'Pantalones', 'Vestidos'] },
  { nombre: 'Hombre', subcategorias: ['Remeras', 'Pantalones', 'Buzos'] },
  { nombre: 'Calzado', subcategorias: ['Zapatillas', 'Sandalias'] },
  {
    nombre: 'Ropa interior',
    subcategorias: ['Corpiños', 'Bombachas', 'Bóxers'],
  },
];

function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function seedCategorias() {
  for (const [i, categoria] of CATEGORIAS.entries()) {
    const slug = slugify(categoria.nombre);
    const padre = await prisma.categoria.upsert({
      where: { slug },
      update: {},
      create: { nombre: categoria.nombre, slug, orden: i },
    });
    for (const [j, nombre] of categoria.subcategorias.entries()) {
      // El slug es único global: se le antepone el del padre.
      const slugSub = `${slug}-${slugify(nombre)}`;
      await prisma.categoria.upsert({
        where: { slug: slugSub },
        update: {},
        create: { nombre, slug: slugSub, padreId: padre.id, orden: j },
      });
    }
  }
}

async function seedAdmin() {
  await prisma.usuario.upsert({
    where: { email: env.SEED_ADMIN_EMAIL.toLowerCase() },
    update: {},
    create: {
      email: env.SEED_ADMIN_EMAIL.toLowerCase(),
      passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
      rol: 'ADMIN',
    },
  });
}

async function seedMarcaDePrueba() {
  if (!env.SEED_FABRICANTE_EMAIL || !env.SEED_FABRICANTE_PASSWORD) {
    console.log(
      'Sin SEED_FABRICANTE_EMAIL/PASSWORD: no se crea la marca de prueba.',
    );
    return;
  }

  const marca = await prisma.marca.upsert({
    where: { slug: 'prueba' },
    update: {},
    create: {
      nombre: 'Marca de prueba',
      slug: 'prueba',
      whatsapp: '5491100000000',
      textosBanner: ['Venta mayorista', 'Envíos a todo el país'],
      redes: { instagram: '' },
      comoComprar:
        'Armá tu pedido en la tienda y envialo por WhatsApp. Te respondemos con el total y los datos para pagar.',
      condicionesVenta: 'Compra mínima de $ 50.000 por pedido.',
      minimoCompra: 50000,
      colores: ['Blanco', 'Negro', 'Gris'],
      talles: ['S', 'M', 'L', 'XL'],
      direccionRetiro: 'Dirección de prueba 123, CABA',
      horariosRetiro: 'Lunes a viernes de 9 a 17',
    },
  });

  const opciones = await prisma.opcionEntrega.count({
    where: { marcaId: marca.id },
  });
  if (opciones === 0) {
    await prisma.opcionEntrega.createMany({
      data: [
        {
          marcaId: marca.id,
          nombre: 'Retiro en showroom',
          tipo: 'RETIRO',
          orden: 0,
        },
        {
          marcaId: marca.id,
          nombre: 'Expreso a domicilio',
          tipo: 'ENVIO',
          orden: 1,
        },
      ],
    });
  }

  await prisma.usuario.upsert({
    where: { email: env.SEED_FABRICANTE_EMAIL.toLowerCase() },
    update: {},
    create: {
      email: env.SEED_FABRICANTE_EMAIL.toLowerCase(),
      passwordHash: await hashPassword(env.SEED_FABRICANTE_PASSWORD),
      rol: 'FABRICANTE',
      marcaId: marca.id,
    },
  });
}

async function main() {
  await seedCategorias();
  await seedAdmin();
  if (env.NODE_ENV !== 'production') {
    await seedMarcaDePrueba();
  }
  console.log('Seed listo.');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
