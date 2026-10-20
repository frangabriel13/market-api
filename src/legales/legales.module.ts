import { Module } from '@nestjs/common';
import { LegalesAdminController } from './legales-admin.controller.js';
import { LegalesTiendaController } from './legales-tienda.controller.js';
import { LegalesService } from './legales.service.js';

@Module({
  controllers: [LegalesAdminController, LegalesTiendaController],
  providers: [LegalesService],
  exports: [LegalesService],
})
export class LegalesModule {}
