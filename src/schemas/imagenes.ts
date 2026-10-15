import { z } from 'zod';

export const FORMATOS_IMAGEN = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const TAMANIO_MAXIMO_IMAGEN = 5 * 1024 * 1024;

export const archivoImagenSchema = z.object({
  contentType: z.enum(FORMATOS_IMAGEN, {
    error: 'La imagen tiene que ser JPG, PNG o WebP',
  }),
  tamanio: z.number().int().positive().max(TAMANIO_MAXIMO_IMAGEN, {
    error: 'La imagen no puede pesar más de 5 MB',
  }),
});

export type ArchivoImagen = z.infer<typeof archivoImagenSchema>;

// `url` es la dirección pública que hay que guardar una vez subido el archivo.
export interface UrlDeSubida {
  uploadUrl: string;
  url: string;
}
