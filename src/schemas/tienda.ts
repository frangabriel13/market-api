import { z } from 'zod';
import type { Categoria } from './categorias.ts';
import type { TipoTextoLegal } from './legales.ts';
import type { Marca } from './marcas.ts';
import type { OpcionEntrega } from './opciones-entrega.ts';
import type { FotoProducto, Producto } from './productos.ts';
import { slugSchema } from './slug.ts';

// El front manda en cada pedido de la tienda el host que pidió el navegador;
// la API resuelve la marca con él.
export const HEADER_HOST_TIENDA = 'x-forwarded-host';

export type TiendaBuscada = { slug: string } | { dominioPropio: string };

// <slug>.<dominio de la plataforma> se busca por slug; cualquier otro host,
// por dominio propio. El dominio de la plataforma solo no es una tienda.
export function identificarTienda(
  host: string,
  dominioPlataforma: string,
): TiendaBuscada | null {
  const nombre = sinPuerto(host);
  const plataforma = sinPuerto(dominioPlataforma);
  if (!nombre || nombre === plataforma) return null;
  if (!nombre.endsWith(`.${plataforma}`)) return { dominioPropio: nombre };
  const slug = nombre.slice(0, -plataforma.length - 1);
  return slug.includes('.') ? null : { slug };
}

const sinPuerto = (host: string) =>
  host.trim().toLowerCase().replace(/:\d+$/, '');

// Configuración pública de la marca (GET /tienda).
export interface MarcaTienda extends Pick<
  Marca,
  | 'nombre'
  | 'slug'
  | 'logoUrl'
  | 'portadaUrl'
  | 'guiaTallesUrl'
  | 'textosBanner'
  | 'whatsapp'
  | 'direccionRetiro'
  | 'horariosRetiro'
  | 'redes'
  | 'comoComprar'
  | 'condicionesVenta'
  | 'minimoCompra'
> {
  // Solo las activas, en orden.
  opcionesEntrega: Pick<OpcionEntrega, 'id' | 'nombre' | 'tipo'>[];
  // Los de la plataforma que tienen contenido (GET /tienda/legales/:tipo).
  textosLegales: TipoTextoLegal[];
}

type CategoriaDeTienda = Pick<Categoria, 'nombre' | 'slug'>;

// Solo las que tienen productos visibles de la marca (GET /tienda/categorias).
export interface CategoriaTienda extends CategoriaDeTienda {
  subcategorias: CategoriaDeTienda[];
}

// ?categoria=<slug>: una categoría trae también los de sus subcategorías.
export const productosTiendaQuerySchema = z.object({
  categoria: slugSchema.optional(),
});

// Agotado: ninguna combinación de color y talle está disponible.
export interface ProductoTiendaResumen extends Pick<
  Producto,
  'id' | 'nombre' | 'precio'
> {
  miniatura: string | null;
  agotado: boolean;
}

export interface ProductoTienda extends Pick<
  Producto,
  'id' | 'nombre' | 'descripcion' | 'precio' | 'variantes'
> {
  categoria: CategoriaDeTienda;
  fotos: Pick<FotoProducto, 'url' | 'urlMiniatura'>[];
  agotado: boolean;
}
