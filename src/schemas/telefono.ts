import { z } from 'zod';

// prettier-ignore
const CARACTERISTICAS_DE_3_DIGITOS = new Set([
  '220', '221', '223', '230', '236', '237', '249', '260', '261', '263', '264',
  '266', '280', '291', '294', '297', '298', '299', '336', '341', '342', '343',
  '345', '348', '351', '353', '358', '362', '364', '370', '376', '379', '380',
  '381', '383', '385', '387', '388',
]);

function largoCaracteristica(nacional: string): number {
  if (nacional.startsWith('11')) return 2;
  return CARACTERISTICAS_DE_3_DIGITOS.has(nacional.slice(0, 3)) ? 3 : 4;
}

// 220 y 2202 son características distintas: se prueban las dos.
function quitar15(digitos: string): string | null {
  const preferido = largoCaracteristica(digitos);
  const largos = preferido === 3 ? [3, 4] : [preferido];
  const largo = largos.find((l) => digitos.slice(l, l + 2) === '15');
  return largo === undefined
    ? null
    : digitos.slice(0, largo) + digitos.slice(largo + 2);
}

// null si no es un número argentino con característica.
export function normalizarTelefono(valor: string): string | null {
  let digitos = valor.replace(/\D/g, '');
  if (digitos.startsWith('54')) {
    digitos = digitos.slice(2);
    if (digitos.startsWith('9')) digitos = digitos.slice(1);
  } else if (digitos.startsWith('0')) {
    digitos = digitos.slice(1);
  }

  const nacional = digitos.length === 12 ? quitar15(digitos) : digitos;
  if (!nacional || !/^[1-3]\d{9}$/.test(nacional)) return null;
  return `549${nacional}`;
}

// De un número normalizado (549…) a "11 5555-5555".
export function formatearTelefono(normalizado: string): string {
  const nacional = normalizado.slice(3);
  const largo = largoCaracteristica(nacional);
  const abonado = nacional.slice(largo);
  return `${nacional.slice(0, largo)} ${abonado.slice(0, -4)}-${abonado.slice(-4)}`;
}

export const telefonoSchema = z.string().transform((valor, ctx) => {
  const normalizado = normalizarTelefono(valor);
  if (!normalizado) {
    ctx.addIssue({
      code: 'custom',
      message: 'Ingresá un teléfono con característica (ej. 11 5555-5555)',
    });
    return z.NEVER;
  }
  return normalizado;
});
