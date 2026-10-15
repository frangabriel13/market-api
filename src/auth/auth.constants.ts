import type { Rol } from '../generated/prisma/enums.js';

export { REFRESH_COOKIE } from '../schemas/auth.js';

export const ACCESS_TOKEN_DURACION = '15m';
export const REFRESH_TOKEN_DURACION_MS = 30 * 24 * 60 * 60 * 1000;

export interface JwtPayload {
  sub: string;
  rol: Rol;
  marcaId: string | null;
}
