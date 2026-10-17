import { useEffect, useRef, useState } from 'react';
import {
  BrowserRouter, Routes, Route, Navigate, Link,
  NavLink, Outlet, useNavigate, useLocation, useSearchParams,
} from 'react-router-dom';
import { ShoppingCart, Store, Search, Plus, Minus, Trash2, ArrowRight, CheckCircle2, PackageOpen, Home, Package, Tags, Headphones, RotateCcw, Timer, UserRound } from 'lucide-react';
import { useCarrito } from '../hooks/useCarrito.js';
import { useProductos } from '../hooks/useProductos.js';
import { ClienteContext } from '../context/ClienteContext.jsx';
import { SesionContext } from '../context/SesionContext.jsx';
import { useContext } from 'react';
import { categorias, emojiCategoria } from '../data/categorias.js';
import { formatoMoneda } from '../utils/formatoMoneda.js';
import { validarDatosCliente } from '../utils/validaciones.js';
import { crearCliente } from '../services/clienteService.js';
import { crearPedido } from '../services/pedidoService.js';
import { MODO_DEMO } from '../services/api.js';
import { listarProductos } from '../services/productoService.js';
import Bienvenida from '../pages/Bienvenida.jsx';
import Categorias from '../pages/Categorias.jsx';
import DetalleProducto from '../pages/DetalleProducto.jsx';
import CarritoPage from '../pages/CarritoPage.jsx';
import IdentificacionPage from '../pages/Identificacion.jsx';
import ConfirmacionPage from '../pages/Confirmacion.jsx';
import PedidoGeneradoPage from '../pages/PedidoGenerado.jsx';
import Catalogo from '../pages/Catalogo.jsx';
import AdminLayout from '../components/admin/AdminLayout.jsx';
import DashboardAdmin from '../pages/admin/DashboardAdmin.jsx';
import ProductosAdmin from '../pages/admin/ProductosAdmin.jsx';
import PedidosAdmin from '../pages/admin/PedidosAdmin.jsx';
import ClientesAdmin from '../pages/admin/ClientesAdmin.jsx';
import CategoriasAdmin from '../pages/admin/CategoriasAdmin.jsx';
import LoginAdmin from '../pages/admin/LoginAdmin.jsx';
import RutaAdmin from '../components/admin/RutaAdmin.jsx';
import ChatAsistente from '../components/chat/ChatAsistente.jsx';
import CarritoFlotante from '../components/cart/CarritoFlotante.jsx';
import WebAccountModal from '../components/WebAccountModal.jsx';
import './Layout.css';
import './NavigationFix.css';
import './ClienteTheme.css';
import '../Responsive.css';
import './HeaderOptionsHidden.css';

