import type { MockInstance } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { ListasPanel } from '../src/schemas/listas.js';
import { StorageService } from '../src/storage/storage.service.js';
import { cliente, crearApp, tokenDe, type AppDeTest } from './utils/app.js';
import {
  crearCategoria,
  crearListaTalles,
  crearMarca,
  crearPedido,
  crearProducto,
  crearUsuario,
  limpiarBase,
} from './utils/db.js';

const INEXISTENTE = '0199f0f0-0000-7000-8000-000000000000';

describe('Panel: colores y listas de talles (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let panel: ReturnType<typeof cliente>;
  let borrar: MockInstance<StorageService['borrar']>;
  let marcaId: string;
  let ropa: string;
  let calzado: string;
  let remera: string;
  let zapatilla: string;

  const variantesDe = async (productoId: string) =>
    (
      await prisma.variante.findMany({
        where: { productoId },
        orderBy: [{ color: 'asc' }, { talle: 'asc' }],
      })
    ).map((v) => `${v.color} ${v.talle}${v.disponible ? '' : ' (agotado)'}`);

  const coloresGuardados = async () =>
    (await prisma.marca.findUniqueOrThrow({ where: { id: marcaId } })).colores;

  const editarColores = (colores: object[]) =>
    panel.put('/panel/colores').send({ colores });

  const editarLista = (id: string, datos: object) =>
    panel.patch(`/panel/listas-talles/${id}`).send(datos);

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    marcaId = (await crearMarca(prisma, 'mi-marca')).id;
    await prisma.marca.update({
      where: { id: marcaId },
      data: { colores: ['Negro', 'Blanco', 'Gris'] },
    });
    ropa = (
      await crearListaTalles(prisma, {
        marcaId,
        nombre: 'Ropa',
        talles: ['S', 'M', 'L'],
      })
    ).id;
    calzado = (
      await crearListaTalles(prisma, {
        marcaId,
        nombre: 'Calzado',
        talles: ['38', '40'],
      })
    ).id;
    const categoriaId = (await crearCategoria(prisma, 'remeras')).id;
    const producto = async (
      listaTallesId: string,
      variantes: { color: string; talle: string; disponible?: boolean }[],
    ) => {
      const { id } = await crearProducto(prisma, {
        marcaId,
        categoriaId,
        listaTallesId,
      });
      await prisma.variante.createMany({
        data: variantes.map((v) => ({ ...v, productoId: id })),
      });
      return id;
    };
    remera = await producto(ropa, [
      { color: 'Negro', talle: 'S' },
      { color: 'Negro', talle: 'M', disponible: false },
      { color: 'Blanco', talle: 'S' },
      // XL no está en la lista: oculta, no cuenta para Gris.
      { color: 'Gris', talle: 'XL' },
    ]);
    zapatilla = await producto(calzado, [
      { color: 'Negro', talle: '38' },
      // S no es de Calzado: oculta.
      { color: 'Blanco', talle: 'S' },
    ]);
    await producto(ropa, []);

    await crearUsuario(prisma, { email: 'a@test.com', marcaId });
    panel = cliente(app, await tokenDe(app, 'a@test.com'));
    borrar = vi.spyOn(app.get(StorageService), 'borrar').mockResolvedValue();
  });

  afterEach(() => borrar.mockRestore());

  afterAll(async () => {
    await app.close();
  });

  describe('GET /panel/listas', () => {
    it('trae cada valor con cuántos productos lo muestran, y las listas en el orden en que se crearon', async () => {
      const res = await panel.get('/panel/listas').expect(200);
      expect(res.body).toEqual({
        colores: [
          { nombre: 'Negro', productos: 2 },
          { nombre: 'Blanco', productos: 1 },
          { nombre: 'Gris', productos: 0 },
        ],
        listasTalles: [
          {
            id: ropa,
            nombre: 'Ropa',
            guiaTallesUrl: null,
            productos: 2,
            talles: [
              { nombre: 'S', productos: 1 },
              { nombre: 'M', productos: 1 },
              { nombre: 'L', productos: 0 },
            ],
          },
          {
            id: calzado,
            nombre: 'Calzado',
            guiaTallesUrl: null,
            productos: 1,
            talles: [
              { nombre: '38', productos: 1 },
              { nombre: '40', productos: 0 },
            ],
          },
        ],
      } satisfies ListasPanel);
    });

    it('un producto sin colores cuenta solo para sus talles', async () => {
      await prisma.producto.update({
        where: { id: remera },
        data: {
          conColores: false,
          variantes: { create: { color: '', talle: 'L' } },
        },
      });
      const res = await panel.get('/panel/listas').expect(200);
      expect(res.body.colores).toEqual([
        { nombre: 'Negro', productos: 1 },
        { nombre: 'Blanco', productos: 0 },
        { nombre: 'Gris', productos: 0 },
      ]);
      expect(res.body.listasTalles[0].talles).toEqual([
        { nombre: 'S', productos: 0 },
        { nombre: 'M', productos: 0 },
        { nombre: 'L', productos: 1 },
      ]);
    });

    it('una marca nueva arranca con las listas vacías', async () => {
      const nueva = await crearMarca(prisma, 'nueva');
      await crearUsuario(prisma, { email: 'n@test.com', marcaId: nueva.id });
      const otro = cliente(app, await tokenDe(app, 'n@test.com'));
      const res = await otro.get('/panel/listas').expect(200);
      expect(res.body).toEqual({ colores: [], listasTalles: [] });
    });
  });

  describe('PUT /panel/colores', () => {
    it('agrega, reordena, renombra y quita en un solo cambio', async () => {
      await crearPedido(prisma, { marcaId, numero: 1 });
      const res = await editarColores([
        { nombre: 'Blanco', anterior: 'Blanco' },
        { nombre: 'Negro azabache', anterior: 'Negro' },
        { nombre: 'Rojo' },
      ]).expect(200);

      expect(res.body.colores).toEqual([
        { nombre: 'Blanco', productos: 1 },
        { nombre: 'Negro azabache', productos: 2 },
        { nombre: 'Rojo', productos: 0 },
      ]);
      // El renombrado conserva la disponibilidad; Gris se oculta sin borrarse.
      expect(await variantesDe(remera)).toEqual([
        'Blanco S',
        'Gris XL',
        'Negro azabache M (agotado)',
        'Negro azabache S',
      ]);
      expect(await variantesDe(zapatilla)).toEqual([
        'Blanco S',
        'Negro azabache 38',
      ]);
      // Los pedidos viejos siguen con el nombre original.
      const item = await prisma.itemPedido.findFirstOrThrow();
      expect(item.color).toBe('Negro');
    });

    it('intercambia dos nombres', async () => {
      await editarColores([
        { nombre: 'Blanco', anterior: 'Negro' },
        { nombre: 'Negro', anterior: 'Blanco' },
        { nombre: 'Gris', anterior: 'Gris' },
      ]).expect(200);
      expect(await variantesDe(remera)).toEqual([
        'Blanco M (agotado)',
        'Blanco S',
        'Gris XL',
        'Negro S',
      ]);
      expect(await coloresGuardados()).toEqual(['Blanco', 'Negro', 'Gris']);
    });

    it('si el nombre nuevo tenía variantes ocultas, el renombrado ocupa su lugar', async () => {
      await editarColores([
        { nombre: 'Negro', anterior: 'Negro' },
        { nombre: 'Blanco', anterior: 'Blanco' },
      ]).expect(200);
      await editarColores([
        { nombre: 'Negro', anterior: 'Negro' },
        { nombre: 'Gris', anterior: 'Blanco' },
      ]).expect(200);
      expect(await variantesDe(remera)).toEqual([
        'Gris S',
        'Negro M (agotado)',
        'Negro S',
      ]);
    });

    it('409 si un color ya no estaba guardado, sin cambiar nada', async () => {
      const res = await editarColores([
        { nombre: 'Azul', anterior: 'Violeta' },
      ]).expect(409);
      expect(res.body.message).toMatch(/recargá la página/);
      expect(await coloresGuardados()).toEqual(['Negro', 'Blanco', 'Gris']);
    });

    it.each([
      ['colores repetidos', [{ nombre: 'Negro' }, { nombre: 'negro' }]],
      [
        'un color renombrado dos veces',
        [
          { nombre: 'Azul', anterior: 'Negro' },
          { nombre: 'Rojo', anterior: 'Negro' },
        ],
      ],
      ['un nombre vacío', [{ nombre: '  ' }]],
    ])('400 con %s', async (_, colores) => {
      await editarColores(colores).expect(400);
      expect(await coloresGuardados()).toEqual(['Negro', 'Blanco', 'Gris']);
    });
  });

  describe('POST /panel/listas-talles', () => {
    it('crea la lista al final', async () => {
      const res = await panel
        .post('/panel/listas-talles')
        .send({ nombre: 'Jeans', talles: ['26', '28'] })
        .expect(201);
      expect(res.body.listasTalles.at(-1)).toEqual({
        id: expect.any(String),
        nombre: 'Jeans',
        guiaTallesUrl: null,
        productos: 0,
        talles: [
          { nombre: '26', productos: 0 },
          { nombre: '28', productos: 0 },
        ],
      });
    });

    it('409 si ya tiene una lista con ese nombre', async () => {
      const res = await panel
        .post('/panel/listas-talles')
        .send({ nombre: 'Ropa', talles: [] })
        .expect(409);
      expect(res.body.message).toBe(
        'Ya tenés una lista de talles con ese nombre',
      );
    });

    it.each([
      ['sin nombre', { nombre: '', talles: [] }],
      ['con talles repetidos', { nombre: 'Jeans', talles: ['26', '26'] }],
    ])('400 %s', async (_, datos) => {
      await panel.post('/panel/listas-talles').send(datos).expect(400);
    });
  });

  describe('PATCH /panel/listas-talles/:id', () => {
    it('renombra un talle solo en los productos de esa lista', async () => {
      const res = await editarLista(ropa, {
        nombre: 'Remeras',
        talles: [
          { nombre: 'XS', anterior: 'S' },
          { nombre: 'M', anterior: 'M' },
        ],
      }).expect(200);

      expect(res.body.listasTalles[0]).toMatchObject({
        nombre: 'Remeras',
        talles: [
          { nombre: 'XS', productos: 1 },
          { nombre: 'M', productos: 1 },
        ],
      });
      expect(await variantesDe(remera)).toEqual([
        'Blanco XS',
        'Gris XL',
        'Negro M (agotado)',
        'Negro XS',
      ]);
      expect(await variantesDe(zapatilla)).toEqual(['Blanco S', 'Negro 38']);
    });

    it('409 si un talle ya no estaba guardado', async () => {
      await editarLista(ropa, {
        talles: [{ nombre: 'XXL', anterior: 'XL' }],
      }).expect(409);
    });

    it('409 con el nombre de otra lista', async () => {
      await editarLista(ropa, { nombre: 'Calzado' }).expect(409);
    });

    it('404 si no existe', async () => {
      await editarLista(INEXISTENTE, { nombre: 'Otra' }).expect(404);
    });
  });

  describe('guía de talles', () => {
    const subirGuia = async (id = ropa) =>
      (
        await panel
          .post(`/panel/listas-talles/${id}/guia`)
          .send({ contentType: 'image/webp', tamanio: 200_000 })
          .expect(201)
      ).body.url as string;

    it('da una URL firmada en la carpeta de la lista', async () => {
      const url = await subirGuia();
      expect(url).toMatch(
        new RegExp(
          `^https://imagenes\\.test/marcas/${marcaId}/talles/${ropa}/guia-[\\w-]+\\.webp$`,
        ),
      );
    });

    it('la guarda, borra la anterior al reemplazarla y la quita con null', async () => {
      const primera = await subirGuia();
      const res = await editarLista(ropa, { guiaTallesUrl: primera }).expect(
        200,
      );
      expect(res.body.listasTalles[0].guiaTallesUrl).toBe(primera);
      expect(borrar).not.toHaveBeenCalled();

      const segunda = await subirGuia();
      await editarLista(ropa, { guiaTallesUrl: segunda }).expect(200);
      await editarLista(ropa, { nombre: 'Remeras' }).expect(200);
      expect(borrar.mock.calls).toEqual([[primera]]);

      await editarLista(ropa, { guiaTallesUrl: null }).expect(200);
      expect(borrar.mock.calls).toEqual([[primera], [segunda]]);
    });

    it('400 con una guía subida para otra lista', async () => {
      const deCalzado = await subirGuia(calzado);
      await editarLista(ropa, { guiaTallesUrl: deCalzado }).expect(400);
    });

    it('404 si la lista no existe', async () => {
      await panel
        .post(`/panel/listas-talles/${INEXISTENTE}/guia`)
        .send({ contentType: 'image/webp', tamanio: 1 })
        .expect(404);
    });
  });

  describe('DELETE /panel/listas-talles/:id', () => {
    it('409 con cuántos productos la usan, sin borrarla', async () => {
      const res = await panel
        .delete(`/panel/listas-talles/${ropa}`)
        .expect(409);
      expect(res.body).toEqual({
        message: 'La usan 2 productos: cambiales la lista antes de borrarla',
        productos: 2,
      });
      expect(await prisma.listaTalles.count({ where: { id: ropa } })).toBe(1);
    });

    it('borra una lista sin productos y su guía', async () => {
      const { id } = await crearListaTalles(prisma, {
        marcaId,
        nombre: 'Jeans',
        talles: ['26'],
      });
      const guia = `https://imagenes.test/marcas/${marcaId}/talles/${id}/guia.webp`;
      await prisma.listaTalles.update({
        where: { id },
        data: { guiaTallesUrl: guia },
      });

      await panel.delete(`/panel/listas-talles/${id}`).expect(204);
      expect(await prisma.listaTalles.count({ where: { id } })).toBe(0);
      expect(borrar.mock.calls).toEqual([[guia]]);
    });
  });
});
