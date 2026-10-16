import { Controller, Get } from '@nestjs/common';
import { MarcaId, Roles } from '../auth/decorators.js';
import { MarcasService } from './marcas.service.js';

@Roles('FABRICANTE')
@Controller('panel/marca')
export class MarcasPanelController {
  constructor(private readonly marcas: MarcasService) {}

  @Get()
  obtener(@MarcaId() marcaId: string) {
    return this.marcas.obtenerParaPanel(marcaId);
  }
}
