import sharp from 'sharp';

export const LADO_MINIATURA = 480;

// null si el archivo no es una imagen.
export async function generarMiniatura(imagen: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(imagen)
      .rotate()
      .resize({
        width: LADO_MINIATURA,
        height: LADO_MINIATURA,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toBuffer();
  } catch {
    return null;
  }
}
