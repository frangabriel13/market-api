import { Body, Controller, Post, Query } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import request from 'supertest';
import { z } from 'zod';
import { Publico } from '../src/auth/decorators.js';
import { crearApp, type AppDeTest } from './utils/app.js';

class PruebaBodyDto extends createZodDto(
  z.object({
    nombre: z.string().min(1),
    cantidad: z.number().int().positive(),
  }),
) {}

class PruebaQueryDto extends createZodDto(
  z.object({ pagina: z.coerce.number().int().positive().default(1) }),
) {}

@Publico()
@Controller('prueba-validacion')
class PruebaController {
  @Post()
  crear(@Body() body: PruebaBodyDto, @Query() query: PruebaQueryDto) {
    return { body, query };
  }
}

describe('Validación global con zod (e2e)', () => {
  let app: AppDeTest;

  beforeAll(async () => {
    app = await crearApp([PruebaController]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('acepta un body válido y aplica transformaciones del esquema', async () => {
    const res = await request(app.getHttpServer())
      .post('/prueba-validacion?pagina=2')
      .send({ nombre: 'Remera', cantidad: 3 })
      .expect(201);
    expect(res.body).toEqual({
      body: { nombre: 'Remera', cantidad: 3 },
      query: { pagina: 2 },
    });
  });

  it('descarta campos que no están en el esquema', async () => {
    const res = await request(app.getHttpServer())
      .post('/prueba-validacion')
      .send({ nombre: 'Remera', cantidad: 3, marcaId: 'otra' })
      .expect(201);
    expect(res.body.body).toEqual({ nombre: 'Remera', cantidad: 3 });
  });

  it('responde 400 con los errores de zod si el body es inválido', async () => {
    const res = await request(app.getHttpServer())
      .post('/prueba-validacion')
      .send({ nombre: '', cantidad: -1 })
      .expect(400);
    expect(res.body.message).toBe('Datos inválidos');
    expect(res.body.errors.map((e: { path: string[] }) => e.path[0])).toEqual([
      'nombre',
      'cantidad',
    ]);
  });

  it('responde 400 si la query es inválida', async () => {
    await request(app.getHttpServer())
      .post('/prueba-validacion?pagina=cero')
      .send({ nombre: 'Remera', cantidad: 3 })
      .expect(400);
  });
});
