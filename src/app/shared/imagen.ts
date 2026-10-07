/**
 * Las fotos tomadas con el teléfono suelen pesar más que el máximo permitido. Antes de enviarlas se reducen
 * (se redimensionan y se comprimen como JPG) hasta que quepan, para que la persona no tenga que hacerlo a mano.
 * Los PDF y las imágenes que ya caben no se tocan.
 */
export async function reducirImagen(archivo: File, maxBytes: number): Promise<File> {
  if (!archivo.type.startsWith('image/') || archivo.size <= maxBytes) return archivo;
  if (typeof createImageBitmap !== 'function') return archivo;
  try {
    const imagen = await createImageBitmap(archivo);
    let ancho = imagen.width;
    let alto = imagen.height;
    const lado = Math.max(ancho, alto);
    // Primero el tamaño: más de 2400 px por lado no aporta legibilidad a un documento.
    if (lado > 2400) {
      ancho = Math.round((ancho * 2400) / lado);
      alto = Math.round((alto * 2400) / lado);
    }
    for (const calidad of [0.85, 0.75, 0.65, 0.5]) {
      const lienzo = document.createElement('canvas');
      lienzo.width = ancho;
      lienzo.height = alto;
      const ctx = lienzo.getContext('2d');
      if (!ctx) return archivo;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, ancho, alto);
      ctx.drawImage(imagen, 0, 0, ancho, alto);
      const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, 'image/jpeg', calidad));
      if (blob && blob.size <= maxBytes) {
        return new File([blob], archivo.name.replace(/\.[A-Za-z0-9]+$/, '') + '.jpg', {
          type: 'image/jpeg',
        });
      }
      ancho = Math.round(ancho * 0.85);
      alto = Math.round(alto * 0.85);
    }
    return archivo;
  } catch {
    return archivo;
  }
}

/** «1,2 MB» o «350 KB». */
export function tamanoLegible(bytes: number): string {
  return bytes < 1_048_576
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} MB`;
}
