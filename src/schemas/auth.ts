import { z } from 'zod';

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

// Respuesta de POST /auth/login y /auth/refresh. El refresh token viaja
// aparte, en una cookie httpOnly.
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
