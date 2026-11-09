import { formatearPrecio } from '../common/precio.js';
import {
  ETIQUETAS_FORMA_PAGO,
  type FormaPago,
  type PedidoCrear,
} from '../schemas/pedidos.js';
import { formatearTelefono } from '../schemas/telefono.js';

export interface DatosMensaje {
  numero: number;
  items: {
    nombreProducto: string;
    color: string;
    talle: string;
    cantidad: number;
    precioUnitario: number;
  }[];
  total: number;
  entrega: string;
  formaPago: FormaPago;
  nombre: string;
  telefono: string;
  // Solo con envío (el esquema ya exige estos datos).
  envio?: Pick<
    PedidoCrear,
    'dni' | 'direccion' | 'localidad' | 'provincia' | 'codigoPostal'
  >;
}

export function mensajeDePedido(pedido: DatosMensaje): string {
  const { envio } = pedido;
  const items = pedido.items.map((item) => {
    // Sin colores o sin talles va solo lo que el producto tiene.
    const variante = [item.color, item.talle].filter(Boolean).join(' / ');
    const producto = variante
      ? `${item.nombreProducto} — ${variante}`
      : item.nombreProducto;
    return `• ${producto} × ${item.cantidad} — ${formatearPrecio(item.precioUnitario * item.cantidad)}`;
  });
  return [
    '¡Hola! Te hago un pedido por la tienda.',
    `Pedido #${pedido.numero}`,
    '',
    ...items,
    '',
    `Total: ${formatearPrecio(pedido.total)}`,
    `Entrega: ${pedido.entrega}`,
    `Pago: ${ETIQUETAS_FORMA_PAGO[pedido.formaPago]}`,
    `Nombre: ${pedido.nombre} · Tel: ${formatearTelefono(pedido.telefono)}`,
    ...(envio
      ? [
          `DNI: ${envio.dni}`,
          `Dirección: ${envio.direccion}, ${envio.localidad}, ${envio.provincia} (CP ${envio.codigoPostal})`,
        ]
      : []),
  ].join('\n');
}

export function linkDeWhatsapp(whatsapp: string, mensaje: string): string {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`;
}
