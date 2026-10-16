import { errorDeListas, variantesVigentes } from './variantes.js';

const LISTAS = { colores: ['Negro', 'Blanco'], talles: ['S', 'M', 'L'] };

const v = (color: string, talle: string, disponible = true) => ({
  color,
  talle,
  disponible,
});

describe('errorDeListas', () => {
  it('acepta colores y talles de la marca', () => {
    expect(
      errorDeListas([v('Negro', 'S'), v('Blanco', 'L')], LISTAS),
    ).toBeNull();
  });

  it('nombra el color que no está en la lista', () => {
    expect(errorDeListas([v('Rojo', 'S')], LISTAS)).toBe(
      'El color "Rojo" no está en la lista de la marca',
    );
  });

  it('nombra el talle que no está en la lista', () => {
    expect(errorDeListas([v('Negro', 'XL')], LISTAS)).toBe(
      'El talle "XL" no está en la lista de la marca',
    );
  });

  it('distingue mayúsculas', () => {
    expect(errorDeListas([v('negro', 'S')], LISTAS)).not.toBeNull();
  });
});

describe('variantesVigentes', () => {
  it('ordena por las listas de la marca', () => {
    const desordenadas = [
      v('Blanco', 'M'),
      v('Negro', 'L'),
      v('Blanco', 'S'),
      v('Negro', 'S'),
    ];
    expect(
      variantesVigentes(desordenadas, LISTAS).map(
        (x) => `${x.color} ${x.talle}`,
      ),
    ).toEqual(['Negro S', 'Negro L', 'Blanco S', 'Blanco M']);
  });

  it('oculta las de colores o talles que ya no están en la marca', () => {
    const variantes = [v('Negro', 'S'), v('Rojo', 'S'), v('Negro', 'XL')];
    expect(variantesVigentes(variantes, LISTAS)).toEqual([v('Negro', 'S')]);
  });
});
