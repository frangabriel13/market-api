import { z } from 'zod';

// Un campo de texto opcional que queda vacío se guarda como null.
export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((valor) => valor || null)
    .nullable();
