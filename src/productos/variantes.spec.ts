import {
  contarCombinaciones,
  errorDeListas,
  estaAgotado,
  listasDe,
  variantesVigentes,
} from './variantes.js';
import { SIN_VALOR } from '../schemas/productos.js';

const LISTAS = { colores: ['Negro', 'Blanco'], talles: ['S', 'M', 'L'] };

const v = (color: string, talle: string, disponible = true) => ({
  color,
  talle,
  disponible,
});

describe('errorDeListas', () => {
  it('acepta colores y talles de las listas', () => {
    expect(
      errorDeListas([v('Negro', 'S'), v('Blanco', 'L')], LISTAS),
    ).toBeNull();
  });

  it('nombra el color que no está en la lista', () => {
    expect(errorDeListas([v('Rojo', 'S')], LISTAS)).toBe(
      'El color "Rojo" no está en tu lista de colores',
    );
  });

  it('nombra el talle que no está en la lista', () => {
    expect(errorDeListas([v('Negro', 'XL')], LISTAS)).toBe(
      'El talle "XL" no está en la lista del producto',
    );
  });

  it('distingue mayúsculas', () => {
    expect(errorDeListas([v('negro', 'S')], LISTAS)).not.toBeNull();
  });
});

describe('variantesVigentes', () => {
  it('ordena por las listas', () => {
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

  it('oculta las de colores o talles que ya no están en las listas', () => {
    const variantes = [v('Negro', 'S'), v('Rojo', 'S'), v('Negro', 'XL')];
    expect(variantesVigentes(variantes, LISTAS)).toEqual([v('Negro', 'S')]);
  });
});

describe('estaAgotado', () => {
  it('no, si hay una combinación vigente disponible', () => {
    expect(estaAgotado([v('Negro', 'S', false), v('Negro', 'M')], LISTAS)).toBe(
      false,
    );
  });

  it('sí, si solo están disponibles combinaciones que ya no están en las listas', () => {
    expect(estaAgotado([v('Negro', 'S', false), v('Rojo', 'S')], LISTAS)).toBe(
      true,
    );
  });

  it('sí, si no tiene combinaciones', () => {
    expect(estaAgotado([], LISTAS)).toBe(true);
  });
});

describe('contarCombinaciones', () => {
  it('cuenta solo las vigentes', () => {
    const variantes = [
      v('Negro', 'S'),
      v('Negro', 'M', false),
      v('Blanco', 'L', false),
      v('Rojo', 'S', false),
    ];
    expect(contarCombinaciones(variantes, LISTAS)).toEqual({
      combinaciones: 3,
      agotadas: 2,
    });
  });
});

describe('listasDe', () => {
  const marca = { colores: ['Negro'] };
  const listaTalles = { talles: ['S'] };

  it('toma los colores de la marca y los talles de la lista del producto', () => {
    expect(listasDe({ conColores: true, marca, listaTalles })).toEqual({
      colores: ['Negro'],
      talles: ['S'],
    });
  });

  it('sin colores o sin lista, el único valor es SIN_VALOR', () => {
    expect(listasDe({ conColores: false, marca, listaTalles: null })).toEqual({
      colores: [SIN_VALOR],
      talles: [SIN_VALOR],
    });
  });
});

describe('errorDeListas sin colores o sin talles', () => {
  const soloColores = { colores: ['Negro'], talles: [SIN_VALOR] };

  it('acepta las variantes con SIN_VALOR en lo que falta', () => {
    expect(errorDeListas([v('Negro', SIN_VALOR)], soloColores)).toBeNull();
  });

  it('avisa si se manda un talle a un producto sin talles', () => {
    expect(errorDeListas([v('Negro', 'M')], soloColores)).toBe(
      'Este producto no tiene talles',
    );
  });

  it('avisa si falta el valor en un producto que lo tiene', () => {
    expect(errorDeListas([v(SIN_VALOR, SIN_VALOR)], soloColores)).toBe(
      'Falta el color de una combinación',
    );
  });
});
