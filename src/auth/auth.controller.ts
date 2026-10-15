import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import type { Env } from '../config/env.js';
import { loginSchema, type Sesion } from '../schemas/auth.js';
import { REFRESH_COOKIE } from './auth.constants.js';
import { AuthService, type ResultadoAuth } from './auth.service.js';
import { Publico } from './decorators.js';

class LoginDto extends createZodDto(loginSchema) {}

@Publico()
@Controller('auth')
export class AuthController {
  // Path "/" porque el navegador la recibe a través del proxy /api del front.
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieOptions = {
      httpOnly: true,
      secure: config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'lax',
      path: '/',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Sesion> {
    return this.responder(await this.auth.login(body), res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Sesion> {
    try {
      return this.responder(await this.auth.refresh(this.cookie(req)), res);
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE, this.cookieOptions);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(this.cookie(req));
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions);
  }

  private cookie(req: Request): string | undefined {
    const valor: unknown = req.cookies?.[REFRESH_COOKIE];
    return typeof valor === 'string' ? valor : undefined;
  }

  private responder(resultado: ResultadoAuth, res: Response): Sesion {
    res.cookie(REFRESH_COOKIE, resultado.refreshToken, {
      ...this.cookieOptions,
      expires: resultado.refreshExpiraEn,
    });
    return resultado.sesion;
  }
}
