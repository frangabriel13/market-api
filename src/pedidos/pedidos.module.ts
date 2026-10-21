import { Module } from '@nestjs/common';
import { PedidosPanelController } from './pedidos-panel.controller.js';
import { PedidosPanelService } from './pedidos-panel.service.js';
import { PedidosTiendaController } from './pedidos-tienda.controller.js';
import { PedidosTiendaService } from './pedidos-tienda.service.js';

@Module({
  controllers: [PedidosTiendaController, PedidosPanelController],
  providers: [PedidosTiendaService, PedidosPanelService],
})
export class PedidosModule {}
