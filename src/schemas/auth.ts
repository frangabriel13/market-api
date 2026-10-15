import { z } from 'zod';

// La API y el front tienen que usar el mismo nombre.
export const REFRESH_COOKIE = 'refresh_token';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Ingresá un email válido' })),
  password: z.string().min(1, { error: 'Ingresá tu contraseña' }),
});

export type LoginInput = z.input<typeof loginSchema>;
export type Login = z.output<typeof loginSchema>;

export const sesionSchema = z.object({
  accessToken: z.string(),
  usuario: z.object({
    id: z.string(),
    email: z.string(),
    // Igual a ROLES de roles.ts (no se importa: ver CLAUDE.md).
    rol: z.enum(['ADMIN', 'FABRICANTE']),
    marcaId: z.string().nullable(),
  }),
});

export type Sesion = z.infer<typeof sesionSchema>;
export type UsuarioSesion = Sesion['usuario'];
