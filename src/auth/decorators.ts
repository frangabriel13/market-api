import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Rol } from '../generated/prisma/enums.js';
import type { JwtPayload } from './auth.constants.js';

export const PUBLICO = 'publico';
export const ROLES = 'roles';

// Ruta sin login (tienda pública, auth). Sin este decorador ni @Roles, el
// guard responde 403: ninguna ruta queda abierta por olvido.
export const Publico = () => SetMetadata(PUBLICO, true);

export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);

export interface RequestConUsuario extends Request {
  usuario?: JwtPayload;
}

export const UsuarioActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtPayload => {
    const usuario = ctx.switchToHttp().getRequest<RequestConUsuario>().usuario;
    if (!usuario) throw new ForbiddenException();
    return usuario;
  },
);

// La marca del fabricante, siempre del token: nunca del body ni de la URL.
export const MarcaId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const usuario = ctx.switchToHttp().getRequest<RequestConUsuario>().usuario;
    if (usuario?.rol !== 'FABRICANTE' || !usuario.marcaId) {
      throw new ForbiddenException();
    }
    return usuario.marcaId;
  },
);
