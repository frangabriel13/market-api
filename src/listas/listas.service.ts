import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  esConflictoDeUnicidad,
  esRegistroInexistente,
} from '../prisma/errores.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { esVigente, listasDe } from '../productos/variantes.js';
import type { ArchivoImagen, UrlDeSubida } from '../schemas/imagenes.js';
import type {
  Colores,
  ListasPanel,
  ListaTallesCrear,
  ListaTallesEditar,
  ListaTallesEnUso,
  ValorEditado,
} from '../schemas/listas.js';
import { carpetaDeListaTalles, carpetaDeMarca } from '../storage/carpetas.js';
import { StorageService } from '../storage/storage.service.js';
import { renombresDe, type Renombre } from './renombres.js';

const NO_ENCONTRADA = 'Lista de talles no encontrada';
const DESACTUALIZADA =
  'La lista cambió mientras la editabas: recargá la página y volvé a probar';

// La marca sale del token: una lista de otra marca responde 404.
@Injectable()
export class ListasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async obtener(marcaId: string): Promise<ListasPanel> {
    const [{ colores }, listas, productos] = await Promise.all([
      this.prisma.marca.findUniqueOrThrow({
        where: { id: marcaId },
        select: { colores: true },
      }),
      this.prisma.listaTalles.findMany({
        where: { marcaId },
        select: { id: true, nombre: true, talles: true, guiaTallesUrl: true },
        orderBy: { creadoEn: 'asc' },
      }),
      this.prisma.producto.findMany({
        where: { marcaId },
        select: {
          conColores: true,
          listaTallesId: true,
          variantes: { select: { color: true, talle: true } },
        },
      }),
    ]);

    // Lo que muestra cada producto hoy: sus variantes vigentes.
    const usos = productos.map(({ conColores, listaTallesId, variantes }) => {
      const vigentes = variantes.filter((v) =>
        esVigente(
          v,
          listasDe({
            conColores,
            marca: { colores },
            listaTalles: listas.find((l) => l.id === listaTallesId) ?? null,
          }),
        ),
      );
      return {
        listaTallesId,
        colores: new Set(vigentes.map((v) => v.color)),
        talles: new Set(vigentes.map((v) => v.talle)),
      };
    });

