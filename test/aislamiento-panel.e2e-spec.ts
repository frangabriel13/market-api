import type { MockInstance } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { StorageService } from '../src/storage/storage.service.js';
import {
  cliente,
  crearApp,
  rutasRegistradas,
  tokenDe,
  type AppDeTest,
  type Metodo,
} from './utils/app.js';
import {
  crearCategoria,
  crearMarca,
  crearPedido,
  crearProducto,
  crearUsuario,
  limpiarBase,
} from './utils/db.js';

// Revisión de conjunto del panel: cada ruta /panel, usada por el fabricante
// de la marca A contra datos de la marca B, no deja ver ni tocar nada de B.
// Si se agrega una ruta /panel y no se suma acá, el primer test falla.

interface Ids {
  productoA: string;
  productoB: string;
  fotoB: string;
  pedidoA: string;
  pedidoB: string;
  categoriaId: string;
}

interface Ruta {
  metodo: Metodo;
  ruta: string;
  // Con ids de la marca B: tiene que responder 404.
  ajena?: (ids: Ids) => { url: string; cuerpo?: object };
}

const RUTAS: Ruta[] = [
  { metodo: 'get', ruta: '/panel/marca' },
  { metodo: 'get', ruta: '/panel/categorias' },
  { metodo: 'get', ruta: '/panel/productos' },
  { metodo: 'post', ruta: '/panel/productos' },
  {
    metodo: 'get',
    ruta: '/panel/productos/:id',
    ajena: ({ productoB }) => ({ url: `/panel/productos/${productoB}` }),
  },
  {
    metodo: 'patch',
    ruta: '/panel/productos/:id',
    ajena: ({ productoB }) => ({
      url: `/panel/productos/${productoB}`,
      cuerpo: { nombre: 'Robado' },
    }),
  },
  {
    metodo: 'patch',
    ruta: '/panel/productos/:id/visibilidad',
    ajena: ({ productoB }) => ({
      url: `/panel/productos/${productoB}/visibilidad`,
      cuerpo: { visible: false },
    }),
  },
  {
    metodo: 'put',
    ruta: '/panel/productos/:id/variantes',
    ajena: ({ productoB }) => ({
      url: `/panel/productos/${productoB}/variantes`,
      cuerpo: { variantes: [] },
    }),
  },
  {
    metodo: 'delete',
    ruta: '/panel/productos/:id',
    ajena: ({ productoB }) => ({ url: `/panel/productos/${productoB}` }),
  },
  {
    metodo: 'post',
    ruta: '/panel/fotos',
    ajena: ({ productoB }) => ({
      url: '/panel/fotos',
      cuerpo: { productoId: productoB, contentType: 'image/webp', tamanio: 1 },
    }),
  },
  {
    metodo: 'post',
    ruta: '/panel/productos/:id/fotos',
    ajena: ({ productoB }) => ({
      url: `/panel/productos/${productoB}/fotos`,
      cuerpo: { url: 'https://imagenes.test/x.webp' },
    }),
  },
  {
    metodo: 'put',
    ruta: '/panel/productos/:id/fotos/orden',
    ajena: ({ productoB, fotoB }) => ({
      url: `/panel/productos/${productoB}/fotos/orden`,
      cuerpo: { fotoIds: [fotoB] },
    }),
  },
  {
    metodo: 'delete',
    ruta: '/panel/productos/:id/fotos/:fotoId',
    ajena: ({ productoB, fotoB }) => ({
      url: `/panel/productos/${productoB}/fotos/${fotoB}`,
    }),
  },
  { metodo: 'get', ruta: '/panel/pedidos' },
  {
    metodo: 'get',
    ruta: '/panel/pedidos/:id',
    ajena: ({ pedidoB }) => ({ url: `/panel/pedidos/${pedidoB}` }),
  },
  {
    metodo: 'patch',
    ruta: '/panel/pedidos/:id/estado',
    ajena: ({ pedidoB }) => ({
      url: `/panel/pedidos/${pedidoB}/estado`,
      cuerpo: { estado: 'CANCELADO' },
    }),
  },
];

const conIdsCualquiera = (ruta: string) =>
  ruta.replace(/:\w+/g, '0199f0f0-0000-7000-8000-000000000000');

