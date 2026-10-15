import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  esConflictoDeUnicidad,
  esRegistroInexistente,
} from '../prisma/errores.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UrlDeSubida } from '../schemas/imagenes.js';
import type {
  ImagenMarca,
  Marca,
  MarcaCrear,
  MarcaEditar,
  MarcaEstado,
  MarcaResumen,
  Redes,
} from '../schemas/marcas.js';
import { StorageService } from '../storage/storage.service.js';

const RESUMEN = {
  id: true,
  nombre: true,
  slug: true,
  dominioPropio: true,
  estado: true,
} satisfies Prisma.MarcaSelect;

const IMAGENES = {
  logoUrl: true,
  portadaUrl: true,
  guiaTallesUrl: true,
} satisfies Prisma.MarcaSelect;

type Imagenes = Prisma.MarcaGetPayload<{ select: typeof IMAGENES }>;

const CAMPOS_IMAGEN = Object.keys(IMAGENES) as (keyof Imagenes)[];

const DETALLE = {
  ...RESUMEN,
  ...IMAGENES,
  textosBanner: true,
  whatsapp: true,
  direccionRetiro: true,
  horariosRetiro: true,
  redes: true,
  comoComprar: true,
  condicionesVenta: true,
  minimoCompra: true,
  colores: true,
  talles: true,
  usuario: { select: { email: true, activo: true } },
} satisfies Prisma.MarcaSelect;

type FilaDetalle = Prisma.MarcaGetPayload<{ select: typeof DETALLE }>;

const SLUG_EN_USO = 'Ya existe una marca con ese slug';
const NO_ENCONTRADA = 'Marca no encontrada';

@Injectable()
export class MarcasService {
  private readonly logger = new Logger(MarcasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  listar(): Promise<MarcaResumen[]> {
    return this.prisma.marca.findMany({
      select: RESUMEN,
      orderBy: { nombre: 'asc' },
    });
  }

  async obtener(id: string): Promise<Marca> {
    const marca = await this.prisma.marca.findUnique({
      where: { id },
      select: DETALLE,
    });
    if (!marca) throw new NotFoundException(NO_ENCONTRADA);
    return aMarca(marca);
  }

  async asegurarExistencia(id: string): Promise<void> {
    if (!(await this.prisma.marca.count({ where: { id } }))) {
      throw new NotFoundException(NO_ENCONTRADA);
    }
  }

  async crear(datos: MarcaCrear): Promise<Marca> {
    const marca = await this.prisma.marca
      .create({ data: datos, select: DETALLE })
      .catch(traducirError);
    return aMarca(marca);
  }

  async editar(id: string, datos: MarcaEditar): Promise<Marca> {
    this.validarImagenes(id, datos);
    const anteriores = await this.prisma.marca.findUnique({
      where: { id },
      select: IMAGENES,
    });
    const marca = await this.actualizar(id, datos);
    if (anteriores) await this.borrarReemplazadas(id, anteriores, marca);
    return marca;
  }

  cambiarEstado(id: string, { estado }: MarcaEstado): Promise<Marca> {
    return this.actualizar(id, { estado });
  }

  async crearUrlDeImagen(
    id: string,
    { tipo, ...archivo }: ImagenMarca,
  ): Promise<UrlDeSubida> {
    await this.asegurarExistencia(id);
    return this.storage.crearUrlDeSubida(carpeta(id), tipo, archivo);
  }

  private async actualizar(
    id: string,
    data: Prisma.MarcaUpdateInput,
  ): Promise<Marca> {
    const marca = await this.prisma.marca
      .update({ where: { id }, data, select: DETALLE })
      .catch(traducirError);
    return aMarca(marca);
  }

  private validarImagenes(id: string, datos: MarcaEditar) {
    const urls = CAMPOS_IMAGEN.map((campo) => datos[campo]).filter(
      (url): url is string => !!url,
    );
    if (urls.some((url) => !this.storage.esUrlDeCarpeta(url, carpeta(id)))) {
      throw new BadRequestException('La imagen no se subió a esta marca');
    }
  }

  // Si falla, la marca ya quedó guardada: solo queda un archivo sin usar.
  private async borrarReemplazadas(
    id: string,
    anteriores: Imagenes,
    actual: Marca,
  ) {
    const reemplazadas = CAMPOS_IMAGEN.flatMap((campo) => {
      const url = anteriores[campo];
      const reemplazada =
        url &&
        url !== actual[campo] &&
        this.storage.esUrlDeCarpeta(url, carpeta(id));
      return reemplazada ? [url] : [];
    });

    const resultados = await Promise.allSettled(
      reemplazadas.map((url) => this.storage.borrar(url)),
    );
    for (const resultado of resultados) {
      if (resultado.status === 'rejected') {
        this.logger.error(resultado.reason, 'No se pudo borrar una imagen');
      }
    }
  }
}

const carpeta = (id: string) => `marcas/${id}`;

function traducirError(error: unknown): never {
  if (esConflictoDeUnicidad(error)) throw new ConflictException(SLUG_EN_USO);
  if (esRegistroInexistente(error)) throw new NotFoundException(NO_ENCONTRADA);
  throw error;
}

function aMarca(fila: FilaDetalle): Marca {
  return { ...fila, redes: fila.redes as Redes };
}
