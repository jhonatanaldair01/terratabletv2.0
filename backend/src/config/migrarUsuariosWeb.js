import 'dotenv/config';
import { pool } from './database.js';
import { registrarSupabaseAuth, supabaseAuthDisponible, supabaseAdminDisponible, crearUsuarioAdmin, actualizarUsuarioAdmin } from '../services/supabaseAuth.js';

// Usuarios web del kiosco sobre Supabase Auth + tabla pública `users`.
//
// Todo aquí es idempotente y NO destructivo con datos de negocio
// (no toca products/customers/orders). Las funciones se reutilizan desde el
// script de alta de usuarios (src/config/crearUsuario.js).
export const ROLES_PERMITIDOS = ['admin', 'seller', 'warehouse', 'support', 'mayorista'];

const EMAIL_MAYORISTA = String(process.env.MAYORISTA_EMAIL || 'mayorista@gmail.com').trim().toLowerCase();
const PASSWORD_MAYORISTA = String(process.env.MAYORISTA_PASSWORD || '123456');
const NOMBRE_MAYORISTA = String(process.env.MAYORISTA_NOMBRE || 'Mayorista TERRA');

// 1. Garantiza que el CHECK de users.role acepte todos los roles permitidos.
export async function asegurarRolesPermitidos() {
  const { rows } = await pool.query(
    `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid = 'public.users'::regclass AND conname = 'users_role_check'`
  );
  const definicion = rows[0]?.def || '';
  if (ROLES_PERMITIDOS.every((rol) => definicion.includes(`'${rol}'`))) {
    return 'users.role ya admite todos los roles';
  }

  // Los CHECK no admiten parámetros: la lista se interpola desde una constante
  // controlada (nunca proviene de datos de usuario).
  const lista = ['admin', 'seller', 'warehouse', 'support', 'mayorista'].map((rol) => `'${rol}'`).join(', ');
  await pool.query('ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check');
  await pool.query(`ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN (${lista}))`);
  return 'users.role ampliado';
}

// 2. Garantiza que el usuario exista en Supabase Auth y con el correo confirmado.
//
//    Preferencia: API de administración (service_role) -> crea sin correo ni límite.
//    Respaldo:    registro público (signup) -> envía correo, sujeto a límite, y se
//                 confirma de forma controlada por BD (cuenta operativa del negocio).
//
//    Con service_role y { actualizarPassword: true } también fija la contraseña de
//    un usuario que ya existía.
export async function asegurarUsuarioAuth(email, password, { actualizarPassword = false } = {}) {
  const correo = String(email || '').trim().toLowerCase();
  const leer = () => pool.query(
    `SELECT id, email_confirmed_at FROM auth.users WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1`,
    [correo]
  );

  let fila = (await leer()).rows[0] || null;
  let creado = false;
  let metodo = null;
  let passwordActualizada = false;

  if (!fila) {
    if (!password) throw new Error('Se requiere contraseña para crear el usuario en Supabase Auth');
    if (supabaseAdminDisponible()) {
      await crearUsuarioAdmin(correo, password);
      metodo = 'admin';
    } else if (supabaseAuthDisponible()) {
      await registrarSupabaseAuth(correo, password);
      metodo = 'signup';
    } else {
      throw new Error('Falta SUPABASE_URL y una clave (publicable o de servicio) para crear el usuario');
    }
    // Se relee desde la BD para obtener el id real (la respuesta de signup puede
    // venir ofuscada cuando el usuario ya existía).
    fila = (await leer()).rows[0] || null;
    creado = true;
    if (!fila) throw new Error('Supabase Auth no confirmó la creación del usuario');
  } else if (actualizarPassword && password && supabaseAdminDisponible()) {
    await actualizarUsuarioAdmin(fila.id, { password });
    passwordActualizada = true;
  }

  let confirmado = Boolean(fila.email_confirmed_at);
  if (!confirmado) {
    // confirmed_at es columna generada: se actualiza sola con email_confirmed_at.
    await pool.query(
      `UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = $1`,
      [fila.id]
    );
    confirmado = true;
  }

  return { id: fila.id, creado, metodo, confirmado, passwordActualizada };
}

// 3. Crea o actualiza el perfil en public.users ligado al usuario de Auth.
export async function asegurarPerfilPublico(authUserId, { email, nombre, rol, activo = true }) {
  const { rows } = await pool.query(
    `INSERT INTO public.users (auth_user_id, name, email, role, is_active)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (auth_user_id)
     DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active,
                   name = EXCLUDED.name, email = EXCLUDED.email
     RETURNING id, role, is_active`,
    [authUserId, nombre || email, String(email).toLowerCase(), rol, activo]
  );
  return rows[0];
}

// Migración de arranque: configura el usuario mayorista por defecto.
export async function migrarUsuariosWeb() {
  const resultados = [];

  try {
    resultados.push(await asegurarRolesPermitidos());
  } catch (error) {
    console.warn(`[migracion users] no se pudo ajustar users.role: ${error.message}`);
    resultados.push('users.role: omitido');
  }

  try {
    const { id, creado, confirmado } = await asegurarUsuarioAuth(EMAIL_MAYORISTA, PASSWORD_MAYORISTA);
    resultados.push(creado ? 'usuario de Supabase Auth creado' : 'usuario de Supabase Auth ya existía');
    if (confirmado) resultados.push('correo confirmado');
    const perfil = await asegurarPerfilPublico(id, {
      email: EMAIL_MAYORISTA, nombre: NOMBRE_MAYORISTA, rol: 'mayorista', activo: true,
    });
    resultados.push(`public.users (${EMAIL_MAYORISTA}): rol ${perfil?.role}`);
  } catch (error) {
    console.warn(`[migracion users] usuario mayorista: ${error.message}`);
    resultados.push(`usuario mayorista: omitido (${error.message})`);
  }

  return resultados;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').includes('migrarUsuariosWeb.js')) {
  migrarUsuariosWeb()
    .then(async (resultados) => {
      console.log('Migración de usuarios (Supabase Auth + users) finalizada:');
      for (const r of resultados) console.log(` - ${r}`);
      await pool.end();
    })
    .catch(async (error) => {
      console.error('Error en migración de usuarios:', error.message);
      await pool.end();
      process.exit(1);
    });
}
