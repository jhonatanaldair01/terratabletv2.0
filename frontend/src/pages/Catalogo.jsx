import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCarrito } from '../hooks/useCarrito.js';
import { listarProductos, listarCategorias } from '../services/productoService.js';
import { SesionContext } from '../context/SesionContext.jsx';
import { formatoMoneda } from '../utils/formatoMoneda.js';
import { obtenerIconoCategoria } from '../data/categorias.js';
import './Catalogo.css';

const CATEGORIAS_CONFIG = [
  { id: '', nombre: 'Todos', icon: 'apps' },
];

const MEDIDAS_CONFIG = [
  { id: 'King', label: 'King (200x200)' },
  { id: 'Queen', label: 'Queen (160x200)' },
  { id: '2 Plazas', label: '2 Plazas (140x190)' },
  { id: '1.5 Plazas', label: '1.5 Plazas' },
];

const FIRMEZAS_CONFIG = [
  { id: 'Suave', label: 'Suave' },
  { id: 'Media', label: 'Media' },
  { id: 'Firme Ortopédica', label: 'Firme Ortopédica' },
];

// Tonos registrados por el admin en products.colors (JSON {nombre, valor,...}).
// Si el producto no tiene colores, devuelve [] para no mostrar la fila de tonos.
const coloresDeProducto = (producto) => {
  const registros = Array.isArray(producto?.colores) ? producto.colores : [];
  const lista = [];
  const vistos = new Set();
  for (const registro of registros) {
    let nombre = '';
    let valor = '';
    if (registro && typeof registro === 'object') {
      nombre = String(registro.nombre || registro.name || '').trim();
      valor = String(registro.valor || registro.color || '').trim();
    } else {
      const texto = String(registro || '').trim();
      try {
        const dato = JSON.parse(texto);
        nombre = String(dato?.nombre || dato?.name || '').trim();
        valor = String(dato?.valor || dato?.color || '').trim();
      } catch {
        const [parte1, parte2] = texto.split('|');
        nombre = (parte2 ? parte1 : parte1) || 'Color';
        valor = parte2 || parte1;
      }
    }
    const hex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(valor) ? valor : '';
    if (!hex) continue;
    const clave = (nombre || hex).toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    lista.push({ nombre: nombre || 'Color', valor: hex });
  }
  return lista;
};

