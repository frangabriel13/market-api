import sharp from 'sharp';
import { generarMiniatura, LADO_MINIATURA } from './miniatura.js';

const imagen = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: '#c00' },
  })
    .jpeg()
    .toBuffer();

describe('generarMiniatura', () => {
  it('achica a WebP sin pasarse del lado máximo y conserva la proporción', async () => {
    const miniatura = await generarMiniatura(await imagen(2000, 1000));
    const { format, width, height } = await sharp(miniatura!).metadata();
    expect(format).toBe('webp');
    expect(width).toBe(LADO_MINIATURA);
    expect(height).toBe(LADO_MINIATURA / 2);
  });

  it('no agranda imágenes chicas', async () => {
    const miniatura = await generarMiniatura(await imagen(200, 300));
    const { width, height } = await sharp(miniatura!).metadata();
    expect([width, height]).toEqual([200, 300]);
  });

  it('devuelve null si el archivo no es una imagen', async () => {
    expect(await generarMiniatura(Buffer.from('no soy una imagen'))).toBeNull();
  });
});
