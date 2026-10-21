import {
  EstadoMarca,
  EstadoPedido,
  Rol,
  TipoEntrega,
  TipoTextoLegal,
} from './generated/prisma/enums.js';
import { loginSchema } from './schemas/auth.js';
import { ETIQUETAS_TEXTO_LEGAL, TIPOS_TEXTO_LEGAL } from './schemas/legales.js';
import { ESTADOS_MARCA } from './schemas/marcas.js';
import {
  ETIQUETAS_TIPO_ENTREGA,
  TIPOS_ENTREGA,
} from './schemas/opciones-entrega.js';
import {
  ESTADOS_PEDIDO,
  ETIQUETAS_ESTADO_PEDIDO,
  pedidoCrearSchema,
} from './schemas/pedidos.js';
import { ROLES } from './schemas/roles.js';
import {
  formatearTelefono,
  normalizarTelefono,
  telefonoSchema,
} from './schemas/telefono.js';
import { identificarTienda } from './schemas/tienda.js';

describe('constantes sincronizadas con los enums de Prisma', () => {
  it('roles', () => {
    expect([...ROLES]).toEqual(Object.values(Rol));
  });

  it('estados de marca', () => {
    expect([...ESTADOS_MARCA]).toEqual(Object.values(EstadoMarca));
  });

  it('tipos de entrega', () => {
    expect([...TIPOS_ENTREGA]).toEqual(Object.values(TipoEntrega));
    expect(Object.keys(ETIQUETAS_TIPO_ENTREGA)).toEqual([...TIPOS_ENTREGA]);
  });

  it('estados de pedido', () => {
    expect([...ESTADOS_PEDIDO]).toEqual(Object.values(EstadoPedido));
  });

  it('cada estado de pedido tiene etiqueta', () => {
    expect(Object.keys(ETIQUETAS_ESTADO_PEDIDO)).toEqual([...ESTADOS_PEDIDO]);
  });

  it('tipos de texto legal', () => {
    expect([...TIPOS_TEXTO_LEGAL]).toEqual(Object.values(TipoTextoLegal));
    expect(Object.keys(ETIQUETAS_TEXTO_LEGAL)).toEqual([...TIPOS_TEXTO_LEGAL]);
  });
});

describe('loginSchema', () => {
  it('normaliza el email', () => {
    const login = loginSchema.parse({
      email: '  Fabrica@Ejemplo.COM ',
      password: 'secreta',
    });
    expect(login.email).toBe('fabrica@ejemplo.com');
  });

  it('rechaza un email inválido con mensaje en español', () => {
    const resultado = loginSchema.safeParse({
      email: 'no-es-email',
      password: 'secreta',
    });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0].message).toBe('Ingresá un email válido');
  });

  it('exige la contraseña', () => {
    const resultado = loginSchema.safeParse({
      email: 'fabrica@ejemplo.com',
      password: '',
    });
    expect(resultado.error?.issues[0].message).toBe('Ingresá tu contraseña');
  });
});

describe('normalizarTelefono', () => {
  it.each([
    ['11 5555-5555', '5491155555555'],
    ['011 15 5555-5555', '5491155555555'],
    ['(011) 15-5555-5555', '5491155555555'],
    ['15 5555 5555 11', null],
    ['+54 9 11 5555-5555', '5491155555555'],
    ['+54 11 5555-5555', '5491155555555'],
    ['+54 9 11 15 5555-5555', '5491155555555'],
    ['5491155555555', '5491155555555'],
    ['0351 15 555-1234', '5493515551234'],
    ['351 555 1234', '5493515551234'],
    ['0220 15 555-1234', '5492205551234'],
    ['02202 15 55-1234', '5492202551234'],
    ['03541 15 55-1234', '5493541551234'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarTelefono(entrada)).toBe(esperado);
  });

  it.each([
    '',
    'sin número',
    '5555-5555',
    '0800 333 1234',
    '11 5555-55555',
    '0351 55 555-1234',
    '+1 415 555 1234',
  ])('rechaza "%s"', (entrada) => {
    expect(normalizarTelefono(entrada)).toBeNull();
  });
});

