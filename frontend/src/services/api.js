export const API_URL = String(
  // public/config.js (window.TERRA_CONFIG) manda si está definido: así la app
  // y la ficha QR (detalle-qr.html) usan la misma URL sin recompilar.
  (typeof window !== 'undefined' && window.TERRA_CONFIG?.API_URL) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3001/api'
).trim().replace(/\/$/, '');

export const MODO_DEMO = import.meta.env.VITE_MODO_DEMO === 'true';

// Clave de sesión del usuario web (kiosco). La sesión de administrador usa otra
// clave distinta (terra_admin_token) para no mezclar roles.
export const WEB_TOKEN_KEY = 'terra_web_token';

function tokenWeb() {
  try { return sessionStorage.getItem(WEB_TOKEN_KEY); } catch { return null; }
}

// Conexión al chat de n8n (nodo "When chat message received").
// La URL se define ÚNICAMENTE en public/config.js (window.TERRA_CONFIG),
// que se carga en tiempo de ejecución y se puede editar en el despliegue sin recompilar.
export const N8N_CHAT_URL = String(
  (typeof window !== 'undefined' && window.TERRA_CONFIG?.N8N_CHAT_URL) || ''
).trim().replace(/\/$/, '');

export async function apiRequest(ruta, { method = 'GET', body, signal } = {}) {
  const token = tokenWeb();
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No se pudo conectar al backend. Comprueba que esté encendido.');
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok || datos?.success === false) {
    throw new Error(datos?.mensaje || `Error HTTP ${respuesta.status}`);
  }
  return datos?.data ?? datos;
}