function Layout() {
  const { cantidadTotal, items, actualizarPrecios } = useCarrito();
  const { usuario, esMayorista } = useContext(SesionContext);
  const [cuentaAbierta, setCuentaAbierta] = useState(false);
  const [clicsLogo, setClicsLogo] = useState(0);
  const temporizadorLogo = useRef(null);
  const navigate = useNavigate();

  // Al iniciar o cerrar sesión mayorista, refresca los precios del carrito para
  // que el resumen y el ticket coincidan con el precio vigente, sin perder artículos.
  useEffect(() => {
    if (!items.length) return undefined;
    let cancelado = false;
    listarProductos({ limite: 200 })
      .then((lista) => {
        if (cancelado) return;
        const mapa = {};
        for (const p of lista) mapa[String(p.id)] = Number(p.precio);
        actualizarPrecios(mapa);
      })
      .catch(() => { /* sin conexión: se conservan los precios actuales */ });
    return () => { cancelado = true; };
  }, [esMayorista, items.length, actualizarPrecios]);

  // Easter egg: 5 toques seguidos en el logo/casa abren el panel admin.
  const tocarLogo = (evento) => {
    clearTimeout(temporizadorLogo.current);
    const siguiente = clicsLogo + 1;
    if (siguiente >= 5) {
      evento.preventDefault();
      setClicsLogo(0);
      navigate('/admin/login');
      return;
    }
    setClicsLogo(siguiente);
    temporizadorLogo.current = setTimeout(() => setClicsLogo(0), 1500);
  };

  return (
    <div className="app-shell">
      <header className="site-header terra-header">
        {/* Espaciador para centrar el logo; el grupo derecho lleva carrito, casa y sesión */}
        <div className="header-spacer" />
        <Link to="/" className="brand terra-logo" title="TERRA Autoservicio" onClick={tocarLogo}>
          <img src="/logo-terra.png" alt="TERRA Autoservicio" />
        </Link>
        <div className="header-grupo-derecho">
          <NavLink to="/catalogo" className="terra-catalog-link">
            <Package size={17} />
            <span>Catálogo de Productos</span>
          </NavLink>
          <NavLink to="/carrito" className="cart-link terra-cart-link">
            <ShoppingCart size={18} />
            <span>Carrito</span>
            {cantidadTotal > 0 && <b>{cantidadTotal}</b>}
          </NavLink>
          <NavLink to="/" end className="terra-home-btn" title="Inicio" onClick={tocarLogo}>
            <Home size={18} />
          </NavLink>
          <button type="button" className="terra-login-button" aria-haspopup="dialog" aria-expanded={cuentaAbierta} onClick={() => setCuentaAbierta(true)} title={usuario ? `${usuario.nombre || usuario.email}${esMayorista ? ' · Mayorista' : ''}` : 'Iniciar sesión'}><UserRound size={19} /><span>{usuario ? (esMayorista ? 'Mayorista' : (String(usuario.nombre || '').split(' ')[0] || 'Mi cuenta')) : 'Iniciar sesión'}</span></button>
        </div>
      </header>
      {cuentaAbierta && <WebAccountModal onClose={() => setCuentaAbierta(false)} />}

      {MODO_DEMO && (
        <div className="demo-banner">
          MODO DEMOSTRACIÓN: precios y pedidos simulados para exhibición showroom.
        </div>
      )}

      {esMayorista && (
        <div className="mayorista-banner">
          Sesión mayorista activa · catálogo completo con precios de mayorista.
        </div>
      )}

      <main className="page-content">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation (< 640px) */}
      <nav className="mobile-bottom-nav" aria-label="Navegación móvil">
        <NavLink to="/catalogo" className="mobile-nav-item">
          <Package size={20} />
          <span>Catálogo</span>
        </NavLink>
        <NavLink to="/categorias" className="mobile-nav-item">
          <Tags size={20} />
          <span>Categorías</span>
        </NavLink>
        <NavLink to="/carrito" className="mobile-nav-item mobile-cart-item">
          <div className="mobile-cart-icon-wrap">
            <ShoppingCart size={20} />
            {cantidadTotal > 0 && <span className="mobile-cart-badge">{cantidadTotal}</span>}
          </div>
          <span>Carrito</span>
        </NavLink>
        <NavLink to="/" end className="mobile-nav-item">
          <Home size={20} />
          <span>Inicio</span>
        </NavLink>
      </nav>

        <footer className="site-footer">
          <div>TERRA AUTOSERVICIO · Sucursal 1 Central, Santa Cruz</div>
          <small>Terminal táctil optimizado para celular, tablet y PC</small>
        </footer>

      <div className="fabs-stack">
        <CarritoFlotante />
        <ChatAsistente />
      </div>
    </div>
  );
}




