import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import type { Env } from './env.js';

// Sin bodies: los pedidos traen datos personales del comprador.
export function loggerConfig(config: ConfigService<Env, true>): Params {
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  return {
    pinoHttp: {
      level:
        nodeEnv === 'test'
          ? 'silent'
          : config.get('LOG_LEVEL', { infer: true }),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        censor: '[oculto]',
      },
      transport:
        nodeEnv === 'development'
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
    },
  };
}
