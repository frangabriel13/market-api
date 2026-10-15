import { PrismaService } from '../src/prisma/prisma.service.js';
import { cliente, crearApp, tokenDe, type AppDeTest } from './utils/app.js';
import { crearMarca, crearUsuario, limpiarBase } from './utils/db.js';

const INEXISTENTE = '0199f0f0-0000-7000-8000-000000000000';

describe('Admin: opciones de entrega (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let admin: ReturnType<typeof cliente>;
  let marcaId: string;

  const ruta = (id = marcaId) => `/admin/marcas/${id}/opciones-entrega`;

  const crearOpcion = (datos: object, id = marcaId) =>
    admin.post(ruta(id)).send(datos);

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    marcaId = (await crearMarca(prisma, 'una-marca')).id;
    await crearUsuario(prisma, { email: 'admin@test.com' });
    await crearUsuario(prisma, { email: 'fabricante@test.com', marcaId });
    admin = cliente(app, await tokenDe(app, 'admin@test.com'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('crea opciones activas y las agrega al final', async () => {
    const retiro = await crearOpcion({
      nombre: 'Retiro en showroom',
      tipo: 'RETIRO',
    }).expect(201);
    const envio = await crearOpcion({
      nombre: 'Expreso a domicilio',
      tipo: 'ENVIO',
    }).expect(201);

    expect(retiro.body).toEqual({
      id: expect.any(String),
      nombre: 'Retiro en showroom',
      tipo: 'RETIRO',
      orden: 0,
      activa: true,
    });
    expect(envio.body.orden).toBe(1);
  });

  it('lista todas las opciones de la marca por orden, incluidas las inactivas', async () => {
    await crearOpcion({ nombre: 'Moto', tipo: 'ENVIO', orden: 2 });
    await crearOpcion({ nombre: 'Showroom', tipo: 'RETIRO', orden: 0 });
    await crearOpcion({
      nombre: 'Correo',
      tipo: 'ENVIO',
      orden: 1,
      activa: false,
    });
    const otra = await crearMarca(prisma, 'otra');
    await crearOpcion({ nombre: 'De otra marca', tipo: 'ENVIO' }, otra.id);

    const res = await admin.get(ruta()).expect(200);
    expect(res.body.map((o: { nombre: string }) => o.nombre)).toEqual([
      'Showroom',
      'Correo',
      'Moto',
    ]);
  });

  it('edita y desactiva una opción', async () => {
    const { id } = (await crearOpcion({ nombre: 'Moto', tipo: 'ENVIO' })).body;

    const res = await admin
      .patch(`${ruta()}/${id}`)
      .send({ nombre: 'Moto en CABA', orden: 5, activa: false })
      .expect(200);
    expect(res.body).toMatchObject({
      nombre: 'Moto en CABA',
      tipo: 'ENVIO',
      orden: 5,
      activa: false,
    });
  });

  it('no se puede editar una opción a través de otra marca', async () => {
    const otra = await crearMarca(prisma, 'otra');
    const { id } = (
      await crearOpcion({ nombre: 'Moto', tipo: 'ENVIO' }, otra.id)
    ).body;

    await admin.patch(`${ruta()}/${id}`).send({ nombre: 'Robada' }).expect(404);
    const opcion = await prisma.opcionEntrega.findUniqueOrThrow({
      where: { id },
    });
    expect(opcion.nombre).toBe('Moto');
  });

  it.each([
    ['sin nombre', { tipo: 'ENVIO' }],
    ['tipo desconocido', { nombre: 'Dron', tipo: 'AEREO' }],
    ['orden negativo', { nombre: 'Moto', tipo: 'ENVIO', orden: -1 }],
  ])('400 %s', async (_, datos) => {
    await crearOpcion(datos).expect(400);
  });

  it('404 si la marca no existe', async () => {
    await admin.get(ruta(INEXISTENTE)).expect(404);
    await crearOpcion({ nombre: 'Moto', tipo: 'ENVIO' }, INEXISTENTE).expect(
      404,
    );
  });

  it('404 si la opción no existe', async () => {
    await admin
      .patch(`${ruta()}/${INEXISTENTE}`)
      .send({ activa: false })
      .expect(404);
  });

  it('un fabricante no puede gestionarlas', async () => {
    const fabricante = cliente(app, await tokenDe(app, 'fabricante@test.com'));
    await fabricante.get(ruta()).expect(403);
    await fabricante
      .post(ruta())
      .send({ nombre: 'Moto', tipo: 'ENVIO' })
      .expect(403);
  });
});
