import sharp from 'sharp';
import type { MockInstance } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
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

describe('Panel: fotos de productos (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let storage: StorageService;
  let panel: ReturnType<typeof cliente>;
  let marcaA: string;
  let marcaB: string;
  let categoriaId: string;
  let productoId: string;
  let jpeg: Buffer;
  let descargar: MockInstance<StorageService['descargar']>;
  let subir: MockInstance<StorageService['subir']>;
  let borrar: MockInstance<StorageService['borrar']>;

  const carpeta = (marcaId = marcaA, id = productoId) =>
    `https://imagenes.test/marcas/${marcaId}/productos/${id}`;

  const pedirUrl = (cuerpo: object = {}) =>
    panel.post('/panel/fotos').send({
      productoId,
      contentType: 'image/webp',
      tamanio: 300_000,
      ...cuerpo,
    });

  const registrar = (url: string, id = productoId) =>
    panel.post(`/panel/productos/${id}/fotos`).send({ url });

  const cargarFotos = (cantidad: number, id = productoId, marcaId = marcaA) =>
    Promise.all(
      Array.from({ length: cantidad }, (_, orden) =>
        prisma.fotoProducto.create({
          data: {
            productoId: id,
            url: `${carpeta(marcaId, id)}/foto-${orden}.webp`,
            urlMiniatura: `${carpeta(marcaId, id)}/miniatura-${orden}.webp`,
            orden,
          },
        }),
      ),
    );

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
    jpeg = await sharp({
      create: { width: 1200, height: 1600, channels: 3, background: '#036' },
    })
      .jpeg()
      .toBuffer();
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    marcaA = (await crearMarca(prisma, 'marca-a')).id;
    marcaB = (await crearMarca(prisma, 'marca-b')).id;
    categoriaId = (await crearCategoria(prisma, 'remeras')).id;
    productoId = (await crearProducto(prisma, { marcaId: marcaA, categoriaId }))
      .id;
    await crearUsuario(prisma, { email: 'admin@test.com' });
    await crearUsuario(prisma, { email: 'a@test.com', marcaId: marcaA });
    panel = cliente(app, await tokenDe(app, 'a@test.com'));

    descargar = vi.spyOn(storage, 'descargar').mockResolvedValue(jpeg);
    subir = vi
      .spyOn(storage, 'subir')
      .mockImplementation(
        async (carpetaSubida, nombre) =>
          `https://imagenes.test/${carpetaSubida}/${nombre}-subida.webp`,
      );
    borrar = vi.spyOn(storage, 'borrar').mockResolvedValue();
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    await app.close();
  });

  describe('POST /panel/fotos', () => {
    it('firma una subida en la carpeta del producto', async () => {
      const res = await pedirUrl().expect(201);
      expect(res.body.uploadUrl).toContain(
        `/bucket-test/marcas/${marcaA}/productos/${productoId}/foto-`,
      );
      expect(res.body.url).toMatch(
        new RegExp(`^${carpeta()}/foto-[\\w-]+\\.webp$`),
      );
    });

    it('400 si el producto ya tiene 10 fotos', async () => {
      await cargarFotos(10);
      const res = await pedirUrl().expect(400);
      expect(res.body.message).toMatch(/ya tiene 10 fotos/);
    });

    it('400 si el archivo pesa más de 5 MB', async () => {
      await pedirUrl({ tamanio: 5 * 1024 * 1024 + 1 }).expect(400);
    });

    it('404 para un producto de otra marca', async () => {
      const ajeno = await crearProducto(prisma, {
        marcaId: marcaB,
        categoriaId,
      });
      await pedirUrl({ productoId: ajeno.id }).expect(404);
    });

    it('el admin no puede pedir URLs', async () => {
      const admin = cliente(app, await tokenDe(app, 'admin@test.com'));
      await admin
        .post('/panel/fotos')
        .send({ productoId, contentType: 'image/webp', tamanio: 1 })
        .expect(403);
    });
  });

  describe('POST /panel/productos/:id/fotos', () => {
    it('genera la miniatura, guarda la foto al final y devuelve el producto', async () => {
      const url = `${carpeta()}/foto-1.webp`;
      const res = await registrar(url).expect(201);

      expect(descargar).toHaveBeenCalledWith(url);
      const [carpetaSubida, nombre, contenido, tipo] = subir.mock.calls[0];
      expect([carpetaSubida, nombre, tipo]).toEqual([
        `marcas/${marcaA}/productos/${productoId}`,
        'miniatura',
        'image/webp',
      ]);
      const { format, width, height } = await sharp(contenido).metadata();
      expect({ format, width, height }).toEqual({
        format: 'webp',
        width: 360,
        height: 480,
      });
      expect(res.body.fotos).toEqual([
        {
          id: expect.any(String),
          url,
          urlMiniatura: `${carpeta()}/miniatura-subida.webp`,
          orden: 0,
        },
      ]);

      const segunda = await registrar(`${carpeta()}/foto-2.webp`).expect(201);
      expect(segunda.body.fotos.map((f: { orden: number }) => f.orden)).toEqual(
        [0, 1],
      );
    });

    it('400 si la foto no se subió para este producto', async () => {
      const otro = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
      });
      await registrar(`${carpeta(marcaA, otro.id)}/foto.webp`).expect(400);
      await registrar('https://otro.com/foto.webp').expect(400);
      expect(descargar).not.toHaveBeenCalled();
    });

    it('400 si el archivo no está en el bucket', async () => {
      descargar.mockResolvedValue(null);
      const res = await registrar(`${carpeta()}/foto.webp`).expect(400);
      expect(res.body.message).toBe('No se encontró la foto subida');
    });

    it('400 y borra el archivo si no es una imagen', async () => {
      descargar.mockResolvedValue(Buffer.from('no soy una imagen'));
      const url = `${carpeta()}/foto.webp`;
      const res = await registrar(url).expect(400);
      expect(res.body.message).toBe('El archivo no es una imagen válida');
      expect(borrar).toHaveBeenCalledWith(url);
      expect(await prisma.fotoProducto.count()).toBe(0);
    });

    it('400 si la foto ya está cargada', async () => {
      const url = `${carpeta()}/foto.webp`;
      await registrar(url).expect(201);
      await registrar(url).expect(400);
    });

    it('400 si ya tiene 10 fotos', async () => {
      await cargarFotos(10);
      await registrar(`${carpeta()}/foto-11.webp`).expect(400);
    });

    it('404 para un producto de otra marca', async () => {
      const ajeno = await crearProducto(prisma, {
        marcaId: marcaB,
        categoriaId,
      });
      await registrar(
        `${carpeta(marcaB, ajeno.id)}/foto.webp`,
        ajeno.id,
      ).expect(404);
      expect(descargar).not.toHaveBeenCalled();
    });
  });

  describe('PUT /panel/productos/:id/fotos/orden', () => {
    const reordenar = (fotoIds: string[], id = productoId) =>
      panel.put(`/panel/productos/${id}/fotos/orden`).send({ fotoIds });

    it('reordena las fotos', async () => {
      const [a, b, c] = await cargarFotos(3);
      const res = await reordenar([c.id, a.id, b.id]).expect(200);
      expect(
        res.body.fotos.map((f: { id: string; orden: number }) => [
          f.id,
          f.orden,
        ]),
      ).toEqual([
        [c.id, 0],
        [a.id, 1],
        [b.id, 2],
      ]);
    });

    it.each([
      ['falta una foto', ([a, b]: { id: string }[]) => [a.id, b.id]],
      ['una foto repetida', ([a, b]: { id: string }[]) => [a.id, b.id, b.id]],
    ])('400 si %s', async (_, armar) => {
      const fotos = await cargarFotos(3);
      await reordenar(armar(fotos)).expect(400);
    });

    it('400 si incluye una foto de otro producto', async () => {
      const [a, b] = await cargarFotos(2);
      const otro = await crearProducto(prisma, {
        marcaId: marcaA,
        categoriaId,
      });
      const [ajena] = await cargarFotos(1, otro.id);
      await reordenar([a.id, ajena.id]).expect(400);
      await reordenar([b.id, a.id]).expect(200);
    });

    it('404 para un producto de otra marca', async () => {
      const ajeno = await crearProducto(prisma, {
        marcaId: marcaB,
        categoriaId,
      });
      const [foto] = await cargarFotos(1, ajeno.id, marcaB);
      await reordenar([foto.id], ajeno.id).expect(404);
    });
  });

  describe('DELETE /panel/productos/:id/fotos/:fotoId', () => {
    it('quita la foto y borra del bucket la foto y su miniatura', async () => {
      const [a, b] = await cargarFotos(2);
      const res = await panel
        .delete(`/panel/productos/${productoId}/fotos/${a.id}`)
        .expect(200);

      expect(res.body.fotos.map((f: { id: string }) => f.id)).toEqual([b.id]);
      expect(borrar.mock.calls.flat().sort()).toEqual(
        [a.url, a.urlMiniatura].sort(),
      );
    });

    it('404 para una foto de otra marca, sin borrarla', async () => {
      const ajeno = await crearProducto(prisma, {
        marcaId: marcaB,
        categoriaId,
      });
      const [foto] = await cargarFotos(1, ajeno.id, marcaB);
      await panel
        .delete(`/panel/productos/${ajeno.id}/fotos/${foto.id}`)
        .expect(404);
      await panel
        .delete(`/panel/productos/${productoId}/fotos/${foto.id}`)
        .expect(404);
      expect(await prisma.fotoProducto.count()).toBe(1);
      expect(borrar).not.toHaveBeenCalled();
    });

    it('404 si la foto no existe', async () => {
      await panel
        .delete(`/panel/productos/${productoId}/fotos/${INEXISTENTE}`)
        .expect(404);
    });
  });
});
