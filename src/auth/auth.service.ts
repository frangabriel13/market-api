import { randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from '../common/password.js';
import { generateToken, hashToken } from '../common/tokens.js';
import type {
  EstadoMarca,
  Prisma,
  Usuario,
} from '../generated/prisma/client.js';
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
const MARCA_DE_BAJA = 'Tu marca está dada de baja: no podés ingresar al panel.';

const CON_MARCA = {
  marca: { select: { estado: true } },
} satisfies Prisma.UsuarioInclude;

// TODO(decision): con la marca dada de baja el fabricante no entra; con la
// marca pausada, sí (puede seguir cargando productos).
const marcaDeBaja = (usuario: { marca: { estado: EstadoMarca } | null }) =>
  usuario.marca?.estado === 'BAJA';

@Injectable()
export class AuthService {
  // Si el email no existe se verifica contra este hash, para que la respuesta
  // tarde lo mismo y no revele qué emails tienen cuenta.
  private readonly hashFalso = hashPassword(randomBytes(16).toString('hex'));

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ email, password }: Login): Promise<ResultadoAuth> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: CON_MARCA,
    });
    const passwordOk = await verifyPassword(
      usuario?.passwordHash ?? (await this.hashFalso),
      password,
    );
    if (!usuario || !passwordOk || !usuario.activo) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }
    if (marcaDeBaja(usuario)) throw new UnauthorizedException(MARCA_DE_BAJA);
    return this.crearSesion(usuario);
  }

  async refresh(refreshToken: string | undefined): Promise<ResultadoAuth> {
    if (!refreshToken) throw new UnauthorizedException(SESION_INVALIDA);

    const sesion = await this.prisma.sesion.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { usuario: { include: CON_MARCA } },
    });
    if (!sesion) throw new UnauthorizedException(SESION_INVALIDA);

    // deleteMany y no delete: si dos refresh llegan juntos, solo uno gana.
    const { count } = await this.prisma.sesion.deleteMany({
      where: { id: sesion.id },
    });
    const { usuario } = sesion;
    if (count === 0 || sesion.expiraEn < new Date() || !usuario.activo) {
      throw new UnauthorizedException(SESION_INVALIDA);
    }
    if (marcaDeBaja(usuario)) throw new UnauthorizedException(MARCA_DE_BAJA);
    return this.crearSesion(usuario);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.sesion.deleteMany({
      where: { tokenHash: hashToken(refreshToken) },
    });
  }

  private async crearSesion(usuario: Usuario): Promise<ResultadoAuth> {
    const refreshToken = generateToken();
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
