import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('genera un hash argon2id que verifica la contraseña correcta', async () => {
    const passwordHash = await hashPassword('una-contraseña');
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(passwordHash, 'una-contraseña')).toBe(true);
    expect(await verifyPassword(passwordHash, 'otra')).toBe(false);
  });
});
