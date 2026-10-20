import request from 'supertest';
import type { EstadoMarca } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { HEADER_HOST_TIENDA } from '../src/schemas/tienda.js';
import { crearApp, type AppDeTest } from './utils/app.js';
import { crearMarca, limpiarBase } from './utils/db.js';

describe('Tienda: resolución de la marca y GET /tienda (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let marcaId: string;

  const tienda = (host?: string) => {
    const req = request(app.getHttpServer()).get('/tienda');
    return host ? req.set(HEADER_HOST_TIENDA, host) : req;
  };

  const conEstado = (estado: EstadoMarca) =>
    prisma.marca.update({ where: { id: marcaId }, data: { estado } });

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    marcaId = (await crearMarca(prisma, 'mi-marca')).id;
    await prisma.marca.update({
      where: { id: marcaId },
      data: {
        dominioPropio: 'mimarca.com.ar',
        redes: { instagram: 'https://instagram.com/mimarca' },
        minimoCompra: 50000,
        colores: ['Negro'],
        opcionesEntrega: {
          create: [
            { nombre: 'Expreso', tipo: 'ENVIO', orden: 1 },
            { nombre: 'Retiro en fábrica', tipo: 'RETIRO', orden: 0 },
            { nombre: 'Moto', tipo: 'ENVIO', orden: 2, activa: false },
          ],
        },
      },
    });
    await crearMarca(prisma, 'otra-marca');
  });

  afterAll(async () => {
    await app.close();
  });

  it('por subdominio devuelve la configuración pública, sin sesión', async () => {
    const res = await tienda('mi-marca.plataforma.test').expect(200);
    expect(res.body).toEqual({
      nombre: 'Marca mi-marca',
      slug: 'mi-marca',
      logoUrl: null,
      portadaUrl: null,
      guiaTallesUrl: null,
      textosBanner: [],
      whatsapp: '5491100000000',
      direccionRetiro: null,
      horariosRetiro: null,
      redes: { instagram: 'https://instagram.com/mimarca' },
      comoComprar: '',
      condicionesVenta: '',
      minimoCompra: 50000,
      opcionesEntrega: [
        { id: expect.any(String), nombre: 'Retiro en fábrica', tipo: 'RETIRO' },
        { id: expect.any(String), nombre: 'Expreso', tipo: 'ENVIO' },
      ],
      textosLegales: [],
    });
  });

  it.each([
    'Mi-Marca.Plataforma.test:3000',
    'mimarca.com.ar',
    'MiMarca.com.ar',
  ])('resuelve %s', async (host) => {
    const res = await tienda(host).expect(200);
    expect(res.body.slug).toBe('mi-marca');
  });

  it.each<EstadoMarca>(['PAUSADA', 'BAJA'])(
    'con la marca %s no está disponible',
    async (estado) => {
      await conEstado(estado);
      const res = await tienda('mi-marca.plataforma.test').expect(404);
      expect(res.body.message).toBe('Tienda no disponible');
      await tienda('mimarca.com.ar').expect(404);
    },
  );

  it.each([
    ['una marca inexistente', 'no-existe.plataforma.test'],
    ['un dominio desconocido', 'otro.com.ar'],
    ['el dominio de la plataforma', 'plataforma.test'],
    ['un subdominio de dos niveles', 'www.mi-marca.plataforma.test'],
  ])('%s no está disponible', async (_, host) => {
    const res = await tienda(host).expect(404);
    expect(res.body.message).toBe('Tienda no disponible');
  });

  it('sin host no está disponible', async () => {
    await tienda().expect(404);
  });
});
