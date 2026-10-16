import { z } from 'zod';
import { optionalEnv } from './optional-env.js';

const texto = optionalEnv(z.string());
const url = optionalEnv(z.url());

const SERVICIOS_OBLIGATORIOS_EN_PRODUCCION = [
  'STORAGE_REGION',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
  'STORAGE_BUCKET',
  'STORAGE_PUBLIC_URL',
  'RESEND_API_KEY',
  'EMAIL_FROM',
] as const;

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),

    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'Tiene que ser una URL de Postgres'),

    PLATFORM_NAME: z.string().min(1),
    PLATFORM_DOMAIN: z
      .string()
      .regex(
        /^[a-z0-9.-]+(:\d+)?$/,
        'Solo el dominio, sin protocolo ni barra (ej. ejemplo.com.ar)',
      ),
    FRONT_URL: z.url(),

    JWT_SECRET: z.string().min(32, 'Tiene que tener al menos 32 caracteres'),

    // Almacenamiento compatible con S3 (hoy Supabase Storage). Sin
    // STORAGE_ENDPOINT se usa AWS S3.
    STORAGE_ENDPOINT: url,
    STORAGE_REGION: texto,
    STORAGE_ACCESS_KEY_ID: texto,
    STORAGE_SECRET_ACCESS_KEY: texto,
    STORAGE_BUCKET: texto,
    STORAGE_PUBLIC_URL: url,

    RESEND_API_KEY: texto,
    EMAIL_FROM: texto,

    VERCEL_TOKEN: texto,
    VERCEL_PROJECT_ID: texto,
    VERCEL_TEAM_ID: texto,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      for (const clave of SERVICIOS_OBLIGATORIOS_EN_PRODUCCION) {
        if (env[clave] === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [clave],
            message: 'Obligatoria en producción',
          });
        }
      }
    }
    if (env.VERCEL_TOKEN && !env.VERCEL_PROJECT_ID) {
      ctx.addIssue({
        code: 'custom',
        path: ['VERCEL_PROJECT_ID'],
        message: 'Obligatoria si se define VERCEL_TOKEN',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const resultado = envSchema.safeParse(config);
  if (!resultado.success) {
    const errores = resultado.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${errores}`);
  }
  return resultado.data;
}
