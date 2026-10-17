import { buscarUsuarioPorAuthId, buscarUsuarioPorEmail, obtenerUsuarioPorId } from '../models/webUserModel.js';
import { loginSupabaseAuth } from '../services/supabaseAuth.js';
import { crearTokenWeb } from '../middlewares/authWeb.js';

function perfilPublico(usuario) {
  return { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol };
}

export async function iniciarSesionWeb(req, res, next) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, mensaje: 'Correo y contraseña son obligatorios' });
    }

    // 1. La contraseña la valida Supabase Auth.
    let auth;
    try {
      auth = await loginSupabaseAuth(email, password);
    } catch (error) {
      return res.status(401).json({ success: false, mensaje: error.message || 'Credenciales inválidas' });
    }

    // 2. El rol y el estado viven en la tabla pública users.
    const usuario = (await buscarUsuarioPorAuthId(auth.id)) || (await buscarUsuarioPorEmail(auth.email || email));
    if (!usuario) {
      return res.status(403).json({ success: false, mensaje: 'La cuenta no tiene un perfil asignado' });
    }
    if (usuario.activo === false) {
      return res.status(403).json({ success: false, mensaje: 'La cuenta está desactivada' });
    }

    return res.json({
      success: true,
      data: { token: crearTokenWeb(usuario), usuario: perfilPublico(usuario) },
    });
  } catch (error) {
    return next(error);
  }
}

export async function perfilWeb(req, res, next) {
  try {
    const usuario = await obtenerUsuarioPorId(req.webUser.sub);
    if (!usuario || usuario.activo === false) {
      return res.status(401).json({ success: false, mensaje: 'Sesión inválida' });
    }
    return res.json({ success: true, data: perfilPublico(usuario) });
  } catch (error) {
    return next(error);
  }
}
