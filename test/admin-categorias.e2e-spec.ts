import { PrismaService } from '../src/prisma/prisma.service.js';
import { cliente, crearApp, tokenDe, type AppDeTest } from './utils/app.js';
import { crearMarca, crearUsuario, limpiarBase } from './utils/db.js';

const INEXISTENTE = '0199f0f0-0000-7000-8000-000000000000';

describe('Admin: categorías (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let admin: ReturnType<typeof cliente>;

  const crear = async (datos: object) =>
    (await admin.post('/admin/categorias').send(datos).expect(201)).body;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    await crearUsuario(prisma, { email: 'admin@test.com' });
    admin = cliente(app, await tokenDe(app, 'admin@test.com'));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('crear y listar', () => {
    it('genera el slug y lleva el del padre en las subcategorías', async () => {
      const mujer = await crear({ nombre: 'Mujer' });
      const remeras = await crear({ nombre: 'Remeras', padreId: mujer.id });
      const interior = await crear({ nombre: 'Ropa Interior' });

      expect(mujer).toEqual({
        id: expect.any(String),
        nombre: 'Mujer',
        slug: 'mujer',
        orden: 0,
        padreId: null,
      });
      expect(remeras).toMatchObject({
        slug: 'mujer-remeras',
        padreId: mujer.id,
        orden: 0,
      });
      expect(interior).toMatchObject({ slug: 'ropa-interior', orden: 1 });
    });

    it('lista el árbol ordenado', async () => {
      const hombre = await crear({ nombre: 'Hombre', orden: 1 });
      const mujer = await crear({ nombre: 'Mujer', orden: 0 });
      await crear({ nombre: 'Vestidos', padreId: mujer.id, orden: 1 });
      await crear({ nombre: 'Remeras', padreId: mujer.id, orden: 0 });
      await crear({ nombre: 'Buzos', padreId: hombre.id });

      const res = await admin.get('/admin/categorias').expect(200);
      const arbol = res.body.map(
        (c: { nombre: string; subcategorias: { nombre: string }[] }) => [
          c.nombre,
          c.subcategorias.map((s) => s.nombre),
        ],
      );
      expect(arbol).toEqual([
        ['Mujer', ['Remeras', 'Vestidos']],
        ['Hombre', ['Buzos']],
      ]);
    });

    it('la misma subcategoría puede estar en dos padres', async () => {
      const mujer = await crear({ nombre: 'Mujer' });
      const hombre = await crear({ nombre: 'Hombre' });
      await crear({ nombre: 'Remeras', padreId: mujer.id });
      const deHombre = await crear({ nombre: 'Remeras', padreId: hombre.id });
      expect(deHombre.slug).toBe('hombre-remeras');
    });

    it('409 si el slug ya existe', async () => {
      await crear({ nombre: 'Calzado' });
      const res = await admin
        .post('/admin/categorias')
        .send({ nombre: 'calzado' })
        .expect(409);
      expect(res.body.message).toBe('Ya existe una categoría con ese slug');
    });

    it('no permite un tercer nivel', async () => {
      const mujer = await crear({ nombre: 'Mujer' });
      const remeras = await crear({ nombre: 'Remeras', padreId: mujer.id });
      const res = await admin
        .post('/admin/categorias')
        .send({ nombre: 'Lisas', padreId: remeras.id })
        .expect(400);
      expect(res.body.message).toMatch(/dos niveles/);
    });

    it.each([
      ['sin nombre', { nombre: '' }],
      ['un nombre sin letras ni números', { nombre: '¡¡!!' }],
      ['un padre inexistente', { nombre: 'Remeras', padreId: INEXISTENTE }],
    ])('400 con %s', async (_, datos) => {
      await admin.post('/admin/categorias').send(datos).expect(400);
    });
  });

  describe('editar', () => {
    it('al renombrar conserva el slug, que se puede cambiar aparte', async () => {
      const { id } = await crear({ nombre: 'Remras' });

      const renombrada = await admin
        .patch(`/admin/categorias/${id}`)
        .send({ nombre: 'Remeras' })
        .expect(200);
      expect(renombrada.body).toMatchObject({
        nombre: 'Remeras',
        slug: 'remras',
      });

      const conSlug = await admin
        .patch(`/admin/categorias/${id}`)
        .send({ slug: 'remeras' })
        .expect(200);
      expect(conSlug.body.slug).toBe('remeras');
    });

    it('mueve una categoría sin subcategorías debajo de otra y la vuelve a subir', async () => {
      const mujer = await crear({ nombre: 'Mujer' });
      const { id } = await crear({ nombre: 'Vestidos' });

      const abajo = await admin
        .patch(`/admin/categorias/${id}`)
        .send({ padreId: mujer.id })
        .expect(200);
      expect(abajo.body.padreId).toBe(mujer.id);

      const arriba = await admin
        .patch(`/admin/categorias/${id}`)
        .send({ padreId: null })
        .expect(200);
      expect(arriba.body.padreId).toBeNull();
    });

    it('no mueve una categoría con subcategorías debajo de otra', async () => {
      const mujer = await crear({ nombre: 'Mujer' });
      const hombre = await crear({ nombre: 'Hombre' });
      await crear({ nombre: 'Buzos', padreId: hombre.id });
      await admin
        .patch(`/admin/categorias/${hombre.id}`)
        .send({ padreId: mujer.id })
        .expect(400);
    });

    it('no la pone como padre de sí misma', async () => {
      const { id } = await crear({ nombre: 'Mujer' });
      await admin
        .patch(`/admin/categorias/${id}`)
        .send({ padreId: id })
        .expect(400);
    });

    it('409 si el slug nuevo ya existe', async () => {
      await crear({ nombre: 'Mujer' });
      const { id } = await crear({ nombre: 'Hombre' });
      await admin
        .patch(`/admin/categorias/${id}`)
        .send({ slug: 'mujer' })
        .expect(409);
    });

    it('404 si no existe', async () => {
      await admin
        .patch(`/admin/categorias/${INEXISTENTE}`)
        .send({ nombre: 'X' })
        .expect(404);
    });
  });

  describe('eliminar', () => {
    it('borra una categoría sin uso', async () => {
      const { id } = await crear({ nombre: 'Mujer' });
      await admin.delete(`/admin/categorias/${id}`).expect(204);
      expect(await prisma.categoria.count()).toBe(0);
    });

    it('409 si tiene subcategorías', async () => {
      const mujer = await crear({ nombre: 'Mujer' });
      await crear({ nombre: 'Remeras', padreId: mujer.id });
      const res = await admin
        .delete(`/admin/categorias/${mujer.id}`)
        .expect(409);
      expect(res.body.message).toMatch(/subcategorías/);
    });

    it('409 si tiene productos', async () => {
      const { id } = await crear({ nombre: 'Remeras' });
      const marca = await crearMarca(prisma, 'una-marca');
      await prisma.producto.create({
        data: {
          marcaId: marca.id,
          categoriaId: id,
          nombre: 'Remera',
          precio: 1000,
        },
      });
      const res = await admin.delete(`/admin/categorias/${id}`).expect(409);
      expect(res.body.message).toMatch(/productos/);
    });

    it('404 si no existe', async () => {
      await admin.delete(`/admin/categorias/${INEXISTENTE}`).expect(404);
    });
  });

  it('un fabricante no puede gestionarlas', async () => {
    const marca = await crearMarca(prisma, 'una-marca');
    await crearUsuario(prisma, { email: 'f@test.com', marcaId: marca.id });
    const fabricante = cliente(app, await tokenDe(app, 'f@test.com'));
    await fabricante.get('/admin/categorias').expect(403);
    await fabricante
      .post('/admin/categorias')
      .send({ nombre: 'Mujer' })
      .expect(403);
  });
});
