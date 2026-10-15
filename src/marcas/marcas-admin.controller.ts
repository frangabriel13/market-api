import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { Roles } from '../auth/decorators.js';
import { IdParamDto } from '../common/id-param.dto.js';
import {
  accesoFabricanteSchema,
  marcaCrearSchema,
  marcaEditarSchema,
  marcaEstadoSchema,
  imagenMarcaSchema,
} from '../schemas/marcas.js';
import { AccesoFabricanteService } from './acceso-fabricante.service.js';
import { MarcasService } from './marcas.service.js';

class MarcaCrearDto extends createZodDto(marcaCrearSchema) {}
class MarcaEditarDto extends createZodDto(marcaEditarSchema) {}
class MarcaEstadoDto extends createZodDto(marcaEstadoSchema) {}
class ImagenMarcaDto extends createZodDto(imagenMarcaSchema) {}
class AccesoFabricanteDto extends createZodDto(accesoFabricanteSchema) {}

@Roles('ADMIN')
@Controller('admin/marcas')
export class MarcasAdminController {
  constructor(
    private readonly marcas: MarcasService,
    private readonly accesos: AccesoFabricanteService,
  ) {}

  @Get()
  listar() {
    return this.marcas.listar();
  }

  @Get(':id')
  obtener(@Param() { id }: IdParamDto) {
    return this.marcas.obtener(id);
  }

  @Post()
  crear(@Body() datos: MarcaCrearDto) {
    return this.marcas.crear(datos);
  }

  @Patch(':id')
  editar(@Param() { id }: IdParamDto, @Body() datos: MarcaEditarDto) {
    return this.marcas.editar(id, datos);
  }

  @Patch(':id/estado')
  cambiarEstado(@Param() { id }: IdParamDto, @Body() datos: MarcaEstadoDto) {
    return this.marcas.cambiarEstado(id, datos);
  }

  @Post(':id/imagenes')
  crearUrlDeImagen(
    @Param() { id }: IdParamDto,
    @Body() imagen: ImagenMarcaDto,
  ) {
    return this.marcas.crearUrlDeImagen(id, imagen);
  }

  @Post(':id/usuario')
  @HttpCode(HttpStatus.OK)
  crearAcceso(
    @Param() { id }: IdParamDto,
    @Body() { email }: AccesoFabricanteDto,
  ) {
    return this.accesos.crearOResetear(id, email);
  }
}
