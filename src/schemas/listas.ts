import { z } from 'zod';

export const MAXIMO_VALORES = 50;

const valorSchema = z.string().trim().min(1).max(30);

const repetidos = (lista: string[]) =>
  new Set(lista.map((valor) => valor.toLowerCase())).size !== lista.length;

const valoresSinRepetidos = (que: string) =>
  z
    .array(valorSchema)
    .max(MAXIMO_VALORES)
    .refine((lista) => !repetidos(lista), { error: `Hay ${que} repetidos` });

// La lista entera, en el orden de la tienda. `anterior` es el nombre con el
// que el valor ya estaba guardado: si cambió, se renombra en los productos.
// Un valor sin `anterior` es nuevo.
const valoresEditados = (que: string) =>
  z
    .array(z.object({ nombre: valorSchema, anterior: valorSchema.optional() }))
    .max(MAXIMO_VALORES)
    .superRefine((lista, ctx) => {
      if (repetidos(lista.map((valor) => valor.nombre))) {
        ctx.addIssue({ code: 'custom', message: `Hay ${que} repetidos` });
      }
      const anteriores = lista.flatMap((valor) => valor.anterior ?? []);
      if (new Set(anteriores).size !== anteriores.length) {
        ctx.addIssue({
          code: 'custom',
          message: `Hay ${que} renombrados dos veces`,
        });
      }
    });

export const coloresSchema = z.object({ colores: valoresEditados('colores') });

const nombreListaSchema = z
  .string()
  .trim()
  .min(1, { error: 'Ingresá el nombre de la lista' })
  .max(40);

export const listaTallesCrearSchema = z.object({
  nombre: nombreListaSchema,
  talles: valoresSinRepetidos('talles'),
});

export const listaTallesEditarSchema = z.object({
  nombre: nombreListaSchema.optional(),
  talles: valoresEditados('talles').optional(),
  // null quita la guía.
  guiaTallesUrl: z.url().nullable().optional(),
});

export type ValorEditado = z.infer<typeof coloresSchema>['colores'][number];
export type Colores = z.infer<typeof coloresSchema>;
export type ListaTallesCrearInput = z.input<typeof listaTallesCrearSchema>;
export type ListaTallesCrear = z.output<typeof listaTallesCrearSchema>;
export type ListaTallesEditarInput = z.input<typeof listaTallesEditarSchema>;
export type ListaTallesEditar = z.output<typeof listaTallesEditarSchema>;

// `productos`: cuántos productos lo muestran hoy, para avisar antes de
// quitarlo.
export interface ValorEnUso {
  nombre: string;
  productos: number;
}

export interface ListaTallesPanel {
  id: string;
  nombre: string;
  guiaTallesUrl: string | null;
  // Cuántos productos usan la lista: con alguno no se puede borrar.
  productos: number;
  talles: ValorEnUso[];
}

// GET /panel/listas: listas de talles en el orden en que se crearon.
export interface ListasPanel {
  colores: ValorEnUso[];
  listasTalles: ListaTallesPanel[];
}

// 409 al borrar una lista que usan productos.
export interface ListaTallesEnUso {
  message: string;
  productos: number;
}
