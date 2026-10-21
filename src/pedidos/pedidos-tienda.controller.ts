import { Body, Controller, Post } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { Publico } from '../auth/decorators.js';
import { pedidoCrearSchema } from '../schemas/pedidos.js';
import { MarcaDeTienda } from '../tienda/marca-de-tienda.js';
import { PedidosTiendaService } from './pedidos-tienda.service.js';

class PedidoCrearDto extends createZodDto(pedidoCrearSchema) {}

@Publico()
@Controller('tienda/pedidos')
export class PedidosTiendaController {
  constructor(private readonly pedidos: PedidosTiendaService) {}

  @Post()
  crear(@MarcaDeTienda() marcaId: string, @Body() datos: PedidoCrearDto) {
    return this.pedidos.crear(marcaId, datos);
  }
}
