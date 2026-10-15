import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { JwtPayload } from '../src/auth/auth.constants.js';
import {
  MarcaId,
  Publico,
  Roles,
  UsuarioActual,
} from '../src/auth/decorators.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { cliente, crearApp, tokenDe, type AppDeTest } from './utils/app.js';
import { crearMarca, crearUsuario, limpiarBase } from './utils/db.js';

@Roles('ADMIN')
@Controller('prueba-admin')
class PruebaAdminController {
  @Get()
  ver(@UsuarioActual() usuario: JwtPayload) {
    return usuario;
  }
}

@Roles('FABRICANTE')
@Controller('prueba-panel')
class PruebaPanelController {
  constructor(private readonly prisma: PrismaService) {}

  // Intenta colar otra marca por la URL, la query y el body.
  @Post(':marcaId')
  marca(
    @MarcaId() marcaId: string,
    @Param('marcaId') _deLaUrl: string,
    @Query('marcaId') _deLaQuery: string,
    @Body() _body: unknown,
  ) {
    return { marcaId };
  }

  @Get('productos')
  listar(@MarcaId() marcaId: string) {
    return this.prisma.producto.findMany({
      where: { marcaId },
      select: { nombre: true },
    });
  }

  @Get('productos/:id')
  async ver(@MarcaId() marcaId: string, @Param('id') id: string) {
    const producto = await this.prisma.producto.findFirst({
      where: { id, marcaId },
    });
    if (!producto) throw new NotFoundException();
    return producto;
  }
}

@Roles('ADMIN', 'FABRICANTE')
@Controller('prueba-ambos')
class PruebaAmbosController {
  @Get()
  ver() {
    return 'ok';
  }

  @Publico()
  @Get('publico')
  publico() {
    return 'ok';
  }
}

@Controller('prueba-sin-roles')
class PruebaSinRolesController {
  @Get()
  ver() {
    return 'no debería verse';
  }
}

