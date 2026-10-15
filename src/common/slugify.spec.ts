import { slugify } from './slugify.js';

describe('slugify', () => {
  it.each([
    ['Ropa interior', 'ropa-interior'],
    ['Corpiños y Bóxers', 'corpinos-y-boxers'],
    ['  Remeras // Lisas!  ', 'remeras-lisas'],
    ['Talle 2XL', 'talle-2xl'],
  ])('%s → %s', (texto, esperado) => {
    expect(slugify(texto)).toBe(esperado);
  });
});
