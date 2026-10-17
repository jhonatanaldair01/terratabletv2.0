import { createHmac, timingSafeEqual } from 'node:crypto';

// Sesión de usuario web (kiosco) firmada con HMAC. Es independiente de la sesión
// de administrador para no mezclar roles.
function secreto() {
  return process.env.WEB_TOKEN_SECRET || process.env.ADMIN_TOKEN_SECRET || '';
}

function firma(payload) {
  return createHmac('sha256', secreto()).update(payload).digest('base64url');
}

export function crearTokenWeb(usuario, horas = 12) {
  const payload = Buffer.from(JSON.stringify({
    sub: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    tipo: 'web',
    exp: Date.now() + horas * 60 * 60 * 1000,
  })).toString('base64url');
  return `${payload}.${firma(payload)}`;
}

function leerToken(token) {
  if (!token || !secreto()) return null;
  const [payload, firmaRecibida] = token.split('.');
  if (!payload || !firmaRecibida) return null;
  const esperada = firma(payload);
  try {
    const valido = firmaRecibida.length === esperada.length
      && timingSafeEqual(Buffer.from(firmaRecibida), Buffer.from(esperada));
    if (!valido) return null;
    const datos = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (datos.tipo !== 'web' || !datos.exp || datos.exp < Date.now()) return null;
    return datos;
  } catch {
    return null;
  }
}

// Autenticación obligatoria: corta la petición si no hay sesión válida.
export function authWeb(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const datos = leerToken(token);
  if (!datos) return res.status(401).json({ success: false, mensaje: 'Sesión requerida o vencida' });
  req.webUser = datos;
  return next();
}

// Autenticación opcional: si hay token válido deja req.webUser disponible,
// si no, continúa como invitado. Nunca bloquea la petición.
export function authWebOpcional(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const datos = leerToken(token);
  if (datos) req.webUser = datos;
  return next();
}
