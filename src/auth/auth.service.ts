import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from '../common/password.js';
import type { Usuario } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Login, Sesion } from '../schemas/auth.js';
import {
  REFRESH_TOKEN_DURACION_MS,
  type JwtPayload,
} from './auth.constants.js';

export interface ResultadoAuth {
  sesion: Sesion;
  refreshToken: string;
  refreshExpiraEn: Date;
}

const CREDENCIALES_INVALIDAS = 'Email o contraseña incorrectos';
const SESION_INVALIDA = 'La sesión expiró. Volvé a ingresar.';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  // Hash contra el que se compara cuando el email no existe, para que la
  // respuesta tarde lo mismo y no revele qué emails tienen cuenta.
  private readonly hashFalso = hashPassword(randomBytes(16).toString('hex'));

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ email, password }: Login): Promise<ResultadoAuth> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    const passwordOk = await verifyPassword(
      usuario?.passwordHash ?? (await this.hashFalso),
      password,
    );
    if (!usuario || !passwordOk || !usuario.activo) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }
    return this.crearSesion(usuario);
  }

  // Rota el refresh token: borra la sesión usada y crea una nueva.
  async refresh(refreshToken: string | undefined): Promise<ResultadoAuth> {
    if (!refreshToken) throw new UnauthorizedException(SESION_INVALIDA);

    const sesion = await this.prisma.sesion.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { usuario: true },
    });
    if (!sesion) throw new UnauthorizedException(SESION_INVALIDA);

    // deleteMany y no delete: si dos refresh llegan juntos, solo uno gana.
    const { count } = await this.prisma.sesion.deleteMany({
      where: { id: sesion.id },
    });
    if (count === 0 || sesion.expiraEn < new Date() || !sesion.usuario.activo) {
      throw new UnauthorizedException(SESION_INVALIDA);
    }
    return this.crearSesion(sesion.usuario);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.sesion.deleteMany({
      where: { tokenHash: hashToken(refreshToken) },
    });
  }

  private async crearSesion(usuario: Usuario): Promise<ResultadoAuth> {
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshExpiraEn = new Date(Date.now() + REFRESH_TOKEN_DURACION_MS);
    await this.prisma.sesion.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: hashToken(refreshToken),
        expiraEn: refreshExpiraEn,
      },
    });

    const payload: JwtPayload = {
      sub: usuario.id,
      rol: usuario.rol,
      marcaId: usuario.marcaId,
    };
    return {
      sesion: {
        accessToken: await this.jwt.signAsync(payload),
        usuario: {
          id: usuario.id,
          email: usuario.email,
          rol: usuario.rol,
          marcaId: usuario.marcaId,
        },
      },
      refreshToken,
      refreshExpiraEn,
    };
  }
}
