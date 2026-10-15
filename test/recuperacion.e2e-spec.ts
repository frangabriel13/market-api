import request from 'supertest';
import { hashToken } from '../src/common/tokens.js';
import { EmailService, type Email } from '../src/email/email.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { crearApp, type AppDeTest } from './utils/app.js';
import { crearUsuario, limpiarBase, PASSWORD_DE_TEST } from './utils/db.js';

describe('Recuperar contraseña (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  const enviados: Email[] = [];

  const post = (url: string, cuerpo: object) =>
    request(app.getHttpServer()).post(url).send(cuerpo);

  const recuperar = (email: string) => post('/auth/recuperar', { email });

  const restablecer = (token: string, password: string) =>
    post('/auth/restablecer', { token, password });

  const login = (email: string, password: string) =>
    post('/auth/login', { email, password });

  const tokenDelEmail = async () => {
    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    const link = enviados[0].texto.match(/https?:\/\/\S+/)![0];
    return new URL(link).searchParams.get('token')!;
  };

  beforeAll(async () => {
    app = await crearApp([], (modulo) =>
      modulo.overrideProvider(EmailService).useValue({
        enviar: async (email: Email) => {
          enviados.push(email);
        },
      }),
    );
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    enviados.length = 0;
    await limpiarBase(prisma);
    await crearUsuario(prisma, { email: 'fabrica@test.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('manda un link de un solo uso que permite elegir una contraseña nueva', async () => {
    const sesionVieja = await login('fabrica@test.com', PASSWORD_DE_TEST);
    const cookieVieja = sesionVieja.headers['set-cookie'][0].split(';')[0];

    await recuperar(' Fabrica@Test.com ').expect(204);
    const token = await tokenDelEmail();
    expect(enviados[0].para).toBe('fabrica@test.com');
    expect(enviados[0].asunto).toMatch(/^Restablecé tu contraseña de /);
    expect(enviados[0].texto).toMatch(/\/restablecer\?token=/);

    await restablecer(token, 'una-nueva-segura').expect(204);

    await login('fabrica@test.com', 'una-nueva-segura').expect(200);
    await login('fabrica@test.com', PASSWORD_DE_TEST).expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieVieja)
      .expect(401);
    await restablecer(token, 'otra-nueva-segura').expect(400);
  });

  it('guarda solo el hash del token, con vencimiento de 1 hora', async () => {
    await recuperar('fabrica@test.com').expect(204);
    const token = await tokenDelEmail();
    const [guardado] = await prisma.tokenRecuperacion.findMany();
    expect(guardado.tokenHash).toBe(hashToken(token));
    const minutos = (guardado.expiraEn.getTime() - Date.now()) / 60_000;
    expect(minutos).toBeGreaterThan(59);
    expect(minutos).toBeLessThanOrEqual(60);
  });

  it('pedir otro link invalida el anterior', async () => {
    await recuperar('fabrica@test.com');
    const primero = await tokenDelEmail();
    enviados.length = 0;
    await recuperar('fabrica@test.com');
    const segundo = await tokenDelEmail();

    await restablecer(primero, 'una-nueva-segura').expect(400);
    await restablecer(segundo, 'una-nueva-segura').expect(204);
  });

  it('responde igual si el email no existe o la cuenta está inactiva, sin mandar nada', async () => {
    await crearUsuario(prisma, { email: 'inactiva@test.com', activo: false });
    await recuperar('nadie@test.com').expect(204);
    await recuperar('inactiva@test.com').expect(204);
    await new Promise((resolver) => setTimeout(resolver, 50));
    expect(enviados).toHaveLength(0);
    expect(await prisma.tokenRecuperacion.count()).toBe(0);
  });

  it('rechaza un link vencido', async () => {
    await recuperar('fabrica@test.com');
    const token = await tokenDelEmail();
    await prisma.tokenRecuperacion.updateMany({
      data: { expiraEn: new Date(Date.now() - 1000) },
    });
    const res = await restablecer(token, 'una-nueva-segura').expect(400);
    expect(res.body.message).toBe(
      'El link no es válido o venció. Pedí uno nuevo.',
    );
  });

  it.each([
    ['un token inventado', 'inventado', 'una-nueva-segura', 400],
    ['una contraseña corta', 'inventado', 'corta', 400],
  ])('rechaza %s', async (_, token, password, estado) => {
    await restablecer(token, password).expect(estado);
  });

  it('valida el email', async () => {
    await recuperar('no-es-email').expect(400);
  });
});