    return {
      colores: colores.map((nombre) => ({
        nombre,
        productos: usos.filter((uso) => uso.colores.has(nombre)).length,
      })),
      listasTalles: listas.map(({ talles, ...lista }) => {
        const deLaLista = usos.filter((uso) => uso.listaTallesId === lista.id);
        return {
          ...lista,
          productos: deLaLista.length,
          talles: talles.map((nombre) => ({
            nombre,
            productos: deLaLista.filter((uso) => uso.talles.has(nombre)).length,
          })),
        };
      }),
    };
  }

  async editarColores(
    marcaId: string,
    { colores }: Colores,
  ): Promise<ListasPanel> {
    await this.prisma.$transaction(async (tx) => {
      const marca = await tx.marca.findUniqueOrThrow({
        where: { id: marcaId },
        select: { colores: true },
      });
      await renombrar(tx, 'color', renombres(colores, marca.colores), {
        marcaId,
      });
      await tx.marca.update({
        where: { id: marcaId },
        data: { colores: colores.map((color) => color.nombre) },
      });
    });
    return this.obtener(marcaId);
  }

  async crearLista(
    marcaId: string,
    datos: ListaTallesCrear,
  ): Promise<ListasPanel> {
    await this.prisma.listaTalles
      .create({ data: { ...datos, marcaId } })
      .catch(traducirError);
    return this.obtener(marcaId);
  }

  async editarLista(
    marcaId: string,
    id: string,
    { talles, ...datos }: ListaTallesEditar,
  ): Promise<ListasPanel> {
    const guia = datos.guiaTallesUrl;
    if (
      guia &&
      !this.storage.esUrlDeCarpeta(guia, carpetaDeListaTalles(marcaId, id))
    ) {
      throw new BadRequestException('La guía no se subió para esta lista');
    }

    const anterior = await this.prisma.$transaction(async (tx) => {
      const lista = await tx.listaTalles.findFirst({
        where: { id, marcaId },
        select: { talles: true, guiaTallesUrl: true },
      });
      if (!lista) throw new NotFoundException(NO_ENCONTRADA);
      if (talles) {
        await renombrar(tx, 'talle', renombres(talles, lista.talles), {
          listaTallesId: id,
        });
      }
      await tx.listaTalles
        .update({
          where: { id },
          data: { ...datos, talles: talles?.map((talle) => talle.nombre) },
        })
        .catch(traducirError);
      return lista.guiaTallesUrl;
    });

    if (guia !== undefined && anterior !== guia) {
      await this.borrarGuia(marcaId, anterior);
    }
    return this.obtener(marcaId);
  }

  async eliminarLista(marcaId: string, id: string): Promise<void> {
    const lista = await this.prisma.listaTalles.findFirst({
      where: { id, marcaId },
      select: { guiaTallesUrl: true, _count: { select: { productos: true } } },
    });
    if (!lista) throw new NotFoundException(NO_ENCONTRADA);
    const productos = lista._count.productos;
    if (productos) {
      throw new ConflictException({
        message:
          productos === 1
            ? 'La usa 1 producto: cambiale la lista antes de borrarla'
            : `La usan ${productos} productos: cambiales la lista antes de borrarla`,
        productos,
      } satisfies ListaTallesEnUso);
    }
    await this.prisma.listaTalles.delete({ where: { id } });
    await this.borrarGuia(marcaId, lista.guiaTallesUrl);
  }

  async crearUrlDeGuia(
    marcaId: string,
    id: string,
    archivo: ArchivoImagen,
  ): Promise<UrlDeSubida> {
    if (!(await this.prisma.listaTalles.count({ where: { id, marcaId } }))) {
      throw new NotFoundException(NO_ENCONTRADA);
    }
    return this.storage.crearUrlDeSubida(
      carpetaDeListaTalles(marcaId, id),
      'guia',
      archivo,
    );
  }

  // Las guías que vinieron de la marca están en su carpeta, no en la de la
  // lista.
  private async borrarGuia(marcaId: string, url: string | null) {
    if (url && this.storage.esUrlDeCarpeta(url, carpetaDeMarca(marcaId))) {
      await this.storage.borrarVarias([url]);
    }
  }
}

function renombres(valores: ValorEditado[], guardados: string[]) {
  const resultado = renombresDe(valores, guardados);
  if (!resultado) throw new ConflictException(DESACTUALIZADA);
  return resultado;
}

// Cambia el nombre en las variantes de los productos indicados y conserva la
// disponibilidad. Va en dos pasos, pasando por un nombre provisorio, para que
// intercambiar dos nombres no choque con la unicidad de producto, color y
// talle. Si el nombre nuevo ya tenía variantes ocultas (de un valor que se
// quitó antes), el renombrado las reemplaza.
async function renombrar(
  tx: Prisma.TransactionClient,
  campo: 'color' | 'talle',
  renombres: Renombre[],
  productos: Prisma.ProductoWhereInput,
) {
  if (!renombres.length) return;
  const donde = (valor: string | { in: string[] }) => ({
    producto: productos,
    [campo]: valor,
  });
  const origenes = renombres.map(([de]) => de);
  const ocupados = renombres
    .map(([, a]) => a)
    .filter((a) => !origenes.includes(a));
  await tx.variante.deleteMany({ where: donde({ in: ocupados }) });
  for (const [i, [de]] of renombres.entries()) {
    await tx.variante.updateMany({
      where: donde(de),
      data: { [campo]: provisorio(i) },
    });
  }
  for (const [i, [, a]] of renombres.entries()) {
    await tx.variante.updateMany({
      where: donde(provisorio(i)),
      data: { [campo]: a },
    });
  }
}

const provisorio = (i: number) => `\u0001${i}`;

function traducirError(error: unknown): never {
  if (esConflictoDeUnicidad(error)) {
    throw new ConflictException('Ya tenés una lista de talles con ese nombre');
  }
  if (esRegistroInexistente(error)) throw new NotFoundException(NO_ENCONTRADA);
  throw error;
}
