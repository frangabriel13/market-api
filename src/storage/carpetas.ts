export const carpetaDeMarca = (marcaId: string) => `marcas/${marcaId}`;

export const carpetaDeProducto = (marcaId: string, productoId: string) =>
  `${carpetaDeMarca(marcaId)}/productos/${productoId}`;
