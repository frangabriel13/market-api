import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hashPassword } from '../common/password.js';
import { generateToken, hashToken } from '../common/tokens.js';
import type { Env } from '../config/env.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const VIGENCIA_MS = 60 * 60 * 1000;

@Injectable()
export class RecuperacionService {
  private readonly logger = new Logger(RecuperacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // No espera el envío ni avisa si el email existe: la respuesta es igual
  // para todos y no revela qué emails tienen cuenta.
  async solicitar(email: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario?.activo) return;

    const token = generateToken();
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        recuperaciones: {
          deleteMany: {},
          create: {
            tokenHash: hashToken(token),
            expiraEn: new Date(Date.now() + VIGENCIA_MS),
          },
        },
      },
    });

    this.enviarLink(email, token).catch((error: unknown) =>
      this.logger.error(error, 'No se pudo enviar el email de recuperación'),
    );
  }

  async restablecer(token: string, password: string): Promise<void> {
    const recuperacion = await this.prisma.tokenRecuperacion.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!recuperacion || recuperacion.expiraEn < new Date()) {
      throw new BadRequestException(
        'El link no es válido o venció. Pedí uno nuevo.',
      );
    }

    await this.prisma.usuario.update({
      where: { id: recuperacion.usuarioId },
      data: {
        passwordHash: await hashPassword(password),
        recuperaciones: { deleteMany: {} },
        sesiones: { deleteMany: {} },
      },
    });
  }

  private enviarLink(email: string, token: string): Promise<void> {
    const plataforma = this.config.get('PLATFORM_NAME', { infer: true });
    const link = new URL(
      '/restablecer',
      this.config.get('FRONT_URL', { infer: true }),
    );
    link.searchParams.set('token', token);

    return this.email.enviar({
      para: email,
      asunto: `Restablecé tu contraseña de ${plataforma}`,
      texto: [
        'Hola,',
        '',
        `Pediste restablecer tu contraseña de ${plataforma}. Entrá a este link para elegir una nueva:`,
        '',
        link.toString(),
        '',
        'El link vence en 1 hora y se puede usar una sola vez. Si no lo pediste, ignorá este email: tu contraseña no cambia.',
      ].join('\n'),
    });
  }
}
