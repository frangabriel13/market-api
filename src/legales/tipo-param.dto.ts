import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { tipoTextoLegalSchema } from '../schemas/legales.js';

export class TipoParamDto extends createZodDto(
  z.object({ tipo: tipoTextoLegalSchema }),
) {}
