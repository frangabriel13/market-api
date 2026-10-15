import { Module } from '@nestjs/common';
import { MarcasModule } from '../marcas/marcas.module.js';
import { OpcionesEntregaAdminController } from './opciones-entrega-admin.controller.js';
import { OpcionesEntregaService } from './opciones-entrega.service.js';

@Module({
  imports: [MarcasModule],
  controllers: [OpcionesEntregaAdminController],
  providers: [OpcionesEntregaService],
})
export class OpcionesEntregaModule {}
