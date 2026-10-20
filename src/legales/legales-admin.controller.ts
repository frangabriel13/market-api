import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { Roles } from '../auth/decorators.js';
import { textoLegalEditarSchema } from '../schemas/legales.js';
import { LegalesService } from './legales.service.js';
import { TipoParamDto } from './tipo-param.dto.js';

class TextoLegalEditarDto extends createZodDto(textoLegalEditarSchema) {}

@Roles('ADMIN')
@Controller('admin/legales')
export class LegalesAdminController {
  constructor(private readonly legales: LegalesService) {}

  @Get()
  listar() {
    return this.legales.listar();
  }

  @Put(':tipo')
  guardar(@Param() { tipo }: TipoParamDto, @Body() datos: TextoLegalEditarDto) {
    return this.legales.guardar(tipo, datos);
  }
}
