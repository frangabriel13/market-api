import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Env } from '../config/env.js';

export interface Email {
  para: string;
  asunto: string;
  texto: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly remitente: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    const apiKey = config.get('RESEND_API_KEY', { infer: true });
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.remitente = config.get('EMAIL_FROM', { infer: true });
  }

  async enviar({ para, asunto, texto }: Email): Promise<void> {
    if (!this.resend || !this.remitente) {
      this.logger.warn(
        `Sin Resend configurado. Para ${para}: ${asunto}\n${texto}`,
      );
      return;
    }
    const { error } = await this.resend.emails.send({
      from: this.remitente,
      to: para,
      subject: asunto,
      text: texto,
    });
    if (error) throw new Error(`Resend: ${error.message}`);
  }
}
