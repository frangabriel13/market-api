import { z } from 'zod';

// En el .env, `VAR=` llega como string vacío: lo tratamos como no definida.
const vacioComoIndefinido = (valor: unknown) =>
  valor === '' ? undefined : valor;

const texto = z.preprocess(vacioComoIndefinido, z.string().min(1).optional());
const url = z.preprocess(vacioComoIndefinido, z.url().optional());

// Servicios externos: opcionales en desarrollo y tests (las cuentas todavía
// pueden no existir), obligatorios en producción.
const SERVICIOS_EXTERNOS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_URL',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'TURNSTILE_SECRET_KEY',
  'SENTRY_DSN',
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

    R2_ACCOUNT_ID: texto,
    R2_ACCESS_KEY_ID: texto,
    R2_SECRET_ACCESS_KEY: texto,
    R2_BUCKET: texto,
    R2_PUBLIC_URL: url,

    RESEND_API_KEY: texto,
    EMAIL_FROM: texto,

    TURNSTILE_SECRET_KEY: texto,

    SENTRY_DSN: url,

    // Dominios propios. Opcionales siempre: la función se puede postergar.
    VERCEL_TOKEN: texto,
    VERCEL_PROJECT_ID: texto,
    VERCEL_TEAM_ID: texto,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      for (const clave of SERVICIOS_EXTERNOS) {
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
