import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { esRegistroInexistente } from '../prisma/errores.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  Pedido,
  PedidoEstado,
  PedidoResumen,
} from '../schemas/pedidos.js';

const RESUMEN = {
  id: true,
  numero: true,
  estado: true,
  creadoEn: true,
  compradorNombre: true,
  tipoEntrega: true,
  total: true,
  opcionEntrega: { select: { nombre: true } },
} satisfies Prisma.PedidoSelect;

const DETALLE = {
  ...RESUMEN,
  compradorTelefono: true,
  compradorDni: true,
  compradorCuit: true,
  direccion: true,
  localidad: true,
  provincia: true,
  transporte: true,
  observaciones: true,
  items: {
    select: {
      productoId: true,
      nombreProducto: true,
      color: true,
      talle: true,
      cantidad: true,
      precioUnitario: true,
    },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.PedidoSelect;

const NO_ENCONTRADO = 'Pedido no encontrado';

// Todas las consultas filtran por marcaId (sale del token): un pedido de
// otra marca responde 404, como si no existiera.
@Injectable()
export class PedidosPanelService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(marcaId: string): Promise<PedidoResumen[]> {
    const pedidos = await this.prisma.pedido.findMany({
      where: { marcaId },
      select: RESUMEN,
      orderBy: { numero: 'desc' },
    });
    return pedidos.map(aPedido);
  }

  async obtener(marcaId: string, id: string): Promise<Pedido> {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id, marcaId },
      select: DETALLE,
    });
    if (!pedido) throw new NotFoundException(NO_ENCONTRADO);
    return aPedido(pedido);
  }

  // TODO(decision): cualquier estado puede pasar a cualquier otro.
  async cambiarEstado(
    marcaId: string,
    id: string,
    { estado }: PedidoEstado,
  ): Promise<Pedido> {
    const pedido = await this.prisma.pedido
      .update({ where: { id, marcaId }, data: { estado }, select: DETALLE })
      .catch((error: unknown) => {
        if (esRegistroInexistente(error)) {
          throw new NotFoundException(NO_ENCONTRADO);
        }
        throw error;
      });
    return aPedido(pedido);
  }
}

function aPedido<
  T extends { creadoEn: Date; opcionEntrega: { nombre: string } },
>({ creadoEn, opcionEntrega, ...pedido }: T) {
  return {
    ...pedido,
    creadoEn: creadoEn.toISOString(),
    entrega: opcionEntrega.nombre,
  };
}
