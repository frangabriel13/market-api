import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { HEADER_HOST_TIENDA } from '../src/schemas/tienda.js';
import { cliente, crearApp, tokenDe, type AppDeTest } from './utils/app.js';
import {
  crearCategoria,
  crearMarca,
  crearPedido,
  crearProducto,
  crearUsuario,
  limpiarBase,
} from './utils/db.js';

describe('Panel: pedidos (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let marcaId: string;
  let fabricante: ReturnType<typeof cliente>;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    marcaId = (await crearMarca(prisma, 'mi-marca')).id;
    await crearUsuario(prisma, { email: 'f@test.com', marcaId });
    fabricante = cliente(app, await tokenDe(app, 'f@test.com'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('lista los pedidos de la marca, del más nuevo al más viejo', async () => {
    await crearPedido(prisma, { marcaId, numero: 1, compradorNombre: 'Ana' });
    const beto = await crearPedido(prisma, {
      marcaId,
      numero: 2,
      compradorNombre: 'Beto',
    });
    await prisma.pedido.update({
      where: { id: beto.id },
      data: {
        localidad: 'Rosario',
        items: {
          create: {
            nombreProducto: 'Jogger',
            color: 'Gris',
            talle: 'L',
            cantidad: 5,
            precioUnitario: 1000,
          },
        },
      },
    });
    const otra = (await crearMarca(prisma, 'otra')).id;
    await crearPedido(prisma, { marcaId: otra, numero: 3 });

    const res = await fabricante.get('/panel/pedidos').expect(200);
    expect(res.body).toEqual([
      {
        id: expect.any(String),
        numero: 2,
        estado: 'NUEVO',
        creadoEn: expect.any(String),
        compradorNombre: 'Beto',
        tipoEntrega: 'RETIRO',
        entrega: 'Retiro',
        localidad: 'Rosario',
        unidades: 7,
        total: 2000,
      },
      expect.objectContaining({
        numero: 1,
        compradorNombre: 'Ana',
        localidad: null,
        unidades: 2,
      }),
    ]);
  });

  it('el detalle muestra el pedido hecho en la tienda, con su copia de los ítems', async () => {
    await prisma.marca.update({
      where: { id: marcaId },
      data: { colores: ['Negro'], talles: ['M'] },
    });
    const categoriaId = (await crearCategoria(prisma, 'remeras')).id;
    const producto = await crearProducto(prisma, { marcaId, categoriaId });
    await prisma.variante.create({
      data: { productoId: producto.id, color: 'Negro', talle: 'M' },
    });
    const opcion = await prisma.opcionEntrega.create({
      data: { marcaId, nombre: 'Expreso', tipo: 'ENVIO' },
    });
    await request(app.getHttpServer())
      .post('/tienda/pedidos')
      .set(HEADER_HOST_TIENDA, 'mi-marca.plataforma.test')
      .send({
        items: [
          { productoId: producto.id, color: 'Negro', talle: 'M', cantidad: 3 },
        ],
        opcionEntregaId: opcion.id,
        tipoEntrega: 'ENVIO',
        nombre: 'Juan Pérez',
        telefono: '11 5555-5555',
        formaPago: 'EFECTIVO',
        dni: '30123456',
        cuit: '20-30123456-7',
        direccion: 'Calle Falsa 123',
        localidad: 'Rosario',
        provincia: 'Santa Fe',
        codigoPostal: '2000',
        observaciones: 'Tocar timbre',
      })
      .expect(201);
    // El producto cambia o se borra después: el pedido conserva su copia.
    await prisma.producto.delete({ where: { id: producto.id } });

    const [{ id }] = (await fabricante.get('/panel/pedidos').expect(200)).body;
    const res = await fabricante.get(`/panel/pedidos/${id}`).expect(200);
    expect(res.body).toEqual({
      id,
      numero: 1,
      estado: 'NUEVO',
      creadoEn: expect.any(String),
      compradorNombre: 'Juan Pérez',
      compradorTelefono: '5491155555555',
      compradorDni: '30123456',
      compradorCuit: '20301234567',
      tipoEntrega: 'ENVIO',
      entrega: 'Expreso',
      direccion: 'Calle Falsa 123',
      localidad: 'Rosario',
      provincia: 'Santa Fe',
      codigoPostal: '2000',
      transporte: null,
      observaciones: 'Tocar timbre',
      formaPago: 'EFECTIVO',
      unidades: 3,
      total: 3000,
      items: [
        {
          productoId: null,
          nombreProducto: 'Remera',
          color: 'Negro',
          talle: 'M',
          cantidad: 3,
          precioUnitario: 1000,
        },
      ],
    });
  });

  it('el estado puede pasar de cualquiera a cualquiera', async () => {
    const { id } = await crearPedido(prisma, { marcaId, numero: 1 });
    for (const estado of ['ENTREGADO', 'NUEVO', 'CANCELADO', 'PAGADO']) {
      const res = await fabricante
        .patch(`/panel/pedidos/${id}/estado`)
        .send({ estado })
        .expect(200);
      expect(res.body).toMatchObject({ id, estado });
    }
    expect(
      (await prisma.pedido.findUniqueOrThrow({ where: { id } })).estado,
    ).toBe('PAGADO');
  });

  it('400 con un estado inexistente', async () => {
    const { id } = await crearPedido(prisma, { marcaId, numero: 1 });
    await fabricante
      .patch(`/panel/pedidos/${id}/estado`)
      .send({ estado: 'ENVIADO' })
      .expect(400);
  });

  it('404 con un pedido inexistente', async () => {
    const id = '0199f0f0-0000-7000-8000-000000000000';
    await fabricante.get(`/panel/pedidos/${id}`).expect(404);
    await fabricante
      .patch(`/panel/pedidos/${id}/estado`)
      .send({ estado: 'PAGADO' })
      .expect(404);
  });
});