describe('formatearTelefono', () => {
  it.each([
    ['5491155555555', '11 5555-5555'],
    ['5493515551234', '351 555-1234'],
    ['5492944551234', '294 455-1234'],
    ['5493541551234', '3541 55-1234'],
  ])('%s → %s', (normalizado, esperado) => {
    expect(formatearTelefono(normalizado)).toBe(esperado);
  });
});

describe('telefonoSchema', () => {
  it('normaliza', () => {
    expect(telefonoSchema.parse('011 15 5555-5555')).toBe('5491155555555');
  });

  it('rechaza con mensaje en español', () => {
    const resultado = telefonoSchema.safeParse('5555-5555');
    expect(resultado.error?.issues[0].message).toBe(
      'Ingresá un teléfono con característica (ej. 11 5555-5555)',
    );
  });
});

describe('identificarTienda', () => {
  it.each([
    ['mi-marca.plataforma.com', { slug: 'mi-marca' }],
    ['Mi-Marca.Plataforma.com', { slug: 'mi-marca' }],
    ['mi-marca.plataforma.com:3000', { slug: 'mi-marca' }],
    ['tienda.com.ar', { dominioPropio: 'tienda.com.ar' }],
    ['www.tienda.com.ar:443', { dominioPropio: 'www.tienda.com.ar' }],
    ['plataforma.com', null],
    ['plataforma.com:3000', null],
    ['a.b.plataforma.com', null],
    ['', null],
  ])('%s → %o', (host, esperado) => {
    expect(identificarTienda(host, 'plataforma.com')).toEqual(esperado);
  });

  it('ignora el puerto del dominio de la plataforma', () => {
    expect(identificarTienda('mi-marca.localhost', 'localhost:3000')).toEqual({
      slug: 'mi-marca',
    });
  });
});

describe('pedidoCrearSchema', () => {
  const item = {
    productoId: '0199f0f0-0000-7000-8000-000000000000',
    color: 'Negro',
    talle: 'M',
    cantidad: 2,
  };
  const retiro = {
    items: [item],
    opcionEntregaId: '0199f0f0-0000-7000-8000-000000000001',
    tipoEntrega: 'RETIRO',
    nombre: 'Juan',
    telefono: '11 5555-5555',
  };

  const campos = (datos: object) =>
    pedidoCrearSchema
      .safeParse(datos)
      .error?.issues.map((issue) => issue.path.join('.'));

  it('retiro: alcanza con nombre y teléfono', () => {
    expect(pedidoCrearSchema.parse(retiro).telefono).toBe('5491155555555');
  });

  it('envío: exige dirección, localidad y provincia', () => {
    expect(campos({ ...retiro, tipoEntrega: 'ENVIO', localidad: ' ' })).toEqual(
      ['direccion', 'localidad', 'provincia'],
    );
  });

  it('DNI y CUIT: opcionales, se guardan solo los números', () => {
    const pedido = pedidoCrearSchema.parse({
      ...retiro,
      tipoEntrega: 'ENVIO',
      direccion: 'Calle 1',
      localidad: 'Rosario',
      provincia: 'Santa Fe',
      dni: '30.123.456',
      cuit: '',
    });
    expect(pedido.dni).toBe('30123456');
    expect(pedido.cuit).toBeNull();
    expect(campos({ ...retiro, dni: '123', cuit: '20-1234-5' })).toEqual([
      'dni',
      'cuit',
    ]);
  });

  it('rechaza el carrito vacío y los ítems repetidos', () => {
    expect(campos({ ...retiro, items: [] })).toEqual(['items']);
    expect(
      campos({ ...retiro, items: [item, { ...item, cantidad: 1 }] }),
    ).toEqual(['items']);
  });
});
