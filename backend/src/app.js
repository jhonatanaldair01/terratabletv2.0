import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import productoRoutes from './routes/productoRoutes.js';
import categoriaRoutes from './routes/categoriaRoutes.js';
import pedidoRoutes from './routes/pedidoRoutes.js';
import clienteRoutes from './routes/clienteRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import asistenteRoutes from './routes/asistenteRoutes.js';
import authWebRoutes from './routes/authWebRoutes.js';

import { authWebOpcional } from './middlewares/authWeb.js';

import { verificarConexion } from './config/database.js';

import {
  rutaNoEncontrada,
  errorHandler,
} from './middlewares/errorHandler.js';

const app = express();

// Permitir conexiones cross-origin (incluyendo frontend en Vercel y local)
app.use(cors());

// Permitir recibir JSON (límite alto para fotos en base64 desde el admin).
app.use(express.json({ limit: '12mb' }));

// Sesión web opcional: si el usuario mayorista inició sesión, deja req.webUser
// disponible para que el catálogo y los pedidos usen precios de mayorista.
// No bloquea: un invitado sigue navegando con precios normales.
app.use('/api', authWebOpcional);

// Ruta principal requerida por la especificación
app.get('/', (req, res) => {
  res.json({
    service: 'TERRA Centralized Products API',
    status: 'online',
    endpoints: {
      productos: '/api/productos',
      seed: '/api/productos/seed',
      docs: '/docs',
      openapi: '/openapi',
    },
  });
});

// Especificación OpenAPI 3.0
app.get('/openapi', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'TERRA Centralized Products API',
      version: '1.0.0',
      description: 'API centralizada de productos y autoservicio TERRA conectada a Supabase PostgreSQL.',
    },
    paths: {
      '/': {
        get: {
          summary: 'Estado y endpoints del servicio',
          responses: { 200: { description: 'Información del servicio' } },
        },
      },
      '/api/productos': {
        get: {
          summary: 'Listar productos',
          parameters: [
            { name: 'buscar', in: 'query', schema: { type: 'string' } },
            { name: 'categoria', in: 'query', schema: { type: 'string' } },
            { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limite', in: 'query', schema: { type: 'integer', default: 100 } },
            { name: 'todos', in: 'query', schema: { type: 'boolean', default: false } },
          ],
          responses: { 200: { description: 'Lista de productos paginada' } },
        },
        post: {
          summary: 'Crear nuevo producto',
          responses: { 201: { description: 'Producto creado' } },
        },
      },
      '/api/productos/seed': {
        get: {
          summary: 'Sincronizar y sembrar catálogo TERRA en Supabase',
          responses: { 200: { description: 'Catálogo sincronizado' } },
        },
        post: {
          summary: 'Sincronizar y sembrar catálogo TERRA en Supabase',
          responses: { 200: { description: 'Catálogo sincronizado' } },
        },
      },
      '/api/productos/{id}': {
        get: { summary: 'Obtener detalle de un producto por ID' },
        put: { summary: 'Actualizar producto' },
        delete: { summary: 'Desactivar producto' },
      },
      '/api/productos/{id}/stock': {
        patch: { summary: 'Actualizar stock (showroom y bodega)' },
      },
      '/api/pedidos': {
        post: { summary: 'Crear un nuevo pedido' },
      },
      '/api/clientes': {
        post: { summary: 'Registrar o buscar cliente' },
      },
      '/api/auth/login': {
        post: {
          summary: 'Iniciar sesión de usuario web (rol mayorista ve precios mayoristas)',
          responses: { 200: { description: 'Token y datos del usuario' }, 401: { description: 'Credenciales inválidas' } },
        },
      },
      '/api/auth/me': {
        get: {
          summary: 'Perfil del usuario web autenticado',
          responses: { 200: { description: 'Datos del usuario' }, 401: { description: 'Sesión requerida o vencida' } },
        },
      },
      '/api/health': {
        get: { summary: 'Verificar salud y conexión a Supabase' },
      },
    },
  });
});

// Documentación Swagger UI
app.get('/docs', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TERRA Centralized Products API - Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; background: #fafafa; font-family: sans-serif; }
    .topbar { display: none !important; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/openapi',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis],
      });
    };
  </script>
</body>
</html>`);
});

// Verificar conexión con Supabase / PostgreSQL.
app.get('/api/health', async (req, res, next) => {
  try {
    const conexion = await verificarConexion();
    res.json({
      success: true,
      mensaje: 'Servidor y base de datos Supabase funcionando',
      baseDeDatos: conexion.db,
      fecha: conexion.fecha,
    });
  } catch (error) {
    next(error);
  }
});

// Registrar rutas.
app.use('/api/productos', productoRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/asistente', asistenteRoutes);
app.use('/api/auth', authWebRoutes);

// Manejo centralizado de errores.
app.use(rutaNoEncontrada);
app.use(errorHandler);

export default app;
