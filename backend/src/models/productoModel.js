import { pool } from '../config/database.js';
import { aplicarPrecioProducto } from '../utils/precios.js';

const campos = `p.id, COALESCE(p.codigo_terra, p.internal_code, p.slug) AS sku, p.slug AS slug,
  p.name AS nombre, p.description AS descripcion, COALESCE(c.name, p.product_group, 'Sin categoría') AS categoria,
  COALESCE(p.public_price, 0) AS precio, COALESCE(p.public_price, 0) AS precio_publico,
  p.precio_mayorista AS precio_mayorista, p.stock_quantity::integer AS stock,
  p.size AS medida, p.color AS detalle, p.imagen_url, COALESCE(p.image_urls, CASE WHEN p.imagen_url IS NULL THEN ARRAY[]::text[] ELSE ARRAY[p.imagen_url] END) AS imagenes, p.video_url, p.colors AS colores, COALESCE(p.activo, p.is_active, TRUE) AS activo`;

export async function listarProductosBD({ buscar = '', categoria = '', pagina = 1, limite = 100, soloActivos = false, esMayorista = false } = {}) {
  const valores = [];
  const condiciones = [];
  if (soloActivos) condiciones.push('COALESCE(p.activo, p.is_active, TRUE) = TRUE');
  if (buscar) { valores.push(`%${buscar}%`); condiciones.push(`(p.name ILIKE $${valores.length} OR COALESCE(p.codigo_terra, p.internal_code, '') ILIKE $${valores.length})`); }
  if (categoria && categoria !== 'Todos') { valores.push(categoria); condiciones.push(`LOWER(COALESCE(c.name, p.product_group, '')) = LOWER($${valores.length})`); }
  valores.push(limite, (pagina - 1) * limite);
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT ${campos} FROM products p LEFT JOIN categories c ON c.id=p.category_id ${where} ORDER BY p.created_at DESC LIMIT $${valores.length - 1} OFFSET $${valores.length}`, valores);
  return rows.map((fila) => aplicarPrecioProducto(fila, esMayorista));
}

const ESTADOS_VENTA = "('completed','entregado')";

async function calcularVentasProducto(productoId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(oi.quantity), 0) AS total_vendido
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN product_variants pv ON pv.id = oi.product_variant_id
     WHERE pv.product_id = $1::uuid
       AND o.status IN ${ESTADOS_VENTA}`,
    [productoId]
  );
  return Number(rows[0]?.total_vendido || 0);
}

async function calcularMaximoVentas() {
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(sub.total), 0) AS max_vendido
     FROM (
       SELECT pv.product_id, COALESCE(SUM(oi.quantity), 0) AS total
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN product_variants pv ON pv.id = oi.product_variant_id
       WHERE o.status IN ${ESTADOS_VENTA}
       GROUP BY pv.product_id
     ) sub`
  );
  return Number(rows[0]?.max_vendido || 0);
}

export async function obtenerProductoBD(id, { esMayorista = false } = {}) {
  const idStr = String(id || '').trim();
  const { rows } = await pool.query(
    `SELECT ${campos} 
     FROM products p 
     LEFT JOIN categories c ON c.id=p.category_id 
     WHERE p.id::text = $1 
        OR p.slug = $1 
        OR COALESCE(p.codigo_terra, p.internal_code) = $1
     LIMIT 1`,
    [idStr]
  );
  const producto = rows[0] ? aplicarPrecioProducto(rows[0], esMayorista) : null;
  if (!producto) return null;
  producto.variantes = await obtenerVariantesBD(producto.id);
  producto.instrucciones = await obtenerInstruccionesBD(producto.id);
  const totalVendido = await calcularVentasProducto(producto.id);
  const maxVendido = await calcularMaximoVentas();
  producto.total_vendido = totalVendido;
  producto.es_mas_vendido = totalVendido > 0 && totalVendido === maxVendido;
  return producto;
}

// Variantes de color/talla ligadas al producto (tabla product_variants).
// Si la tabla no existe en el entorno, devuelve lista vacía sin romper el detalle.
export async function obtenerVariantesBD(productoId) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, sku, size, color, price_publico AS price_minor, currency
       FROM product_variants
       WHERE product_id = $1::uuid AND COALESCE(is_active, TRUE) = TRUE
       ORDER BY created_at ASC`,
      [productoId]
    );
    return rows;
  } catch {
    return [];
  }
}

// Instrucciones del producto (tabla product_instructions). Si la tabla no existe
// en el entorno, devuelve lista vacía sin romper el detalle.
export async function obtenerInstruccionesBD(productoId) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM product_instructions WHERE product_id = $1::uuid',
      [productoId]
    );
    return rows;
  } catch {
    return [];
  }
}

