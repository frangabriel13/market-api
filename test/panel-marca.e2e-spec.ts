import { PrismaService } from '../src/prisma/prisma.service.js';
import { cliente, crearApp, tokenDe, type AppDeTest } from './utils/app.js';
import { crearMarca, crearUsuario, limpiarBase } from './utils/db.js';

describe('Panel: GET /panel/marca (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let marcaId: string;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    marcaId = (
      await prisma.marca.create({
        data: {
          nombre: 'Textil Norte',
          slug: 'textil-norte',
          whatsapp: '5491155555555',
          logoUrl: 'https://imagenes.test/logo.webp',
          colores: ['Negro', 'Blanco'],
          talles: ['S', 'M'],
          minimoCompra: 50000,
        },
      })
    ).id;
    const otra = await crearMarca(prisma, 'otra');
    await crearUsuario(prisma, { email: 'admin@test.com' });
    await crearUsuario(prisma, { email: 'a@test.com', marcaId });
    await crearUsuario(prisma, { email: 'b@test.com', marcaId: otra.id });
  });

  afterAll(async () => {
    await app.close();
  });

  it('devuelve solo los datos de su marca que usa el panel', async () => {
    const panel = cliente(app, await tokenDe(app, 'a@test.com'));
    const res = await panel.get('/panel/marca').expect(200);
    expect(res.body).toEqual({
      id: marcaId,
      nombre: 'Textil Norte',
      slug: 'textil-norte',
      dominioPropio: null,
      estado: 'ACTIVA',
      logoUrl: 'https://imagenes.test/logo.webp',
      colores: ['Negro', 'Blanco'],
      talles: ['S', 'M'],
    });
  });

  it('cada fabricante ve la suya', async () => {
    const otro = cliente(app, await tokenDe(app, 'b@test.com'));
    const res = await otro.get('/panel/marca').expect(200);
    expect(res.body.slug).toBe('otra');
  });

  it('refleja los cambios que hace Piter', async () => {
    const panel = cliente(app, await tokenDe(app, 'a@test.com'));
    await prisma.marca.update({
      where: { id: marcaId },
      data: { talles: ['S', 'M', 'L'], estado: 'PAUSADA' },
    });
    const res = await panel.get('/panel/marca').expect(200);
    expect(res.body).toMatchObject({
      talles: ['S', 'M', 'L'],
      estado: 'PAUSADA',
    });
  });

  it('es solo lectura', async () => {
    const panel = cliente(app, await tokenDe(app, 'a@test.com'));
    await panel.patch('/panel/marca').send({ nombre: 'Otra' }).expect(404);
  });

  it('el admin no lo usa y sin sesión no se ve', async () => {
    const admin = cliente(app, await tokenDe(app, 'admin@test.com'));
    await admin.get('/panel/marca').expect(403);
    await cliente(app).get('/panel/marca').expect(401);
  });
});
