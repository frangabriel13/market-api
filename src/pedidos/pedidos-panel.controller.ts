import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { MarcaId, Roles } from '../auth/decorators.js';
import { IdParamDto } from '../common/id-param.dto.js';
import { pedidoEstadoSchema } from '../schemas/pedidos.js';
import { PedidosPanelService } from './pedidos-panel.service.js';

class PedidoEstadoDto extends createZodDto(pedidoEstadoSchema) {}

@Roles('FABRICANTE')
@Controller('panel/pedidos')
export class PedidosPanelController {
  constructor(private readonly pedidos: PedidosPanelService) {}

  @Get()
  listar(@MarcaId() marcaId: string) {
    return this.pedidos.listar(marcaId);
  }

  @Get(':id')
  obtener(@MarcaId() marcaId: string, @Param() { id }: IdParamDto) {
    return this.pedidos.obtener(marcaId, id);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @MarcaId() marcaId: string,
    @Param() { id }: IdParamDto,
    @Body() datos: PedidoEstadoDto,
  ) {
    return this.pedidos.cambiarEstado(marcaId, id, datos);
  }
}
