import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { AccesoFabricanteService } from './acceso-fabricante.service.js';
import { MarcasAdminController } from './marcas-admin.controller.js';
import { MarcasPanelController } from './marcas-panel.controller.js';
import { MarcasService } from './marcas.service.js';

@Module({
  imports: [StorageModule],
  controllers: [MarcasAdminController, MarcasPanelController],
  providers: [MarcasService, AccesoFabricanteService],
  exports: [MarcasService],
})
export class MarcasModule {}
