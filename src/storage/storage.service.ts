import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type { ArchivoImagen, UrlDeSubida } from '../schemas/imagenes.js';

const EXTENSIONES: Record<ArchivoImagen['contentType'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const VIGENCIA_SEGUNDOS = 5 * 60;

interface Almacenamiento {
  cliente: S3Client;
  bucket: string;
  urlPublica: string;
}

@Injectable()
export class StorageService {
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
    const clave = `${carpeta}/${nombre}-${randomUUID()}.${EXTENSIONES[contentType]}`;
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

  async borrar(url: string): Promise<void> {
    const prefijo = `${this.almacenamiento?.urlPublica}/`;
    if (!this.almacenamiento || !url.startsWith(prefijo)) return;
    await this.almacenamiento.cliente.send(
      new DeleteObjectCommand({
        Bucket: this.almacenamiento.bucket,
        Key: url.slice(prefijo.length),
      }),
    );
  }

  esUrlDeCarpeta(url: string, carpeta: string): boolean {
    return (
      !!this.almacenamiento &&
      url.startsWith(`${this.almacenamiento.urlPublica}/${carpeta}/`)
    );
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
