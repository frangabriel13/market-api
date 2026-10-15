import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Roles } from '../auth/decorators.js';
import { IdParamDto } from '../common/id-param.dto.js';
import {
  opcionEntregaCrearSchema,
  opcionEntregaEditarSchema,
} from '../schemas/opciones-entrega.js';
import { OpcionesEntregaService } from './opciones-entrega.service.js';

class OpcionParamDto extends createZodDto(
  z.object({ id: z.uuid(), opcionId: z.uuid() }),
) {}
class OpcionEntregaCrearDto extends createZodDto(opcionEntregaCrearSchema) {}
class OpcionEntregaEditarDto extends createZodDto(opcionEntregaEditarSchema) {}

@Roles('ADMIN')
@Controller('admin/marcas/:id/opciones-entrega')
export class OpcionesEntregaAdminController {
  constructor(private readonly opciones: OpcionesEntregaService) {}

  @Get()
  listar(@Param() { id }: IdParamDto) {
    return this.opciones.listar(id);
  }

  @Post()
  crear(@Param() { id }: IdParamDto, @Body() datos: OpcionEntregaCrearDto) {
    return this.opciones.crear(id, datos);
  }

  @Patch(':opcionId')
  editar(
    @Param() { id, opcionId }: OpcionParamDto,
    @Body() datos: OpcionEntregaEditarDto,
  ) {
    return this.opciones.editar(id, opcionId, datos);
  }
}
