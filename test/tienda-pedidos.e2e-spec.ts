import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { HEADER_HOST_TIENDA } from '../src/schemas/tienda.js';
import { crearApp, type AppDeTest } from './utils/app.js';
import { crearCategoria, crearMarca, limpiarBase } from './utils/db.js';

describe('Tienda: POST /tienda/pedidos (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let marcaId: string;
  let ids: Record<
    'remera' | 'oculto' | 'deB' | 'retiro' | 'expreso' | 'inactiva' | 'deOtra',
    string
  >;

  const pedir = (cuerpo: object, host = 'mi-marca.plataforma.test') =>
    request(app.getHttpServer())
      .post('/tienda/pedidos')
      .set(HEADER_HOST_TIENDA, host)
      .send(cuerpo);

  const item = (cantidad = 1, color = 'Negro', talle = 'S') => ({
    productoId: ids.remera,
    color,
    talle,
    cantidad,
  });

  const retiro = (items: object[] = [item(2)]) => ({
    items,
    opcionEntregaId: ids.retiro,
    tipoEntrega: 'RETIRO',
    nombre: 'Juan Pérez',
    telefono: '011 15 5555-5555',
  });

  const envio = () => ({
    ...retiro(),
    opcionEntregaId: ids.expreso,
    tipoEntrega: 'ENVIO',
    dni: '30.123.456',
    direccion: 'Calle Falsa 123',
    localidad: 'Rosario',
    provincia: 'Santa Fe',
    transporte: 'Vía Cargo',
  });

  const numeroActual = async () =>
    (await prisma.marca.findUniqueOrThrow({ where: { id: marcaId } }))
      .ultimoNumeroPedido;

  const textoDe = (whatsappUrl: string) =>
    new URL(whatsappUrl).searchParams.get('text')!.replace(/ /g, ' ');

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    const categoriaId = (await crearCategoria(prisma, 'remeras')).id;
    const marca = await prisma.marca.create({
      data: {
        nombre: 'Mi marca',
        slug: 'mi-marca',
        whatsapp: '5491122223333',
        minimoCompra: 20000,
        colores: ['Negro', 'Blanco'],
        talles: ['S', 'M'],
        ultimoNumeroPedido: 1023,
      },
    });
    marcaId = marca.id;
    const otra = await crearMarca(prisma, 'otra-marca');
    await prisma.marca.update({
      where: { id: otra.id },
      data: { colores: ['Negro'], talles: ['S'] },
    });

    const opcion = (
      nombre: string,
      tipo: 'RETIRO' | 'ENVIO',
      extra: { activa?: boolean; marcaId?: string } = {},
    ) =>
      prisma.opcionEntrega
        .create({ data: { nombre, tipo, marcaId, ...extra } })
        .then((o) => o.id);
    const producto = (
      nombre: string,
      extra: { visible?: boolean; marcaId?: string } = {},
    ) =>
      prisma.producto
        .create({
          data: {
            nombre,
            precio: 12000,
            categoriaId,
            marcaId,
            ...extra,
            variantes: {
              create: [
                { color: 'Negro', talle: 'S' },
                { color: 'Negro', talle: 'M', disponible: false },
                { color: 'Blanco', talle: 'M' },
                // Rojo ya no está en la lista de la marca.
                { color: 'Rojo', talle: 'S' },
              ],
            },
          },
        })
        .then((p) => p.id);

    ids = {
      remera: await producto('Remera Lisa'),
      oculto: await producto('Oculto', { visible: false }),
      deB: await producto('De B', { marcaId: otra.id }),
      retiro: await opcion('Retiro en fábrica', 'RETIRO'),
      expreso: await opcion('Expreso a domicilio', 'ENVIO'),
      inactiva: await opcion('Moto', 'ENVIO', { activa: false }),
      deOtra: await opcion('Retiro', 'RETIRO', { marcaId: otra.id }),
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('crea el pedido con los precios de la base y devuelve el link de WhatsApp', async () => {
    const res = await pedir({
      ...retiro([{ ...item(2), precio: 1 }, item(1, 'Blanco', 'M')]),
      total: 1,
      // Retiro: los datos de envío se descartan.
      direccion: 'No va',
    }).expect(201);

    expect(res.body).toEqual({
      numero: 1024,
      total: 36000,
      whatsappUrl: expect.stringMatching(
        /^https:\/\/wa\.me\/5491122223333\?text=/,
      ),
    });
    expect(textoDe(res.body.whatsappUrl)).toBe(
      [
        '¡Hola! Te hago un pedido por la tienda.',
        'Pedido #1024',
        '',
        '• Remera Lisa — Negro / S × 2 — $ 24.000',
        '• Remera Lisa — Blanco / M × 1 — $ 12.000',
        '',
        'Total: $ 36.000',
        'Entrega: Retiro en fábrica',
        'Nombre: Juan Pérez · Tel: 11 5555-5555',
      ].join('\n'),
    );

    const pedido = await prisma.pedido.findFirstOrThrow({
      include: { items: { orderBy: { color: 'desc' } } },
    });
    expect(pedido).toMatchObject({
      marcaId,
      numero: 1024,
      estado: 'NUEVO',
      tipoEntrega: 'RETIRO',
      opcionEntregaId: ids.retiro,
      compradorNombre: 'Juan Pérez',
      compradorTelefono: '5491155555555',
      direccion: null,
      total: 36000,
    });
    expect(pedido.items).toEqual([
      expect.objectContaining({
        productoId: ids.remera,
        nombreProducto: 'Remera Lisa',
        color: 'Negro',
        talle: 'S',
        cantidad: 2,
        precioUnitario: 12000,
      }),
      expect.objectContaining({ color: 'Blanco', talle: 'M', cantidad: 1 }),
    ]);
    expect(await numeroActual()).toBe(1024);
  });

  it('envío: guarda los datos del comprador', async () => {
    await pedir(envio()).expect(201);
    expect(await prisma.pedido.findFirstOrThrow()).toMatchObject({
      tipoEntrega: 'ENVIO',
      compradorDni: '30123456',
      compradorCuit: null,
      direccion: 'Calle Falsa 123',
      localidad: 'Rosario',
      provincia: 'Santa Fe',
      transporte: 'Vía Cargo',
      observaciones: null,
    });
  });

  it('envío sin dirección: 400 marcando el campo', async () => {
    const res = await pedir({ ...envio(), direccion: '' }).expect(400);
    expect(res.body.errors.map((e: { path: string[] }) => e.path)).toEqual([
      ['direccion'],
    ]);
  });

  it('los números son correlativos por marca, aun en simultáneo', async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () => pedir(retiro()).expect(201)),
    );
    expect(respuestas.map((r) => r.body.numero).sort()).toEqual([
      1024, 1025, 1026, 1027, 1028,
    ]);

    const deOtra = await pedir(
      {
        ...retiro([{ ...item(2), productoId: ids.deB }]),
        opcionEntregaId: ids.deOtra,
      },
      'otra-marca.plataforma.test',
    ).expect(201);
    expect(deOtra.body.numero).toBe(1);
  });

  it('409 con los ítems que ya no están disponibles, sin crear nada', async () => {
    const res = await pedir(
      retiro([
        item(5),
        item(1, 'Negro', 'M'),
        item(1, 'Rojo', 'S'),
        { ...item(1), productoId: ids.oculto },
        { ...item(1), productoId: ids.deB },
      ]),
    ).expect(409);

    expect(res.body).toEqual({
      message: 'Algunos productos ya no están disponibles',
      noDisponibles: [
        { productoId: ids.remera, color: 'Negro', talle: 'M' },
        { productoId: ids.remera, color: 'Rojo', talle: 'S' },
        { productoId: ids.oculto, color: 'Negro', talle: 'S' },
        { productoId: ids.deB, color: 'Negro', talle: 'S' },
      ],
    });
    expect(await prisma.pedido.count()).toBe(0);
    expect(await numeroActual()).toBe(1023);
  });

  it('400 si no llega al mínimo, sin gastar el número', async () => {
    const res = await pedir(retiro([item(1)])).expect(400);
    expect(res.body.message.replace(/ /g, ' ')).toBe(
      'El pedido no llega al mínimo de compra de $ 20.000',
    );
    expect(await prisma.pedido.count()).toBe(0);
    expect(await numeroActual()).toBe(1023);
  });

  it.each([
    [
      'inactiva',
      () => ({ opcionEntregaId: ids.inactiva, tipoEntrega: 'ENVIO' }),
    ],
    [
      'de otra marca',
      () => ({ opcionEntregaId: ids.deOtra, tipoEntrega: 'RETIRO' }),
    ],
    [
      'de otro tipo',
      () => ({ opcionEntregaId: ids.expreso, tipoEntrega: 'RETIRO' }),
    ],
  ])('400 con una opción de entrega %s', async (_, opcion) => {
    const res = await pedir({ ...envio(), ...opcion() }).expect(400);
    expect(res.body.message).toBe(
      'La opción de entrega ya no está disponible: elegí otra',
    );
    expect(await prisma.pedido.count()).toBe(0);
  });

  it('con la marca pausada, tienda no disponible', async () => {
    await prisma.marca.update({
      where: { id: marcaId },
      data: { estado: 'PAUSADA' },
    });
    await pedir(retiro()).expect(404);
    expect(await prisma.pedido.count()).toBe(0);
  });
});
