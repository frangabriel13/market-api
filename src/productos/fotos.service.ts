import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UrlDeSubida } from '../schemas/imagenes.js';
import {
  MAXIMO_FOTOS,
  type FotoSubida,
  type Producto,
} from '../schemas/productos.js';
import { carpetaDeMarca, carpetaDeProducto } from '../storage/carpetas.js';
import { StorageService } from '../storage/storage.service.js';
import { generarMiniatura } from './miniatura.js';
import { ProductosService } from './productos.service.js';

// La marca sale del token: un producto o una foto de otra marca responde 404.
@Injectable()
export class FotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly productos: ProductosService,
  ) {}

  async crearUrlDeSubida(
    marcaId: string,
    { productoId, ...archivo }: FotoSubida,
  ): Promise<UrlDeSubida> {
    await this.asegurarLugar(marcaId, productoId);
    return this.storage.crearUrlDeSubida(
      carpetaDeProducto(marcaId, productoId),
      'foto',
      archivo,
    );
  }

  // Baja la foto subida, genera la miniatura y la agrega al final.
  async registrar(
    marcaId: string,
    productoId: string,
    url: string,
  ): Promise<Producto> {
    await this.asegurarLugar(marcaId, productoId);
    const carpeta = carpetaDeProducto(marcaId, productoId);
    if (!this.storage.esUrlDeCarpeta(url, carpeta)) {
      throw new BadRequestException('La foto no se subió para este producto');
    }
    if (await this.prisma.fotoProducto.count({ where: { productoId, url } })) {
      throw new BadRequestException('Esa foto ya está cargada');
    }

    const original = await this.storage.descargar(url);
    if (!original)
      throw new BadRequestException('No se encontró la foto subida');
    const miniatura = await generarMiniatura(original);
    if (!miniatura) {
      await this.storage.borrarVarias([url]);
      throw new BadRequestException('El archivo no es una imagen válida');
    }
    const urlMiniatura = await this.storage.subir(
      carpeta,
      'miniatura',
      miniatura,
      'image/webp',
    );

    const { _max } = await this.prisma.fotoProducto.aggregate({
      where: { productoId },
      _max: { orden: true },
    });
    await this.prisma.fotoProducto.create({
      data: {
        productoId,
        url,
        urlMiniatura,
        orden: _max.orden === null ? 0 : _max.orden + 1,
      },
    });
    return this.productos.obtener(marcaId, productoId);
  }

  async reordenar(
    marcaId: string,
    productoId: string,
    fotoIds: string[],
  ): Promise<Producto> {
    const producto = await this.prisma.producto.findFirst({
      where: { id: productoId, marcaId },
      select: { fotos: { select: { id: true } } },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const actuales = new Set(producto.fotos.map((foto) => foto.id));
    const completas =
      new Set(fotoIds).size === fotoIds.length &&
      fotoIds.length === actuales.size &&
      fotoIds.every((id) => actuales.has(id));
    if (!completas) {
      throw new BadRequestException(
        'Mandá todas las fotos del producto, una sola vez cada una',
      );
    }

    await this.prisma.$transaction(
      fotoIds.map((id, orden) =>
        this.prisma.fotoProducto.update({ where: { id }, data: { orden } }),
      ),
    );
    return this.productos.obtener(marcaId, productoId);
  }

  async quitar(
    marcaId: string,
    productoId: string,
    fotoId: string,
  ): Promise<Producto> {
    const foto = await this.prisma.fotoProducto.findFirst({
      where: { id: fotoId, productoId, producto: { marcaId } },
      select: { url: true, urlMiniatura: true },
    });
    if (!foto) throw new NotFoundException('Foto no encontrada');

    await this.prisma.fotoProducto.delete({ where: { id: fotoId } });
    const carpeta = carpetaDeMarca(marcaId);
    await this.storage.borrarVarias(
      [foto.url, foto.urlMiniatura].filter((url) =>
        this.storage.esUrlDeCarpeta(url, carpeta),
      ),
    );
    return this.productos.obtener(marcaId, productoId);
  }

  private async asegurarLugar(marcaId: string, productoId: string) {
    const producto = await this.prisma.producto.findFirst({
      where: { id: productoId, marcaId },
      select: { _count: { select: { fotos: true } } },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    if (producto._count.fotos >= MAXIMO_FOTOS) {
      throw new BadRequestException(
        `El producto ya tiene ${MAXIMO_FOTOS} fotos: quitá una para subir otra`,
      );
    }
  }
}
