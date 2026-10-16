import { PrismaService } from '../src/prisma/prisma.service.js';
import { cliente, crearApp, tokenDe, type AppDeTest } from './utils/app.js';
import { crearMarca, crearUsuario, limpiarBase } from './utils/db.js';

describe('Panel: GET /panel/categorias (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    const marca = await crearMarca(prisma, 'una-marca');
    await crearUsuario(prisma, { email: 'admin@test.com' });
    await crearUsuario(prisma, { email: 'f@test.com', marcaId: marca.id });
  });

  afterAll(async () => {
    await app.close();
  });

  it('devuelve el árbol de categorías, igual que el panel de Piter', async () => {
    const admin = cliente(app, await tokenDe(app, 'admin@test.com'));
    const { body: mujer } = await admin
      .post('/admin/categorias')
      .send({ nombre: 'Mujer' })
      .expect(201);
    await admin
      .post('/admin/categorias')
      .send({ nombre: 'Remeras', padreId: mujer.id })
      .expect(201);
    await admin.post('/admin/categorias').send({ nombre: 'Calzado' });

    const fabricante = cliente(app, await tokenDe(app, 'f@test.com'));
    const res = await fabricante.get('/panel/categorias').expect(200);

    expect(
      res.body.map((c: { slug: string; subcategorias: { slug: string }[] }) => [
        c.slug,
        c.subcategorias.map((s) => s.slug),
      ]),
    ).toEqual([
      ['mujer', ['mujer-remeras']],
      ['calzado', []],
    ]);
    expect(res.body).toEqual(
      (await admin.get('/admin/categorias').expect(200)).body,
    );
  });

  it('el fabricante no puede modificarlas', async () => {
    const fabricante = cliente(app, await tokenDe(app, 'f@test.com'));
    await fabricante
      .post('/admin/categorias')
      .send({ nombre: 'X' })
      .expect(403);
    await fabricante
      .post('/panel/categorias')
      .send({ nombre: 'X' })
      .expect(404);
  });
});