export default function Catalogo() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { cantidadTotal, subtotal, agregarProducto } = useCarrito();
  const { esMayorista } = useContext(SesionContext);

  // Estados de datos reales
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Estados de búsqueda y filtros
  const [buscar, setBuscar] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(() => {
    const categoria = searchParams.get('categoria') || '';
    const equivalencias = {
      Dormitorio: 'Colchones',
      Living: 'Muebles',
      'Decoración': 'Almohadas',
    };
    return equivalencias[categoria] || categoria;
  });
  const [medidaSeleccionada, setMedidaSeleccionada] = useState('');
  const [firmezaSeleccionada, setFirmezaSeleccionada] = useState('');
  const [orden, setOrden] = useState('recomendados'); // 'recomendados' | 'precio-asc' | 'precio-desc' | 'nombre'
  const [menuOrdenAbierto, setMenuOrdenAbierto] = useState(false);

  // Retroalimentación de productos agregados temporalmente: { [id]: boolean }
  const [agregados, setAgregados] = useState({});

  // Modal de Asesor TERRA
  const [modalAsesorAbierto, setModalAsesorAbierto] = useState(false);

  // Modal Teclado Kiosco
  const [tecladoAbierto, setTecladoAbierto] = useState(false);

  // Contador de sesión activa del Kiosco (3 minutos de inactividad)
  const [segundosSesion, setSegundosSesion] = useState(180);

  const searchInputRef = useRef(null);

  // Carga de productos reales desde backend PostgreSQL
  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    listarProductos({ limite: 100 })
      .then((datos) => {
        if (!cancelado) {
          setProductos(Array.isArray(datos) ? datos : []);
          setCargando(false);
        }
      })
      .catch((err) => {
        console.warn('Error al conectar con backend:', err);
        if (!cancelado) { setProductos([]); setCargando(false); }
      });

    return () => { cancelado = true; };
  }, [esMayorista]);

  // Cargar categorías dinámicas desde backend / Supabase
  const [categoriasApi, setCategoriasApi] = useState([]);
  useEffect(() => {
    let cancelado = false;
    listarCategorias()
      .then((cats) => {
        if (!cancelado && Array.isArray(cats) && cats.length > 0) {
          setCategoriasApi(cats);
        }
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, []);

  // Construcción de categorías dinámicas
  const categoriasDinamicas = useMemo(() => {
    const lista = [
      { id: '', nombre: 'Todos', icon: 'apps' },
    ];

    const conteo = {};
    let hayPromociones = false;
    for (const p of productos) {
      if (p.promocion || p.descuento) hayPromociones = true;
      const cat = (p.categoria || '').trim();
      if (cat) {
        conteo[cat] = (conteo[cat] || 0) + 1;
      }
    }

    if (categoriasApi.length > 0) {
      for (const cat of categoriasApi) {
        lista.push({
          id: cat.nombre,
          nombre: cat.nombre,
          icon: cat.icon || obtenerIconoCategoria(cat.nombre),
          total: conteo[cat.nombre] ?? cat.total,
        });
      }
    } else if (Object.keys(conteo).length > 0) {
      const catsOrdenadas = Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a]);
      for (const cat of catsOrdenadas) {
        lista.push({
          id: cat,
          nombre: cat,
          icon: obtenerIconoCategoria(cat),
          total: conteo[cat],
        });
      }
    } else {
      for (const cat of CATEGORIAS_CONFIG.filter((c) => c.id && !c.especial)) {
        lista.push(cat);
      }
    }

    if (hayPromociones || productos.some((p) => p.promocion || p.descuento)) {
      lista.push({
        id: 'Promociones',
        nombre: 'Promociones',
        icon: 'star',
        especial: true,
      });
    }

    return lista;
  }, [productos, categoriasApi]);

  // Manejo del temporizador de sesión
  useEffect(() => {
    const timer = setInterval(() => {
      setSegundosSesion((prev) => (prev > 0 ? prev - 1 : 180));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatoTiempo = useMemo(() => {
    const minutos = Math.floor(segundosSesion / 60);
    const segundos = segundosSesion % 60;
    return `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')} min`;
  }, [segundosSesion]);

  // Filtrado y ordenamiento dinámico sobre datos reales
  const productosFiltrados = useMemo(() => {
    let resultado = [...productos];

    // Filtro por búsqueda
    if (buscar.trim()) {
      const q = buscar.toLowerCase().trim();
      resultado = resultado.filter((p) => {
        const textoCompleto = `${p.nombre} ${p.descripcion || ''} ${p.subtitulo || ''} ${p.categoria || ''} ${p.medida || ''}`.toLowerCase();
        return textoCompleto.includes(q);
      });
    }

    // Filtro por categoría
    if (categoriaSeleccionada) {
      if (categoriaSeleccionada === 'Promociones') {
        resultado = resultado.filter((p) => Boolean(p.promocion || p.descuento));
      } else {
        resultado = resultado.filter((p) => p.categoria?.toLowerCase() === categoriaSeleccionada.toLowerCase());
      }
    }

    // Filtro por medida
    if (medidaSeleccionada) {
      resultado = resultado.filter((p) =>
        p.medida?.toLowerCase().includes(medidaSeleccionada.toLowerCase()) ||
        p.tagMedida?.toLowerCase().includes(medidaSeleccionada.toLowerCase())
      );
    }

    // Filtro por firmeza
    if (firmezaSeleccionada) {
      resultado = resultado.filter((p) =>
        p.firmeza?.toLowerCase().includes(firmezaSeleccionada.toLowerCase()) ||
        p.subtitulo?.toLowerCase().includes(firmezaSeleccionada.toLowerCase())
      );
    }

    // Ordenamiento
    if (orden === 'precio-asc') {
      resultado.sort((a, b) => a.precio - b.precio);
    } else if (orden === 'precio-desc') {
      resultado.sort((a, b) => b.precio - a.precio);
    } else if (orden === 'nombre') {
      resultado.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    return resultado;
  }, [productos, buscar, categoriaSeleccionada, medidaSeleccionada, firmezaSeleccionada, orden]);

  // Acción de agregar al carrito con efecto visual
  const handleAgregar = (producto) => {
    if (!agregarProducto(producto)) return;
    setAgregados((prev) => ({ ...prev, [producto.id]: true }));
    setTimeout(() => {
      setAgregados((prev) => ({ ...prev, [producto.id]: false }));
    }, 1800);
  };

  // Teclado virtual táctil
  const agregarCaracter = (caracter) => {
    setBuscar((prev) => prev + caracter);
  };

  const borrarCaracter = () => {
    setBuscar((prev) => prev.slice(0, -1));
  };

  const nombreOrdenActual = {
    'recomendados': 'Recomendados',
    'precio-asc': 'Menor precio',
    'precio-desc': 'Mayor precio',
    'nombre': 'Nombre A-Z',
  }[orden];

  return (
    <div className="catalogo-container bg-surface font-body-md text-on-surface select-none antialiased flex flex-col">
      {/* HEADER TÁCTIL FIJO */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-primary-container text-on-primary shadow-[0_4px_20px_rgba(0,66,48,0.15)]">
        <div className="h-20 w-full px-margin flex items-center justify-between">
          {/* Marca TERRA Autoservicio y sucursal */}
          <div className="flex items-center gap-space-lg">
            <Link
              to="/"
              className="flex items-center bg-white/95 hover:bg-white px-3 py-1.5 rounded-xl shadow-sm transition-all active:scale-95"
              title="TERRA Autoservicio - Logramos tu descanso"
            >
              <img
                alt="TERRA Autoservicio"
                className="h-9 sm:h-10 w-auto object-contain cursor-pointer"
                src="/logo-terra.png"
              />
            </Link>

            <div className="hidden lg:flex items-center gap-space-xs bg-primary/40 px-space-md py-space-xs rounded-full border border-primary-fixed/20">
              <span className="material-symbols-outlined text-[18px] text-secondary-fixed">storefront</span>
              <span className="font-label-sm text-label-sm text-surface-bright">
                Sucursal 1 Central • Santa Cruz de la Sierra
              </span>r
            </div>

            <div className="flex items-center gap-space-xs bg-surface-container-lowest/10 px-space-sm py-space-xs rounded-full">
              <span className="w-2 h-2 rounded-full bg-primary-fixed animate-pulse"></span>
              <span className="font-label-sm text-label-sm text-primary-fixed">Terminal Kiosco #02</span>
            </div>
          </div>

          {/* Navegación Kiosco */}
          <nav className="flex items-center gap-space-md">
            <Link
              to="/catalogo"
              className="min-h-[52px] px-space-lg rounded-xl flex items-center font-label-lg text-label-lg bg-primary text-on-primary shadow-sm transition-colors"
            >
              Catálogo
            </Link>
            <Link
              to="/categorias"
              className="min-h-[52px] px-space-lg rounded-xl flex items-center font-label-lg text-label-lg text-surface-variant hover:text-on-primary transition-colors"
            >
              Categorías
            </Link>
            <Link
              to="/carrito"
              className="min-h-[52px] px-space-lg rounded-xl flex items-center font-label-lg text-label-lg text-surface-variant hover:text-on-primary transition-colors"
            >
              Carrito ({cantidadTotal}) • {formatoMoneda(subtotal)}
            </Link>
          </nav>

          {/* Acciones de cabecera */}
          <div className="flex items-center gap-space-md">
            <Link
              to="/"
              title="Volver a la pantalla de bienvenida"
              className="min-h-[52px] px-space-md rounded-xl bg-primary hover:bg-surface-container-high hover:text-on-surface flex items-center justify-center text-on-primary transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[24px]">home</span>
            </Link>
            <div
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer"
              title="Usuario activo en autoservicio"
            >
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full pb-4 bg-surface flex-1">
        <div className="flex flex-col w-full">
          {/* BARRA TÁCTICA DE BÚSQUEDA Y CONTROL DE FILTROS */}
          <section className="w-full px-margin pt-space-md pb-space-sm bg-surface">
            <div className="max-w-[1240px] mx-auto flex flex-col gap-space-md">
              {/* Fila principal de búsqueda táctil */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
                {/* Cuadro de búsqueda optimizado para pantalla táctil */}
                <div className="relative flex-1 group">
                  <div className="flex items-center bg-surface-container-lowest rounded-xl shadow-sm px-space-md min-h-[56px] transition-all focus-within:shadow-md">
                    <span className="material-symbols-outlined text-outline text-[26px] mr-space-sm select-none">
                      search
                    </span>
                    <input
                      ref={searchInputRef}
                      className="w-full bg-transparent border-none outline-none font-body-lg text-body-lg text-on-surface placeholder:text-outline/70 py-2"
                      id="kiosk-search"
                      placeholder="Buscar poltronas y sofa cama"
                      type="text"
                      value={buscar}
                      readOnly
                      onFocus={(e) => e.target.blur()}
                      onChange={(e) => setBuscar(e.target.value)}
                    />
                    {buscar && (
                      <button
                        aria-label="Borrar búsqueda"
                        className="min-w-[44px] min-h-[44px] rounded-lg bg-surface-container text-on-surface-variant hover:bg-surface-container-high flex items-center justify-center transition-transform active:scale-90"
                        id="clear-search-btn"
                        onClick={() => {
                          setBuscar('');
                        }}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                      </button>
                    )}
                    {!tecladoAbierto && (
                      <button
                        type="button"
                        onClick={() => setTecladoAbierto(true)}
                        className="flex items-center gap-space-xs ml-space-sm pl-space-sm px-space-sm py-1.5 rounded-lg cursor-pointer transition-colors bg-surface-container-low text-on-surface-variant"
                        title="Abrir teclado táctil"
                      >
                        <span className="material-symbols-outlined text-[18px] text-primary">
                          keyboard
                        </span>
                        <span className="font-label-sm text-label-sm uppercase tracking-wider">Teclado</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Contador de inventario y selector de orden */}
                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 lg:gap-4 shrink-0">
                  <div className="flex items-center gap-space-xs px-space-md py-space-sm bg-surface-container-high rounded-xl min-h-[48px]">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
                    <span className="font-label-md text-label-md text-on-surface font-semibold">
                      {productosFiltrados.length} disponibles en tienda
                    </span>
                  </div>

                  {/* Emulador de Menú Desplegable de Orden */}
                  <div className="relative">
                    <button
                      className="min-h-[48px] lg:min-h-[56px] px-4 lg:px-6 rounded-xl bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container transition-all flex items-center gap-space-sm active:scale-95"
                      id="sort-menu-btn"
                      type="button"
                      onClick={() => setMenuOrdenAbierto((prev) => !prev)}
                    >
                      <span className="material-symbols-outlined text-[20px] text-primary">swap_vert</span>
                      <span className="font-label-md text-label-md">
                        Orden: <strong className="text-primary font-bold">{nombreOrdenActual}</strong>
                      </span>
                      <span className="material-symbols-outlined text-[18px] text-outline">
                        {menuOrdenAbierto ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>

                    {menuOrdenAbierto && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container-high py-2 z-30">
                        {[
                          { id: 'recomendados', label: 'Recomendados' },
                          { id: 'precio-asc', label: 'Menor precio' },
                          { id: 'precio-desc', label: 'Mayor precio' },
                          { id: 'nombre', label: 'Nombre A-Z' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setOrden(opt.id);
                              setMenuOrdenAbierto(false);
                            }}
                            className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm font-semibold transition-colors ${
                              orden === opt.id
                                ? 'bg-primary-container text-on-primary'
                                : 'text-on-surface hover:bg-surface-container-high'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {orden === opt.id && (
                              <span className="material-symbols-outlined text-[18px]">done</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Teclado en pantalla táctil (Touch Virtual Keyboard) */}
              {tecladoAbierto && (
                <div className="w-full bg-surface-container-high p-3 rounded-2xl shadow-inner flex flex-col gap-2">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                      Teclado Táctil TERRA
                    </span>
                    <button
                      type="button"
                      onClick={() => setTecladoAbierto(false)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Cerrar teclado
                    </button>
                  </div>
                  {[
                    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
                    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
                  ].map((row, i) => (
                    <div key={i} className="flex justify-center gap-0.5 sm:gap-1.5 w-full">
                      {row.map((letra) => (
                        <button
                          key={letra}
                          type="button"
                          onClick={() => agregarCaracter(letra)}
                          className="flex-1 min-w-0 sm:min-w-[36px] max-w-[44px] h-9 sm:h-12 rounded-lg bg-surface-container-lowest text-on-surface font-bold text-sm sm:text-base shadow-sm active:scale-95 active:bg-primary-container active:text-on-primary transition-all flex items-center justify-center"
                        >
                          {letra}
                        </button>
                      ))}
                      {i === 2 && (
                        <button
                          type="button"
                          onClick={borrarCaracter}
                          className="px-1.5 sm:px-3 h-9 sm:h-12 rounded-lg bg-error-container text-on-error-container font-bold text-xs sm:text-sm shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1 shrink-0"
                        >
                          <span className="material-symbols-outlined text-[16px] sm:text-[18px]">backspace</span>
                          <span className="hidden sm:inline">Borrar</span>
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-center gap-1 sm:gap-2 mt-1 w-full">
                    <button
                      type="button"
                      onClick={() => agregarCaracter(' ')}
                      className="flex-1 min-w-0 max-w-[340px] h-9 sm:h-12 rounded-lg bg-surface-container-lowest text-on-surface font-semibold text-xs sm:text-sm shadow-sm active:scale-95 flex items-center justify-center gap-2"
                    >
                      Espacio
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuscar('')}
                      className="px-2 sm:px-4 h-9 sm:h-12 rounded-lg bg-surface-variant text-on-surface-variant font-semibold text-xs sm:text-sm shadow-sm active:scale-95 flex items-center justify-center shrink-0"
                    >
                      Limpiar todo
                    </button>
                  </div>
                </div>
              )}

              {/* Riel desplazable horizontal de categorías */}
              <div className="w-full overflow-x-auto no-scrollbar py-1">
                <div className="flex items-center gap-space-sm min-w-max">
                  {cargando
                    ? [110, 150, 130, 140].map((ancho, i) => (
                        <span
                          key={i}
                          aria-hidden="true"
                          style={{ width: ancho }}
                          className="min-h-[52px] rounded-full bg-surface-container-low animate-pulse"
                        />
                      ))
                    : categoriasDinamicas.map((cat) => {
                    const activa =
                      (!categoriaSeleccionada && cat.id === '') ||
                      (Boolean(categoriaSeleccionada) && Boolean(cat.id) && categoriaSeleccionada.toLowerCase() === cat.id.toLowerCase());

                    if (cat.especial) {
                      return (
                        <button
                          key={cat.id || 'todos'}
                          type="button"
                          onClick={() => setCategoriaSeleccionada(activa ? '' : cat.id)}
                          className={`min-h-[52px] px-space-lg rounded-full shadow-sm flex items-center gap-space-xs font-label-lg text-label-lg font-bold transition-all active:scale-95 ${
                            activa
                              ? 'bg-secondary text-surface-bright ring-2 ring-tertiary-fixed shadow-md'
                              : 'bg-secondary-container text-on-secondary-fixed hover:bg-secondary-fixed'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[22px] text-tertiary">
                            {cat.icon}
                          </span>
                          <span>{cat.nombre}</span>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={cat.id || 'todos'}
                        type="button"
                        onClick={() => {
                          if (cat.id === '') {
                            setCategoriaSeleccionada('');
                          } else {
                            setCategoriaSeleccionada(activa ? '' : cat.id);
                          }
                        }}
                        className={`min-h-[52px] px-space-lg rounded-full flex items-center gap-space-xs font-label-lg text-label-lg transition-transform active:scale-95 ${
                          activa
                            ? 'bg-primary-container text-on-primary shadow-md'
                            : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high shadow-sm'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[22px] ${
                            activa ? 'text-surface-bright' : 'text-outline'
                          }`}
                        >
                          {cat.icon}
                        </span>
                        <span>{cat.nombre}</span>
                        {activa && <span className="w-2 h-2 rounded-full bg-secondary-fixed ml-1"></span>}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </section>

          {/* CATÁLOGO DE PRODUCTOS: Cuadrícula Landscape Tablet 3 Columnas */}
          <section className="w-full px-margin py-space-md flex-1">
            <div className="max-w-[1240px] mx-auto">
              {cargando ? (
                <div className="catalogo-loader">
                  <div className="loader" role="status" aria-label="Cargando productos" />
                  <p>Cargando productos...</p>
                </div>
              ) : productosFiltrados.length === 0 ? (
                <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-12 text-center flex flex-col items-center justify-center gap-4 my-8 shadow-sm">
                  <span className="material-symbols-outlined text-[64px] text-outline">search_off</span>
                  <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                    No encontramos productos que coincidan con tu búsqueda
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                    Probá cambiando los filtros de medidas o firmeza, o limpiá los términos de búsqueda.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setBuscar('');
                      setCategoriaSeleccionada('');
                      setMedidaSeleccionada('');
                      setFirmezaSeleccionada('');
                    }}
                    className="min-h-[50px] px-6 rounded-xl bg-primary text-on-primary font-bold shadow-sm active:scale-95"
                  >
                    Restablecer todos los filtros
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                  {productosFiltrados.map((producto) => {
                    const recienAgregado = Boolean(agregados[producto.id]);
                    const tonosColores = coloresDeProducto(producto);

                    return (
                      <article
                        key={producto.id}
                        className="flex flex-col bg-surface-container-lowest rounded-[1.75rem] shadow-sm hover:shadow-md transition-all overflow-hidden relative cursor-pointer"
                        onClick={(event) => {
                          if (!event.target.closest('button, a')) {
                            navigate(`/productos/${producto.id}`);
                          }
                        }}
                      >
                        {/* Contenedor de Imagen y Badges */}
                        <div className="relative w-full aspect-square bg-surface-container-lowest overflow-hidden m-3 mb-0 rounded-2xl" style={{ width: 'calc(100% - 1.5rem)' }}>
                          <img
                            className="w-full h-full object-contain transition-transform duration-500 hover:scale-105"
                            alt={producto.nombre}
                            src={producto.imagen_url}
                            loading="lazy"
                          />

                          {/* Insignias Superiores */}
                          <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                            {producto.descuento && (
                              <span className="px-space-sm py-1 rounded-full bg-secondary-container text-on-secondary-fixed font-label-sm text-label-sm font-bold shadow-sm flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">local_offer</span>{' '}
                                {producto.descuento}
                              </span>
                            )}
                            {producto.badgeSecundario && (
                              <span className="px-space-sm py-1 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm font-semibold shadow-sm">
                                {producto.badgeSecundario}
                              </span>
                            )}
                            {producto.badge && !producto.descuento && (
                              <span
                                className={`px-space-sm py-1 rounded-full font-label-sm text-label-sm font-bold shadow-sm flex items-center gap-1 ${
                                  producto.badge === 'Más Vendido'
                                    ? 'bg-secondary-fixed text-on-secondary-fixed'
                                    : producto.badge === 'Nuevo'
                                    ? 'bg-surface-bright text-primary'
                                    : producto.badge === 'Salud Postural'
                                    ? 'bg-primary/10 text-primary'
                                    : producto.badge === 'Últimas Unidades'
                                    ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                                    : 'bg-surface-container text-on-surface'
                                }`}
                              >
                                {producto.badgeIcon && (
                                  <span className="material-symbols-outlined text-[14px]">
                                    {producto.badgeIcon}
                                  </span>
                                )}
                                {producto.badge}
                              </span>
                            )}
                          </div>

                          {/* Medida / Especificación Destacada Inferior */}
                          {producto.tagMedida && (
                            <div className="absolute bottom-3 left-3 bg-surface-container-lowest/95 backdrop-blur px-space-sm py-1 rounded-md text-primary font-label-sm text-label-sm font-bold shadow-sm flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px] text-primary">
                                {producto.tagMedidaIcon || 'verified'}
                              </span>{' '}
                              {producto.tagMedida}
                            </div>
                          )}
                        </div>

                        {/* Cuerpo de la Tarjeta */}
                        <div className="p-3 sm:p-4 lg:p-6 flex flex-col flex-1 justify-between gap-space-md">
                          <div className="flex flex-col gap-space-xs">
                            {/* Fila de reseñas y entrega */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-label-sm text-label-sm text-on-surface-variant">
                                <span className="text-amber-500 tracking-tight">★★★★★</span>{' '}
                                (32 reseñas)
                              </span>
                              <span className={`font-label-sm text-label-sm font-bold ${producto.stock > 0 ? 'text-on-surface' : 'text-error'}`}>
                                {producto.stock > 0 ? 'Entrega inmediata' : 'Agotado'}
                              </span>
                            </div>

                            <Link
                              to={`/productos/${producto.id}`}
                              className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                visibility
                              </span>
                              <span>Ver detalles del producto</span>
                            </Link>

                            <h2 className="font-title-md text-title-md text-on-surface font-bold leading-snug">
                              <Link
                                className="hover:text-primary transition-colors"
                                to={`/productos/${producto.id}`}
                              >
                                {producto.nombre}
                              </Link>
                            </h2>

                            {Boolean(producto.descripcion) && (
                              <p className="text-on-surface-variant font-body-sm text-body-sm leading-relaxed line-clamp-2">
                                {producto.descripcion}
                              </p>
                            )}
                          </div>

                          {/* Tonos disponibles (solo los registrados por el admin) */}
                          {tonosColores.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              {tonosColores.slice(0, 4).map((tono) => (
                                <span
                                  key={`${tono.nombre}-${tono.valor}`}
                                  title={tono.nombre}
                                  style={{ backgroundColor: tono.valor }}
                                  className="w-3.5 h-3.5 rounded-full border border-surface-container-high"
                                />
                              ))}
                              {tonosColores.length > 4 && (
                                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">
                                  +{tonosColores.length - 4} tonos
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Precio y Botón Táctil de Agregar */}
                        <div className="flex flex-col gap-space-sm pt-space-xs bg-surface-container-low/50 p-3 sm:p-4 rounded-xl">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="min-w-0">
                              {producto.esPrecioMayorista ? (
                                <span className="font-body-sm text-body-sm text-outline line-through">
                                  {formatoMoneda(producto.precioPublico)}
                                </span>
                              ) : producto.precioOriginal ? (
                                <span className="font-body-sm text-body-sm text-outline line-through">
                                  {formatoMoneda(producto.precioOriginal)}
                                </span>
                              ) : (
                                <span className="font-body-sm text-body-sm text-outline">
                                  {producto.precioLabel || 'Precio Regular'}
                                </span>
                              )}
                              <div className="font-price-card text-price-card text-primary font-extrabold">
                                {formatoMoneda(producto.precio)}
                              </div>
                            </div>
                            <span className="hidden sm:inline-block shrink-0 font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant">
                              {producto.garantia || 'Garantía Oficial'}
                            </span>
                          </div>

                          {/* Botón Táctil de Gran Formato */}
                          <button
                            className={`w-full min-h-[48px] sm:min-h-[52px] rounded-xl text-[15px] sm:text-base font-bold flex items-center justify-center gap-space-xs shadow-sm transition-all active:scale-95 ${
                              recienAgregado
                                ? 'bg-secondary text-surface-bright shadow-md'
                                : 'bg-primary-container hover:bg-primary text-on-primary'
                            }`}
                            onClick={() => handleAgregar(producto)}
                            type="button"
                            disabled={producto.stock <= 0}
                          >
                            <span className="material-symbols-outlined text-[22px]">
                              {recienAgregado ? 'done' : 'add_shopping_cart'}
                            </span>
                            <span>
                              {recienAgregado ? '¡Agregado al Carrito!' : 'Agregar al carrito'}
                            </span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

                    {/* Carrito flotante global en el borde derecho (CarritoFlotante) */}

        </div>
      </main>

      {/* FOOTER TÁCTIL FIJO KIOSCO */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest text-on-surface shadow-[0_-4px_16px_rgba(41,41,41,0.04)] border-t border-surface-container-high">
        <div className="h-16 w-full px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-md">
            <button
              className="min-h-[48px] px-space-lg rounded-xl bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed hover:text-on-secondary-fixed flex items-center gap-space-xs font-label-md text-label-md transition-all active:scale-95 cursor-pointer font-bold"
              type="button"
              onClick={() => setModalAsesorAbierto(true)}
            >
              <span className="material-symbols-outlined text-[20px]">support_agent</span>
              <span>Solicitar un asesor TERRA</span>
            </button>
            <span className="font-body-sm text-body-sm text-on-surface-variant hidden sm:inline">
              Atención asistida disponible de 09:00 a 20:00
            </span>
          </div>

          <div className="flex items-center gap-space-lg">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-outline text-[18px]">schedule</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Sesión activa: {formatoTiempo}
              </span>
            </div>
            <Link
              className="min-h-[44px] px-space-md rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface flex items-center gap-space-xs font-label-sm text-label-sm transition-all"
              to="/"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Reiniciar Kiosco</span>
            </Link>
          </div>
        </div>
      </footer>

      {/* MODAL: SOLICITUD DE ASESOR EN SALA */}
      {modalAsesorAbierto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-secondary-container text-on-secondary-fixed flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[36px]">support_agent</span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              ¡Asesor TERRA Notificado!
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Un especialista en descanso de la <strong>Sucursal 1central</strong> se está acercando a tu <strong>Terminal Kiosco #02</strong> para asistirte con modelos, medidas y pruebas de firmeza.
            </p>
            <div className="w-full bg-surface-container-low p-3 rounded-xl flex items-center justify-center gap-2 text-primary font-bold text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
              Tiempo estimado de espera: Menos de 1 minuto
            </div>
            <button
              type="button"
              onClick={() => setModalAsesorAbierto(false)}
              className="w-full min-h-[50px] rounded-xl bg-primary text-on-primary font-bold shadow-md hover:bg-primary-container active:scale-95 transition-all mt-2"
            >
              Entendido, continuar explorando
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
