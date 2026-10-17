import 'dotenv/config';

// Cliente mínimo de Supabase Auth (API REST de GoTrue).
//
// - Clave pública (publicable/anon): valida contraseñas en el login y sirve como
//   respaldo para registrar usuarios (envía correo de confirmación y tiene límite).
// - Clave de servicio (service_role): permite crear/editar usuarios por la API de
//   administración SIN enviar correos ni topar el límite. Es OPCIONAL; si no está,
//   se usa el registro público + confirmación controlada del correo.
const URL_BASE = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const CLAVE = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '');
const CLAVE_SERVICIO = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
);

export function supabaseAuthDisponible() {
  return Boolean(URL_BASE && CLAVE);
}

export function supabaseAdminDisponible() {
  return Boolean(URL_BASE && CLAVE_SERVICIO);
}

function cabeceras(clave = CLAVE) {
  return { apikey: clave, Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' };
}

async function leerJson(respuesta) {
  try { return await respuesta.json(); } catch { return null; }
}

function mensajeDeError(datos, alterno) {
  const codigo = datos?.error_code || datos?.error;
  const texto = datos?.msg || datos?.message || datos?.error_description || alterno;
  if (codigo === 'invalid_credentials') return 'Credenciales inválidas';
  if (codigo === 'email_not_confirmed') return 'El correo aún no está confirmado';
  if (codigo === 'user_banned') return 'La cuenta está bloqueada';
  if (/rate limit/i.test(String(texto))) {
    return 'Supabase limitó el envío de correos de confirmación. Configurá '
      + 'SUPABASE_SERVICE_ROLE_KEY en backend/.env para crear usuarios sin enviar correos.';
  }
  return texto;
}

// Verifica usuario/contraseña contra Supabase Auth. Devuelve { id, email } del
// usuario de auth o lanza un Error con un mensaje apto para el usuario final.
export async function loginSupabaseAuth(email, password) {
  if (!supabaseAuthDisponible()) {
    throw new Error('Falta configurar SUPABASE_URL y la clave publicable en el backend');
  }
  let respuesta;
  try {
    respuesta = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: cabeceras(),
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error('No se pudo conectar con Supabase Auth');
  }
  const datos = await leerJson(respuesta);
  if (!respuesta.ok) {
    throw new Error(mensajeDeError(datos, 'No se pudo iniciar sesión'));
  }
  return { id: datos?.user?.id, email: datos?.user?.email || email };
}

// Crea el usuario por la API de administración (requiere service_role).
// No envía correos y deja el correo confirmado de una vez.
export async function crearUsuarioAdmin(email, password) {
  if (!supabaseAdminDisponible()) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY para usar la API de administración');
  }
  const respuesta = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: cabeceras(CLAVE_SERVICIO),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const datos = await leerJson(respuesta);
  if (!respuesta.ok) {
    throw new Error(mensajeDeError(datos, 'No se pudo crear el usuario en Supabase Auth'));
  }
  return { id: datos?.id, email: datos?.email || email };
}

// Actualiza datos del usuario por la API de administración (requiere service_role).
export async function actualizarUsuarioAdmin(id, cambios = {}) {
  if (!supabaseAdminDisponible()) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY para usar la API de administración');
  }
  const respuesta = await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    headers: cabeceras(CLAVE_SERVICIO),
    body: JSON.stringify(cambios),
  });
  const datos = await leerJson(respuesta);
  if (!respuesta.ok) {
    throw new Error(mensajeDeError(datos, 'No se pudo actualizar el usuario en Supabase Auth'));
  }
  return datos;
}

// Registra el usuario con el endpoint público. Envía correo de confirmación y está
// sujeto al límite de correos de Supabase (por eso el respaldo con service_role).
export async function registrarSupabaseAuth(email, password) {
  if (!supabaseAuthDisponible()) {
    throw new Error('Falta configurar SUPABASE_URL y la clave publicable en el backend');
  }
  const respuesta = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({ email, password }),
  });
  const datos = await leerJson(respuesta);
  if (!respuesta.ok) {
    throw new Error(mensajeDeError(datos, 'No se pudo registrar el usuario en Supabase Auth'));
  }
  return { id: datos?.id, email: datos?.email || email };
}
