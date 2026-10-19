import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { slugify } from '../common/slugify.js';
import type { Prisma } from '../generated/prisma/client.js';
import { esConflictoDeUnicidad, esReferenciaEnUso } from '../prisma/errores.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  Categoria,
  CategoriaConSubcategorias,
  CategoriaCrear,
  CategoriaEditar,
} from '../schemas/categorias.js';
import type { CategoriaTienda } from '../schemas/tienda.js';

const CAMPOS = {
  id: true,
  nombre: true,
  slug: true,
  orden: true,
  padreId: true,
} satisfies Prisma.CategoriaSelect;

const ORDEN = [
  { orden: 'asc' },
  { nombre: 'asc' },
] satisfies Prisma.CategoriaOrderByWithRelationInput[];

const NO_ENCONTRADA = 'Categoría no encontrada';
const DOS_NIVELES = 'Solo se permiten dos niveles: categoría y subcategoría';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  listar(): Promise<CategoriaConSubcategorias[]> {
    return this.prisma.categoria.findMany({
      where: { padreId: null },
      select: {
        ...CAMPOS,
        subcategorias: { select: CAMPOS, orderBy: ORDEN },
      },
      orderBy: ORDEN,
    });
  }

  // Una categoría aparece si tiene productos visibles de la marca o si los
  // tiene alguna de sus subcategorías.
  listarDeTienda(marcaId: string): Promise<CategoriaTienda[]> {
    const conProductos = {
      productos: { some: { marcaId, visible: true } },
    } satisfies Prisma.CategoriaWhereInput;
    const campos = {
      nombre: true,
      slug: true,
    } satisfies Prisma.CategoriaSelect;
    return this.prisma.categoria.findMany({
      where: {
        padreId: null,
        OR: [conProductos, { subcategorias: { some: conProductos } }],
      },
      select: {
        ...campos,
        subcategorias: { where: conProductos, select: campos, orderBy: ORDEN },
      },
      orderBy: ORDEN,
    });
  }

  // El slug no cambia al renombrar: no rompe links ya compartidos. Las
  // subcategorías llevan el del padre adelante porque es único global.
  async crear({ nombre, padreId, orden }: CategoriaCrear): Promise<Categoria> {
    const base = slugify(nombre);
    if (!base) {
      throw new BadRequestException(
        'El nombre tiene que tener letras o números',
      );
    }
    const padre = padreId ? await this.padreValido(padreId) : null;
    const slug = padre ? `${padre.slug}-${base}` : base;
    return this.prisma.categoria
      .create({
        data: {
          nombre,
          slug,
          padreId: padre?.id ?? null,
          orden: orden ?? (await this.siguienteOrden(padre?.id ?? null)),
        },
        select: CAMPOS,
      })
      .catch(traducirError);
  }

  async editar(id: string, datos: CategoriaEditar): Promise<Categoria> {
    const actual = await this.prisma.categoria.findUnique({
      where: { id },
      select: { _count: { select: { subcategorias: true } } },
    });
    if (!actual) throw new NotFoundException(NO_ENCONTRADA);

    if (datos.padreId) {
      if (datos.padreId === id || actual._count.subcategorias > 0) {
        throw new BadRequestException(DOS_NIVELES);
      }
      await this.padreValido(datos.padreId);
    }

    return this.prisma.categoria
      .update({ where: { id }, data: datos, select: CAMPOS })
      .catch(traducirError);
  }

  async eliminar(id: string): Promise<void> {
    const categoria = await this.prisma.categoria.findUnique({
      where: { id },
      select: { _count: { select: { subcategorias: true, productos: true } } },
    });
    if (!categoria) throw new NotFoundException(NO_ENCONTRADA);
    if (categoria._count.subcategorias > 0) {
      throw new ConflictException('Tiene subcategorías: borralas primero');
    }
    if (categoria._count.productos > 0) {
      throw new ConflictException('Tiene productos cargados');
    }
    await this.prisma.categoria.delete({ where: { id } }).catch(traducirError);
  }

  private async padreValido(padreId: string) {
    const padre = await this.prisma.categoria.findUnique({
      where: { id: padreId },
      select: { id: true, slug: true, padreId: true },
    });
    if (!padre) throw new BadRequestException('La categoría padre no existe');
    if (padre.padreId) throw new BadRequestException(DOS_NIVELES);
    return padre;
  }

  private async siguienteOrden(padreId: string | null): Promise<number> {
    const { _max } = await this.prisma.categoria.aggregate({
      where: { padreId },
      _max: { orden: true },
    });
    return _max.orden === null ? 0 : _max.orden + 1;
  }
}

function traducirError(error: unknown): never {
  if (esConflictoDeUnicidad(error)) {
    throw new ConflictException('Ya existe una categoría con ese slug');
  }
  if (esReferenciaEnUso(error)) {
    throw new ConflictException('La categoría está en uso');
  }
  throw error;
}
