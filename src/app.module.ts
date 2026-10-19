import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { CategoriasModule } from './categorias/categorias.module.js';
import { ZodValidationPipe } from './common/zod-validation.pipe.js';
import { validateEnv } from './config/env.js';
import { loggerConfig } from './config/logger.js';
import { MarcasModule } from './marcas/marcas.module.js';
import { OpcionesEntregaModule } from './opciones-entrega/opciones-entrega.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProductosModule } from './productos/productos.module.js';
import { TiendaModule } from './tienda/tienda.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: loggerConfig,
    }),
    PrismaModule,
    AuthModule,
    MarcasModule,
    OpcionesEntregaModule,
    CategoriasModule,
    ProductosModule,
    TiendaModule,
  ],
  providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
