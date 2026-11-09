import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  estaAgotado,
  LISTAS_DEL_PRODUCTO,
  listasDe,
  variantesVigentes,
} from '../productos/variantes.js';
import type {
  ProductoTienda,
  ProductoTiendaResumen,
} from '../schemas/tienda.js';

const CANTIDAD_DESTACADOS = 8;

const VARIANTES = { select: { color: true, talle: true, disponible: true } };
const CATEGORIA = { select: { nombre: true, slug: true } };

const RESUMEN = {
  id: true,
  nombre: true,
  precio: true,
  fotos: { select: { urlMiniatura: true }, orderBy: { orden: 'asc' }, take: 1 },
  variantes: { ...VARIANTES, where: { disponible: true } },
  ...LISTAS_DEL_PRODUCTO,
} satisfies Prisma.ProductoSelect;

const DETALLE = {
  id: true,
  nombre: true,
  descripcion: true,
  precio: true,
  categoria: CATEGORIA,
  fotos: {
    select: { url: true, urlMiniatura: true },
    orderBy: { orden: 'asc' },
  },
  variantes: VARIANTES,
  ...LISTAS_DEL_PRODUCTO,
  listaTalles: { select: { talles: true, guiaTallesUrl: true } },
} satisfies Prisma.ProductoSelect;

// Solo productos visibles de la marca de la tienda: el resto responde 404,
// como si no existiera.
@Injectable()
export class ProductosTiendaService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    marcaId: string,
    categoria?: string,
  ): Promise<ProductoTiendaResumen[]> {
    if (!categoria) return this.resumenes(marcaId);
    await this.asegurarCategoria(categoria);
    return this.resumenes(marcaId, {
      categoria: { OR: [{ slug: categoria }, { padre: { slug: categoria } }] },
    });
  }

  // TODO(decision): los más nuevos. "Más vendidos" no es confiable porque
  // los pedidos se guardan aunque no se concreten.
  destacados(marcaId: string): Promise<ProductoTiendaResumen[]> {
    return this.resumenes(marcaId, {}, CANTIDAD_DESTACADOS);
  }

  async obtener(marcaId: string, id: string): Promise<ProductoTienda> {
    const producto = await this.prisma.producto.findFirst({
      where: { id, marcaId, visible: true },
      select: DETALLE,
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    const { conColores: _, marca: _marca, listaTalles, ...resto } = producto;
    const listas = listasDe(producto);
    const variantes = variantesVigentes(producto.variantes, listas);
    return {
      ...resto,
      variantes,
      guiaTallesUrl: listaTalles?.guiaTallesUrl ?? null,
      agotado: estaAgotado(variantes, listas),
    };
  }

  // De los más nuevos a los más viejos.
  private async resumenes(
    marcaId: string,
    where: Prisma.ProductoWhereInput = {},
    take?: number,
  ): Promise<ProductoTiendaResumen[]> {
    const productos = await this.prisma.producto.findMany({
      where: { ...where, marcaId, visible: true },
      select: RESUMEN,
      orderBy: { creadoEn: 'desc' },
      take,
    });
    return productos.map(
      ({ fotos, variantes, conColores, marca, listaTalles, ...producto }) => ({
        ...producto,
        miniatura: fotos[0]?.urlMiniatura ?? null,
        agotado: estaAgotado(
          variantes,
          listasDe({ conColores, marca, listaTalles }),
        ),
      }),
    );
  }

  private async asegurarCategoria(slug: string) {
    if (!(await this.prisma.categoria.count({ where: { slug } }))) {
      throw new NotFoundException('Categoría no encontrada');
    }
  }
}
