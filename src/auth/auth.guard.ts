import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import type { Rol } from '../generated/prisma/enums.js';
import { rolSchema } from '../schemas/roles.js';
import type { JwtPayload } from './auth.constants.js';
import { PUBLICO, ROLES, type RequestConUsuario } from './decorators.js';

const payloadSchema = z.object({
  sub: z.string(),
  rol: rolSchema,
  marcaId: z.string().nullable(),
});

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const destinos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, destinos)) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest<RequestConUsuario>();
    const usuario = await this.verificarToken(req.headers.authorization);

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(
      ROLES,
      destinos,
    );
    if (!roles?.includes(usuario.rol)) throw new ForbiddenException();
    if (usuario.rol === 'FABRICANTE' && !usuario.marcaId) {
      throw new ForbiddenException();
    }

    req.usuario = usuario;
    return true;
  }

  private async verificarToken(
    header: string | undefined,
  ): Promise<JwtPayload> {
    const [tipo, token] = header?.split(' ') ?? [];
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException();
    try {
      const payload: unknown = await this.jwt.verifyAsync(token, {
        algorithms: ['HS256'],
      });
      return payloadSchema.parse(payload);
    } catch {
      throw new UnauthorizedException();
    }
  }
}
