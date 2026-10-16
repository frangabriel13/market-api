import { Module } from '@nestjs/common';
import { CategoriasAdminController } from './categorias-admin.controller.js';
import { CategoriasPanelController } from './categorias-panel.controller.js';
import { CategoriasService } from './categorias.service.js';

@Module({
  controllers: [CategoriasAdminController, CategoriasPanelController],
  providers: [CategoriasService],
  exports: [CategoriasService],
})
export class CategoriasModule {}
