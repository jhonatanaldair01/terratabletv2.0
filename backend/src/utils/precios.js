// Normaliza el precio mayorista que vive en products.precio_mayorista.
// Es una columna TEXT y admite valores como "490", "1100", "Bs 490" o "1.100"
// (punto como separador de miles según la convención en Bolivia).
// Devuelve un número en unidades mayores (Bs) o null si no es un precio válido.
export function parsearPrecioMayorista(valor) {
  if (valor === null || valor === undefined) return null;
  let texto = String(valor).trim();
  if (!texto) return null;

  // Quita símbolos, letras y espacios: deja dígitos, separadores y signo.
  texto = texto.replace(/[^\d.,-]/g, '');
  if (!texto) return null;

  const tieneComa = texto.includes(',');
  const tienePunto = texto.includes('.');

  if (tieneComa && tienePunto) {
    // Formato 1.100,50 -> separador de miles y decimal.
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else if (tieneComa) {
    texto = texto.replace(',', '.');
  } else if (tienePunto) {
    const partes = texto.split('.');
    const ultima = partes[partes.length - 1];
    // 1.100 o 1.100.200 -> separadores de miles (sin decimales).
    if (partes.length > 2 || ultima.length === 3) texto = partes.join('');
  }

  const numero = Number(texto);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

// Aplica el precio correspondiente a una fila de producto.
// - esMayorista === true y hay precio_mayorista válido -> usa mayorista.
// - En cualquier otro caso -> precio público (comportamiento normal).
export function aplicarPrecioProducto(fila, esMayorista = false) {
  if (!fila) return fila;
  const publico = Number(fila.precio_publico ?? fila.precio ?? 0);
  const mayorista = parsearPrecioMayorista(fila.precio_mayorista);
  const usarMayorista = Boolean(esMayorista) && mayorista !== null;

  fila.precio_publico = Number.isFinite(publico) ? publico : 0;
  fila.precio_mayorista = mayorista;
  fila.precio = usarMayorista ? mayorista : fila.precio_publico;
  fila.es_precio_mayorista = usarMayorista;
  return fila;
}