describe('Aislamiento del panel por marca (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let ids: Ids;
  let fabricanteA: ReturnType<typeof cliente>;
  let borrar: MockInstance<StorageService['borrar']>;

  const datosDeB = async () => ({
    productos: await prisma.producto.findMany({
      where: { marca: { slug: 'marca-b' } },
      include: { fotos: true, variantes: true },
      orderBy: { id: 'asc' },
    }),
    pedidos: await prisma.pedido.findMany({
      where: { marca: { slug: 'marca-b' } },
      include: { items: true },
    }),
  });

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    const marcaA = (await crearMarca(prisma, 'marca-a')).id;
    const marcaB = (await crearMarca(prisma, 'marca-b')).id;
    await prisma.marca.updateMany({
      data: { colores: ['Negro'], talles: ['M'] },
    });
    const categoriaId = (await crearCategoria(prisma, 'remeras')).id;
    const productoA = (
      await crearProducto(prisma, { marcaId: marcaA, categoriaId })
    ).id;
    const productoB = (
      await crearProducto(prisma, {
        marcaId: marcaB,
        categoriaId,
        nombre: 'De B',
      })
    ).id;
    await prisma.variante.create({
      data: { productoId: productoB, color: 'Negro', talle: 'M' },
    });
    const fotoB = (
      await prisma.fotoProducto.create({
        data: {
          productoId: productoB,
          url: `https://imagenes.test/marcas/${marcaB}/productos/${productoB}/f.webp`,
          urlMiniatura: `https://imagenes.test/marcas/${marcaB}/productos/${productoB}/m.webp`,
          orden: 0,
        },
      })
    ).id;
    const pedidoA = (await crearPedido(prisma, { marcaId: marcaA, numero: 1 }))
      .id;
    const pedidoB = (
      await crearPedido(prisma, {
        marcaId: marcaB,
        numero: 1,
        compradorNombre: 'De B',
      })
    ).id;
    ids = { productoA, productoB, fotoB, pedidoA, pedidoB, categoriaId };

    await crearUsuario(prisma, { email: 'admin@test.com' });
    await crearUsuario(prisma, { email: 'a@test.com', marcaId: marcaA });
    fabricanteA = cliente(app, await tokenDe(app, 'a@test.com'));
    borrar = vi.spyOn(app.get(StorageService), 'borrar').mockResolvedValue();
  });

  afterEach(() => borrar.mockRestore());

  afterAll(async () => {
    await app.close();
  });

  it('la tabla cubre todas las rutas /panel registradas', () => {
    const enTabla = RUTAS.map((r) => `${r.metodo.toUpperCase()} ${r.ruta}`);
    expect(rutasRegistradas(app, '/panel').sort()).toEqual(enTabla.sort());
  });

  it.each(RUTAS)(
    '$metodo $ruta: 401 sin sesión y 403 para el admin',
    async ({ metodo, ruta }) => {
      const url = conIdsCualquiera(ruta);
      await cliente(app)[metodo](url).expect(401);
      const admin = cliente(app, await tokenDe(app, 'admin@test.com'));
      await admin[metodo](url).expect(403);
    },
  );

  it.each(RUTAS.filter((r) => r.ajena))(
    '$metodo $ruta: 404 con datos de otra marca, sin tocarlos',
    async ({ metodo, ajena }) => {
      const antes = await datosDeB();
      const { url, cuerpo } = ajena!(ids);
      const res = await fabricanteA[metodo](url).send(cuerpo).expect(404);
      expect(JSON.stringify(res.body)).not.toContain('De B');
      expect(await datosDeB()).toEqual(antes);
      expect(borrar).not.toHaveBeenCalled();
    },
  );

  it('las rutas sin id solo muestran y crean datos de la propia marca', async () => {
    const lista = await fabricanteA.get('/panel/productos').expect(200);
    expect(lista.body.map((p: { id: string }) => p.id)).toEqual([
      ids.productoA,
    ]);

    const pedidos = await fabricanteA.get('/panel/pedidos').expect(200);
    expect(pedidos.body.map((p: { id: string }) => p.id)).toEqual([
      ids.pedidoA,
    ]);

    const marca = await fabricanteA.get('/panel/marca').expect(200);
    expect(marca.body.slug).toBe('marca-a');

    // Las categorías son globales: el fabricante ve las mismas que Piter.
    const admin = cliente(app, await tokenDe(app, 'admin@test.com'));
    const deAdmin = await admin.get('/admin/categorias').expect(200);
    const delPanel = await fabricanteA.get('/panel/categorias').expect(200);
    expect(delPanel.body).toEqual(deAdmin.body);

    const creado = await fabricanteA
      .post('/panel/productos')
      .send({
        nombre: 'Nuevo',
        precio: 1000,
        categoriaId: ids.categoriaId,
        marcaId: 'cualquiera',
      })
      .expect(201);
    const guardado = await prisma.producto.findUniqueOrThrow({
      where: { id: creado.body.id },
      select: { marca: { select: { slug: true } } },
    });
    expect(guardado.marca.slug).toBe('marca-a');
  });

  it('no se puede quitar una foto de otra marca usando un producto propio', async () => {
    await fabricanteA
      .delete(`/panel/productos/${ids.productoA}/fotos/${ids.fotoB}`)
      .expect(404);
    expect(await prisma.fotoProducto.count({ where: { id: ids.fotoB } })).toBe(
      1,
    );
    expect(borrar).not.toHaveBeenCalled();
  });
});
