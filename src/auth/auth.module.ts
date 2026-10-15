import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import type { Env } from '../config/env.js';
import { EmailModule } from '../email/email.module.js';
import { ACCESS_TOKEN_DURACION } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { RecuperacionController } from './recuperacion.controller.js';
import { RecuperacionService } from './recuperacion.service.js';

@Module({
  imports: [
    EmailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: ACCESS_TOKEN_DURACION },
      }),
    }),
  ],
  controllers: [AuthController, RecuperacionController],
  providers: [
    AuthService,
    RecuperacionService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [JwtModule],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cookieParser()).forRoutes(AuthController);
  }
}
