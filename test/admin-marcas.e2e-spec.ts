import type { MockInstance } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { StorageService } from '../src/storage/storage.service.js';
import { cliente, crearApp, tokenDe, type AppDeTest } from './utils/app.js';
import { crearMarca, crearUsuario, limpiarBase } from './utils/db.js';

const NUEVA = {
  nombre: 'Textil Norte',
  slug: 'Textil-Norte',
  whatsapp: '011 15 5555-5555',
};

describe('Admin: marcas (e2e)', () => {
  let app: AppDeTest;
  let prisma: PrismaService;
  let admin: ReturnType<typeof cliente>;
  let marcaId: string;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBase(prisma);
    marcaId = (await crearMarca(prisma, 'existente')).id;
    await crearUsuario(prisma, { email: 'admin@test.com' });
    await crearUsuario(prisma, { email: 'fabricante@test.com', marcaId });
    admin = cliente(app, await tokenDe(app, 'admin@test.com'));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('permisos', () => {
    it('sin sesión responde 401', async () => {
      await cliente(app).get('/admin/marcas').expect(401);
    });

    it('un fabricante no puede entrar', async () => {
      const fabricante = cliente(
        app,
        await tokenDe(app, 'fabricante@test.com'),
      );
      await fabricante.get('/admin/marcas').expect(403);
      await fabricante.post('/admin/marcas').send(NUEVA).expect(403);
      await fabricante
        .patch(`/admin/marcas/${marcaId}`)
        .send({ nombre: 'Otra' })
        .expect(403);
      await fabricante
        .patch(`/admin/marcas/${marcaId}/estado`)
        .send({ estado: 'PAUSADA' })
        .expect(403);
    });
  });

  describe('POST /admin/marcas', () => {
    it('crea la marca normalizando slug y WhatsApp, con valores por defecto', async () => {
      const res = await admin.post('/admin/marcas').send(NUEVA).expect(201);
      expect(res.body).toMatchObject({
        nombre: 'Textil Norte',
        slug: 'textil-norte',
        whatsapp: '5491155555555',
        estado: 'ACTIVA',
        minimoCompra: 0,
        colores: [],
        talles: [],
        redes: {},
        usuario: null,
      });
      expect(res.body).not.toHaveProperty('ultimoNumeroPedido');
    });

    it('guarda toda la configuración', async () => {
      const config = {
        ...NUEVA,
        textosBanner: ['Venta mayorista'],
        direccionRetiro: 'Av. Avellaneda 1234',
        horariosRetiro: '',
        redes: { instagram: 'https://instagram.com/textilnorte', tiktok: '' },
        comoComprar: 'Armá tu pedido',
        condicionesVenta: 'Mínimo 6 prendas',
        minimoCompra: 80000,
        colores: ['Negro', 'Blanco'],
        talles: ['S', 'M', 'L'],
      };
      const res = await admin.post('/admin/marcas').send(config).expect(201);
      expect(res.body).toMatchObject({
        ...config,
        slug: 'textil-norte',
        whatsapp: '5491155555555',
        horariosRetiro: null,
        redes: { instagram: 'https://instagram.com/textilnorte' },
      });
    });

    it('ignora campos que no se configuran por acá', async () => {
      const res = await admin
        .post('/admin/marcas')
        .send({
          ...NUEVA,
          estado: 'BAJA',
          dominioPropio: 'otra.com',
          ultimoNumeroPedido: 99,
        })
        .expect(201);
      expect(res.body).toMatchObject({ estado: 'ACTIVA', dominioPropio: null });
    });

    it('rechaza un slug repetido con 409', async () => {
      const res = await admin
        .post('/admin/marcas')
        .send({ ...NUEVA, slug: 'existente' })
        .expect(409);
      expect(res.body.message).toBe('Ya existe una marca con ese slug');
    });

    it.each([
      ['slug reservado', { slug: 'www' }, 'slug'],
      ['slug con espacios', { slug: 'textil norte' }, 'slug'],
      ['WhatsApp sin característica', { whatsapp: '5555-5555' }, 'whatsapp'],
      ['colores repetidos', { colores: ['Negro', 'negro'] }, 'colores'],
      ['mínimo negativo', { minimoCompra: -1 }, 'minimoCompra'],
      ['red sin https', { redes: { instagram: 'instagram.com/x' } }, 'redes'],
      ['sin nombre', { nombre: '' }, 'nombre'],
    ])('rechaza %s con 400', async (_, cambio, campo) => {
      const res = await admin
        .post('/admin/marcas')
        .send({ ...NUEVA, ...cambio })
        .expect(400);
      expect(res.body.errors[0].path[0]).toBe(campo);
    });
  });

  describe('GET /admin/marcas', () => {
    it('lista las marcas ordenadas por nombre', async () => {
      await admin
        .post('/admin/marcas')
        .send({ ...NUEVA, nombre: 'Algodón Sur', slug: 'algodon-sur' })
        .expect(201);
      const res = await admin.get('/admin/marcas').expect(200);
      expect(res.body.map((m: { nombre: string }) => m.nombre)).toEqual([
        'Algodón Sur',
        'Marca existente',
      ]);
      expect(Object.keys(res.body[0]).sort()).toEqual([
        'dominioPropio',
        'estado',
        'id',
        'nombre',
        'slug',
      ]);
    });
  });

  describe('GET /admin/marcas/:id', () => {
    it('devuelve la marca con el acceso del fabricante', async () => {
      const res = await admin.get(`/admin/marcas/${marcaId}`).expect(200);
      expect(res.body).toMatchObject({
        id: marcaId,
        slug: 'existente',
        usuario: { email: 'fabricante@test.com', activo: true },
      });
    });

    it('404 si no existe', async () => {
      await admin
        .get('/admin/marcas/0199f0f0-0000-7000-8000-000000000000')
        .expect(404);
    });

    it('400 si el id no es un UUID', async () => {
      await admin.get('/admin/marcas/123').expect(400);
    });
  });

  describe('PATCH /admin/marcas/:id', () => {
    it('cambia solo lo que se manda', async () => {
      const res = await admin
        .patch(`/admin/marcas/${marcaId}`)
        .send({ minimoCompra: 50000, talles: ['38', '39', '40'] })
        .expect(200);
      expect(res.body).toMatchObject({
        nombre: 'Marca existente',
        slug: 'existente',
        minimoCompra: 50000,
        talles: ['38', '39', '40'],
      });
    });

    it('normaliza el WhatsApp', async () => {
      const res = await admin
        .patch(`/admin/marcas/${marcaId}`)
        .send({ whatsapp: '+54 9 351 555-1234' })
        .expect(200);
      expect(res.body.whatsapp).toBe('5493515551234');
    });

    it('409 si el slug nuevo ya está en uso', async () => {
      await crearMarca(prisma, 'ocupado');
      await admin
        .patch(`/admin/marcas/${marcaId}`)
        .send({ slug: 'ocupado' })
        .expect(409);
    });

    it('404 si no existe', async () => {
      await admin
        .patch('/admin/marcas/0199f0f0-0000-7000-8000-000000000000')
        .send({ nombre: 'Otra' })
        .expect(404);
    });
  });

  describe('PATCH /admin/marcas/:id/estado', () => {
    it.each(['PAUSADA', 'BAJA', 'ACTIVA'])('pasa a %s', async (estado) => {
      const res = await admin
        .patch(`/admin/marcas/${marcaId}/estado`)
        .send({ estado })
        .expect(200);
      expect(res.body).toMatchObject({ id: marcaId, estado });
    });

    it('una marca dada de baja se puede reactivar', async () => {
      await admin
        .patch(`/admin/marcas/${marcaId}/estado`)
        .send({ estado: 'BAJA' })
        .expect(200);
      const res = await admin
        .patch(`/admin/marcas/${marcaId}/estado`)
        .send({ estado: 'ACTIVA' })
        .expect(200);
      expect(res.body.estado).toBe('ACTIVA');
    });

    it('solo cambia el estado', async () => {
      const res = await admin
        .patch(`/admin/marcas/${marcaId}/estado`)
        .send({ estado: 'PAUSADA', nombre: 'Otra' })
        .expect(200);
      expect(res.body).toMatchObject({
        estado: 'PAUSADA',
        nombre: 'Marca existente',
      });
    });

    it('PATCH /admin/marcas/:id no cambia el estado', async () => {
      const res = await admin
        .patch(`/admin/marcas/${marcaId}`)
        .send({ estado: 'BAJA' })
        .expect(200);
      expect(res.body.estado).toBe('ACTIVA');
    });

    it.each([{}, { estado: 'BORRADA' }])('400 con %j', async (body) => {
      await admin
        .patch(`/admin/marcas/${marcaId}/estado`)
        .send(body)
        .expect(400);
    });

    it('404 si no existe', async () => {
      await admin
        .patch('/admin/marcas/0199f0f0-0000-7000-8000-000000000000/estado')
        .send({ estado: 'PAUSADA' })
        .expect(404);
    });
  });

  describe('imágenes', () => {
    const LOGO = { tipo: 'logo', contentType: 'image/webp', tamanio: 200_000 };

    const pedirUrl = (cuerpo: object = LOGO, id = marcaId) =>
      admin.post(`/admin/marcas/${id}/imagenes`).send(cuerpo);

    it('devuelve una URL firmada para subir y la URL pública a guardar', async () => {
      const res = await pedirUrl().expect(201);
      expect(res.body.uploadUrl).toMatch(
        new RegExp(
          `^https://almacenamiento\\.test/storage/v1/s3/bucket-test/marcas/${marcaId}/logo-`,
        ),
      );
      expect(res.body.url).toMatch(
        new RegExp(
          `^https://imagenes\\.test/marcas/${marcaId}/logo-[\\w-]+\\.webp$`,
        ),
      );
    });

    it.each([
      ['un archivo de más de 5 MB', { tamanio: 5 * 1024 * 1024 + 1 }],
      ['un formato que no es imagen', { contentType: 'application/pdf' }],
      ['un tipo de imagen desconocido', { tipo: 'banner' }],
    ])('rechaza %s', async (_, cambio) => {
      await pedirUrl({ ...LOGO, ...cambio }).expect(400);
    });

    it('404 si la marca no existe', async () => {
      await pedirUrl(LOGO, '0199f0f0-0000-7000-8000-000000000000').expect(404);
    });

    it('un fabricante no puede pedir URLs', async () => {
      const fabricante = cliente(
        app,
        await tokenDe(app, 'fabricante@test.com'),
      );
      await fabricante
        .post(`/admin/marcas/${marcaId}/imagenes`)
        .send(LOGO)
        .expect(403);
    });

    it('guarda la URL subida y permite quitarla', async () => {
      const { url } = (await pedirUrl().expect(201)).body;

      const conLogo = await admin
        .patch(`/admin/marcas/${marcaId}`)
        .send({ logoUrl: url })
        .expect(200);
      expect(conLogo.body.logoUrl).toBe(url);

      const sinLogo = await admin
        .patch(`/admin/marcas/${marcaId}`)
        .send({ logoUrl: null })
        .expect(200);
      expect(sinLogo.body.logoUrl).toBeNull();
    });

    it('rechaza URLs de afuera del bucket', async () => {
      await admin
        .patch(`/admin/marcas/${marcaId}`)
        .send({ portadaUrl: 'https://otro.com/portada.webp' })
        .expect(400);
    });

    it('rechaza imágenes subidas para otra marca', async () => {
      const otra = await crearMarca(prisma, 'otra');
      const { url } = (await pedirUrl(LOGO, otra.id).expect(201)).body;
      await admin
        .patch(`/admin/marcas/${marcaId}`)
        .send({ guiaTallesUrl: url })
        .expect(400);
    });

    describe('borrado de la imagen anterior', () => {
      let borrar: MockInstance<StorageService['borrar']>;

      const nuevaUrl = async (tipo = 'logo') =>
        (await pedirUrl({ ...LOGO, tipo }).expect(201)).body.url as string;

      const editar = (datos: object) =>
        admin.patch(`/admin/marcas/${marcaId}`).send(datos).expect(200);

      beforeEach(() => {
        borrar = vi
          .spyOn(app.get(StorageService), 'borrar')
          .mockResolvedValue();
      });

      afterEach(() => borrar.mockRestore());

      it('al reemplazar el logo borra el anterior', async () => {
        const vieja = await nuevaUrl();
        await editar({ logoUrl: vieja });
        expect(borrar).not.toHaveBeenCalled();

        await editar({ logoUrl: await nuevaUrl() });
        expect(borrar.mock.calls).toEqual([[vieja]]);
      });

      it('al quitar la portada la borra', async () => {
        const portada = await nuevaUrl('portada');
        await editar({ portadaUrl: portada });
        await editar({ portadaUrl: null });
        expect(borrar.mock.calls).toEqual([[portada]]);
      });

      it('borra cada imagen reemplazada en un mismo cambio', async () => {
        const logo = await nuevaUrl('logo');
        const guia = await nuevaUrl('guiaTalles');
        await editar({ logoUrl: logo, guiaTallesUrl: guia });
        await editar({ logoUrl: await nuevaUrl('logo'), guiaTallesUrl: null });
        expect(borrar.mock.calls.flat().sort()).toEqual([guia, logo].sort());
      });

      it('no borra si la imagen no cambia o si se editan otros campos', async () => {
        const logo = await nuevaUrl();
        await editar({ logoUrl: logo });
        await editar({ logoUrl: logo });
        await editar({ nombre: 'Otro nombre' });
        expect(borrar).not.toHaveBeenCalled();
      });

      it('no borra imágenes que no están en la carpeta de la marca', async () => {
        await prisma.marca.update({
          where: { id: marcaId },
          data: { logoUrl: 'https://otro.com/logo-viejo.png' },
        });
        await editar({ logoUrl: await nuevaUrl() });
        expect(borrar).not.toHaveBeenCalled();
      });

      it('si el borrado falla, el cambio igual se guarda', async () => {
        borrar.mockRejectedValue(new Error('almacenamiento caído'));
        await editar({ logoUrl: await nuevaUrl() });
        const nueva = await nuevaUrl();
        const res = await editar({ logoUrl: nueva });
        expect(res.body.logoUrl).toBe(nueva);
      });
    });
  });
});
