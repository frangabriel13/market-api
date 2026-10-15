import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service.js';

const enviar = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: vi.fn(function () {
    return { emails: { send: enviar } };
  }),
}));

const servicio = (env: Record<string, string>) =>
  new EmailService(new ConfigService(env) as ConfigService<never, true>);

const EMAIL = { para: 'a@test.com', asunto: 'Asunto', texto: 'Texto' };

describe('EmailService', () => {
  beforeEach(() => enviar.mockReset());

  it('sin Resend configurado no envía ni falla', async () => {
    await expect(servicio({}).enviar(EMAIL)).resolves.toBeUndefined();
    expect(enviar).not.toHaveBeenCalled();
  });

  it('envía con Resend desde EMAIL_FROM', async () => {
    enviar.mockResolvedValue({ data: { id: '1' }, error: null });
    await servicio({
      RESEND_API_KEY: 're_x',
      EMAIL_FROM: 'Plataforma <no@x.com>',
    }).enviar(EMAIL);
    expect(enviar).toHaveBeenCalledWith({
      from: 'Plataforma <no@x.com>',
      to: 'a@test.com',
      subject: 'Asunto',
      text: 'Texto',
    });
  });

  it('falla si Resend devuelve un error', async () => {
    enviar.mockResolvedValue({
      data: null,
      error: { message: 'dominio no verificado' },
    });
    await expect(
      servicio({ RESEND_API_KEY: 're_x', EMAIL_FROM: 'no@x.com' }).enviar(
        EMAIL,
      ),
    ).rejects.toThrow('Resend: dominio no verificado');
  });
});
