import { BadRequestException } from '@nestjs/common';
import {
  createZodValidationPipe,
  type ZodValidationPipe as ZodValidationPipeBase,
} from 'nestjs-zod';
import { ZodError } from 'zod';

export const ZodValidationPipe: typeof ZodValidationPipeBase =
  createZodValidationPipe({
    createValidationException: (error: unknown) =>
      new BadRequestException({
        statusCode: 400,
        message: 'Datos inválidos',
        errors: error instanceof ZodError ? error.issues : undefined,
      }),
  });
