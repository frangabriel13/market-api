import { generatePassword, hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('genera un hash argon2id que verifica la contraseña correcta', async () => {
    const passwordHash = await hashPassword('una-contraseña');
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(passwordHash, 'una-contraseña')).toBe(true);
    expect(await verifyPassword(passwordHash, 'otra')).toBe(false);
  });

  it('genera contraseñas legibles y distintas', () => {
    const generadas = new Set(Array.from({ length: 100 }, generatePassword));
    expect(generadas.size).toBe(100);
    for (const password of generadas) {
      expect(password).toMatch(
        /^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/,
      );
    }
  });
});
