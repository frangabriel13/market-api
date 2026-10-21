import { linkDeWhatsapp, mensajeDePedido } from './mensaje-whatsapp.js';

// Intl separa "$" del número con un espacio duro.
const sinEspacioDuro = (texto: string) => texto.replace(/ /g, ' ');

describe('mensajeDePedido', () => {
  it('sigue la plantilla', () => {
    const mensaje = mensajeDePedido({
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
      entrega: 'Expreso a domicilio',
      nombre: 'Juan Pérez',
      telefono: '5491155555555',
    });

    expect(sinEspacioDuro(mensaje)).toBe(
      [
        '¡Hola! Te hago un pedido por la tienda.',
        'Pedido #1024',
        '',
        '• Remera Lisa — Blanco / M × 6 — $ 72.000',
        '• Jogger Baggy — Negro / L × 4 — $ 96.000',
        '',
        'Total: $ 168.000',
        'Entrega: Expreso a domicilio',
        'Nombre: Juan Pérez · Tel: 11 5555-5555',
      ].join('\n'),
    );
  });
});

describe('linkDeWhatsapp', () => {
  it('codifica el mensaje', () => {
    expect(linkDeWhatsapp('5491100000000', '¡Hola!\n#1 & más')).toBe(
      'https://wa.me/5491100000000?text=%C2%A1Hola!%0A%231%20%26%20m%C3%A1s',
    );
  });
});
