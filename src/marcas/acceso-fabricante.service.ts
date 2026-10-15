import { ConflictException, Injectable } from '@nestjs/common';
import { generatePassword, hashPassword } from '../common/password.js';
import { esConflictoDeUnicidad } from '../prisma/errores.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccesoFabricante } from '../schemas/marcas.js';
import { MarcasService } from './marcas.service.js';

@Injectable()
export class AccesoFabricanteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marcas: MarcasService,
  ) {}

  // Crea el acceso o, si ya existe, le da una contraseña nueva y cierra
  // todas sus sesiones.
  async crearOResetear(
    marcaId: string,
    email: string,
  ): Promise<AccesoFabricante> {
    await this.marcas.asegurarExistencia(marcaId);
    const password = generatePassword();
    const passwordHash = await hashPassword(password);

    await this.prisma.usuario
      .upsert({
        where: { marcaId },
        create: { email, passwordHash, rol: 'FABRICANTE', marcaId },
        update: { email, passwordHash, sesiones: { deleteMany: {} } },
      })
      .catch((error: unknown) => {
        if (esConflictoDeUnicidad(error)) {
          throw new ConflictException('Ese email ya tiene una cuenta');
        }
        throw error;
      });

    return { email, password };
  }
}
