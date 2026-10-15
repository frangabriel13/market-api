import { validateEnv } from './env.js';

const minimas = {
  DATABASE_URL: 'postgresql://app:app@localhost:5432/app',
  PLATFORM_NAME: 'Plataforma',
  PLATFORM_DOMAIN: 'ejemplo.com.ar',
  FRONT_URL: 'http://localhost:3001',
  JWT_SECRET: 'x'.repeat(32),
};

const serviciosExternos = {
  STORAGE_REGION: 'sa-east-1',
  STORAGE_ACCESS_KEY_ID: 'clave',
  STORAGE_SECRET_ACCESS_KEY: 'secreto',
  STORAGE_BUCKET: 'fotos',
  STORAGE_PUBLIC_URL: 'https://fotos.ejemplo.com.ar',
  RESEND_API_KEY: 're_123',
  EMAIL_FROM: 'Plataforma <no-responder@ejemplo.com.ar>',
};

describe('validateEnv', () => {
  it('acepta las variables mínimas y aplica los valores por defecto', () => {
    const env = validateEnv(minimas);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('convierte PORT a número', () => {
    expect(validateEnv({ ...minimas, PORT: '8080' }).PORT).toBe(8080);
  });

  it('falla si falta una variable obligatoria y la nombra', () => {
    const { DATABASE_URL: _, ...sinBase } = minimas;
    expect(() => validateEnv(sinBase)).toThrow(/DATABASE_URL/);
  });

  it('rechaza un JWT_SECRET corto', () => {
    expect(() => validateEnv({ ...minimas, JWT_SECRET: 'corto' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('rechaza PLATFORM_DOMAIN con protocolo', () => {
    expect(() =>
      validateEnv({ ...minimas, PLATFORM_DOMAIN: 'https://ejemplo.com.ar' }),
    ).toThrow(/PLATFORM_DOMAIN/);
  });

  it('trata las variables vacías como no definidas', () => {
    const env = validateEnv({ ...minimas, STORAGE_BUCKET: '', EMAIL_FROM: '' });
    expect(env.STORAGE_BUCKET).toBeUndefined();
    expect(env.EMAIL_FROM).toBeUndefined();
  });

  it('en producción exige los servicios externos', () => {
    expect(() => validateEnv({ ...minimas, NODE_ENV: 'production' })).toThrow(
      /STORAGE_BUCKET[\s\S]*EMAIL_FROM/,
    );
  });

  it('en producción acepta la configuración completa', () => {
    const env = validateEnv({
      ...minimas,
      ...serviciosExternos,
      NODE_ENV: 'production',
    });
    expect(env.NODE_ENV).toBe('production');
  });

  it('exige VERCEL_PROJECT_ID si hay VERCEL_TOKEN', () => {
    expect(() => validateEnv({ ...minimas, VERCEL_TOKEN: 'token' })).toThrow(
      /VERCEL_PROJECT_ID/,
    );
  });
});
