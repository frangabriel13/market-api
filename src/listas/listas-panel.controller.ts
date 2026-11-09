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
import { archivoImagenSchema } from '../schemas/imagenes.js';
import {
  coloresSchema,
  listaTallesCrearSchema,
  listaTallesEditarSchema,
} from '../schemas/listas.js';
import { ListasService } from './listas.service.js';

class ColoresDto extends createZodDto(coloresSchema) {}
class ListaTallesCrearDto extends createZodDto(listaTallesCrearSchema) {}
class ListaTallesEditarDto extends createZodDto(listaTallesEditarSchema) {}
class ArchivoImagenDto extends createZodDto(archivoImagenSchema) {}

@Roles('FABRICANTE')
@Controller('panel')
export class ListasPanelController {
  constructor(private readonly listas: ListasService) {}

  @Get('listas')
  obtener(@MarcaId() marcaId: string) {
    return this.listas.obtener(marcaId);
  }

  @Put('colores')
  editarColores(@MarcaId() marcaId: string, @Body() datos: ColoresDto) {
    return this.listas.editarColores(marcaId, datos);
  }

  @Post('listas-talles')
  crearLista(@MarcaId() marcaId: string, @Body() datos: ListaTallesCrearDto) {
    return this.listas.crearLista(marcaId, datos);
  }

  @Patch('listas-talles/:id')
  editarLista(
    @MarcaId() marcaId: string,
    @Param() { id }: IdParamDto,
    @Body() datos: ListaTallesEditarDto,
  ) {
    return this.listas.editarLista(marcaId, id, datos);
  }

  @Delete('listas-talles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarLista(@MarcaId() marcaId: string, @Param() { id }: IdParamDto) {
    return this.listas.eliminarLista(marcaId, id);
  }

  @Post('listas-talles/:id/guia')
  crearUrlDeGuia(
    @MarcaId() marcaId: string,
    @Param() { id }: IdParamDto,
    @Body() archivo: ArchivoImagenDto,
  ) {
    return this.listas.crearUrlDeGuia(marcaId, id, archivo);
  }
}
