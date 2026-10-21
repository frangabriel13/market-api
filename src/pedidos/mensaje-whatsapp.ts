import { formatearPrecio } from '../common/precio.js';
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
  nombre: string;
  telefono: string;
}

export function mensajeDePedido(pedido: DatosMensaje): string {
  const items = pedido.items.map(
    (item) =>
      `• ${item.nombreProducto} — ${item.color} / ${item.talle} × ${item.cantidad} — ${formatearPrecio(item.precioUnitario * item.cantidad)}`,
  );
  return [
    '¡Hola! Te hago un pedido por la tienda.',
    `Pedido #${pedido.numero}`,
    '',
    ...items,
    '',
    `Total: ${formatearPrecio(pedido.total)}`,
    `Entrega: ${pedido.entrega}`,
    `Nombre: ${pedido.nombre} · Tel: ${formatearTelefono(pedido.telefono)}`,
  ].join('\n');
}

export function linkDeWhatsapp(whatsapp: string, mensaje: string): string {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`;
}
