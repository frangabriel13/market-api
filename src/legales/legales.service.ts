import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  TIPOS_TEXTO_LEGAL,
  type TextoLegal,
  type TextoLegalEditar,
  type TipoTextoLegal,
} from '../schemas/legales.js';

interface Fila {
  tipo: TipoTextoLegal;
  contenido: string;
  actualizadoEn: Date;
}

const PUBLICADO = { contenido: { not: '' } };

@Injectable()
export class LegalesService {
  constructor(private readonly prisma: PrismaService) {}

  // Todos los tipos, cargados o no, para editarlos.
  async listar(): Promise<TextoLegal[]> {
    const filas = await this.prisma.textoLegal.findMany();
    return TIPOS_TEXTO_LEGAL.map((tipo) => {
      const fila = filas.find((f) => f.tipo === tipo);
      return fila
        ? aTextoLegal(fila)
        : { tipo, contenido: '', actualizadoEn: null };
    });
  }

  async guardar(
    tipo: TipoTextoLegal,
    { contenido }: TextoLegalEditar,
  ): Promise<TextoLegal> {
    const fila = await this.prisma.textoLegal.upsert({
      where: { tipo },
      create: { tipo, contenido },
      update: { contenido },
    });
    return aTextoLegal(fila);
  }

  async obtenerPublicado(tipo: TipoTextoLegal): Promise<TextoLegal> {
    const fila = await this.prisma.textoLegal.findUnique({
      where: { tipo, ...PUBLICADO },
    });
    if (!fila) throw new NotFoundException('Texto no disponible');
    return aTextoLegal(fila);
  }

  async publicados(): Promise<TipoTextoLegal[]> {
    const filas = await this.prisma.textoLegal.findMany({
      where: PUBLICADO,
      select: { tipo: true },
    });
    return TIPOS_TEXTO_LEGAL.filter((tipo) =>
      filas.some((f) => f.tipo === tipo),
    );
  }
}

function aTextoLegal({ tipo, contenido, actualizadoEn }: Fila): TextoLegal {
  return { tipo, contenido, actualizadoEn: actualizadoEn.toISOString() };
}
