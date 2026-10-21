import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { formatearPrecio } from '../common/precio.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { esVigente, type ListasDeMarca } from '../productos/variantes.js';
import type {
  ItemPedidoCrear,
  PedidoCreado,
  PedidoCrear,
  PedidoNoDisponible,
} from '../schemas/pedidos.js';
import { linkDeWhatsapp, mensajeDePedido } from './mensaje-whatsapp.js';

@Injectable()
export class PedidosTiendaService {
  constructor(private readonly prisma: PrismaService) {}

  // Precios y disponibilidad salen de la base, nunca del navegador.
  crear(marcaId: string, datos: PedidoCrear): Promise<PedidoCreado> {
    return this.prisma.$transaction(async (tx) => {
      // Toma el número y bloquea la fila de la marca hasta el final: los
      // pedidos simultáneos de una marca se hacen de a uno. Si algo falla,
      // el número no se gasta.
      const marca = await tx.marca.update({
        where: { id: marcaId },
        data: { ultimoNumeroPedido: { increment: 1 } },
        select: {
          ultimoNumeroPedido: true,
          minimoCompra: true,
          whatsapp: true,
          colores: true,
          talles: true,
        },
      });

      const opcion = await tx.opcionEntrega.findFirst({
        where: { id: datos.opcionEntregaId, marcaId, activa: true },
        select: { nombre: true, tipo: true },
      });
      if (opcion?.tipo !== datos.tipoEntrega) {
        throw new BadRequestException(
          'La opción de entrega ya no está disponible: elegí otra',
        );
      }

      const productos = await tx.producto.findMany({
        where: {
          id: { in: datos.items.map((item) => item.productoId) },
          marcaId,
          visible: true,
        },
        select: {
          id: true,
          nombre: true,
          precio: true,
          variantes: {
            where: { disponible: true },
            select: { color: true, talle: true },
          },
        },
      });

      const { items, noDisponibles } = armarItems(
        datos.items,
        productos,
        marca,
      );
      if (noDisponibles.length) {
        throw new ConflictException({
          message: 'Algunos productos ya no están disponibles',
          noDisponibles,
        } satisfies PedidoNoDisponible);
      }

      const total = items.reduce(
        (suma, item) => suma + item.precioUnitario * item.cantidad,
        0,
      );
      if (total < marca.minimoCompra) {
        throw new BadRequestException(
          `El pedido no llega al mínimo de compra de ${formatearPrecio(marca.minimoCompra)}`,
        );
      }

      const envio =
        datos.tipoEntrega === 'ENVIO'
          ? {
              compradorDni: datos.dni,
              compradorCuit: datos.cuit,
              direccion: datos.direccion,
              localidad: datos.localidad,
              provincia: datos.provincia,
              transporte: datos.transporte,
              observaciones: datos.observaciones,
            }
          : {};
      const numero = marca.ultimoNumeroPedido;
      await tx.pedido.create({
        data: {
          marcaId,
          numero,
          opcionEntregaId: datos.opcionEntregaId,
          tipoEntrega: opcion.tipo,
          compradorNombre: datos.nombre,
          compradorTelefono: datos.telefono,
          ...envio,
          total,
          items: { create: items },
        },
      });

      const mensaje = mensajeDePedido({
        numero,
        items,
        total,
        entrega: opcion.nombre,
        nombre: datos.nombre,
        telefono: datos.telefono,
      });
      return {
        numero,
        total,
        whatsappUrl: linkDeWhatsapp(marca.whatsapp, mensaje),
      };
    });
  }
}

interface ProductoDelPedido {
  id: string;
  nombre: string;
  precio: number;
  // Solo las disponibles.
  variantes: { color: string; talle: string }[];
}

// Copia nombre y precio de cada ítem disponible; junta los que no lo están.
function armarItems(
  pedidos: ItemPedidoCrear[],
  productos: ProductoDelPedido[],
  listas: ListasDeMarca,
) {
  const items = [];
  const noDisponibles: PedidoNoDisponible['noDisponibles'] = [];
  for (const { productoId, color, talle, cantidad } of pedidos) {
    const producto = productos.find((p) => p.id === productoId);
    const disponible =
      esVigente({ color, talle }, listas) &&
      producto?.variantes.some((v) => v.color === color && v.talle === talle);
    if (producto && disponible) {
      items.push({
        productoId,
        nombreProducto: producto.nombre,
        color,
        talle,
        cantidad,
        precioUnitario: producto.precio,
      });
    } else {
      noDisponibles.push({ productoId, color, talle });
    }
  }
  return { items, noDisponibles };
}
