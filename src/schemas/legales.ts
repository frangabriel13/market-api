import { z } from 'zod';

export const TIPOS_TEXTO_LEGAL = ['TERMINOS', 'PRIVACIDAD'] as const;

export const tipoTextoLegalSchema = z.enum(TIPOS_TEXTO_LEGAL);

export type TipoTextoLegal = z.infer<typeof tipoTextoLegalSchema>;

export const ETIQUETAS_TEXTO_LEGAL: Record<TipoTextoLegal, string> = {
  TERMINOS: 'Términos y condiciones',
  PRIVACIDAD: 'Política de privacidad',
};

// Vacío: la tienda no lo muestra.
export const textoLegalEditarSchema = z.object({
  contenido: z.string().trim().max(50_000),
});

export type TextoLegalEditar = z.infer<typeof textoLegalEditarSchema>;

export interface TextoLegal {
  tipo: TipoTextoLegal;
  contenido: string;
  // ISO; null si todavía no se cargó.
  actualizadoEn: string | null;
}
