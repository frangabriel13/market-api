import type { Prisma } from '../generated/prisma/client.js';
import type { VarianteProducto } from '../schemas/productos.js';

export const LISTAS_DE_MARCA = {
  colores: true,
  talles: true,
} satisfies Prisma.MarcaSelect;

export interface ListasDeMarca {
  colores: string[];
  talles: string[];
}

export function errorDeListas(
  variantes: VarianteProducto[],
  { colores, talles }: ListasDeMarca,
): string | null {
  const color = variantes.find((v) => !colores.includes(v.color))?.color;
  if (color) return `El color "${color}" no está en la lista de la marca`;
  const talle = variantes.find((v) => !talles.includes(v.talle))?.talle;
  if (talle) return `El talle "${talle}" no está en la lista de la marca`;
  return null;
}

export const esVigente = (
  v: Pick<VarianteProducto, 'color' | 'talle'>,
  { colores, talles }: ListasDeMarca,
) => colores.includes(v.color) && talles.includes(v.talle);

// Si Piter quita un color o un talle de la marca, sus variantes no se borran:
// dejan de mostrarse y vuelven si lo agrega de nuevo. Salen en el orden de las
// listas de la marca.
export function variantesVigentes(
  variantes: VarianteProducto[],
  listas: ListasDeMarca,
): VarianteProducto[] {
  const { colores, talles } = listas;
  return variantes
    .filter((v) => esVigente(v, listas))
    .sort(
      (a, b) =>
        colores.indexOf(a.color) - colores.indexOf(b.color) ||
        talles.indexOf(a.talle) - talles.indexOf(b.talle),
    );
}

// Agotado: ninguna combinación vigente está disponible (también si no tiene
// ninguna).
export const estaAgotado = (
  variantes: VarianteProducto[],
  listas: ListasDeMarca,
) => !variantes.some((v) => v.disponible && esVigente(v, listas));
