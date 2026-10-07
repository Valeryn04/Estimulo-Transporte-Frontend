import { reducirImagen, tamanoLegible } from './imagen';

describe('imagen', () => {
  describe('reducirImagen', () => {
    it('no toca un PDF, aunque pese más del máximo', async () => {
      const pdf = new File([new Uint8Array(3000)], 'a.pdf', { type: 'application/pdf' });
      expect(await reducirImagen(pdf, 1000)).toBe(pdf);
    });

    it('no toca una imagen que ya cabe', async () => {
      const foto = new File([new Uint8Array(500)], 'a.jpg', { type: 'image/jpeg' });
      expect(await reducirImagen(foto, 1000)).toBe(foto);
    });

    it('si no se puede procesar la imagen, la devuelve sin cambios', async () => {
      const rota = new File([new Uint8Array(3000)], 'rota.jpg', { type: 'image/jpeg' });
      expect(await reducirImagen(rota, 1000)).toBe(rota);
    });
  });

  describe('tamanoLegible', () => {
    it('usa KB para lo pequeño y MB con coma decimal para lo grande', () => {
      expect(tamanoLegible(100)).toBe('1 KB');
      expect(tamanoLegible(350_000)).toBe('342 KB');
      expect(tamanoLegible(1_300_000)).toBe('1,2 MB');
    });
  });
});
