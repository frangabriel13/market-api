import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { MarcasService } from '../marcas/marcas.service.js';
import { esRegistroInexistente } from '../prisma/errores.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  OpcionEntrega,
  OpcionEntregaCrear,
  OpcionEntregaEditar,
} from '../schemas/opciones-entrega.js';

const CAMPOS = {
  id: true,
  nombre: true,
  tipo: true,
  orden: true,
  activa: true,
} satisfies Prisma.OpcionEntregaSelect;

@Injectable()
export class OpcionesEntregaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marcas: MarcasService,
  ) {}

  async listar(marcaId: string): Promise<OpcionEntrega[]> {
    await this.marcas.asegurarExistencia(marcaId);
    return this.prisma.opcionEntrega.findMany({
      where: { marcaId },
      select: CAMPOS,
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
  }

  async crear(
    marcaId: string,
    datos: OpcionEntregaCrear,
  ): Promise<OpcionEntrega> {
    await this.marcas.asegurarExistencia(marcaId);
    const orden = datos.orden ?? (await this.siguienteOrden(marcaId));
    return this.prisma.opcionEntrega.create({
      data: { ...datos, orden, marcaId },
      select: CAMPOS,
    });
  }

  editar(
    marcaId: string,
    id: string,
    datos: OpcionEntregaEditar,
  ): Promise<OpcionEntrega> {
    return this.prisma.opcionEntrega
      .update({ where: { id, marcaId }, data: datos, select: CAMPOS })
      .catch((error: unknown) => {
        if (esRegistroInexistente(error)) {
          throw new NotFoundException('Opción de entrega no encontrada');
        }
        throw error;
      });
  }

  private async siguienteOrden(marcaId: string): Promise<number> {
    const { _max } = await this.prisma.opcionEntrega.aggregate({
      where: { marcaId },
      _max: { orden: true },
    });
    return _max.orden === null ? 0 : _max.orden + 1;
  }
}
