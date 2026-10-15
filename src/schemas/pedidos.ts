import { z } from 'zod';

// TODO(decision): cualquier estado puede pasar a cualquier otro.
export const ESTADOS_PEDIDO = [
  'NUEVO',
  'PAGADO',
  'EN_PREPARACION',
  'ENTREGADO',
  'CANCELADO',
] as const;

export const estadoPedidoSchema = z.enum(ESTADOS_PEDIDO);

export type EstadoPedido = z.infer<typeof estadoPedidoSchema>;

export const ETIQUETAS_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  NUEVO: 'Nuevo',
  PAGADO: 'Pagado',
  EN_PREPARACION: 'En preparación',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};
