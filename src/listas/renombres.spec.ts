import { renombresDe } from './renombres.js';

describe('renombresDe', () => {
  const guardados = ['Negro', 'Azul', 'Rojo'];

  it('devuelve solo los valores cuyo nombre cambió', () => {
    expect(
      renombresDe(
        [
          { nombre: 'Negro', anterior: 'Negro' },
          { nombre: 'Azul marino', anterior: 'Azul' },
          { nombre: 'Verde' },
        ],
        guardados,
      ),
    ).toEqual([['Azul', 'Azul marino']]);
  });

  it('acepta intercambiar nombres', () => {
    expect(
      renombresDe(
        [
          { nombre: 'Azul', anterior: 'Negro' },
          { nombre: 'Negro', anterior: 'Azul' },
        ],
        guardados,
      ),
    ).toEqual([
      ['Negro', 'Azul'],
      ['Azul', 'Negro'],
    ]);
  });

  it('null si un anterior ya no está guardado', () => {
    expect(
      renombresDe([{ nombre: 'Gris', anterior: 'Blanco' }], guardados),
    ).toBeNull();
  });
});
