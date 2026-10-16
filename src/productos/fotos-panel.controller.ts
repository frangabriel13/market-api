import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MarcaId, Roles } from '../auth/decorators.js';
import { IdParamDto } from '../common/id-param.dto.js';
import {
  fotoRegistrarSchema,
  fotosOrdenSchema,
  fotoSubidaSchema,
} from '../schemas/productos.js';
import { FotosService } from './fotos.service.js';

class FotoParamDto extends createZodDto(
  z.object({ id: z.uuid(), fotoId: z.uuid() }),
) {}
class FotoSubidaDto extends createZodDto(fotoSubidaSchema) {}
class FotoRegistrarDto extends createZodDto(fotoRegistrarSchema) {}
class FotosOrdenDto extends createZodDto(fotosOrdenSchema) {}

@Roles('FABRICANTE')
@Controller('panel')
export class FotosPanelController {
  constructor(private readonly fotos: FotosService) {}

  @Post('fotos')
  crearUrlDeSubida(@MarcaId() marcaId: string, @Body() datos: FotoSubidaDto) {
    return this.fotos.crearUrlDeSubida(marcaId, datos);
  }

  @Post('productos/:id/fotos')
  registrar(
    @MarcaId() marcaId: string,
    @Param() { id }: IdParamDto,
    @Body() { url }: FotoRegistrarDto,
  ) {
    return this.fotos.registrar(marcaId, id, url);
  }

  @Put('productos/:id/fotos/orden')
  reordenar(
    @MarcaId() marcaId: string,
    @Param() { id }: IdParamDto,
    @Body() { fotoIds }: FotosOrdenDto,
  ) {
    return this.fotos.reordenar(marcaId, id, fotoIds);
  }

  @Delete('productos/:id/fotos/:fotoId')
  quitar(@MarcaId() marcaId: string, @Param() { id, fotoId }: FotoParamDto) {
    return this.fotos.quitar(marcaId, id, fotoId);
  }
}