describe('Permisos y aislamiento por marca (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let jwt: JwtService;
  let secreto: string;
  let marcaA: string;
  let marcaB: string;
  let productoB: string;

  const get = (url: string, token?: string) => cliente(app, token).get(url);

  beforeAll(async () => {
    app = await crearApp([
      PruebaAdminController,
      PruebaPanelController,
      PruebaAmbosController,
      PruebaSinRolesController,
    ]);
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    secreto = app.get(ConfigService).getOrThrow<string>('JWT_SECRET');
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    marcaA = (await crearMarca(prisma, 'marca-a')).id;
    marcaB = (await crearMarca(prisma, 'marca-b')).id;
    await crearUsuario(prisma, { email: 'admin@test.com' });
    await crearUsuario(prisma, { email: 'a@test.com', marcaId: marcaA });
    await crearUsuario(prisma, { email: 'b@test.com', marcaId: marcaB });

    const categoria = await prisma.categoria.create({
      data: { nombre: 'Remeras', slug: 'remeras' },
    });
    await prisma.producto.create({
      data: {
        marcaId: marcaA,
        categoriaId: categoria.id,
        nombre: 'Producto A',
        precio: 1000,
      },
    });
    productoB = (
      await prisma.producto.create({
        data: {
          marcaId: marcaB,
          categoriaId: categoria.id,
          nombre: 'Producto B',
          precio: 1000,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('sin sesión', () => {
    it.each(['/prueba-admin', '/prueba-panel/productos', '/prueba-ambos'])(
      '%s responde 401',
      async (url) => {
        await get(url).expect(401);
      },
    );

    it('las rutas @Publico() no piden token', async () => {
      await get('/prueba-ambos/publico').expect(200);
    });

    it('rechaza un header que no es Bearer', async () => {
      const token = await tokenDe(app, 'admin@test.com');
      await request(app.getHttpServer())
        .get('/prueba-admin')
        .set('Authorization', token)
        .expect(401);
    });
  });

  describe('tokens inválidos', () => {
    const payloadAdmin: JwtPayload = {
      sub: 'x',
      rol: 'ADMIN',
      marcaId: null,
    };

    it('firmado con otro secreto', async () => {
      const otro = new JwtService({ secret: 'otro-secreto'.repeat(4) });
      await get('/prueba-admin', await otro.signAsync(payloadAdmin)).expect(
        401,
      );
    });

    it('vencido', async () => {
      const firmador = new JwtService({ secret: secreto });
      const vencido = await firmador.signAsync({
        ...payloadAdmin,
        exp: Math.floor(Date.now() / 1000) - 10,
      });
      await get('/prueba-admin', vencido).expect(401);
    });

    it('sin firma (alg none)', async () => {
      const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString(
        'base64url',
      );
      const body = Buffer.from(JSON.stringify(payloadAdmin)).toString(
        'base64url',
      );
      await get('/prueba-admin', `${header}.${body}.`).expect(401);
    });

    it('con un rol que no existe', async () => {
      const token = await jwt.signAsync({ ...payloadAdmin, rol: 'ROOT' });
      await get('/prueba-admin', token).expect(401);
    });

    it('FABRICANTE sin marcaId', async () => {
      const token = await jwt.signAsync({
        sub: 'x',
        rol: 'FABRICANTE',
        marcaId: null,
      });
      await get('/prueba-panel/productos', token).expect(403);
    });
  });

  describe('roles', () => {
    it('ADMIN entra a /admin y no al panel', async () => {
      const token = await tokenDe(app, 'admin@test.com');
      const res = await get('/prueba-admin', token).expect(200);
      expect(res.body).toMatchObject({ rol: 'ADMIN', marcaId: null });
      await get('/prueba-panel/productos', token).expect(403);
    });

    it('FABRICANTE entra al panel y no a /admin', async () => {
      const token = await tokenDe(app, 'a@test.com');
      await get('/prueba-panel/productos', token).expect(200);
      await get('/prueba-admin', token).expect(403);
    });

    it('@Roles con varios roles deja pasar a cualquiera de ellos', async () => {
      await get('/prueba-ambos', await tokenDe(app, 'admin@test.com')).expect(
        200,
      );
      await get('/prueba-ambos', await tokenDe(app, 'a@test.com')).expect(200);
    });

    it('una ruta sin @Publico ni @Roles queda cerrada para todos', async () => {
      await get('/prueba-sin-roles').expect(401);
      await get(
        '/prueba-sin-roles',
        await tokenDe(app, 'admin@test.com'),
      ).expect(403);
      await get('/prueba-sin-roles', await tokenDe(app, 'a@test.com')).expect(
        403,
      );
    });
  });

  describe('aislamiento por marca', () => {
    it('el marcaId sale del token aunque venga otro en la URL, la query o el body', async () => {
      const token = await tokenDe(app, 'a@test.com');
      const res = await request(app.getHttpServer())
        .post(`/prueba-panel/${marcaB}?marcaId=${marcaB}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ marcaId: marcaB })
        .expect(201);
      expect(res.body).toEqual({ marcaId: marcaA });
    });

    it('cada fabricante ve solo los productos de su marca', async () => {
      const resA = await get(
        '/prueba-panel/productos',
        await tokenDe(app, 'a@test.com'),
      ).expect(200);
      expect(resA.body).toEqual([{ nombre: 'Producto A' }]);

      const resB = await get(
        '/prueba-panel/productos',
        await tokenDe(app, 'b@test.com'),
      ).expect(200);
      expect(resB.body).toEqual([{ nombre: 'Producto B' }]);
    });

    it('un fabricante no puede leer un producto de otra marca por id', async () => {
      const token = await tokenDe(app, 'a@test.com');
      await get(`/prueba-panel/productos/${productoB}`, token).expect(404);
      await get(
        `/prueba-panel/productos/${productoB}`,
        await tokenDe(app, 'b@test.com'),
      ).expect(200);
    });
  });
});
