import {
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  NotFoundException,
  type PipeTransform,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HEADER_HOST_TIENDA, identificarTienda } from '../schemas/tienda.js';

@Injectable()
export class MarcaDeTiendaPipe implements PipeTransform<
  string | undefined,
  Promise<string>
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async transform(host: string | undefined): Promise<string> {
    const buscada = identificarTienda(
      host ?? '',
      this.config.get('PLATFORM_DOMAIN', { infer: true }),
    );
    const marca =
      buscada &&
      (await this.prisma.marca.findUnique({
        where: { ...buscada, estado: 'ACTIVA' },
        select: { id: true },
      }));
    if (!marca) throw new NotFoundException('Tienda no disponible');
    return marca.id;
  }
}

const HostDeTienda = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest<Request>().header(HEADER_HOST_TIENDA),
);

// Id de la marca activa que corresponde al host. Inexistente, pausada o dada
// de baja: 404 "Tienda no disponible".
export const MarcaDeTienda = () => HostDeTienda(MarcaDeTiendaPipe);
