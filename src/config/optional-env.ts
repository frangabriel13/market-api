import { z } from 'zod';

// `VAR=` en el .env llega como string vacío: cuenta como no definida.
export const optionalEnv = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (valor) => (valor === '' ? undefined : valor),
    schema.optional(),
  );
