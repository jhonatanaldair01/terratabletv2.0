import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { pool } from './database.js';
import {
  ROLES_PERMITIDOS,
  asegurarRolesPermitidos,
  asegurarUsuarioAuth,
  asegurarPerfilPublico,
} from './migrarUsuariosWeb.js';

// Alta / actualización de usuarios del kiosco (Supabase Auth + tabla public.users).
//
// Uso:
//   node src/config/crearUsuario.js --email=ana@terra.bo --password=secreto123 --rol=mayorista --nombre="Ana Pérez"
//   node src/config/crearUsuario.js ana@terra.bo secreto123 mayorista "Ana Pérez"
//   npm run usuario -- --email=ana@terra.bo --password=secreto123 --rol=mayorista
//
// Si se omite algún dato, se pide por consola. Roles válidos: admin, seller,
// warehouse, support, mayorista.
// Flags: --inactivo (crea/actualiza inactivo), --cambiar-password (fija la
// contraseña de un usuario ya existente; requiere SUPABASE_SERVICE_ROLE_KEY).
const USO = `
Alta de usuario TERRA (Supabase Auth + public.users)

  node src/config/crearUsuario.js --email=<correo> --password=<clave> --rol=<rol> [--nombre="Nombre"] [--inactivo] [--cambiar-password]

O en orden posicional:
  node src/config/crearUsuario.js <correo> <clave> [rol] [nombre]

Roles válidos: ${ROLES_PERMITIDOS.join(', ')}

Notas:
  - Si el usuario ya existe en Supabase Auth, por defecto NO se cambia su contraseña
    (solo el perfil). Usá --cambiar-password para fijarla (necesita SUPABASE_SERVICE_ROLE_KEY).
  - El correo se confirma automáticamente (cuenta operativa del negocio).
  - Recomendado: definir SUPABASE_SERVICE_ROLE_KEY en backend/.env. Sin ella, el alta
    usa el registro público de Supabase, que envía correo y tiene límite de envíos.
`;

function analizarArgumentos(argv) {
  const opciones = { activo: true, cambiarPassword: false };
  const posicionales = [];
  for (const arg of argv) {
    const limpio = arg.trim();
    if (!limpio) continue;
    if (limpio.startsWith('--')) {
      const [clave, ...resto] = limpio.slice(2).split('=');
      const valor = resto.join('=');
      const k = clave.toLowerCase();
      if (k === 'email' || k === 'correo') opciones.email = valor;
      else if (k === 'password' || k === 'contrasena' || k === 'clave') opciones.password = valor;
      else if (k === 'rol' || k === 'role') opciones.rol = valor;
      else if (k === 'nombre' || k === 'name') opciones.nombre = valor;
      else if (k === 'inactivo') opciones.activo = false;
      else if (k === 'cambiar-password' || k === 'cambiar-contrasena') opciones.cambiarPassword = true;
      else if (k === 'activo') opciones.activo = !['false', '0', 'no'].includes((valor || '').toLowerCase());
      else if (k === 'ayuda' || k === 'help') opciones.ayuda = true;
      else { console.error(`Opción desconocida: ${arg}`); opciones.ayuda = true; }
    } else {
      posicionales.push(limpio);
    }
  }
  if (!opciones.email && posicionales[0]) opciones.email = posicionales[0];
  if (!opciones.password && posicionales[1]) opciones.password = posicionales[1];
  if (!opciones.rol && posicionales[2]) opciones.rol = posicionales[2];
  if (!opciones.nombre && posicionales[3]) opciones.nombre = posicionales[3];
  return opciones;
}

// Lee una contraseña sin mostrarla (si hay TTY). En entornos sin TTY usa readline.
function preguntarOculto(pregunta) {
  const stdin = process.stdin;
  const stdout = process.stdout;
  if (!stdin.isTTY) return null;

  return new Promise((resolve) => {
    stdout.write(pregunta);
    const modoPrevio = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    let valor = '';
    const alRecibir = (chunk) => {
      const texto = chunk.toString('utf8');
      for (const c of texto) {
        if (c === '\n' || c === '\r' || c === '\u0004') {
          stdin.removeListener('data', alRecibir);
          stdin.setRawMode(modoPrevio || false);
          stdin.pause();
          stdout.write('\n');
          return resolve(valor);
        }
        if (c === '\u0003') { // Ctrl+C
          stdout.write('\n');
          process.exit(130);
        }
        if (c === '\u007f' || c === '\b') { valor = valor.slice(0, -1); continue; }
        valor += c;
      }
    };
    stdin.on('data', alRecibir);
  });
}

function esCorreoValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function nombrePorDefecto(email) {
  const base = String(email).split('@')[0].replace(/[._-]+/g, ' ').trim();
  return base ? base.replace(/\b\w/g, (l) => l.toUpperCase()) : 'Usuario TERRA';
}

async function principal() {
  const opciones = analizarArgumentos(process.argv.slice(2));
  if (opciones.ayuda) {
    console.log(USO);
    return;
  }

  // Valida lo que ya vino por argumento antes de preguntar nada (así un dato mal
  // escrito no obliga a pasar por todos los prompts).
  if (opciones.email && !esCorreoValido(opciones.email)) {
    throw new Error(`Correo inválido: ${opciones.email}`);
  }
  if (opciones.rol && !ROLES_PERMITIDOS.includes(String(opciones.rol).trim().toLowerCase())) {
    throw new Error(`Rol inválido: ${opciones.rol}. Válidos: ${ROLES_PERMITIDOS.join(', ')}`);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (!opciones.email) opciones.email = await rl.question('Correo electrónico: ');
    if (!opciones.password) {
      const oculto = await preguntarOculto('Contraseña: ');
      if (oculto !== null) opciones.password = oculto;
      else {
        rl.pause();
        opciones.password = await rl.question('Contraseña (visible): ');
      }
    }
    if (!opciones.rol) {
      const respuesta = await rl.question(`Rol [${ROLES_PERMITIDOS.join('/')}] (mayorista): `);
      opciones.rol = respuesta.trim() || 'mayorista';
    }
    if (!opciones.nombre) {
      const respuesta = await rl.question(`Nombre (${nombrePorDefecto(opciones.email)}): `);
      opciones.nombre = respuesta.trim() || nombrePorDefecto(opciones.email);
    }
  } finally {
    rl.close();
  }

  const email = String(opciones.email).trim().toLowerCase();
  const rol = String(opciones.rol || '').trim().toLowerCase();
  const password = String(opciones.password || '');

  if (!esCorreoValido(email)) throw new Error(`Correo inválido: ${email}`);
  if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
  if (!ROLES_PERMITIDOS.includes(rol)) throw new Error(`Rol inválido: ${rol}. Válidos: ${ROLES_PERMITIDOS.join(', ')}`);

  console.log('\nConfigurando usuario…');
  await asegurarRolesPermitidos();
  const { id, creado, metodo, confirmado, passwordActualizada } = await asegurarUsuarioAuth(
    email, password, { actualizarPassword: opciones.cambiarPassword }
  );
  const perfil = await asegurarPerfilPublico(id, {
    email, nombre: opciones.nombre, rol, activo: opciones.activo,
  });

  const via = metodo === 'admin' ? ' (API de administración)' : metodo === 'signup' ? ' (registro público)' : '';
  console.log('');
  console.log(`  Supabase Auth : ${creado ? `creado${via}` : 'ya existía'} (id ${id})`);
  console.log(`  Correo        : ${confirmado ? 'confirmado' : 'sin confirmar'}`);
  console.log(`  public.users  : ${perfil?.role} · ${opciones.activo ? 'activo' : 'inactivo'}`);
  console.log(`  Nombre        : ${opciones.nombre}`);
  if (!creado && !passwordActualizada) {
    console.log('  Aviso         : la contraseña no se modificó (usá --cambiar-password para fijarla).');
  }

  const todos = await pool.query(
    `SELECT email, role, is_active, created_at FROM public.users ORDER BY created_at`
  );
  console.log('\nUsuarios en public.users:');
  console.table(todos.rows);
}

principal()
  .catch((error) => {
    console.error(`\nError: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
