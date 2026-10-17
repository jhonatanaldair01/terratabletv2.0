import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, QrCode, ShoppingCart, Trash2, X } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useCarrito } from '../../hooks/useCarrito.js';
import { obtenerProducto } from '../../services/productoService.js';
import { formatoMoneda } from '../../utils/formatoMoneda.js';
import './CarritoFlotante.css';

function esDispositivoMovil() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Extrae el id/param del contenido del QR (URL de la ficha o texto con ?id=).
function idDeCodigoQr(texto) {
  try {
    const url = new URL(texto);
    return url.searchParams.get('id') || url.searchParams.get('producto') || url.searchParams.get('p');
  } catch {
    const m = String(texto).match(/[?&](?:id|producto|p)=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
}

const LECTOR_ID = 'qr-reader';

export default function CarritoFlotante() {
  const [abierto, setAbierto] = useState(false);
  const [escaneoAbierto, setEscaneoAbierto] = useState(false);
  const [qrLeido, setQrLeido] = useState(null);
  const [mostrarAvisoCamara, setMostrarAvisoCamara] = useState(false);
  // inactiva | iniciando | activa | error
  const [camaraEstado, setCamaraEstado] = useState('inactiva');
  const [camaraError, setCamaraError] = useState(null);
  const [mensajeQr, setMensajeQr] = useState(null);
  const [agregandoScan, setAgregandoScan] = useState(false);
  const lectorRef = useRef(null);
  // Código ya procesado: evita que la cámara lo repita en cada frame.
  const codigoRef = useRef(null);
  const { items, cantidadTotal, subtotal, actualizarCantidad, quitarProducto, vaciarCarrito, agregarProducto } = useCarrito();
  const agregarRef = useRef(agregarProducto);
  useEffect(() => { agregarRef.current = agregarProducto; });

  const detenerCamara = async () => {
    const lector = lectorRef.current;
    lectorRef.current = null;
    if (!lector) return;
    try { await lector.stop(); } catch { /* la camara ya estaba detenida */ }
    try { lector.clear(); } catch { /* el lector ya estaba limpio */ }
  };

  const cerrarEscaneo = () => setEscaneoAbierto(false);

  const abrirEscaneo = () => {
    if (!esDispositivoMovil()) {
      setMostrarAvisoCamara(true);
      setTimeout(() => setMostrarAvisoCamara(false), 3000);
      return;
    }
    codigoRef.current = null;
    setMensajeQr(null);
    setAgregandoScan(false);
    setCamaraEstado('inactiva');
    setCamaraError(null);
    setEscaneoAbierto(true);
  };

  const iniciarCamara = async () => {
    setCamaraError(null);
    setCamaraEstado('iniciando');
    // El contenedor se renderiza junto al modal, así que ya existe al tocar el botón.
    if (!document.getElementById(LECTOR_ID)) {
      setCamaraError('No se pudo preparar el visor de la cámara.');
      setCamaraEstado('error');
      return;
    }
    await detenerCamara();
    try {
      const lector = new Html5Qrcode(LECTOR_ID, { verbose: false });
      lectorRef.current = lector;
      await lector.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
        (texto) => {
          if (texto === codigoRef.current) return;
          codigoRef.current = texto;
          setQrLeido(texto);
        },
        () => {}
      );
      setCamaraEstado('activa');
    } catch {
      lectorRef.current = null;
      setCamaraError('No se pudo acceder a la cámara. Revisá los permisos del navegador e intentá de nuevo.');
      setCamaraEstado('error');
    }
  };

  useEffect(() => {
    if (escaneoAbierto) return undefined;
    detenerCamara();
    codigoRef.current = null;
    setMensajeQr(null);
    setAgregandoScan(false);
    setCamaraEstado('inactiva');
    setCamaraError(null);
    return undefined;
  }, [escaneoAbierto]);

  useEffect(() => () => { detenerCamara(); }, []);

  useEffect(() => {
    if (!qrLeido) return undefined;
    const id = idDeCodigoQr(qrLeido);
    setQrLeido(null);
    if (!id) {
      setMensajeQr('⚠️ Ese código no corresponde a un producto.');
      return undefined;
    }
    let activo = true;
    setMensajeQr(null);
    setAgregandoScan(true);
    obtenerProducto(id)
      .then((producto) => {
        if (!activo) return;
        const ok = agregarRef.current(producto, 1);
        setMensajeQr(ok
          ? `✅ ${producto.nombre} agregado al carrito`
          : '⚠️ No se pudo agregar (sin stock).');
      })
      .catch(() => { if (activo) setMensajeQr('⚠️ Producto no encontrado.'); })
      .finally(() => { if (activo) setAgregandoScan(false); });
    return () => { activo = false; };
  }, [qrLeido]);

  return (
    <div className={`cart-widget ${abierto ? 'abierto' : ''}`}>
      {abierto && <button type="button" className="cart-overlay" onClick={() => setAbierto(false)} aria-label="Cerrar carrito" />}

      <aside className="cart-drawer" aria-hidden={!abierto} aria-label="Carrito de compra">
        <header className="cart-drawer-header">
          <div>
            <strong>Tu carrito</strong>
            <small>{cantidadTotal === 0 ? 'Sin productos' : `${cantidadTotal} ${cantidadTotal === 1 ? 'producto' : 'productos'}`}</small>
          </div>
          <button type="button" className="cart-cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar carrito">
            <X size={18} />
          </button>
        </header>

        <div className="cart-drawer-body">
          {items.length === 0 ? (
            <p className="cart-vacio">Tu carrito esta vacio. Agrega productos desde el catalogo.</p>
          ) : (
            items.map((item) => (
              <article className="cart-drawer-item" key={item.lineaId || item.id}>
                <div className="cart-drawer-thumb">
                  {item.imagen_url ? <img src={item.imagen_url} alt={item.nombre} /> : <ShoppingCart size={20} />}
                </div>
                <div className="cart-drawer-info">
                  <b>{item.nombre}</b>
                  {item.color && (
                    <small className="cart-drawer-color">
                      <i style={{ backgroundColor: item.color.valor }} />
                      {item.color.nombre}
                    </small>
                  )}
                  <span>{formatoMoneda(item.precio)} c/u</span>
                  <div className="cart-drawer-qty">
                    <button type="button" onClick={() => actualizarCantidad(item.lineaId || item.id, item.cantidad - 1)} aria-label="Quitar uno">
                      <Minus size={14} />
                    </button>
                    <b>{item.cantidad}</b>
                    <button type="button" onClick={() => actualizarCantidad(item.lineaId || item.id, item.cantidad + 1)} disabled={item.cantidad >= item.stock} aria-label="Agregar uno">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div className="cart-drawer-side">
                  <strong>{formatoMoneda(item.precio * item.cantidad)}</strong>
                  <button type="button" className="cart-drawer-del" onClick={() => quitarProducto(item.lineaId || item.id)} aria-label={`Quitar ${item.nombre}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <footer className="cart-drawer-footer">
          <div className="cart-drawer-total">
            <span>Total</span>
            <strong>{formatoMoneda(subtotal)}</strong>
          </div>
          <Link to="/carrito" className="cart-drawer-ver" onClick={() => setAbierto(false)}>
            Ver Carrito
          </Link>
          {items.length > 0 && (
            <button type="button" className="cart-drawer-vaciar" onClick={vaciarCarrito}>
              Vaciar carrito
            </button>
          )}
        </footer>
      </aside>

      <div className="cart-fabs">
        {!abierto && (
          <button type="button" className="cart-qr" onClick={abrirEscaneo} aria-label="Escanear código QR">
            <QrCode size={18} />
          </button>
        )}
        <button
          type="button"
          className="cart-fab"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-label={abierto ? 'Cerrar carrito' : 'Abrir carrito'}
        >
          {abierto ? <X size={20} /> : <ShoppingCart size={20} />}
          {!abierto && cantidadTotal > 0 && <b className="cart-fab-badge">{cantidadTotal}</b>}
        </button>
      </div>
      {mostrarAvisoCamara && (
        <div className="qr-aviso-flotante">
          Usá un dispositivo con cámara (celular o tablet) para escanear el QR.
        </div>
      )}
      {escaneoAbierto && (
        <div className="qr-modal" role="dialog" aria-modal="true" aria-label="Escanear código QR" onClick={cerrarEscaneo}>
          <div className="qr-modal__panel" onClick={e => e.stopPropagation()}>
            <button type="button" className="qr-modal__close" onClick={cerrarEscaneo} aria-label="Cerrar escáner"><X size={20} /></button>
            <h2 className="qr-modal__title">Escanear código QR</h2>
            <p className="qr-modal__sub">Enfocá el código del producto con la cámara</p>
            <div className="qr-modal__view">
              {camaraEstado === 'inactiva' && <p className="qr-modal__hint">Tocá “Iniciar cámara” para escanear</p>}
              <div id={LECTOR_ID} />
              <div className="qr-modal__frame" />
            </div>
            {camaraEstado === 'inactiva' && (
              <button
                type="button"
                className="camara-iniciar-btn"
                onClick={iniciarCamara}
                aria-label="Iniciar cámara"
              >
                <span className="material-symbols-outlined text-[20px]">camera_alt</span>
                Iniciar cámara
              </button>
            )}
            {camaraEstado === 'iniciando' && <div className="camara-activa">⏳ Iniciando cámara...</div>}
            {camaraEstado === 'activa' && <div className="camara-activa">✅ Cámara activa</div>}
            {camaraError && <div className="camara-error">⚠️ {camaraError}</div>}
            {camaraEstado === 'error' && (
              <button
                type="button"
                className="camara-iniciar-btn"
                onClick={iniciarCamara}
                aria-label="Reintentar cámara"
              >
                <span className="material-symbols-outlined text-[20px]">refresh</span>
                Reintentar
              </button>
            )}
            {agregandoScan && <div className="camara-activa">⏳ Agregando al carrito...</div>}
            {mensajeQr && <p className="qr-modal__ok">{mensajeQr}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
