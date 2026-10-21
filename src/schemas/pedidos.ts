import { z } from 'zod';
import { tipoEntregaSchema, type TipoEntrega } from './opciones-entrega.ts';
import { telefonoSchema } from './telefono.ts';
import { textoOpcional } from './texto.ts';

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

const soloDigitos = (valor: string) => valor.replace(/[\s.-]/g, '');

// Vacío se guarda como null; si no, solo los números.
const documento = (largos: number[], error: string) =>
  z
    .string()
    .trim()
    .transform(soloDigitos)
    .refine(
      (valor) =>
        !valor || (/^\d+$/.test(valor) && largos.includes(valor.length)),
      { error },
    )
    .transform((valor) => valor || null)
    .nullable()
    .optional();

const clave = ({ productoId, color, talle }: ItemPedidoCrear) =>
  `${productoId}\u0000${color}\u0000${talle}`;

export const itemPedidoCrearSchema = z.object({
  productoId: z.uuid(),
  color: z.string().trim().min(1).max(30),
  talle: z.string().trim().min(1).max(30),
  cantidad: z.number().int().min(1).max(9999),
});

export type ItemPedidoCrear = z.infer<typeof itemPedidoCrearSchema>;

const CAMPOS_DE_ENVIO = {
  direccion: 'Ingresá la dirección',
  localidad: 'Ingresá la localidad',
  provincia: 'Ingresá la provincia',
} as const;

// Los datos de envío solo se piden (y guardan) si la opción elegida es de
// tipo ENVIO. La API verifica que tipoEntrega coincida con la opción.
export const pedidoCrearSchema = z
  .object({
    items: z
      .array(itemPedidoCrearSchema)
      .min(1, { error: 'El carrito está vacío' })
      .max(200)
      .refine((items) => new Set(items.map(clave)).size === items.length, {
        error: 'Hay productos repetidos',
      }),
    opcionEntregaId: z.uuid({ error: 'Elegí cómo recibís el pedido' }),
    tipoEntrega: tipoEntregaSchema,
    nombre: z.string().trim().min(1, { error: 'Ingresá tu nombre' }).max(80),
    telefono: telefonoSchema,
    // TODO(decision): DNI y CUIT opcionales en envío.
    dni: documento([7, 8], 'Ingresá el DNI (7 u 8 números)'),
    cuit: documento([11], 'Ingresá el CUIT (11 números)'),
    direccion: textoOpcional(200).optional(),
    localidad: textoOpcional(100).optional(),
    provincia: textoOpcional(60).optional(),
    transporte: textoOpcional(100).optional(),
    observaciones: textoOpcional(500).optional(),
  })
  .superRefine((pedido, ctx) => {
    if (pedido.tipoEntrega !== 'ENVIO') return;
    for (const [campo, mensaje] of Object.entries(CAMPOS_DE_ENVIO)) {
      if (!pedido[campo as keyof typeof CAMPOS_DE_ENVIO]) {
        ctx.addIssue({ code: 'custom', path: [campo], message: mensaje });
      }
    }
  });

export type PedidoCrearInput = z.input<typeof pedidoCrearSchema>;
export type PedidoCrear = z.output<typeof pedidoCrearSchema>;

export interface PedidoCreado {
  numero: number;
  total: number;
  whatsappUrl: string;
}

// 409 de POST /tienda/pedidos: ítems que ya no se pueden pedir (producto
// oculto o borrado, o combinación agotada o que ya no es de la marca).
export interface PedidoNoDisponible {
  message: string;
  noDisponibles: Pick<ItemPedidoCrear, 'productoId' | 'color' | 'talle'>[];
}

export const pedidoEstadoSchema = z.object({ estado: estadoPedidoSchema });

export type PedidoEstado = z.infer<typeof pedidoEstadoSchema>;

export interface PedidoResumen {
  id: string;
  numero: number;
  estado: EstadoPedido;
  // ISO.
  creadoEn: string;
  compradorNombre: string;
  tipoEntrega: TipoEntrega;
  // Nombre de la opción de entrega elegida.
  entrega: string;
  total: number;
}

// Copia del producto al momento del pedido; productoId es null si el
// producto se borró después.
export interface ItemPedido {
  productoId: string | null;
  nombreProducto: string;
  color: string;
  talle: string;
  cantidad: number;
  precioUnitario: number;
}

export interface Pedido extends PedidoResumen {
  compradorTelefono: string;
  compradorDni: string | null;
  compradorCuit: string | null;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
  transporte: string | null;
  observaciones: string | null;
  items: ItemPedido[];
}
