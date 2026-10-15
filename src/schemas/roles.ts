import { z } from 'zod';

export const ROLES = ['ADMIN', 'FABRICANTE'] as const;

export const rolSchema = z.enum(ROLES);

export type Rol = z.infer<typeof rolSchema>;
