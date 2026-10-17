import { useContext, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, LogOut, LockKeyhole, Mail, ShieldCheck, UserRound, X } from 'lucide-react';
import { SesionContext } from '../context/SesionContext.jsx';
import './WebAccountModal.css';

export default function WebAccountModal({ onClose }) {
  const { usuario, esMayorista, iniciarSesion, cerrarSesion } = useContext(SesionContext);
  const [crearCuenta, setCrearCuenta] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async (event) => {
    event.preventDefault();
    if (crearCuenta) {
      setMensaje('La creación de cuentas estará disponible próximamente.');
      return;
    }
    setCargando(true);
    setMensaje('');
    try {
      await iniciarSesion(email.trim(), password);
      onClose();
    } catch (err) {
      setMensaje(err.message || 'No se pudo iniciar sesión');
    } finally {
      setCargando(false);
    }
  };

  const salir = () => {
    cerrarSesion();
    onClose();
  };

  return (
    <div
      className="account-modal"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="account-modal__panel" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <header>
          <div><img src="/logo-terra.png" alt="TERRA" /><i /><b id="account-title">Mi cuenta</b></div>
          <button type="button" aria-label="Cerrar" onClick={onClose}><X size={20} /></button>
        </header>

        {usuario ? (
          <div className="account-modal__session">
            <div className="account-modal__avatar"><UserRound size={30} /></div>
            <b className="account-modal__name">{usuario.nombre || usuario.email}</b>
            <span className="account-modal__email">{usuario.email}</span>
            {esMayorista && (
              <span className="account-modal__role">
                <CheckCircle2 size={14} /> Precios de mayorista activos
              </span>
            )}
            <p className="account-modal__session-note">
              {esMayorista
                ? 'Estás viendo el catálogo completo con precios de mayorista.'
                : 'Sesión activa en esta terminal.'}
            </p>
            <button className="account-modal__submit" type="button" onClick={salir}>
              <LogOut size={17} /> Cerrar sesión
            </button>
          </div>
        ) : (
          <>
            <div className="account-modal__tabs">
              <button type="button" className={!crearCuenta ? 'active' : ''} onClick={() => { setCrearCuenta(false); setMensaje(''); }}>Iniciar sesión</button>
              <button type="button" className={crearCuenta ? 'active' : ''} onClick={() => { setCrearCuenta(true); setMensaje(''); }}>Crear cuenta</button>
            </div>
            <form onSubmit={enviar}>
              {crearCuenta && <label>Nombre completo<input required placeholder="Tu nombre y apellido" /></label>}
              <label>
                Correo electrónico
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ej. mayorista@gmail.com"
                  autoComplete="username"
                />
                <Mail size={16} />
              </label>
              <label>
                Contraseña
                {!crearCuenta && (
                  <button
                    className="account-modal__forgot"
                    type="button"
                    onClick={() => setMensaje('La recuperación de contraseña estará disponible próximamente.')}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
                <input
                  required
                  minLength="6"
                  type={verClave ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <LockKeyhole size={16} />
                <button
                  className="account-modal__eye"
                  type="button"
                  aria-label="Mostrar u ocultar contraseña"
                  onClick={() => setVerClave((actual) => !actual)}
                >
                  {verClave ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </label>
              {!crearCuenta && (
                <div className="account-modal__options">
                  <label><input type="checkbox" /> Recordar mi sesión</label>
                  <small><ShieldCheck size={13} /> Conexión segura</small>
                </div>
              )}
              {mensaje && <p className="account-modal__message" role="status">{mensaje}</p>}
              <button className="account-modal__submit" type="submit" disabled={cargando}>
                {cargando ? 'Ingresando…' : (crearCuenta ? 'Crear cuenta' : 'Iniciar sesión')}
              </button>
            </form>
          </>
        )}

        <footer>Tus pedidos, cotizaciones y garantías estarán disponibles desde tu cuenta TERRA.</footer>
      </section>
    </div>
  );
}
