import type { Prisma } from '../generated/prisma/client.js';
import { SIN_VALOR, type VarianteProducto } from '../schemas/productos.js';

// Los colores son de la marca y los talles, de la lista que usa el producto.
// Sin colores o sin lista, el único valor vigente es SIN_VALOR.
export const LISTAS_DEL_PRODUCTO = {
  conColores: true,
  marca: { select: { colores: true } },
  listaTalles: { select: { talles: true } },
} satisfies Prisma.ProductoSelect;

export interface ListasDelProducto {
  colores: string[];
  talles: string[];
}

export const listasDe = ({
  conColores,
  marca,
  listaTalles,
}: {
  conColores: boolean;
  marca: { colores: string[] };
  listaTalles: { talles: string[] } | null;
}): ListasDelProducto => ({
  colores: conColores ? marca.colores : [SIN_VALOR],
  talles: listaTalles?.talles ?? [SIN_VALOR],
});

export function errorDeListas(
  variantes: VarianteProducto[],
  { colores, talles }: ListasDelProducto,
): string | null {
  const color = variantes.find((v) => !colores.includes(v.color))?.color;
  if (color !== undefined) {
    return errorDeValor(
      color,
      colores,
      'color',
      'colores',
      'tu lista de colores',
    );
  }
  const talle = variantes.find((v) => !talles.includes(v.talle))?.talle;
  if (talle !== undefined) {
    return errorDeValor(
      talle,
      talles,
      'talle',
      'talles',
      'la lista del producto',
    );
  }
  return null;
}

function errorDeValor(
  valor: string,
  lista: string[],
  que: string,
  plural: string,
  donde: string,
) {
  if (lista[0] === SIN_VALOR) return `Este producto no tiene ${plural}`;
  if (valor === SIN_VALOR) return `Falta el ${que} de una combinación`;
  return `El ${que} "${valor}" no está en ${donde}`;
}

export const esVigente = (
  v: Pick<VarianteProducto, 'color' | 'talle'>,
  { colores, talles }: ListasDelProducto,
) => colores.includes(v.color) && talles.includes(v.talle);

// Si el fabricante quita un color o un talle de sus listas, las variantes no
// se borran: dejan de mostrarse y vuelven si lo agrega de nuevo. Salen en el
// orden de las listas.
export function variantesVigentes(
  variantes: VarianteProducto[],
  listas: ListasDelProducto,
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
  listas: ListasDelProducto,
) => !variantes.some((v) => v.disponible && esVigente(v, listas));

// Para el listado del panel: combinaciones vigentes y cuántas están agotadas.
export function contarCombinaciones(
  variantes: VarianteProducto[],
  listas: ListasDelProducto,
) {
  const vigentes = variantes.filter((v) => esVigente(v, listas));
  return {
    combinaciones: vigentes.length,
    agotadas: vigentes.filter((v) => !v.disponible).length,
  };
}
