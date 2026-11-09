import {
  linkDeWhatsapp,
  mensajeDePedido,
  type DatosMensaje,
} from './mensaje-whatsapp.js';

// Intl separa "$" del número con un espacio duro.
const sinEspacioDuro = (texto: string) => texto.replace(/ /g, ' ');

describe('mensajeDePedido', () => {
  const pedido = {
    numero: 1024,
    items: [
      {
        nombreProducto: 'Remera Lisa',
        color: 'Blanco',
        talle: 'M',
        cantidad: 6,
        precioUnitario: 12000,
      },
      {
        nombreProducto: 'Jogger Baggy',
        color: 'Negro',
        talle: 'L',
        cantidad: 4,
        precioUnitario: 24000,
      },
    ],
    total: 168000,
    entrega: 'Retiro en fábrica',
    formaPago: 'TRANSFERENCIA',
    nombre: 'Juan Pérez',
    telefono: '5491155555555',
  } satisfies DatosMensaje;

  it('sigue la plantilla', () => {
    expect(sinEspacioDuro(mensajeDePedido(pedido))).toBe(
      [
        '¡Hola! Te hago un pedido por la tienda.',
        'Pedido #1024',
        '',
        '• Remera Lisa — Blanco / M × 6 — $ 72.000',
        '• Jogger Baggy — Negro / L × 4 — $ 96.000',
        '',
        'Total: $ 168.000',
        'Entrega: Retiro en fábrica',
        'Pago: Transferencia',
        'Nombre: Juan Pérez · Tel: 11 5555-5555',
      ].join('\n'),
    );
  });

  it('con envío suma el DNI y la dirección', () => {
    const mensaje = mensajeDePedido({
      ...pedido,
      entrega: 'Expreso a domicilio',
      formaPago: 'EFECTIVO',
      envio: {
        dni: '30123456',
        direccion: 'Calle Falsa 123',
        localidad: 'Rosario',
        provincia: 'Santa Fe',
        codigoPostal: 'S2000ABC',
      },
    });
    expect(mensaje.split('\n').slice(-5)).toEqual([
      'Entrega: Expreso a domicilio',
      'Pago: Efectivo',
      'Nombre: Juan Pérez · Tel: 11 5555-5555',
      'DNI: 30123456',
      'Dirección: Calle Falsa 123, Rosario, Santa Fe (CP S2000ABC)',
    ]);
  });

  it('sin colores o sin talles muestra solo lo que tiene el producto', () => {
    const item = (nombreProducto: string, color: string, talle: string) => ({
      nombreProducto,
      color,
      talle,
      cantidad: 2,
      precioUnitario: 1000,
    });
    const mensaje = mensajeDePedido({
      ...pedido,
      items: [
        item('Remera Lisa', 'Blanco', ''),
        item('Jean Recto', '', '42'),
        item('Gorra', '', ''),
      ],
    });
    expect(sinEspacioDuro(mensaje).split('\n').slice(3, 6)).toEqual([
      '• Remera Lisa — Blanco × 2 — $ 2.000',
      '• Jean Recto — 42 × 2 — $ 2.000',
      '• Gorra × 2 — $ 2.000',
    ]);
  });
});

describe('linkDeWhatsapp', () => {
  it('codifica el mensaje', () => {
    expect(linkDeWhatsapp('5491100000000', '¡Hola!\n#1 & más')).toBe(
      'https://wa.me/5491100000000?text=%C2%A1Hola!%0A%231%20%26%20m%C3%A1s',
    );
  });
});
