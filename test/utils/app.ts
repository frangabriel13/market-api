import type { INestApplication, Type } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { PASSWORD_DE_TEST } from './db.js';

export type AppDeTest = INestApplication<App>;

export async function crearApp(
  controllers: Type[] = [],
  ajustar: (modulo: TestingModuleBuilder) => TestingModuleBuilder = (m) => m,
): Promise<AppDeTest> {
  const moduleRef = await ajustar(
    Test.createTestingModule({ imports: [AppModule], controllers }),
  ).compile();
  const app = moduleRef.createNestApplication<AppDeTest>();
  await app.init();
  return app;
}

export async function tokenDe(app: AppDeTest, email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: PASSWORD_DE_TEST })
    .expect(200);
  return res.body.accessToken as string;
}

export function cliente(app: AppDeTest, token?: string) {
  const conToken = (req: request.Test) =>
    token ? req.set('Authorization', `Bearer ${token}`) : req;
  const servidor = app.getHttpServer();
  return {
    get: (url: string) => conToken(request(servidor).get(url)),
    post: (url: string) => conToken(request(servidor).post(url)),
    patch: (url: string) => conToken(request(servidor).patch(url)),
    put: (url: string) => conToken(request(servidor).put(url)),
    delete: (url: string) => conToken(request(servidor).delete(url)),
  };
}
