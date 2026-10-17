import { apiRequest, MODO_DEMO } from './api.js';

export function normalizarProducto(producto) {
  const precio = Number(producto.precio || 0);
  const showroom = Number(producto.showroom ?? producto.stock ?? 0);
  const imagenes = Array.isArray(producto.imagenes) && producto.imagenes.length ? producto.imagenes : (producto.imagen_url ? [producto.imagen_url] : []);
  return {
    ...producto,
    id: producto.id,
    sku: producto.sku || `TRR-${producto.id}`,
    precio,
    precioPublico: producto.precio_publico != null ? Number(producto.precio_publico) : precio,
    esPrecioMayorista: producto.es_precio_mayorista === true,
    precioOriginal: producto.precio_original ? Number(producto.precio_original) : null,
    showroom,
    bodega: Number(producto.bodega ?? 0),
    stock: Number(producto.stock ?? showroom),
    imagenes,
    imagen_url: imagenes[0] || null,
    video_url: producto.video_url ? String(producto.video_url).trim() : null,
    visible: producto.activo !== false,
    activo: producto.activo !== false,
    detalle: producto.detalle || producto.medida || '',
    descripcion: producto.descripcion || '',
    categoria: producto.categoria || 'Sin categoría',
    variantes: Array.isArray(producto.variantes) ? producto.variantes : [],
    totalVendido: Number(producto.total_vendido ?? 0),
    esMasVendido: producto.es_mas_vendido === true,
  };
}
function exigirConexionReal() { if (MODO_DEMO) throw new Error('El modo demostración está activo. Configura VITE_MODO_DEMO=false para usar PostgreSQL.'); }
export async function listarProductos({ buscar = '', categoria = '', pagina = 1, limite = 100, todos = false, signal } = {}) { exigirConexionReal(); const p = new URLSearchParams({ pagina, limite }); if (buscar) p.set('buscar', buscar); if (categoria && categoria !== 'Todos') p.set('categoria', categoria); if (todos) p.set('todos', 'true'); const r = await apiRequest(`/productos?${p}`, { signal }); return (Array.isArray(r) ? r : r?.data || []).map(normalizarProducto); }
export async function obtenerProducto(id) { exigirConexionReal(); return normalizarProducto(await apiRequest(`/productos/${id}`)); }
export async function crearProducto(datos) { exigirConexionReal(); return normalizarProducto(await apiRequest('/productos', { method: 'POST', body: datos })); }
export async function actualizarProducto(id, datos) { exigirConexionReal(); return normalizarProducto(await apiRequest(`/productos/${id}`, { method: 'PUT', body: datos })); }
export async function actualizarStock(id, datos) { exigirConexionReal(); return normalizarProducto(await apiRequest(`/productos/${id}/stock`, { method: 'PATCH', body: datos })); }
export async function eliminarProducto(id) { exigirConexionReal(); return apiRequest(`/productos/${id}`, { method: 'DELETE' }); }
export async function listarCategorias({ signal } = {}) { try { const r = await apiRequest('/categorias', { signal }); return Array.isArray(r) ? r : r?.data || []; } catch { return []; } }
export async function crearCategoria(datos) { exigirConexionReal(); return apiRequest('/categorias', { method: 'POST', body: datos }); }
export async function actualizarCategoria(id, datos) { exigirConexionReal(); return apiRequest(`/categorias/${id}`, { method: 'PUT', body: datos }); }
export async function eliminarCategoria(id) { exigirConexionReal(); return apiRequest(`/categorias/${id}`, { method: 'DELETE' }); }
