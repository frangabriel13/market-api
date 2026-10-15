import { Prisma } from '../generated/prisma/client.js';

function tieneCodigo(error: unknown, codigo: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === codigo
  );
}

export const esConflictoDeUnicidad = (error: unknown) =>
  tieneCodigo(error, 'P2002');

export const esRegistroInexistente = (error: unknown) =>
  tieneCodigo(error, 'P2025');

export const esReferenciaEnUso = (error: unknown) =>
  tieneCodigo(error, 'P2003');
