import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { ZodValidationPipe } from './common/zod-validation.pipe.js';
import { validateEnv } from './config/env.js';
import { loggerConfig } from './config/logger.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: loggerConfig,
    }),
    PrismaModule,
    AuthModule,
  ],
  providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
