import { z } from 'zod';
import { archivoImagenSchema } from './imagenes.ts';
import { textoOpcional } from './texto.ts';

export const MAXIMO_FOTOS = 10;

export const productoCrearSchema = z.object({
  nombre: z.string().trim().min(1, { error: 'Ingresá el nombre' }).max(120),
  descripcion: textoOpcional(2000).optional(),
  precio: z
    .number({ error: 'Ingresá el precio' })
    .int({ error: 'El precio va sin centavos' })
    .positive({ error: 'El precio tiene que ser mayor a 0' })
    .max(100_000_000),
  categoriaId: z.uuid({ error: 'Elegí una categoría' }),
  // false = "Guardar sin publicar".
  visible: z.boolean().optional(),
});

export const productoEditarSchema = productoCrearSchema
  .omit({ visible: true })
  .partial();

export const productoVisibilidadSchema = z.object({ visible: z.boolean() });

export const varianteSchema = z.object({
  color: z.string().trim().min(1),
  talle: z.string().trim().min(1),
  disponible: z.boolean(),
});

const clave = ({ color, talle }: { color: string; talle: string }) =>
  `${color}\u0000${talle}`;

// La matriz color × talle va completa: cada color elegido en cada talle
// elegido, marcado como hay o agotado.
export const variantesSchema = z
  .object({ variantes: z.array(varianteSchema).max(2500) })
  .superRefine(({ variantes }, ctx) => {
    const combinaciones = new Set(variantes.map(clave));
    if (combinaciones.size !== variantes.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['variantes'],
        message: 'Hay combinaciones de color y talle repetidas',
      });
      return;
    }
    const colores = new Set(variantes.map((v) => v.color));
    const talles = new Set(variantes.map((v) => v.talle));
    if (colores.size * talles.size !== variantes.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['variantes'],
        message:
          'Faltan combinaciones: cada color tiene que estar en todos los talles',
      });
    }
  });

export const fotoSubidaSchema = archivoImagenSchema.extend({
  productoId: z.uuid(),
});

export const fotoRegistrarSchema = z.object({ url: z.url() });

export const fotosOrdenSchema = z.object({
  fotoIds: z.array(z.uuid()).max(MAXIMO_FOTOS),
});

export type ProductoCrearInput = z.input<typeof productoCrearSchema>;
export type ProductoCrear = z.output<typeof productoCrearSchema>;
export type ProductoEditarInput = z.input<typeof productoEditarSchema>;
export type ProductoEditar = z.output<typeof productoEditarSchema>;
export type ProductoVisibilidad = z.infer<typeof productoVisibilidadSchema>;
export type VarianteProducto = z.infer<typeof varianteSchema>;
export type Variantes = z.infer<typeof variantesSchema>;
export type FotoSubida = z.infer<typeof fotoSubidaSchema>;
export type FotosOrden = z.infer<typeof fotosOrdenSchema>;

export interface CategoriaDeProducto {
  id: string;
  nombre: string;
}

export interface ProductoResumen {
  id: string;
  nombre: string;
  precio: number;
  visible: boolean;
  categoria: CategoriaDeProducto;
  miniatura: string | null;
}

export interface FotoProducto {
  id: string;
  url: string;
  urlMiniatura: string;
  orden: number;
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  visible: boolean;
  categoria: CategoriaDeProducto;
  fotos: FotoProducto[];
  variantes: VarianteProducto[];
}
