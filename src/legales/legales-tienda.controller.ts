import { Controller, Get, Param } from '@nestjs/common';
import { Publico } from '../auth/decorators.js';
import { LegalesService } from './legales.service.js';
import { TipoParamDto } from './tipo-param.dto.js';

// Son de la plataforma: no dependen de la marca del host.
@Publico()
@Controller('tienda/legales')
export class LegalesTiendaController {
  constructor(private readonly legales: LegalesService) {}

  @Get(':tipo')
  obtener(@Param() { tipo }: TipoParamDto) {
    return this.legales.obtenerPublicado(tipo);
  }
}