export async function crearProductoBD(datos) {
  const baseSlug = String(datos.nombre || 'producto').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const codigo = String(datos.sku || `TRR-${Date.now()}`).trim();
  const { rows } = await pool.query(
    `INSERT INTO products (name, slug, codigo_terra, description, public_price, stock_quantity, imagen_url, image_urls, video_url, colors, activo, is_active, internal_code, size, color, category_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$3,$12,$13,(SELECT id FROM categories WHERE LOWER(name)=LOWER($14) AND is_active=TRUE LIMIT 1)) RETURNING id`,
    [datos.nombre, `${baseSlug}-${Date.now()}`, codigo, datos.descripcion || null, Number(datos.precio || 0), Number(datos.stock ?? datos.showroom ?? 0), datos.imagen_url || null, Array.isArray(datos.imagenes) ? datos.imagenes : [], datos.video_url || null, Array.isArray(datos.colores) ? datos.colores : [], datos.activo ?? true, datos.medida || null, datos.detalle || null, datos.categoria]
  );
  return obtenerProductoBD(rows[0].id);
}

export async function actualizarProductoBD(id, datos) {
  const idStr = String(id || '').trim();
  const { rows } = await pool.query(
    `UPDATE products 
     SET name=COALESCE($1,name), description=COALESCE($2,description), public_price=COALESCE($3,public_price), stock_quantity=COALESCE($4,stock_quantity), imagen_url=COALESCE($5,imagen_url), image_urls=$6, activo=COALESCE($7,activo), internal_code=COALESCE($8,internal_code), codigo_terra=COALESCE($8,codigo_terra), size=COALESCE($9,size), color=COALESCE($10,color), video_url=$11, colors=$12, category_id=COALESCE((SELECT id FROM categories WHERE LOWER(name)=LOWER($13) AND is_active=TRUE LIMIT 1),category_id), updated_at=NOW() 
     WHERE id::text = $14 OR slug = $14 OR COALESCE(codigo_terra, internal_code) = $14 
     RETURNING id`,
    [datos.nombre, datos.descripcion, datos.precio, datos.stock ?? datos.showroom, datos.imagen_url, Array.isArray(datos.imagenes) ? datos.imagenes : [], datos.activo, datos.sku, datos.medida, datos.detalle, datos.video_url ?? null, Array.isArray(datos.colores) ? datos.colores : [], datos.categoria, idStr]
  );
  return rows[0] ? obtenerProductoBD(rows[0].id) : null;
}

export async function actualizarStockBD(id, { showroom }) {
  const idStr = String(id || '').trim();
  const { rows } = await pool.query(
    `UPDATE products 
     SET stock_quantity=$1, updated_at=NOW() 
     WHERE id::text = $2 OR slug = $2 OR COALESCE(codigo_terra, internal_code) = $2 
     RETURNING id`,
    [Number(showroom ?? 0), idStr]
  );
  return rows[0] ? obtenerProductoBD(rows[0].id) : null;
}

export async function eliminarProductoBD(id) {
  const idStr = String(id || '').trim();
  const conexion = await pool.connect();
  try {
    await conexion.query('BEGIN');
    const objetivo = await conexion.query(
      `SELECT id FROM products
       WHERE id::text = $1 OR slug = $1 OR COALESCE(codigo_terra, internal_code) = $1
       LIMIT 1`,
      [idStr]
    );
    if (!objetivo.rowCount) {
      await conexion.query('ROLLBACK');
      return null;
    }
    const productoId = objetivo.rows[0].id;

    // inventory y cart_items referencian a las variantes con ON DELETE RESTRICT:
    // hay que liberarlos antes de poder borrar el producto.
    await conexion.query(
      `DELETE FROM inventory WHERE product_variant_id IN (SELECT id FROM product_variants WHERE product_id = $1)`,
      [productoId]
    );
    await conexion.query(
      `DELETE FROM cart_items WHERE product_variant_id IN (SELECT id FROM product_variants WHERE product_id = $1)`,
      [productoId]
    );

    // Borrado real. Borra en cascada variantes, imágenes, instrucciones y promociones.
    // Los order_items quedan con product_variant_id = NULL pero conservan nombre/sku/precio:
    // el historial de ventas no se pierde.
    await conexion.query('DELETE FROM products WHERE id = $1', [productoId]);

    await conexion.query('COMMIT');
    return { id: productoId };
  } catch (error) {
    await conexion.query('ROLLBACK');
    throw error;
  } finally {
    conexion.release();
  }
}
