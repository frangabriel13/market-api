import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { cliente, crearApp, tokenDe, type AppDeTest } from './utils/app.js';
import { crearMarca, crearUsuario, limpiarBase } from './utils/db.js';

const INEXISTENTE = '0199f0f0-0000-7000-8000-000000000000';

describe('Admin: acceso del fabricante (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let admin: ReturnType<typeof cliente>;
  let marcaId: string;

  const crearAcceso = (email: string, id = marcaId) =>
    admin.post(`/admin/marcas/${id}/usuario`).send({ email });

  const login = (email: string, password: string) =>
    request(app.getHttpServer()).post('/auth/login').send({ email, password });

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    marcaId = (await crearMarca(prisma, 'una-marca')).id;
    await crearUsuario(prisma, { email: 'admin@test.com' });
    admin = cliente(app, await tokenDe(app, 'admin@test.com'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('crea el acceso y devuelve una contraseña que sirve para entrar', async () => {
    const res = await crearAcceso(' Fabrica@Test.com ').expect(200);
    expect(res.body).toEqual({
      email: 'fabrica@test.com',
      password: expect.stringMatching(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/),
    });

    const sesion = await login('fabrica@test.com', res.body.password).expect(
      200,
    );
    expect(sesion.body.usuario).toMatchObject({ rol: 'FABRICANTE', marcaId });

    const marca = await admin.get(`/admin/marcas/${marcaId}`).expect(200);
    expect(marca.body.usuario).toEqual({
      email: 'fabrica@test.com',
      activo: true,
    });
  });

  it('al resetear, la contraseña vieja deja de servir y se cierran las sesiones', async () => {
    const primera = (await crearAcceso('fabrica@test.com')).body.password;
    const sesionVieja = await login('fabrica@test.com', primera).expect(200);
    const cookieVieja = sesionVieja.headers['set-cookie'][0].split(';')[0];

    const segunda = (await crearAcceso('fabrica@test.com').expect(200)).body
      .password;
    expect(segunda).not.toBe(primera);

    await login('fabrica@test.com', primera).expect(401);
    await login('fabrica@test.com', segunda).expect(200);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieVieja)
      .expect(401);
    expect(await prisma.usuario.count({ where: { marcaId } })).toBe(1);
  });

  it('al resetear se puede cambiar el email', async () => {
    await crearAcceso('vieja@test.com').expect(200);
    const res = await crearAcceso('nueva@test.com').expect(200);

    await login('nueva@test.com', res.body.password).expect(200);
    await login('vieja@test.com', res.body.password).expect(401);
  });

  it('409 si el email ya es de otra cuenta', async () => {
    const res = await crearAcceso('admin@test.com').expect(409);
    expect(res.body.message).toBe('Ese email ya tiene una cuenta');

    const otra = await crearMarca(prisma, 'otra');
    await crearAcceso('fabrica@test.com', otra.id).expect(200);
    await crearAcceso('fabrica@test.com').expect(409);
  });

  it('400 con un email inválido', async () => {
    await crearAcceso('no-es-email').expect(400);
  });

  it('404 si la marca no existe', async () => {
    await crearAcceso('fabrica@test.com', INEXISTENTE).expect(404);
  });

  it('un fabricante no puede crear accesos', async () => {
    await crearAcceso('fabrica@test.com').expect(200);
    const otra = await crearMarca(prisma, 'otra');
    await crearUsuario(prisma, { email: 'b@test.com', marcaId: otra.id });
    const fabricante = cliente(app, await tokenDe(app, 'b@test.com'));

    await fabricante
      .post(`/admin/marcas/${marcaId}/usuario`)
      .send({ email: 'b@test.com' })
      .expect(403);
  });
});
