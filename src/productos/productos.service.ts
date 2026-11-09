import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { esRegistroInexistente } from '../prisma/errores.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  Producto,
  ProductoCrear,
  ProductoEditar,
  ProductoResumen,
  ProductoVisibilidad,
  Variantes,
} from '../schemas/productos.js';
import { carpetaDeMarca } from '../storage/carpetas.js';
import { StorageService } from '../storage/storage.service.js';
import {
  contarCombinaciones,
  errorDeListas,
  LISTAS_DEL_PRODUCTO,
  listasDe,
  variantesVigentes,
} from './variantes.js';

const CATEGORIA = { select: { id: true, nombre: true } };

const RESUMEN = {
  id: true,
  nombre: true,
  precio: true,
  visible: true,
  categoria: CATEGORIA,
  fotos: { select: { urlMiniatura: true }, orderBy: { orden: 'asc' }, take: 1 },
  variantes: { select: { color: true, talle: true, disponible: true } },
  ...LISTAS_DEL_PRODUCTO,
} satisfies Prisma.ProductoSelect;

const DETALLE = {
  id: true,
  nombre: true,
  descripcion: true,
  precio: true,
  visible: true,
  categoria: CATEGORIA,
  listaTallesId: true,
  fotos: {
    select: { id: true, url: true, urlMiniatura: true, orden: true },
    orderBy: { orden: 'asc' },
  },
  variantes: { select: { color: true, talle: true, disponible: true } },
  ...LISTAS_DEL_PRODUCTO,
} satisfies Prisma.ProductoSelect;

type FilaDetalle = Prisma.ProductoGetPayload<{ select: typeof DETALLE }>;

const NO_ENCONTRADO = 'Producto no encontrado';

// Todas las consultas filtran por marcaId (sale del token): un producto de
// otra marca responde 404, como si no existiera.
@Injectable()
export class ProductosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async listar(marcaId: string): Promise<ProductoResumen[]> {
    const productos = await this.prisma.producto.findMany({
      where: { marcaId },
      select: RESUMEN,
      orderBy: { creadoEn: 'desc' },
    });
    return productos.map(
      ({ fotos, variantes, conColores, marca, listaTalles, ...producto }) => ({
        ...producto,
        miniatura: fotos[0]?.urlMiniatura ?? null,
        ...contarCombinaciones(
          variantes,
          listasDe({ conColores, marca, listaTalles }),
        ),
      }),
    );
  }

  async obtener(marcaId: string, id: string): Promise<Producto> {
    const producto = await this.prisma.producto.findFirst({
      where: { id, marcaId },
      select: DETALLE,
    });
    if (!producto) throw new NotFoundException(NO_ENCONTRADO);
    return aProducto(producto);
  }

  async crear(marcaId: string, datos: ProductoCrear): Promise<Producto> {
    await this.validarCategoria(datos.categoriaId);
    if (datos.listaTallesId) {
      await this.validarListaTalles(marcaId, datos.listaTallesId);
    }
    const producto = await this.prisma.producto.create({
      data: { ...datos, marcaId },
      select: DETALLE,
    });
    return aProducto(producto);
  }

  async editar(
    marcaId: string,
    id: string,
    datos: ProductoEditar,
  ): Promise<Producto> {
    if (datos.categoriaId) await this.validarCategoria(datos.categoriaId);
    if (datos.listaTallesId) {
      await this.validarListaTalles(marcaId, datos.listaTallesId);
    }
    return this.actualizar(marcaId, id, datos);
  }

  cambiarVisibilidad(
    marcaId: string,
    id: string,
    { visible }: ProductoVisibilidad,
  ): Promise<Producto> {
    return this.actualizar(marcaId, id, { visible });
  }

  async reemplazarVariantes(
    marcaId: string,
    id: string,
    { variantes }: Variantes,
  ): Promise<Producto> {
    const producto = await this.prisma.producto.findFirst({
      where: { id, marcaId },
      select: LISTAS_DEL_PRODUCTO,
    });
    if (!producto) throw new NotFoundException(NO_ENCONTRADO);
    const listas = listasDe(producto);
    const error = errorDeListas(variantes, listas);
    if (error) throw new BadRequestException(error);

    // Las ocultas (de valores quitados, otra lista u otra modalidad) quedan
    // guardadas para cuando vuelvan.
    await this.prisma.$transaction([
      this.prisma.variante.deleteMany({
        where: {
          productoId: id,
          color: { in: listas.colores },
          talle: { in: listas.talles },
        },
      }),
      this.prisma.variante.createMany({
        data: variantes.map((variante) => ({ ...variante, productoId: id })),
      }),
    ]);
    return this.obtener(marcaId, id);
  }

  // La base borra fotos y variantes; los pedidos conservan su copia del
  // producto. Después se borran los archivos de las fotos.
  async eliminar(marcaId: string, id: string): Promise<void> {
    const { fotos } = await this.prisma.producto
      .delete({
        where: { id, marcaId },
        select: { fotos: { select: { url: true, urlMiniatura: true } } },
      })
      .catch(traducirError);

    const carpeta = carpetaDeMarca(marcaId);
    await this.storage.borrarVarias(
      fotos
        .flatMap((foto) => [foto.url, foto.urlMiniatura])
        .filter((url) => this.storage.esUrlDeCarpeta(url, carpeta)),
    );
  }

  private async actualizar(
    marcaId: string,
    id: string,
    data: Prisma.ProductoUpdateInput,
  ): Promise<Producto> {
    const producto = await this.prisma.producto
      .update({ where: { id, marcaId }, data, select: DETALLE })
      .catch(traducirError);
    return aProducto(producto);
  }

  private async validarCategoria(id: string) {
    if (!(await this.prisma.categoria.count({ where: { id } }))) {
      throw new BadRequestException('La categoría no existe');
    }
  }

  private async validarListaTalles(marcaId: string, id: string) {
    if (!(await this.prisma.listaTalles.count({ where: { id, marcaId } }))) {
      throw new BadRequestException('La lista de talles no existe');
    }
  }
}

function traducirError(error: unknown): never {
  if (esRegistroInexistente(error)) throw new NotFoundException(NO_ENCONTRADO);
  throw error;
}

function aProducto(fila: FilaDetalle): Producto {
  const { marca: _marca, listaTalles: _listaTalles, ...producto } = fila;
  return {
    ...producto,
    variantes: variantesVigentes(fila.variantes, listasDe(fila)),
  };
}
