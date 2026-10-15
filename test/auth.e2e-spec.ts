import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { JwtPayload } from '../src/auth/auth.constants.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { crearApp, type AppDeTest } from './utils/app.js';
import {
  crearMarca,
  crearUsuario,
  limpiarBase,
  PASSWORD_DE_TEST,
} from './utils/db.js';

function cookieRefresh(res: request.Response): string | undefined {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return cookies.find((c) => c.startsWith('refresh_token='))?.split(';')[0];
}

describe('Auth (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let jwt: JwtService;
  let marcaId: string;

  const login = (email: string, password = PASSWORD_DE_TEST) =>
    request(app.getHttpServer()).post('/auth/login').send({ email, password });

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    marcaId = (await crearMarca(prisma, 'una-marca')).id;
    await crearUsuario(prisma, { email: 'admin@test.com' });
    await crearUsuario(prisma, { email: 'fabricante@test.com', marcaId });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('devuelve el access token con rol y marca, y el refresh en una cookie httpOnly', async () => {
      const res = await login('fabricante@test.com').expect(200);

      expect(res.body.usuario).toMatchObject({
        email: 'fabricante@test.com',
        rol: 'FABRICANTE',
        marcaId,
      });
      const payload = await jwt.verifyAsync<
        JwtPayload & { iat: number; exp: number }
      >(res.body.accessToken);
      expect(payload).toMatchObject({
        sub: res.body.usuario.id,
        rol: 'FABRICANTE',
        marcaId,
      });
      expect(payload.exp - payload.iat).toBe(15 * 60);

      const setCookie = ([] as string[]).concat(res.headers['set-cookie']);
      expect(setCookie[0]).toMatch(/^refresh_token=[\w-]+;/);
      expect(setCookie[0]).toMatch(/HttpOnly/);
      expect(setCookie[0]).toMatch(/SameSite=Lax/);
      expect(setCookie[0]).toMatch(/Path=\//);
      expect(res.body).not.toHaveProperty('refreshToken');
    });

    it('el admin no tiene marca', async () => {
      const res = await login('admin@test.com').expect(200);
      expect(res.body.usuario).toMatchObject({ rol: 'ADMIN', marcaId: null });
    });

    it('acepta el email con mayúsculas y espacios', async () => {
      await login('  Fabricante@Test.com ').expect(200);
    });

    it('guarda solo el hash del refresh token', async () => {
      const res = await login('admin@test.com').expect(200);
      const token = cookieRefresh(res)!.split('=')[1];
      const sesiones = await prisma.sesion.findMany();
      expect(sesiones).toHaveLength(1);
      expect(sesiones[0].tokenHash).not.toBe(token);
    });

    it('rechaza una contraseña incorrecta', async () => {
      const res = await login('admin@test.com', 'otra').expect(401);
      expect(res.body.message).toBe('Email o contraseña incorrectos');
      expect(cookieRefresh(res)).toBeUndefined();
    });

    it('rechaza un email inexistente con el mismo mensaje', async () => {
      const res = await login('nadie@test.com').expect(401);
      expect(res.body.message).toBe('Email o contraseña incorrectos');
    });

    it('rechaza un usuario inactivo', async () => {
      await crearUsuario(prisma, { email: 'inactivo@test.com', activo: false });
      await login('inactivo@test.com').expect(401);
    });

    it('valida el body', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'no-es-email' })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    const refresh = (cookie?: string) => {
      const req = request(app.getHttpServer()).post('/auth/refresh');
      return cookie ? req.set('Cookie', cookie) : req;
    };

    it('devuelve un access token nuevo y rota el refresh token', async () => {
      const cookie = cookieRefresh(await login('fabricante@test.com'))!;

      const res = await refresh(cookie).expect(200);
      expect(res.body.usuario.marcaId).toBe(marcaId);
      await jwt.verifyAsync(res.body.accessToken);
      const nueva = cookieRefresh(res)!;
      expect(nueva).not.toBe(cookie);

      await refresh(cookie).expect(401);
      await refresh(nueva).expect(200);
    });

    it('sin cookie responde 401', async () => {
      await refresh().expect(401);
    });

    it('con un token inventado responde 401 y borra la cookie', async () => {
      const res = await refresh('refresh_token=inventado').expect(401);
      expect(res.headers['set-cookie']?.[0]).toMatch(/^refresh_token=;/);
    });

    it('rechaza una sesión vencida', async () => {
      const cookie = cookieRefresh(await login('admin@test.com'))!;
      await prisma.sesion.updateMany({ data: { expiraEn: new Date(0) } });
      await refresh(cookie).expect(401);
      expect(await prisma.sesion.count()).toBe(0);
    });

    it('rechaza si el usuario se desactivó', async () => {
      const cookie = cookieRefresh(await login('admin@test.com'))!;
      await prisma.usuario.updateMany({ data: { activo: false } });
      await refresh(cookie).expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('borra la sesión y la cookie', async () => {
      const cookie = cookieRefresh(await login('admin@test.com'))!;

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(204);
      expect(res.headers['set-cookie']?.[0]).toMatch(/^refresh_token=;/);
      expect(await prisma.sesion.count()).toBe(0);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
    });

    it('sin cookie igual responde 204', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(204);
    });
  });
});
