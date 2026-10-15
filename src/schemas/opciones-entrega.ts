import { z } from 'zod';

export const TIPOS_ENTREGA = ['RETIRO', 'ENVIO'] as const;

export const tipoEntregaSchema = z.enum(TIPOS_ENTREGA);

export type TipoEntrega = z.infer<typeof tipoEntregaSchema>;

export const ETIQUETAS_TIPO_ENTREGA: Record<TipoEntrega, string> = {
  RETIRO: 'Retiro',
  ENVIO: 'Envío',
};

export const opcionEntregaCrearSchema = z.object({
  nombre: z.string().trim().min(1, { error: 'Ingresá el nombre' }).max(80),
  tipo: tipoEntregaSchema,
  orden: z.number().int().min(0).optional(),
  activa: z.boolean().optional(),
});

export const opcionEntregaEditarSchema = opcionEntregaCrearSchema.partial();

export type OpcionEntregaCrearInput = z.input<typeof opcionEntregaCrearSchema>;
export type OpcionEntregaCrear = z.output<typeof opcionEntregaCrearSchema>;
export type OpcionEntregaEditar = z.output<typeof opcionEntregaEditarSchema>;

export interface OpcionEntrega {
  id: string;
  nombre: string;
  tipo: TipoEntrega;
  orden: number;
  activa: boolean;
}
