import { BadRequestException } from '@nestjs/common';
import {
  createZodValidationPipe,
  type ZodValidationPipe as ZodValidationPipeBase,
} from 'nestjs-zod';
import { ZodError } from 'zod';

// Valida todo @Body/@Query/@Param tipado con un DTO de createZodDto.
// Responde 400 con { statusCode, message, errors } (errors: issues de zod).
export const ZodValidationPipe: typeof ZodValidationPipeBase =
  createZodValidationPipe({
    createValidationException: (error: unknown) =>
      new BadRequestException({
        statusCode: 400,
        message: 'Datos inválidos',
        errors: error instanceof ZodError ? error.issues : undefined,
      }),
  });
