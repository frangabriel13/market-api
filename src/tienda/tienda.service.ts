import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { LegalesService } from '../legales/legales.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Redes } from '../schemas/marcas.js';
import type { MarcaTienda } from '../schemas/tienda.js';

const CONFIGURACION = {
  nombre: true,
  slug: true,
  logoUrl: true,
  portadaUrl: true,
  guiaTallesUrl: true,
  textosBanner: true,
  whatsapp: true,
  direccionRetiro: true,
  horariosRetiro: true,
  redes: true,
  comoComprar: true,
  condicionesVenta: true,
  minimoCompra: true,
  opcionesEntrega: {
    where: { activa: true },
    select: { id: true, nombre: true, tipo: true },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  },
} satisfies Prisma.MarcaSelect;

@Injectable()
export class TiendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legales: LegalesService,
  ) {}

  async configuracion(marcaId: string): Promise<MarcaTienda> {
    const [marca, textosLegales] = await Promise.all([
      this.prisma.marca.findUniqueOrThrow({
        where: { id: marcaId },
        select: CONFIGURACION,
      }),
      this.legales.publicados(),
    ]);
    return { ...marca, redes: marca.redes as Redes, textosLegales };
  }
}
