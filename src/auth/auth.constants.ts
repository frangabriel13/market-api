import type { Rol } from '../generated/prisma/enums.js';

export const ACCESS_TOKEN_DURACION = '15m';
export const REFRESH_TOKEN_DURACION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
export const REFRESH_COOKIE = 'refresh_token';

// Contenido del access token (JWT).
export interface JwtPayload {
  sub: string;
  rol: Rol;
  marcaId: string | null;
}
