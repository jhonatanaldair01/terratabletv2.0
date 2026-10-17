import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

export const CarritoContext = createContext(null);

// El carrito se guarda por pestaña (sessionStorage): sobrevive a las recargas
// completas que ocurren al escanear varios QR en el mismo celular
// (detalle-qr.html -> /productos/:id?agregar=1), pero NO se comparte entre
// pestañas ni entre dispositivos, así cada persona tiene su propio carrito.
const CLAVE_CARRITO = 'terra_carrito';

function carritoGuardado() {
  try {
    const lista = JSON.parse(sessionStorage.getItem(CLAVE_CARRITO) || '[]');
    if (!Array.isArray(lista)) return [];
    return lista.filter((item) => item && typeof item === 'object' && item.lineaId && item.id
      && Number.isFinite(Number(item.precio)) && Number.isFinite(Number(item.cantidad)));
  } catch {
    return [];
  }
}

export function CarritoProvider({ children }) {
  const [items, setItems] = useState(carritoGuardado);

  useEffect(() => {
    try {
      if (items.length) sessionStorage.setItem(CLAVE_CARRITO, JSON.stringify(items));
      else sessionStorage.removeItem(CLAVE_CARRITO);
    } catch { /* sin almacenamiento */ }
  }, [items]);

  const agregarProducto = useCallback((producto, cantidad = 1, opcion = {}) => {
    const id = String(producto?.id || '').trim();
    const precio = Number(producto?.precio);
    const stock = Number(producto?.stock);
    const unidades = Number(cantidad);

    if (!id || !Number.isFinite(precio) ||
        !Number.isSafeInteger(unidades) || unidades < 1 ||
        !Number.isSafeInteger(stock) || stock < 1) return false;

    const color = opcion?.color ? { nombre: opcion.color.nombre, valor: opcion.color.valor } : null;
    const lineaId = `${id}::${color?.valor || color?.nombre || 'sin-color'}`;
    const existente = items.find((item) => item.lineaId === lineaId);
    const actual = existente?.cantidad ?? 0;
    const nuevaCantidad = Math.min(Math.floor(stock), actual + unidades);
    if (nuevaCantidad === actual) return false;

    setItems((anterior) => {
      const encontrado = anterior.some((item) => item.lineaId === lineaId);
      return encontrado
        ? anterior.map((item) => item.lineaId === lineaId ? { ...item, cantidad: nuevaCantidad } : item)
        : [...anterior, {
            id, nombre: producto.nombre, precio, stock: Math.floor(stock),
            categoria: producto.categoria, imagen_url: producto.imagen_url,
            color, lineaId, cantidad: nuevaCantidad,
          }];
    });
    return true;
  }, [items]);

  const quitarProducto = useCallback((lineaId) => {
    setItems((anterior) => anterior.filter((item) => item.lineaId !== String(lineaId)));
  }, []);

  const actualizarCantidad = useCallback((lineaId, cantidad) => {
    const n = Number(cantidad);
    if (!Number.isSafeInteger(n)) return;
    setItems((anterior) => anterior
      .map((item) => item.lineaId === String(lineaId)
        ? { ...item, cantidad: Math.min(Math.max(0, n), item.stock) }
        : item)
      .filter((item) => item.cantidad > 0));
  }, []);

  const vaciarCarrito = useCallback(() => setItems([]), []);

  const valor = useMemo(() => {
    const cantidadTotal = items.reduce((suma, item) => suma + item.cantidad, 0);
    const centavos = items.reduce(
      (suma, item) => suma + Math.round(item.precio * 100) * item.cantidad, 0
    );
    const subtotal = centavos / 100;
    return {
      items, cantidadTotal, subtotal, total: subtotal,
      agregarProducto, quitarProducto, actualizarCantidad, vaciarCarrito,
    };
  }, [items, agregarProducto, quitarProducto, actualizarCantidad, vaciarCarrito]);

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}
