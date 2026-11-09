import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { ListasPanelController } from './listas-panel.controller.js';
import { ListasService } from './listas.service.js';

@Module({
  imports: [StorageModule],
  controllers: [ListasPanelController],
  providers: [ListasService],
})
export class ListasModule {}
