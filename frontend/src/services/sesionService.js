import { API_URL, WEB_TOKEN_KEY } from './api.js';

// La sesión web se guarda en sessionStorage (no localStorage): la terminal es
// compartida, así que la sesión no debe sobrevivir al cierre de la pestaña.
const USUARIO_KEY = 'terra_web_usuario';

export function getTokenWeb() {
  try { return sessionStorage.getItem(WEB_TOKEN_KEY); } catch { return null; }
}

export function getUsuarioWeb() {
  try { const crudo = sessionStorage.getItem(USUARIO_KEY); return crudo ? JSON.parse(crudo) : null; } catch { return null; }
}

export function esMayoristaWeb() {
  return getUsuarioWeb()?.rol === 'mayorista';
}

function guardarSesionWeb(token, usuario) {
  try {
    sessionStorage.setItem(WEB_TOKEN_KEY, token);
    sessionStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
  } catch { /* sin almacenamiento */ }
}

export function cerrarSesionWeb() {
  try {
    sessionStorage.removeItem(WEB_TOKEN_KEY);
    sessionStorage.removeItem(USUARIO_KEY);
  } catch { /* sin almacenamiento */ }
}

export async function iniciarSesionWeb(email, password) {
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error('No se pudo conectar al backend. Comprueba que esté encendido.');
  }
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok || datos?.success === false) {
    throw new Error(datos?.mensaje || 'No se pudo iniciar sesión');
  }
  const { token, usuario } = datos.data;
  guardarSesionWeb(token, usuario);
  return usuario;
}

export async function obtenerPerfilWeb() {
  const token = getTokenWeb();
  if (!token) return null;
  try {
    const respuesta = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok || datos?.success === false) { cerrarSesionWeb(); return null; }
    const usuario = datos.data;
    try { sessionStorage.setItem(USUARIO_KEY, JSON.stringify(usuario)); } catch { /* noop */ }
    return usuario;
  } catch {
    return getUsuarioWeb();
  }
}
