import type { VarianteProducto } from '../schemas/productos.js';

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

// Si Piter quita un color o un talle de la marca, sus variantes no se borran:
// dejan de mostrarse y vuelven si lo agrega de nuevo. Salen en el orden de las
// listas de la marca.
export function variantesVigentes(
  variantes: VarianteProducto[],
  { colores, talles }: ListasDeMarca,
): VarianteProducto[] {
  return variantes
    .filter((v) => colores.includes(v.color) && talles.includes(v.talle))
    .sort(
      (a, b) =>
        colores.indexOf(a.color) - colores.indexOf(b.color) ||
        talles.indexOf(a.talle) - talles.indexOf(b.talle),
    );
}
