import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ServiceUnavailableException } from '@nestjs/common';
import type { MockInstance } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service.js';

const SUPABASE = {
  STORAGE_ENDPOINT: 'https://proyecto.storage.supabase.co/storage/v1/s3',
  STORAGE_REGION: 'sa-east-1',
  STORAGE_ACCESS_KEY_ID: 'clave',
  STORAGE_SECRET_ACCESS_KEY: 'secreto',
  STORAGE_BUCKET: 'fotos',
  STORAGE_PUBLIC_URL: 'https://fotos.ejemplo.com.ar/',
};

const storage = (env: Record<string, string>) =>
  new StorageService(new ConfigService(env) as ConfigService<never, true>);

describe('StorageService', () => {
  it('firma una subida con tipo, tamaño y vigencia de 5 minutos', async () => {
    const { uploadUrl, url } = await storage(SUPABASE).crearUrlDeSubida(
      'marcas/abc',
      'logo',
      { contentType: 'image/webp', tamanio: 1234 },
    );

    const firmada = new URL(uploadUrl);
    expect(firmada.host).toBe('proyecto.storage.supabase.co');
    expect(firmada.pathname).toMatch(
      /^\/storage\/v1\/s3\/fotos\/marcas\/abc\/logo-[\w-]+\.webp$/,
    );
    expect(firmada.searchParams.get('X-Amz-SignedHeaders')).toBe(
      'content-length;content-type;host',
    );
    expect(firmada.searchParams.get('X-Amz-Expires')).toBe('300');
    expect([...firmada.searchParams.keys()].join()).not.toMatch(/checksum/i);

    expect(url).toBe(
      `https://fotos.ejemplo.com.ar${firmada.pathname.replace('/storage/v1/s3/fotos', '')}`,
    );
  });

  it('sin STORAGE_ENDPOINT firma contra AWS S3', async () => {
    const { STORAGE_ENDPOINT: _, ...aws } = SUPABASE;
    const { uploadUrl } = await storage(aws).crearUrlDeSubida(
      'marcas/abc',
      'logo',
      { contentType: 'image/png', tamanio: 1 },
    );
    const firmada = new URL(uploadUrl);
    expect(firmada.host).toBe('fotos.s3.sa-east-1.amazonaws.com');
    expect(firmada.pathname).toMatch(/^\/marcas\/abc\/logo-[\w-]+\.png$/);
  });

  it('cada subida tiene un nombre distinto', async () => {
    const s = storage(SUPABASE);
    const archivo = { contentType: 'image/png' as const, tamanio: 1 };
    const a = await s.crearUrlDeSubida('marcas/abc', 'logo', archivo);
    const b = await s.crearUrlDeSubida('marcas/abc', 'logo', archivo);
    expect(a.url).not.toBe(b.url);
  });

  it('reconoce las URLs de una carpeta propia', () => {
    const s = storage(SUPABASE);
    expect(
      s.esUrlDeCarpeta(
        'https://fotos.ejemplo.com.ar/marcas/abc/logo-1.webp',
        'marcas/abc',
      ),
    ).toBe(true);
    expect(
      s.esUrlDeCarpeta(
        'https://fotos.ejemplo.com.ar/marcas/otra/logo-1.webp',
        'marcas/abc',
      ),
    ).toBe(false);
    expect(
      s.esUrlDeCarpeta('https://otro.com/marcas/abc/logo-1.webp', 'marcas/abc'),
    ).toBe(false);
  });

  it('sin almacenamiento configurado responde 503 y no reconoce ninguna URL', async () => {
    const s = storage({});
    await expect(
      s.crearUrlDeSubida('marcas/abc', 'logo', {
        contentType: 'image/png',
        tamanio: 1,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(
      s.esUrlDeCarpeta('https://x.com/marcas/abc/a.png', 'marcas/abc'),
    ).toBe(false);
  });

  describe('archivos en el bucket', () => {
    let send: MockInstance<S3Client['send']>;

    beforeEach(() => {
      send = vi
        .spyOn(S3Client.prototype, 'send')
        .mockResolvedValue({} as never);
    });

    afterEach(() => send.mockRestore());

    it('borra el archivo del bucket a partir de su URL pública', async () => {
      await storage(SUPABASE).borrar(
        'https://fotos.ejemplo.com.ar/marcas/abc/logo-1.webp',
      );
      const [comando] = send.mock.calls[0];
      expect(comando).toBeInstanceOf(DeleteObjectCommand);
      expect(comando.input).toEqual({
        Bucket: 'fotos',
        Key: 'marcas/abc/logo-1.webp',
      });
    });

    it('no toca URLs de afuera del bucket', async () => {
      await storage(SUPABASE).borrar('https://otro.com/marcas/abc/logo-1.webp');
      expect(send).not.toHaveBeenCalled();
    });

    it('sin almacenamiento configurado no hace nada', async () => {
      await storage({}).borrar('https://fotos.ejemplo.com.ar/marcas/abc/a.png');
      expect(send).not.toHaveBeenCalled();
    });

    it('sube un archivo con nombre nuevo y devuelve su URL pública', async () => {
      const contenido = Buffer.from('imagen');
      const url = await storage(SUPABASE).subir(
        'marcas/abc/productos/p1',
        'miniatura',
        contenido,
        'image/webp',
      );
      const [comando] = send.mock.calls[0];
      expect(comando).toBeInstanceOf(PutObjectCommand);
      expect(comando.input).toMatchObject({
        Bucket: 'fotos',
        Body: contenido,
        ContentType: 'image/webp',
      });
      expect(url).toBe(
        `https://fotos.ejemplo.com.ar/${(comando.input as { Key: string }).Key}`,
      );
      expect(url).toMatch(
        /\/marcas\/abc\/productos\/p1\/miniatura-[\w-]+\.webp$/,
      );
    });

    it('descarga un archivo del bucket', async () => {
      send.mockResolvedValue({
        Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      } as never);
      const contenido = await storage(SUPABASE).descargar(
        'https://fotos.ejemplo.com.ar/marcas/abc/foto.webp',
      );
      expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
      expect(send.mock.calls[0][0].input).toEqual({
        Bucket: 'fotos',
        Key: 'marcas/abc/foto.webp',
      });
      expect(contenido).toEqual(Buffer.from([1, 2, 3]));
    });

    it('descargar devuelve null si el archivo no existe o la URL es de afuera', async () => {
      send.mockRejectedValue(
        new NoSuchKey({ message: 'no existe', $metadata: {} }),
      );
      const s = storage(SUPABASE);
      expect(
        await s.descargar('https://fotos.ejemplo.com.ar/marcas/abc/nada.webp'),
      ).toBeNull();
      expect(await s.descargar('https://otro.com/foto.webp')).toBeNull();
    });
  });
});
