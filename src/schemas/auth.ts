import { z } from 'zod';

// La API y el front tienen que usar el mismo nombre.
export const REFRESH_COOKIE = 'refresh_token';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Ingresá un email válido' }));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'Ingresá tu contraseña' }),
});

export type LoginInput = z.input<typeof loginSchema>;
export type Login = z.output<typeof loginSchema>;

export const recuperarSchema = z.object({ email: emailSchema });

export const restablecerSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, { error: 'Usá al menos 8 caracteres' }).max(128),
});

export type RecuperarInput = z.input<typeof recuperarSchema>;
export type RestablecerInput = z.input<typeof restablecerSchema>;

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
