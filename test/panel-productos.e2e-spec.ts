import type { MockInstance } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { VarianteProducto } from '../src/schemas/productos.js';
import { StorageService } from '../src/storage/storage.service.js';
import { cliente, crearApp, tokenDe, type AppDeTest } from './utils/app.js';
import {
  crearCategoria,
  crearMarca,
  crearProducto,
  crearUsuario,
  limpiarBase,
} from './utils/db.js';

const INEXISTENTE = '0199f0f0-0000-7000-8000-000000000000';

describe('Panel: productos (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let panel: ReturnType<typeof cliente>;
  let marcaA: string;
  let marcaB: string;
  let categoriaId: string;

  const NUEVO = () => ({
    nombre: 'Remera Lisa',
    descripcion: 'Algodón peinado',
    precio: 12000,
    categoriaId,
  });

  const fotoUrl = (marcaId: string, nombre: string) =>
    `https://imagenes.test/marcas/${marcaId}/productos/${nombre}`;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    marcaA = (await crearMarca(prisma, 'marca-a')).id;
    await prisma.marca.update({
      where: { id: marcaA },
      data: { colores: ['Negro', 'Blanco', 'Gris'], talles: ['S', 'M', 'L'] },
    });
    marcaB = (await crearMarca(prisma, 'marca-b')).id;
    categoriaId = (await crearCategoria(prisma, 'remeras')).id;
    await crearUsuario(prisma, { email: 'admin@test.com' });
    await crearUsuario(prisma, { email: 'a@test.com', marcaId: marcaA });
    panel = cliente(app, await tokenDe(app, 'a@test.com'));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('permisos', () => {
    it('sin sesión responde 401', async () => {
      await cliente(app).get('/panel/productos').expect(401);
    });

    it('el admin no puede usar el panel', async () => {
      const admin = cliente(app, await tokenDe(app, 'admin@test.com'));
      await admin.get('/panel/productos').expect(403);
      await admin.post('/panel/productos').send(NUEVO()).expect(403);
    });
  });

  describe('POST /panel/productos', () => {
    it('crea el producto publicado en la marca del token', async () => {
      const res = await panel
        .post('/panel/productos')
        .send(NUEVO())
        .expect(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        nombre: 'Remera Lisa',
        descripcion: 'Algodón peinado',
        precio: 12000,
        visible: true,
        categoria: { id: categoriaId, nombre: 'remeras' },
        fotos: [],
        variantes: [],
      });
      const guardado = await prisma.producto.findUniqueOrThrow({
        where: { id: res.body.id },
      });
      expect(guardado.marcaId).toBe(marcaA);
    });

    it('"Guardar sin publicar" lo crea oculto', async () => {
      const res = await panel
        .post('/panel/productos')
        .send({ ...NUEVO(), visible: false })
        .expect(201);
      expect(res.body.visible).toBe(false);
    });

    it('ignora un marcaId en el body', async () => {
      const res = await panel
        .post('/panel/productos')
        .send({ ...NUEVO(), marcaId: marcaB })
        .expect(201);
      const guardado = await prisma.producto.findUniqueOrThrow({
        where: { id: res.body.id },
      });
      expect(guardado.marcaId).toBe(marcaA);
    });

    it('guarda la descripción vacía como null', async () => {
      const res = await panel
        .post('/panel/productos')
        .send({ ...NUEVO(), descripcion: '  ' })
        .expect(201);
      expect(res.body.descripcion).toBeNull();
    });

    it('400 si la categoría no existe', async () => {
      const res = await panel
        .post('/panel/productos')
        .send({ ...NUEVO(), categoriaId: INEXISTENTE })
        .expect(400);
      expect(res.body.message).toBe('La categoría no existe');
    });

    it.each([
      ['sin nombre', { nombre: '' }, 'nombre'],
      ['precio 0', { precio: 0 }, 'precio'],
      ['precio con centavos', { precio: 1500.5 }, 'precio'],
      ['precio como texto', { precio: '1500' }, 'precio'],
      ['sin categoría', { categoriaId: undefined }, 'categoriaId'],
    ])('400 %s', async (_, cambio, campo) => {
      const res = await panel
        .post('/panel/productos')
        .send({ ...NUEVO(), ...cambio })
        .expect(400);
      expect(res.body.errors[0].path[0]).toBe(campo);
    });
  });

  describe('GET /panel/productos', () => {
    it('lista solo los de su marca, del más nuevo al más viejo, con la primera foto', async () => {
      const viejo = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
        nombre: 'Viejo',
      });
      await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
        nombre: 'Nuevo',
      });
      await crearProducto(prisma, {
        marcaId: marcaB,
        categoriaId,
        nombre: 'De otra marca',
      });
      await prisma.fotoProducto.createMany({
        data: [1, 0].map((orden) => ({
          productoId: viejo.id,
          url: fotoUrl(marcaA, `${orden}.webp`),
          urlMiniatura: fotoUrl(marcaA, `${orden}-mini.webp`),
          orden,
        })),
      });

      const res = await panel.get('/panel/productos').expect(200);
      expect(
        res.body.map((p: { nombre: string; miniatura: string | null }) => [
          p.nombre,
          p.miniatura,
        ]),
      ).toEqual([
        ['Nuevo', null],
        ['Viejo', fotoUrl(marcaA, '0-mini.webp')],
      ]);
    });
  });

  describe('GET /panel/productos/:id', () => {
    it('devuelve el detalle con fotos ordenadas y variantes', async () => {
      const { id } = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
      });
      await prisma.fotoProducto.createMany({
        data: [2, 1].map((orden) => ({
          productoId: id,
          url: fotoUrl(marcaA, `${orden}.webp`),
          urlMiniatura: fotoUrl(marcaA, `${orden}-mini.webp`),
          orden,
        })),
      });
      await prisma.variante.create({
        data: { productoId: id, color: 'Negro', talle: 'M', disponible: false },
      });

      const res = await panel.get(`/panel/productos/${id}`).expect(200);
      expect(res.body.fotos.map((f: { orden: number }) => f.orden)).toEqual([
        1, 2,
      ]);
      expect(res.body.variantes).toEqual([
        { color: 'Negro', talle: 'M', disponible: false },
      ]);
    });

    it('404 para un producto de otra marca', async () => {
      const ajeno = await crearProducto(prisma, {
        marcaId: marcaB,
        categoriaId,
      });
      await panel.get(`/panel/productos/${ajeno.id}`).expect(404);
    });

    it('404 si no existe', async () => {
      await panel.get(`/panel/productos/${INEXISTENTE}`).expect(404);
    });
  });

  describe('PATCH /panel/productos/:id', () => {
    it('cambia solo lo que se manda', async () => {
      const { id } = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
      });
      const otraCategoria = await crearCategoria(prisma, 'buzos');

      const res = await panel
        .patch(`/panel/productos/${id}`)
        .send({ precio: 15000, categoriaId: otraCategoria.id })
        .expect(200);
      expect(res.body).toMatchObject({
        nombre: 'Remera',
        precio: 15000,
        categoria: { id: otraCategoria.id, nombre: 'buzos' },
      });
    });

    it('no cambia la visibilidad (tiene su propio endpoint)', async () => {
      const { id } = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
      });
      const res = await panel
        .patch(`/panel/productos/${id}`)
        .send({ visible: false })
        .expect(200);
      expect(res.body.visible).toBe(true);
    });

    it('400 si la categoría nueva no existe', async () => {
      const { id } = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
      });
      await panel
        .patch(`/panel/productos/${id}`)
        .send({ categoriaId: INEXISTENTE })
        .expect(400);
    });

    it('404 para un producto de otra marca, sin modificarlo', async () => {
      const ajeno = await crearProducto(prisma, {
        marcaId: marcaB,
        categoriaId,
      });
      await panel
        .patch(`/panel/productos/${ajeno.id}`)
        .send({ nombre: 'Robado' })
        .expect(404);
      const sinCambios = await prisma.producto.findUniqueOrThrow({
        where: { id: ajeno.id },
      });
      expect(sinCambios.nombre).toBe('Remera');
    });
  });

  describe('PATCH /panel/productos/:id/visibilidad', () => {
    const visibilidad = (id: string, cuerpo: object) =>
      panel.patch(`/panel/productos/${id}/visibilidad`).send(cuerpo);

    it('oculta y vuelve a mostrar el producto', async () => {
      const { id } = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
      });

      const oculto = await visibilidad(id, { visible: false }).expect(200);
      expect(oculto.body).toMatchObject({ id, visible: false });

      const visible = await visibilidad(id, { visible: true }).expect(200);
      expect(visible.body.visible).toBe(true);
    });

    it('solo cambia la visibilidad', async () => {
      const { id } = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
      });
      const res = await visibilidad(id, {
        visible: false,
        nombre: 'Otro',
      }).expect(200);
      expect(res.body.nombre).toBe('Remera');
    });

    it.each([{}, { visible: 'no' }])('400 con %j', async (cuerpo) => {
      const { id } = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
      });
      await visibilidad(id, cuerpo).expect(400);
    });

    it('404 para un producto de otra marca, sin modificarlo', async () => {
      const ajeno = await crearProducto(prisma, {
        marcaId: marcaB,
        categoriaId,
      });
      await visibilidad(ajeno.id, { visible: false }).expect(404);
      const sinCambios = await prisma.producto.findUniqueOrThrow({
        where: { id: ajeno.id },
      });
      expect(sinCambios.visible).toBe(true);
    });

    it('el admin no puede cambiarla', async () => {
      const { id } = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
      });
      const admin = cliente(app, await tokenDe(app, 'admin@test.com'));
      await admin
        .patch(`/panel/productos/${id}/visibilidad`)
        .send({ visible: false })
        .expect(403);
    });
  });

  describe('PUT /panel/productos/:id/variantes', () => {
    let productoId: string;

    const v = (color: string, talle: string, disponible = true) => ({
      color,
      talle,
      disponible,
    });

    const matriz = (colores: string[], talles: string[]) =>
      colores.flatMap((color) => talles.map((talle) => v(color, talle)));

    const reemplazar = (variantes: object[], id = productoId) =>
      panel.put(`/panel/productos/${id}/variantes`).send({ variantes });

    const combinaciones = (res: { body: { variantes: VarianteProducto[] } }) =>
      res.body.variantes.map(({ color, talle }) => `${color} ${talle}`);

    beforeEach(async () => {
      productoId = (
        await crearProducto(prisma, { marcaId: marcaA, categoriaId })
      ).id;
    });

    it('guarda la matriz con hay y agotado, en el orden de las listas de la marca', async () => {
      const res = await reemplazar([
        v('Blanco', 'M'),
        v('Negro', 'M', false),
        v('Blanco', 'S', false),
        v('Negro', 'S'),
      ]).expect(200);

      expect(res.body.variantes).toEqual([
        v('Negro', 'S'),
        v('Negro', 'M', false),
        v('Blanco', 'S', false),
        v('Blanco', 'M'),
      ]);
      const detalle = await panel.get(`/panel/productos/${productoId}`);
      expect(detalle.body.variantes).toEqual(res.body.variantes);
    });

    it('reemplaza las variantes anteriores', async () => {
      await reemplazar(matriz(['Negro', 'Blanco'], ['S', 'M'])).expect(200);
      const res = await reemplazar(matriz(['Gris'], ['L'])).expect(200);
      expect(combinaciones(res)).toEqual(['Gris L']);
      expect(await prisma.variante.count()).toBe(1);
    });

    it('con la lista vacía quita todas', async () => {
      await reemplazar(matriz(['Negro'], ['S'])).expect(200);
      const res = await reemplazar([]).expect(200);
      expect(res.body.variantes).toEqual([]);
    });

    it.each([
      ['un color que no es de la marca', [v('Rojo', 'S')], /color "Rojo"/],
      ['un talle que no es de la marca', [v('Negro', 'XL')], /talle "XL"/],
      [
        'combinaciones repetidas',
        [v('Negro', 'S'), v('Negro', 'S', false)],
        /repetidas/,
      ],
      [
        'una matriz incompleta',
        [v('Negro', 'S'), v('Negro', 'M'), v('Blanco', 'S')],
        /Faltan combinaciones/,
      ],
    ])('400 con %s', async (_, variantes, mensaje) => {
      const res = await reemplazar(variantes).expect(400);
      const errores = [
        res.body.message,
        ...(res.body.errors ?? []).map((e: { message: string }) => e.message),
      ];
      expect(errores.join(' ')).toMatch(mensaje);
      expect(await prisma.variante.count()).toBe(0);
    });

    it('si Piter quita un color de la marca, sus variantes dejan de mostrarse y vuelven al agregarlo', async () => {
      await reemplazar(matriz(['Negro', 'Blanco'], ['S', 'M'])).expect(200);

      await prisma.marca.update({
        where: { id: marcaA },
        data: { colores: ['Negro', 'Gris'] },
      });
      const sinBlanco = await panel.get(`/panel/productos/${productoId}`);
      expect(combinaciones(sinBlanco)).toEqual(['Negro S', 'Negro M']);

      await prisma.marca.update({
        where: { id: marcaA },
        data: { colores: ['Negro', 'Blanco', 'Gris'] },
      });
      const conBlanco = await panel.get(`/panel/productos/${productoId}`);
      expect(combinaciones(conBlanco)).toEqual([
        'Negro S',
        'Negro M',
        'Blanco S',
        'Blanco M',
      ]);
    });

    it('404 para un producto de otra marca, sin tocar sus variantes', async () => {
      const ajeno = await crearProducto(prisma, {
        marcaId: marcaB,
        categoriaId,
      });
      await prisma.variante.create({
        data: { productoId: ajeno.id, color: 'Negro', talle: 'S' },
      });
      await reemplazar([], ajeno.id).expect(404);
      expect(
        await prisma.variante.count({ where: { productoId: ajeno.id } }),
      ).toBe(1);
    });

    it('el admin no puede cambiarlas', async () => {
      const admin = cliente(app, await tokenDe(app, 'admin@test.com'));
      await admin
        .put(`/panel/productos/${productoId}/variantes`)
        .send({ variantes: [] })
        .expect(403);
    });
  });

  describe('DELETE /panel/productos/:id', () => {
    let borrar: MockInstance<StorageService['borrar']>;

    beforeEach(() => {
      borrar = vi.spyOn(app.get(StorageService), 'borrar').mockResolvedValue();
    });

    afterEach(() => borrar.mockRestore());

    it('borra el producto, sus variantes y los archivos de sus fotos', async () => {
      const { id } = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
      });
      await prisma.fotoProducto.create({
        data: {
          productoId: id,
          url: fotoUrl(marcaA, 'f.webp'),
          urlMiniatura: fotoUrl(marcaA, 'f-mini.webp'),
          orden: 0,
        },
      });
      await prisma.variante.create({
        data: { productoId: id, color: 'Negro', talle: 'M' },
      });

      await panel.delete(`/panel/productos/${id}`).expect(204);

      expect(await prisma.producto.count()).toBe(0);
      expect(await prisma.fotoProducto.count()).toBe(0);
      expect(await prisma.variante.count()).toBe(0);
      expect(borrar.mock.calls.flat().sort()).toEqual(
        [fotoUrl(marcaA, 'f-mini.webp'), fotoUrl(marcaA, 'f.webp')].sort(),
      );
    });

    it('los pedidos conservan su copia del producto', async () => {
      const { id } = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
      });
      const opcion = await prisma.opcionEntrega.create({
        data: { marcaId: marcaA, nombre: 'Retiro', tipo: 'RETIRO' },
      });
      await prisma.pedido.create({
        data: {
          marcaId: marcaA,
          numero: 1,
          opcionEntregaId: opcion.id,
          tipoEntrega: 'RETIRO',
          compradorNombre: 'Juan',
          compradorTelefono: '5491155555555',
          total: 1000,
          items: {
            create: {
              productoId: id,
              nombreProducto: 'Remera',
              color: 'Negro',
              talle: 'M',
              cantidad: 1,
              precioUnitario: 1000,
            },
          },
        },
      });

      await panel.delete(`/panel/productos/${id}`).expect(204);

      const [item] = await prisma.itemPedido.findMany();
      expect(item).toMatchObject({
        productoId: null,
        nombreProducto: 'Remera',
      });
    });

    it('no borra archivos que no están en la carpeta de la marca', async () => {
      const { id } = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
      });
      await prisma.fotoProducto.create({
        data: {
          productoId: id,
          url: 'https://otro.com/f.webp',
          urlMiniatura: fotoUrl(marcaB, 'f-mini.webp'),
          orden: 0,
        },
      });
      await panel.delete(`/panel/productos/${id}`).expect(204);
      expect(borrar).not.toHaveBeenCalled();
    });

    it('si borrar los archivos falla, el producto igual se elimina', async () => {
      borrar.mockRejectedValue(new Error('almacenamiento caído'));
      const { id } = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
      });
      await prisma.fotoProducto.create({
        data: {
          productoId: id,
          url: fotoUrl(marcaA, 'f.webp'),
          urlMiniatura: fotoUrl(marcaA, 'f-mini.webp'),
          orden: 0,
        },
      });
      await panel.delete(`/panel/productos/${id}`).expect(204);
      expect(await prisma.producto.count()).toBe(0);
    });

    it('404 para un producto de otra marca, sin borrarlo', async () => {
      const ajeno = await crearProducto(prisma, {
        marcaId: marcaB,
        categoriaId,
      });
      await panel.delete(`/panel/productos/${ajeno.id}`).expect(404);
      expect(await prisma.producto.count()).toBe(1);
      expect(borrar).not.toHaveBeenCalled();
    });
  });
});
