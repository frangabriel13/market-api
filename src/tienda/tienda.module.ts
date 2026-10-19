import { Module } from '@nestjs/common';
import { CategoriasModule } from '../categorias/categorias.module.js';
import { ProductosTiendaService } from './productos-tienda.service.js';
import { TiendaController } from './tienda.controller.js';
import { TiendaService } from './tienda.service.js';

@Module({
  imports: [CategoriasModule],
  controllers: [TiendaController],
  providers: [TiendaService, ProductosTiendaService],
})
export class TiendaModule {}