function Confirmacion() {
  const { items, subtotal, vaciarCarrito } = useCarrito();
  const { cliente, limpiarCliente } = useContext(ClienteContext);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const clienteRegistradoRef = useRef(null);
  const enviandoRef = useRef(false);
  const navigate = useNavigate();
  if (items.length === 0) return <Navigate to="/carrito" replace />;

  async function confirmarPedido() {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setProcesando(true);
    setError('');
    try {
      let clienteId = null;
      if (cliente.nombre.trim()) {
        if (!clienteRegistradoRef.current) {
          clienteRegistradoRef.current = await crearCliente(cliente);
        }
        clienteId = clienteRegistradoRef.current?.id ?? null;
      }
      const pedido = await crearPedido({ clienteId, items: items.map((item) => ({ productoId: item.id, cantidad: item.cantidad })) });
      vaciarCarrito();
      limpiarCliente();
      navigate('/pedido', { replace: true, state: { pedido } });
    } catch (err) {
      setError(err.message);
    } finally {
      enviandoRef.current = false;
      setProcesando(false);
    }
  }

  return (
    <section className="narrow-page"><h1>Confirmar pedido</h1>
      <div className="form-card"><h2>Resumen de compra</h2>
        {items.map((item) => <div className="receipt-row" key={item.id}><span>{item.cantidad} × {item.nombre}</span><b>{formatoMoneda(item.cantidad * item.precio)}</b></div>)}
        <div className="summary"><span>Total</span><strong>{formatoMoneda(subtotal)}</strong></div>
        <p className="muted">Cliente: {cliente.nombre || 'Invitado'}</p>
        <p className="muted">Forma de pago: en caja (no se cobra desde esta pantalla).</p>
        {error && <p className="error-box" role="alert">{error}</p>}
        <button className="btn btn-primary btn-large" type="button" disabled={procesando} onClick={confirmarPedido}>{procesando ? 'Generando pedido...' : 'Generar pedido'} <ArrowRight size={20} /></button>
        <Link className="btn btn-ghost" to="/carrito">Volver al carrito</Link>
      </div>
    </section>
  );
}

function PedidoGenerado() {
  const location = useLocation();
  const pedido = location.state?.pedido;
  if (!pedido) return <Navigate to="/" replace />;
  return (
    <section className="success-page"><CheckCircle2 size={70} className="success-icon" />
      <h1>{pedido.demo ? 'Pedido de demostración' : '¡Pedido generado!'}</h1>
      <p>{pedido.demo ? 'Esta operación es una simulación y no se guardó en el servidor.' : 'Muestra este código en caja para realizar el pago.'}</p>
      <div className="code-card"><span>Código de pedido</span><strong>{pedido.codigo}</strong><span>Total: {formatoMoneda(pedido.total)}</span></div>
      <Link to="/" className="btn btn-primary btn-large">Nueva compra</Link>
    </section>
  );
}

function NoEncontrado() {
  return <div className="empty-state"><h1>Página no encontrada</h1><Link className="btn btn-primary" to="/">Volver al inicio</Link></div>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="admin/login" element={<LoginAdmin />} />
        <Route path="admin" element={<RutaAdmin><AdminLayout /></RutaAdmin>}>
          <Route index element={<DashboardAdmin />} />
          <Route path="productos" element={<ProductosAdmin />} />
          <Route path="categorias" element={<CategoriasAdmin />} />
          <Route path="pedidos" element={<PedidosAdmin />} />
          <Route path="clientes" element={<ClientesAdmin />} />
        </Route>
        <Route element={<Layout />}>
          <Route index element={<Bienvenida />} />
          <Route path="categorias" element={<Categorias />} />
          <Route path="catalogo" element={<Catalogo />} />
          <Route path="productos/:id" element={<DetalleProducto />} />
          <Route path="carrito" element={<CarritoPage />} />
          <Route path="identificacion" element={<IdentificacionPage />} />
          <Route path="confirmacion" element={<ConfirmacionPage />} />
          <Route path="pedido" element={<PedidoGeneradoPage />} />
          <Route path="pedido/:id" element={<PedidoGeneradoPage />} />
          <Route path="*" element={<NoEncontrado />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
