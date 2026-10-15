import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { recuperarSchema, restablecerSchema } from '../schemas/auth.js';
import { Publico } from './decorators.js';
import { RecuperacionService } from './recuperacion.service.js';

class RecuperarDto extends createZodDto(recuperarSchema) {}
class RestablecerDto extends createZodDto(restablecerSchema) {}

@Publico()
@Controller('auth')
export class RecuperacionController {
  constructor(private readonly recuperacion: RecuperacionService) {}

  @Post('recuperar')
  @HttpCode(HttpStatus.NO_CONTENT)
  recuperar(@Body() { email }: RecuperarDto) {
    return this.recuperacion.solicitar(email);
  }

  @Post('restablecer')
  @HttpCode(HttpStatus.NO_CONTENT)
  restablecer(@Body() { token, password }: RestablecerDto) {
    return this.recuperacion.restablecer(token, password);
  }
}
