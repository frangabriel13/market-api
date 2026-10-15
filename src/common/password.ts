import { hash, verify } from '@node-rs/argon2';

// argon2id con los parámetros por defecto de la librería.
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}
