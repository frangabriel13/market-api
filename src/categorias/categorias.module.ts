import { Module } from '@nestjs/common';
import { CategoriasAdminController } from './categorias-admin.controller.js';
import { CategoriasService } from './categorias.service.js';

@Module({
  controllers: [CategoriasAdminController],
  providers: [CategoriasService],
  exports: [CategoriasService],
})
export class CategoriasModule {}
