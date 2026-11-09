import type { ValorEditado } from '../schemas/listas.js';

export type Renombre = [de: string, a: string];

// Los valores cuyo nombre cambió. Un `anterior` que ya no está guardado (otra
// pestaña lo quitó o lo renombró) devuelve null para no pisar nada.
export function renombresDe(
  valores: ValorEditado[],
  guardados: string[],
): Renombre[] | null {
  const renombres: Renombre[] = [];
  for (const { nombre, anterior } of valores) {
    if (anterior === undefined) continue;
    if (!guardados.includes(anterior)) return null;
    if (anterior !== nombre) renombres.push([anterior, nombre]);
  }
  return renombres;
}
