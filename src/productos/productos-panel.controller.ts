import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { MarcaId, Roles } from '../auth/decorators.js';
import { IdParamDto } from '../common/id-param.dto.js';
import {
  productoCrearSchema,
  productoEditarSchema,
  productoVisibilidadSchema,
  variantesSchema,
} from '../schemas/productos.js';
import { ProductosService } from './productos.service.js';

class ProductoCrearDto extends createZodDto(productoCrearSchema) {}
class ProductoEditarDto extends createZodDto(productoEditarSchema) {}
class ProductoVisibilidadDto extends createZodDto(productoVisibilidadSchema) {}
class VariantesDto extends createZodDto(variantesSchema) {}

@Roles('FABRICANTE')
@Controller('panel/productos')
export class ProductosPanelController {
  constructor(private readonly productos: ProductosService) {}

  @Get()
  listar(@MarcaId() marcaId: string) {
    return this.productos.listar(marcaId);
  }

  @Get(':id')
  obtener(@MarcaId() marcaId: string, @Param() { id }: IdParamDto) {
    return this.productos.obtener(marcaId, id);
  }

  @Post()
  crear(@MarcaId() marcaId: string, @Body() datos: ProductoCrearDto) {
    return this.productos.crear(marcaId, datos);
  }

  @Patch(':id')
  editar(
    @MarcaId() marcaId: string,
    @Param() { id }: IdParamDto,
    @Body() datos: ProductoEditarDto,
  ) {
    return this.productos.editar(marcaId, id, datos);
  }

  @Patch(':id/visibilidad')
  cambiarVisibilidad(
    @MarcaId() marcaId: string,
    @Param() { id }: IdParamDto,
    @Body() datos: ProductoVisibilidadDto,
  ) {
    return this.productos.cambiarVisibilidad(marcaId, id, datos);
  }

  @Put(':id/variantes')
  reemplazarVariantes(
    @MarcaId() marcaId: string,
    @Param() { id }: IdParamDto,
    @Body() datos: VariantesDto,
  ) {
    return this.productos.reemplazarVariantes(marcaId, id, datos);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@MarcaId() marcaId: string, @Param() { id }: IdParamDto) {
    return this.productos.eliminar(marcaId, id);
  }
}
