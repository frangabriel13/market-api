import { randomInt } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// Sin caracteres que se confunden al dictarla o copiarla (0/o, 1/l/i).
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}

// 12 caracteres en grupos de 4 ("k7mq-x4tp-9wzr"): ~59 bits.
export function generatePassword(): string {
  const caracteres = Array.from(
    { length: 12 },
    () => ALFABETO[randomInt(ALFABETO.length)],
  );
  return [0, 4, 8].map((i) => caracteres.slice(i, i + 4).join('')).join('-');
}
