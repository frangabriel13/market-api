import { z } from 'zod';
import { emailSchema } from './auth.ts';
import { archivoImagenSchema } from './imagenes.ts';
import { slugSchema } from './slug.ts';
import { telefonoSchema } from './telefono.ts';

export const ESTADOS_MARCA = ['ACTIVA', 'PAUSADA', 'BAJA'] as const;

export const estadoMarcaSchema = z.enum(ESTADOS_MARCA);

export type EstadoMarca = z.infer<typeof estadoMarcaSchema>;

// Subdominios de la plataforma que no pueden ser tiendas.
const SLUGS_RESERVADOS = ['www', 'api', 'admin', 'panel'];

const vacioComoIndefinido = (valor: unknown) =>
  valor === '' ? undefined : valor;

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((valor) => valor || null)
    .nullable();

const link = z.preprocess(
  vacioComoIndefinido,
  z
    .url({ protocol: /^https?$/, error: 'Ingresá un link (https://…)' })
    .optional(),
);

const listaSinRepetidos = (que: string) =>
  z
    .array(z.string().trim().min(1).max(30))
    .max(50)
    .refine(
      (lista) =>
        new Set(lista.map((item) => item.toLowerCase())).size === lista.length,
      { error: `Hay ${que} repetidos` },
    );

export const redesSchema = z.object({
  instagram: link,
  facebook: link,
  tiktok: link,
});

export type Redes = z.infer<typeof redesSchema>;

export const marcaCrearSchema = z.object({
  nombre: z.string().trim().min(1, { error: 'Ingresá el nombre' }).max(80),
  slug: slugSchema.refine((slug) => !SLUGS_RESERVADOS.includes(slug), {
    error: 'Ese nombre está reservado',
  }),
  whatsapp: telefonoSchema,
  textosBanner: z.array(z.string().trim().min(1).max(120)).max(3).optional(),
  direccionRetiro: textoOpcional(200).optional(),
  horariosRetiro: textoOpcional(200).optional(),
  redes: redesSchema.optional(),
  comoComprar: z.string().trim().max(5000).optional(),
  condicionesVenta: z.string().trim().max(5000).optional(),
  minimoCompra: z.number().int().min(0).optional(),
  colores: listaSinRepetidos('colores').optional(),
  talles: listaSinRepetidos('talles').optional(),
});

const imagenUrl = z.url().nullable().optional();

export const marcaEditarSchema = marcaCrearSchema.partial().extend({
  logoUrl: imagenUrl,
  portadaUrl: imagenUrl,
  guiaTallesUrl: imagenUrl,
});

export const marcaEstadoSchema = z.object({ estado: estadoMarcaSchema });

export const TIPOS_IMAGEN_MARCA = ['logo', 'portada', 'guiaTalles'] as const;

export const imagenMarcaSchema = archivoImagenSchema.extend({
  tipo: z.enum(TIPOS_IMAGEN_MARCA),
});

export const accesoFabricanteSchema = z.object({ email: emailSchema });

export type MarcaCrearInput = z.input<typeof marcaCrearSchema>;
export type MarcaCrear = z.output<typeof marcaCrearSchema>;
export type MarcaEditarInput = z.input<typeof marcaEditarSchema>;
export type MarcaEditar = z.output<typeof marcaEditarSchema>;
export type MarcaEstado = z.infer<typeof marcaEstadoSchema>;
export type ImagenMarca = z.infer<typeof imagenMarcaSchema>;
export type AccesoFabricanteInput = z.input<typeof accesoFabricanteSchema>;

// La contraseña se muestra una sola vez: la API no la vuelve a devolver.
export interface AccesoFabricante {
  email: string;
  password: string;
}

export interface MarcaResumen {
  id: string;
  nombre: string;
  slug: string;
  dominioPropio: string | null;
  estado: EstadoMarca;
}

export interface Marca extends MarcaResumen {
  logoUrl: string | null;
  portadaUrl: string | null;
  guiaTallesUrl: string | null;
  textosBanner: string[];
  whatsapp: string;
  direccionRetiro: string | null;
  horariosRetiro: string | null;
  redes: Redes;
  comoComprar: string;
  condicionesVenta: string;
  minimoCompra: number;
  colores: string[];
  talles: string[];
  usuario: { email: string; activo: boolean } | null;
}
