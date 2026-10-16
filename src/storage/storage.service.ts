import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type { ArchivoImagen, UrlDeSubida } from '../schemas/imagenes.js';

const EXTENSIONES: Record<ArchivoImagen['contentType'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const VIGENCIA_SEGUNDOS = 5 * 60;

// Cada archivo lleva un nombre nuevo: el CDN cachea y nunca se pisa uno existente.
const nuevaClave = (
  carpeta: string,
  nombre: string,
  contentType: ArchivoImagen['contentType'],
) => `${carpeta}/${nombre}-${randomUUID()}.${EXTENSIONES[contentType]}`;

interface Almacenamiento {
  cliente: S3Client;
  bucket: string;
  urlPublica: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly almacenamiento: Almacenamiento | null;

  // Cualquier almacenamiento compatible con S3. Con STORAGE_ENDPOINT (Supabase
  // Storage, R2) las URLs llevan el bucket en el path; sin él, es AWS S3.
  constructor(config: ConfigService<Env, true>) {
    const endpoint = config.get('STORAGE_ENDPOINT', { infer: true });
    const region = config.get('STORAGE_REGION', { infer: true });
    const accessKeyId = config.get('STORAGE_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = config.get('STORAGE_SECRET_ACCESS_KEY', {
      infer: true,
    });
    const bucket = config.get('STORAGE_BUCKET', { infer: true });
    const urlPublica = config.get('STORAGE_PUBLIC_URL', { infer: true });

    this.almacenamiento =
      region && accessKeyId && secretAccessKey && bucket && urlPublica
        ? {
            cliente: new S3Client({
              region,
              endpoint,
              forcePathStyle: !!endpoint,
              credentials: { accessKeyId, secretAccessKey },
              // El checksum por defecto se calcula sobre un cuerpo vacío y
              // rompe la subida desde el navegador.
              requestChecksumCalculation: 'WHEN_REQUIRED',
            }),
            bucket,
            urlPublica: urlPublica.replace(/\/+$/, ''),
          }
        : null;
  }

  // Firma tipo y tamaño: el almacenamiento rechaza un archivo distinto del
  // declarado.
  async crearUrlDeSubida(
    carpeta: string,
    nombre: string,
    { contentType, tamanio }: ArchivoImagen,
  ): Promise<UrlDeSubida> {
    const almacenamiento = this.configurado();
    const clave = nuevaClave(carpeta, nombre, contentType);
    const uploadUrl = await getSignedUrl(
      almacenamiento.cliente,
      new PutObjectCommand({
        Bucket: almacenamiento.bucket,
        Key: clave,
        ContentType: contentType,
        ContentLength: tamanio,
      }),
      {
        expiresIn: VIGENCIA_SEGUNDOS,
        signableHeaders: new Set(['content-type', 'content-length']),
      },
    );
    return { uploadUrl, url: `${almacenamiento.urlPublica}/${clave}` };
  }

  async subir(
    carpeta: string,
    nombre: string,
    contenido: Buffer,
    contentType: ArchivoImagen['contentType'],
  ): Promise<string> {
    const almacenamiento = this.configurado();
    const clave = nuevaClave(carpeta, nombre, contentType);
    await almacenamiento.cliente.send(
      new PutObjectCommand({
        Bucket: almacenamiento.bucket,
        Key: clave,
        Body: contenido,
        ContentType: contentType,
      }),
    );
    return `${almacenamiento.urlPublica}/${clave}`;
  }

  // null si la URL no es del bucket o el archivo no existe.
  async descargar(url: string): Promise<Buffer | null> {
    const almacenamiento = this.configurado();
    const clave = this.claveDe(url);
    if (!clave) return null;
    try {
      const { Body } = await almacenamiento.cliente.send(
        new GetObjectCommand({ Bucket: almacenamiento.bucket, Key: clave }),
      );
      return Body ? Buffer.from(await Body.transformToByteArray()) : null;
    } catch (error) {
      if (error instanceof Error && error.name === 'NoSuchKey') return null;
      throw error;
    }
  }

  async borrar(url: string): Promise<void> {
    const clave = this.claveDe(url);
    if (!this.almacenamiento || !clave) return;
    await this.almacenamiento.cliente.send(
      new DeleteObjectCommand({
        Bucket: this.almacenamiento.bucket,
        Key: clave,
      }),
    );
  }

  // Para archivos que dejaron de usarse después de guardar un cambio: si el
  // borrado falla, solo queda un archivo sin usar, así que se loguea y sigue.
  async borrarVarias(urls: string[]): Promise<void> {
    const resultados = await Promise.allSettled(
      urls.map((url) => this.borrar(url)),
    );
    for (const resultado of resultados) {
      if (resultado.status === 'rejected') {
        this.logger.error(resultado.reason, 'No se pudo borrar un archivo');
      }
    }
  }

  esUrlDeCarpeta(url: string, carpeta: string): boolean {
    return (
      !!this.almacenamiento &&
      url.startsWith(`${this.almacenamiento.urlPublica}/${carpeta}/`)
    );
  }

  private claveDe(url: string): string | null {
    const prefijo = `${this.almacenamiento?.urlPublica}/`;
    return this.almacenamiento && url.startsWith(prefijo)
      ? url.slice(prefijo.length)
      : null;
  }

  private configurado(): Almacenamiento {
    if (!this.almacenamiento) {
      throw new ServiceUnavailableException(
        'La subida de imágenes no está configurada',
      );
    }
    return this.almacenamiento;
  }
}
