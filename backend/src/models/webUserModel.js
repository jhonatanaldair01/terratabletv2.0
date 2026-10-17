import { pool } from '../config/database.js';

// Perfiles de la tabla pública `users`, vinculados 1:1 con Supabase Auth
// (users.auth_user_id -> auth.users.id).
const CAMPOS = 'id, auth_user_id, name AS nombre, email, role AS rol, is_active AS activo';

export async function buscarUsuarioPorAuthId(authUserId) {
  if (!authUserId) return null;
  const { rows } = await pool.query(
    `SELECT ${CAMPOS} FROM users WHERE auth_user_id = $1 LIMIT 1`,
    [authUserId]
  );
  return rows[0] || null;
}

export async function buscarUsuarioPorEmail(email) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS} FROM users WHERE LOWER(email) = LOWER($1) ORDER BY created_at ASC LIMIT 1`,
    [String(email || '').trim()]
  );
  return rows[0] || null;
}

export async function obtenerUsuarioPorId(id) {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM users WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] || null;
}
