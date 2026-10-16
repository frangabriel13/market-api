import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { FotosPanelController } from './fotos-panel.controller.js';
import { FotosService } from './fotos.service.js';
import { ProductosPanelController } from './productos-panel.controller.js';
import { ProductosService } from './productos.service.js';

@Module({
  imports: [StorageModule],
  controllers: [ProductosPanelController, FotosPanelController],
  providers: [ProductosService, FotosService],
  exports: [ProductosService],
})
export class ProductosModule {}
