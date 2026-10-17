import { pool } from '../config/database.js';

function nombreValido(valor) {
  return String(valor ?? '').trim().replace(/\s+/g, ' ');
}

function slugificar(valor) {
  return String(valor ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'categoria';
}

export async function crearCategoria(req, res, next) {
  try {
    const nombre = nombreValido(req.body?.nombre);
    if (!nombre) return res.status(400).json({ success: false, mensaje: 'El nombre de la categoría es obligatorio.' });
    const { rows } = await pool.query(
      `INSERT INTO categories (name, slug, is_active) VALUES ($1, $2, TRUE) RETURNING id, name AS nombre, is_active AS activo`,
      [nombre, `${slugificar(nombre)}-${Date.now()}`]
    );
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, mensaje: 'Ya existe una categoría con ese nombre.' });
    next(error);
  }
}

export async function actualizarCategoria(req, res, next) {
  try {
    const nombre = nombreValido(req.body?.nombre);
    if (!nombre) return res.status(400).json({ success: false, mensaje: 'El nombre de la categoría es obligatorio.' });
    const { rows } = await pool.query(
      `UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name AS nombre, is_active AS activo`,
      [nombre, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, mensaje: 'Categoría no encontrada.' });
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, mensaje: 'Ya existe una categoría con ese nombre.' });
    next(error);
  }
}

export async function eliminarCategoria(req, res, next) {
  try {
    const { rows: asociadas } = await pool.query('SELECT COUNT(*)::integer AS total FROM products WHERE category_id = $1', [req.params.id]);
    if (Number(asociadas[0]?.total || 0) > 0) return res.status(409).json({ success: false, mensaje: 'No puedes eliminar una categoría que tiene productos asociados.' });
    const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, mensaje: 'Categoría no encontrada.' });
    return res.json({ success: true, data: { id: req.params.id } });
  } catch (error) { next(error); }
}

export async function listarCategorias(req, res, next) {
  try {
    const resultado = await pool.query(`
      SELECT c.id, c.name AS nombre, COUNT(p.id)::integer AS total, MIN(p.imagen_url) AS imagen_url
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND COALESCE(p.activo, p.is_active, TRUE) = TRUE
      WHERE c.is_active = TRUE
      GROUP BY c.id, c.name
      ORDER BY total DESC, c.name ASC
    `);

    const categoriasConIcono = resultado.rows.map((row) => {
      const n = row.nombre.toLowerCase();
      let icon = 'category';
      let emoji = '📦';

      if (n.includes('colch')) { icon = 'bed'; emoji = '🛏️'; }
      else if (n.includes('somm') || n.includes('somier')) { icon = 'layers'; emoji = '🛋️'; }
      else if (n.includes('cama') || n.includes('dorm')) { icon = 'bedroom_parent'; emoji = '🛏️'; }
      else if (n.includes('almohad')) { icon = 'hotel'; emoji = '☁️'; }
      else if (n.includes('ropa') || n.includes('saban') || n.includes('textil')) { icon = 'texture'; emoji = '🧺'; }
      else if (n.includes('mueble') || n.includes('living') || n.includes('sofa')) { icon = 'chair'; emoji = '🪑'; }
      else if (n.includes('espald') || n.includes('cabec') || n.includes('respald')) { icon = 'vertical_split'; emoji = '🖼️'; }
      else if (n.includes('recamier') || n.includes('banquet')) { icon = 'weekend'; emoji = '🛋️'; }
      else if (n.includes('promo')) { icon = 'star'; emoji = '⭐'; }

      return {
        id: row.id,
        nombre: row.nombre,
        total: row.total,
        icon,
        emoji,
        imagen_url: row.imagen_url,
      };
    });

    return res.json({
      success: true,
      data: categoriasConIcono,
    });
  } catch (error) {
    next(error);
  }
}
