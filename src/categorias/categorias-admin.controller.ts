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
} from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { Roles } from '../auth/decorators.js';
import { IdParamDto } from '../common/id-param.dto.js';
import {
  categoriaCrearSchema,
  categoriaEditarSchema,
} from '../schemas/categorias.js';
import { CategoriasService } from './categorias.service.js';

class CategoriaCrearDto extends createZodDto(categoriaCrearSchema) {}
class CategoriaEditarDto extends createZodDto(categoriaEditarSchema) {}

@Roles('ADMIN')
@Controller('admin/categorias')
export class CategoriasAdminController {
  constructor(private readonly categorias: CategoriasService) {}

  @Get()
  listar() {
    return this.categorias.listar();
  }

  @Post()
  crear(@Body() datos: CategoriaCrearDto) {
    return this.categorias.crear(datos);
  }

  @Patch(':id')
  editar(@Param() { id }: IdParamDto, @Body() datos: CategoriaEditarDto) {
    return this.categorias.editar(id, datos);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param() { id }: IdParamDto) {
    return this.categorias.eliminar(id);
  }
}
