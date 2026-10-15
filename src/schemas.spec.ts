// Los tests de src/schemas viven acá y no adentro de la carpeta: esa carpeta
// se copia tal cual al front y solo puede importar zod.
import { EstadoPedido, Rol } from './generated/prisma/enums.js';
import { loginSchema } from './schemas/auth.js';
import { ESTADOS_PEDIDO, ETIQUETAS_ESTADO_PEDIDO } from './schemas/pedidos.js';
import { ROLES } from './schemas/roles.js';

describe('constantes sincronizadas con los enums de Prisma', () => {
  it('roles', () => {
    expect([...ROLES]).toEqual(Object.values(Rol));
  });

  it('estados de pedido', () => {
    expect([...ESTADOS_PEDIDO]).toEqual(Object.values(EstadoPedido));
  });

  it('cada estado de pedido tiene etiqueta', () => {
    expect(Object.keys(ETIQUETAS_ESTADO_PEDIDO)).toEqual([...ESTADOS_PEDIDO]);
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
