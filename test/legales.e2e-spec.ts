import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { HEADER_HOST_TIENDA } from '../src/schemas/tienda.js';
import { cliente, crearApp, tokenDe, type AppDeTest } from './utils/app.js';
import { crearMarca, crearUsuario, limpiarBase } from './utils/db.js';

describe('Textos legales (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let admin: ReturnType<typeof cliente>;

  const configuracion = () =>
    request(app.getHttpServer())
      .get('/tienda')
      .set(HEADER_HOST_TIENDA, 'mi-marca.plataforma.test')
      .expect(200);

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    const marca = await crearMarca(prisma, 'mi-marca');
    await crearUsuario(prisma, { email: 'admin@test.com' });
    await crearUsuario(prisma, { email: 'f@test.com', marcaId: marca.id });
    admin = cliente(app, await tokenDe(app, 'admin@test.com'));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('panel de Piter', () => {
    it('lista los dos tipos aunque no estén cargados', async () => {
      const res = await admin.get('/admin/legales').expect(200);
      expect(res.body).toEqual([
        { tipo: 'TERMINOS', contenido: '', actualizadoEn: null },
        { tipo: 'PRIVACIDAD', contenido: '', actualizadoEn: null },
      ]);
    });

    it('guarda y reemplaza el contenido', async () => {
      await admin
        .put('/admin/legales/TERMINOS')
        .send({ contenido: 'Versión 1' })
        .expect(200);
      const res = await admin
        .put('/admin/legales/TERMINOS')
        .send({ contenido: '  Versión 2  ' })
        .expect(200);
      expect(res.body).toEqual({
        tipo: 'TERMINOS',
        contenido: 'Versión 2',
        actualizadoEn: expect.any(String),
      });

      const lista = await admin.get('/admin/legales').expect(200);
      expect(lista.body[0].contenido).toBe('Versión 2');
      expect(lista.body[1].actualizadoEn).toBeNull();
    });

    it('400 con un tipo inexistente', async () => {
      await admin
        .put('/admin/legales/COOKIES')
        .send({ contenido: 'x' })
        .expect(400);
    });

    it('solo el admin puede verlos y editarlos', async () => {
      const fabricante = cliente(app, await tokenDe(app, 'f@test.com'));
      await fabricante.get('/admin/legales').expect(403);
      await fabricante
        .put('/admin/legales/TERMINOS')
        .send({ contenido: 'x' })
        .expect(403);
      await cliente(app).get('/admin/legales').expect(401);
      await cliente(app)
        .put('/admin/legales/TERMINOS')
        .send({ contenido: 'x' })
        .expect(401);
      expect(await prisma.textoLegal.count()).toBe(0);
    });
  });

  describe('tienda', () => {
    it('muestra los cargados, sin sesión', async () => {
      await admin
        .put('/admin/legales/PRIVACIDAD')
        .send({ contenido: 'Tus datos' })
        .expect(200);

      const res = await cliente(app)
        .get('/tienda/legales/PRIVACIDAD')
        .expect(200);
      expect(res.body).toMatchObject({
        tipo: 'PRIVACIDAD',
        contenido: 'Tus datos',
      });
      expect((await configuracion()).body.textosLegales).toEqual([
        'PRIVACIDAD',
      ]);
    });

    it('404 si no está cargado o quedó vacío', async () => {
      await cliente(app).get('/tienda/legales/TERMINOS').expect(404);

      await admin
        .put('/admin/legales/TERMINOS')
        .send({ contenido: 'Algo' })
        .expect(200);
      await admin
        .put('/admin/legales/TERMINOS')
        .send({ contenido: '   ' })
        .expect(200);
      const res = await cliente(app)
        .get('/tienda/legales/TERMINOS')
        .expect(404);
      expect(res.body.message).toBe('Texto no disponible');
      expect((await configuracion()).body.textosLegales).toEqual([]);
    });

    it('textosLegales sale en el orden de los tipos', async () => {
      for (const tipo of ['PRIVACIDAD', 'TERMINOS']) {
        await admin
          .put(`/admin/legales/${tipo}`)
          .send({ contenido: 'x' })
          .expect(200);
      }
      expect((await configuracion()).body.textosLegales).toEqual([
        'TERMINOS',
        'PRIVACIDAD',
      ]);
    });
  });
});
