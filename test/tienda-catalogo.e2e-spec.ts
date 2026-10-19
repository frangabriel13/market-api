import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { HEADER_HOST_TIENDA } from '../src/schemas/tienda.js';
import { crearApp, type AppDeTest } from './utils/app.js';
import { crearMarca, limpiarBase } from './utils/db.js';

describe('Tienda: categorías y productos (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let marcaId: string;
  let ids: Record<'remera' | 'gorra' | 'vestido' | 'oculto' | 'deB', string>;

  const tienda = (url: string) =>
    request(app.getHttpServer())
      .get(url)
      .set(HEADER_HOST_TIENDA, 'mi-marca.plataforma.test');

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    marcaId = (await crearMarca(prisma, 'mi-marca')).id;
    await prisma.marca.update({
      where: { id: marcaId },
      data: { colores: ['Negro', 'Blanco'], talles: ['S', 'M'] },
    });
    const otraMarca = (await crearMarca(prisma, 'otra-marca')).id;

    const categoria = (nombre: string, slug: string, padreId?: string) =>
      prisma.categoria
        .create({ data: { nombre, slug, padreId } })
        .then((c) => c.id);
    const mujer = await categoria('Mujer', 'mujer');
    const remeras = await categoria('Remeras', 'mujer-remeras', mujer);
    await categoria('Jeans', 'mujer-jeans', mujer);
    const accesorios = await categoria('Accesorios', 'accesorios');
    const hombre = await categoria('Hombre', 'hombre');
    const calzado = await categoria('Calzado', 'calzado');

    let dia = 0;
    const producto = (
      nombre: string,
      categoriaId: string,
      extra: { visible?: boolean; marcaId?: string } = {},
    ) =>
      prisma.producto
        .create({
          data: {
            nombre,
            precio: 12500,
            categoriaId,
            marcaId,
            creadoEn: new Date(2026, 9, ++dia),
            ...extra,
          },
        })
        .then((p) => p.id);
    ids = {
      remera: await producto('Remera', remeras),
      gorra: await producto('Gorra', accesorios),
      vestido: await producto('Vestido', mujer),
      oculto: await producto('Oculto', hombre, { visible: false }),
      deB: await producto('De B', calzado, { marcaId: otraMarca }),
    };

    await prisma.variante.createMany({
      data: [
        { productoId: ids.remera, color: 'Blanco', talle: 'M' },
        {
          productoId: ids.remera,
          color: 'Negro',
          talle: 'S',
          disponible: false,
        },
        // Rojo ya no está en la lista de la marca: no cuenta.
        { productoId: ids.vestido, color: 'Rojo', talle: 'S' },
        {
          productoId: ids.vestido,
          color: 'Negro',
          talle: 'S',
          disponible: false,
        },
      ],
    });
    const foto = (orden: number) => ({
      productoId: ids.remera,
      url: `https://imagenes.test/${orden}.webp`,
      urlMiniatura: `https://imagenes.test/${orden}-mini.webp`,
      orden,
    });
    await prisma.fotoProducto.createMany({ data: [foto(1), foto(0)] });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /tienda/categorias', () => {
    it('solo las que tienen productos visibles de la marca', async () => {
      const res = await tienda('/tienda/categorias').expect(200);
      expect(res.body).toEqual([
        { nombre: 'Accesorios', slug: 'accesorios', subcategorias: [] },
        {
          nombre: 'Mujer',
          slug: 'mujer',
          subcategorias: [{ nombre: 'Remeras', slug: 'mujer-remeras' }],
        },
      ]);
    });

    it('muestra la categoría padre aunque solo tengan productos sus subcategorías', async () => {
      await prisma.producto.delete({ where: { id: ids.vestido } });
      const res = await tienda('/tienda/categorias').expect(200);
      expect(res.body.map((c: { slug: string }) => c.slug)).toContain('mujer');
    });
  });

  describe('GET /tienda/productos', () => {
    it('los visibles de la marca, de los más nuevos a los más viejos', async () => {
      const res = await tienda('/tienda/productos').expect(200);
      expect(res.body).toEqual([
        {
          id: ids.vestido,
          nombre: 'Vestido',
          precio: 12500,
          miniatura: null,
          agotado: true,
        },
        {
          id: ids.gorra,
          nombre: 'Gorra',
          precio: 12500,
          miniatura: null,
          agotado: true,
        },
        {
          id: ids.remera,
          nombre: 'Remera',
          precio: 12500,
          miniatura: 'https://imagenes.test/0-mini.webp',
          agotado: false,
        },
      ]);
    });

    it.each([
      ['mujer', ['vestido', 'remera']],
      ['mujer-remeras', ['remera']],
      ['MUJER-REMERAS', ['remera']],
      ['calzado', []],
      ['hombre', []],
    ] as const)('?categoria=%s', async (categoria, esperados) => {
      const res = await tienda(
        `/tienda/productos?categoria=${categoria}`,
      ).expect(200);
      expect(res.body.map((p: { id: string }) => p.id)).toEqual(
        esperados.map((nombre) => ids[nombre]),
      );
    });

    it('404 con una categoría inexistente y 400 con una inválida', async () => {
      const res = await tienda('/tienda/productos?categoria=no-existe').expect(
        404,
      );
      expect(res.body.message).toBe('Categoría no encontrada');
      await tienda('/tienda/productos?categoria=no_vale').expect(400);
    });
  });

  describe('GET /tienda/productos/:id', () => {
    it('devuelve el detalle con las variantes vigentes', async () => {
      const res = await tienda(`/tienda/productos/${ids.remera}`).expect(200);
      expect(res.body).toEqual({
        id: ids.remera,
        nombre: 'Remera',
        descripcion: null,
        precio: 12500,
        categoria: { nombre: 'Remeras', slug: 'mujer-remeras' },
        fotos: [
          {
            url: 'https://imagenes.test/0.webp',
            urlMiniatura: 'https://imagenes.test/0-mini.webp',
          },
          {
            url: 'https://imagenes.test/1.webp',
            urlMiniatura: 'https://imagenes.test/1-mini.webp',
          },
        ],
        variantes: [
          { color: 'Negro', talle: 'S', disponible: false },
          { color: 'Blanco', talle: 'M', disponible: true },
        ],
        agotado: false,
      });
    });

    it('agotado si solo está disponible una combinación que ya no es de la marca', async () => {
      const res = await tienda(`/tienda/productos/${ids.vestido}`).expect(200);
      expect(res.body.variantes).toEqual([
        { color: 'Negro', talle: 'S', disponible: false },
      ]);
      expect(res.body.agotado).toBe(true);
    });

    it.each([
      ['oculto', () => ids.oculto],
      ['de otra marca', () => ids.deB],
      ['inexistente', () => '0199f0f0-0000-7000-8000-000000000000'],
    ])('404 si es %s', async (_, id) => {
      const res = await tienda(`/tienda/productos/${id()}`).expect(404);
      expect(res.body).toMatchObject({ message: 'Producto no encontrado' });
    });

    it('404 en la tienda de la otra marca', async () => {
      await request(app.getHttpServer())
        .get(`/tienda/productos/${ids.remera}`)
        .set(HEADER_HOST_TIENDA, 'otra-marca.plataforma.test')
        .expect(404);
    });
  });

  describe('GET /tienda/destacados', () => {
    it('con pocos productos, son todos los visibles, igual que el listado', async () => {
      const destacados = await tienda('/tienda/destacados').expect(200);
      const todos = await tienda('/tienda/productos').expect(200);
      expect(destacados.body).toEqual(todos.body);
    });

    it('los 8 visibles más nuevos', async () => {
      const { categoriaId } = await prisma.producto.findUniqueOrThrow({
        where: { id: ids.remera },
      });
      const nuevos = Array.from({ length: 10 }, (_, i) => ({
        nombre: `Nuevo ${i}`,
        precio: 1000,
        categoriaId,
        marcaId,
        creadoEn: new Date(2026, 10, i + 1),
        visible: i !== 9,
      }));
      await prisma.producto.createMany({ data: nuevos });

      const res = await tienda('/tienda/destacados').expect(200);
      expect(res.body.map((p: { nombre: string }) => p.nombre)).toEqual([
        'Nuevo 8',
        'Nuevo 7',
        'Nuevo 6',
        'Nuevo 5',
        'Nuevo 4',
        'Nuevo 3',
        'Nuevo 2',
        'Nuevo 1',
      ]);
    });
  });

  it.each([
    '/tienda/categorias',
    '/tienda/productos',
    '/tienda/productos/:id',
    '/tienda/destacados',
  ])('%s: con la marca pausada, tienda no disponible', async (ruta) => {
    await prisma.marca.update({
      where: { id: marcaId },
      data: { estado: 'PAUSADA' },
    });
    const res = await tienda(ruta.replace(':id', ids.remera)).expect(404);
    expect(res.body.message).toBe('Tienda no disponible');
  });
});
