// Recorta el fondo (conectado a los bordes) a transparente mediante flood fill.
// Si la imagen ya viene con fondo transparente, se respeta sin cambios.
export function quitarFondo(lienzo) {
  const ctx = lienzo.getContext('2d');
  const w = lienzo.width;
  const h = lienzo.height;
  const datos = ctx.getImageData(0, 0, w, h);
  const px = datos.data;
  const esquinas = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
  if (esquinas.every((i) => px[i + 3] < 10)) return;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const i of esquinas) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
  r /= esquinas.length; g /= esquinas.length; b /= esquinas.length;
  const tol = 28;
  const esFondo = (i) => Math.abs(px[i] - r) <= tol && Math.abs(px[i + 1] - g) <= tol && Math.abs(px[i + 2] - b) <= tol;
  const visto = new Uint8Array(w * h);
  const pila = [];
  for (let x = 0; x < w; x += 1) { pila.push(x, 0, x, h - 1); }
  for (let y = 0; y < h; y += 1) { pila.push(0, y, w - 1, y); }
  while (pila.length) {
    const y = pila.pop();
    const x = pila.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const pos = y * w + x;
    if (visto[pos]) continue;
    const i = pos * 4;
    if (!esFondo(i)) continue;
    visto[pos] = 1;
    px[i + 3] = 0;
    pila.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  ctx.putImageData(datos, 0, 0);
}

// Descarga una imagen y devuelve un data URL PNG con el fondo recortado.
// Se usa para recortar fotos ya subidas (sin necesidad de volver a subirlas).
export function recortarFondoDeUrl(url, maximo = 900) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error('URL vacía'));
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${url}`));
    img.onload = () => {
      try {
        const escala = Math.min(1, maximo / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const w = Math.max(1, Math.round((img.naturalWidth || 1) * escala));
        const h = Math.max(1, Math.round((img.naturalHeight || 1) * escala));
        const lienzo = document.createElement('canvas');
        lienzo.width = w;
        lienzo.height = h;
        const ctx = lienzo.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        quitarFondo(lienzo);
        resolve(lienzo.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.src = url;
  });
}
