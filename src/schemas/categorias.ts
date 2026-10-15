import { z } from 'zod';
import { slugSchema } from './slug.ts';

export const categoriaCrearSchema = z.object({
  nombre: z.string().trim().min(1, { error: 'Ingresá el nombre' }).max(60),
  padreId: z.uuid().nullable().optional(),
  orden: z.number().int().min(0).optional(),
});

export const categoriaEditarSchema = categoriaCrearSchema
  .partial()
  .extend({ slug: slugSchema.optional() });

export type CategoriaCrearInput = z.input<typeof categoriaCrearSchema>;
export type CategoriaCrear = z.output<typeof categoriaCrearSchema>;
export type CategoriaEditarInput = z.input<typeof categoriaEditarSchema>;
export type CategoriaEditar = z.output<typeof categoriaEditarSchema>;

export interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
  padreId: string | null;
}

export interface CategoriaConSubcategorias extends Categoria {
  subcategorias: Categoria[];
}
