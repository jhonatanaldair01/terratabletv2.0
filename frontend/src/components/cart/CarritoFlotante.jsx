import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, QrCode, ShoppingCart, Trash2, X } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useCarrito } from '../../hooks/useCarrito.js';
import { formatoMoneda } from '../../utils/formatoMoneda.js';
import './CarritoFlotante.css';

function esDispositivoMovil() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export default function CarritoFlotante() {
  const [abierto, setAbierto] = useState(false);
  const [escaneoAbierto, setEscaneoAbierto] = useState(false);
  const [qrLeido, setQrLeido] = useState(null);
  const [mostrarAvisoCamara, setMostrarAvisoCamara] = useState(false);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [camaraError, setCamaraError] = useState(null);
  const [camaraIniciada, setCamaraIniciada] = useState(false);
  const scannerRef = useRef(null);
  const navigate = useNavigate();
  const { items, cantidadTotal, subtotal, actualizarCantidad, quitarProducto, vaciarCarrito } = useCarrito();

  const abrirEscaneo = () => {
    if (!esDispositivoMovil()) {
      setMostrarAvisoCamara(true);
      setTimeout(() => setMostrarAvisoCamara(false), 3000);
      return;
    }
    setEscaneoAbierto(true);
  };

  useEffect(() => {
    if (!escaneoAbierto || !camaraActiva) return undefined;
    setCamaraError(null);
    let scanner;
    try {
      scanner = new Html5QrcodeScanner("qr-reader", {
        fps: 20,
        qrbox: 200,
        aspectRatio: 1.0,
        showTorchButton: true,
        showFlipCameraButton: true,
        disableFlip: false,
      }, false);
    } catch {
      setCamaraError("No se pudo inicializar el lector QR.");
      setCamaraActiva(false);
      return undefined;
    }
    scannerRef.current = scanner;
    try {
      scanner.render(
        (decodedText) => { setQrLeido(decodedText); },
        () => {}
      ).catch(() => {
        setCamaraError("No se pudo acceder a la cámara. Verifica los permisos.");
        setCamaraActiva(false);
      });
    } catch {
      setCamaraError("No se pudo iniciar el escáner. Verifica los permisos de cámara.");
      setCamaraActiva(false);
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().then(() => { scannerRef.current = null; }).catch(() => {});
      }
      setCamaraActiva(false);
      setCamaraIniciada(false);
      setCamaraError(null);
    };
  }, [escaneoAbierto, camaraActiva]);

  useEffect(() => {
    if (!qrLeido) return;
    let id = null;
    try {
      const url = new URL(qrLeido);
      id = url.searchParams.get('id') || url.searchParams.get('producto') || url.searchParams.get('p');
    } catch {
      const m = String(qrLeido).match(/[?&](?:id|producto|p)=([^&]+)/);
      id = m ? m[1] : null;
    }
    if (id) {
      setEscaneoAbierto(false);
      setQrLeido(null);
      navigate(`/productos/${id}`);
    }
  }, [qrLeido, navigate]);

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
          <button type="button" className="cart-qr" onClick={abrirEscaneo} aria-label="Escanear código QR" hidden>
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
        <div className="qr-modal" role="dialog" aria-modal="true" aria-label="Escanear código QR" onClick={() => setEscaneoAbierto(false)}>
          <div className="qr-modal__panel" onClick={e => e.stopPropagation()}>
            <button type="button" className="qr-modal__close" onClick={() => setEscaneoAbierto(false)} aria-label="Cerrar escáner"><X size={20} /></button>
            <h2 className="qr-modal__title">Escanear código QR</h2>
            <p className="qr-modal__sub">Enfocá el código del producto con la cámara</p>
            {!camaraIniciada && (
              <button
                type="button"
                className="camara-iniciar-btn"
                onClick={() => { setCamaraIniciada(true); setCamaraActiva(true); }}
                aria-label="Iniciar cámara"
              >
                <span className="material-symbols-outlined text-[20px]">camera_alt</span>
                Iniciar cámara
              </button>
            )}
            {camaraIniciada && !camaraError && !camaraActiva && (
              <div className="camara-activa">⏳ Iniciando cámara...</div>
            )}
            {camaraError && <div className="camara-error">⚠️ {camaraError}</div>}
            {camaraIniciada && !camaraError && camaraActiva && (
              <>
                <div className="camara-activa">✅ Cámara activa</div>
                <div className="qr-modal__view"><div id="qr-reader" /></div>
              </>
            )}
            <div className="qr-modal__frame" />
            {qrLeido && <p className="qr-modal__ok">Código leído: <b>{qrLeido}</b></p>}
          </div>
        </div>
      )}
    </div>
  );
}
