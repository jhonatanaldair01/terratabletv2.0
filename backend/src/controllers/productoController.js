import {
  listarProductosBD,
  obtenerProductoBD,
  crearProductoBD,
  actualizarProductoBD,
  actualizarStockBD,
  eliminarProductoBD,
} from '../models/productoModel.js';
import { migrateAndSeed } from '../config/migrate_seed.js';

// Un usuario web con rol "mayorista" ve el catálogo completo con precios de mayorista.
function esMayorista(req) {
  return req.webUser?.rol === 'mayorista';
}

export async function seedProductos(req, res, next) {
  try {
    const resultado = await migrateAndSeed({ closePool: false });
    return res.json({
      success: true,
      mensaje: 'Base de datos sincronizada con éxito en Supabase',
      total: resultado.total,
    });
  } catch (error) {
    next(error);
  }
}

export async function listarProductos(req, res, next) {
  try {
    const buscar = String(req.query.buscar ?? '').trim();
    const categoria = String(req.query.categoria ?? '').trim();
    const pagina = Number(req.query.pagina ?? 1);
    const limite = Number(req.query.limite ?? 100);
    const soloActivos = req.query.todos === 'true' ? false : true;

    if (
      !Number.isSafeInteger(pagina) ||
      pagina < 1 ||
      !Number.isSafeInteger(limite) ||
      limite < 1 ||
      limite > 200
    ) {
      return res.status(400).json({
        success: false,
        mensaje: 'Paginación inválida',
      });
    }

    const productos = await listarProductosBD({
      buscar,
      categoria,
      pagina,
      limite,
      soloActivos,
      esMayorista: esMayorista(req),
    });

    return res.json({
      success: true,
      data: productos,
      paginacion: {
        pagina,
        limite,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function obtenerProducto(req, res, next) {
  try {
    const id = String(req.params.id || '').trim();

    if (!id) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID de producto inválido',
      });
    }

    const producto = await obtenerProductoBD(id, { esMayorista: esMayorista(req) });

    if (!producto) {
      return res.status(404).json({
        success: false,
        mensaje: 'Producto no encontrado',
      });
    }

    return res.json({
      success: true,
      data: producto,
    });
  } catch (error) {
    next(error);
  }
}

export async function crearProducto(req, res, next) {
  try {
    const datos = req.body;
    if (!datos.nombre || !datos.categoria || datos.precio === undefined) {
      return res.status(400).json({
        success: false,
        mensaje: 'Nombre, categoría y precio son obligatorios',
      });
    }

    const nuevo = await crearProductoBD(datos);
    return res.status(201).json({
      success: true,
      mensaje: 'Producto creado exitosamente',
      data: nuevo,
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        mensaje: 'Ya existe un producto con ese SKU / código.',
      });
    }
    next(error);
  }
}

export async function actualizarProducto(req, res, next) {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID de producto inválido',
      });
    }

    const actualizado = await actualizarProductoBD(id, req.body);
    if (!actualizado) {
      return res.status(404).json({
        success: false,
        mensaje: 'Producto no encontrado',
      });
    }

    return res.json({
      success: true,
      mensaje: 'Producto actualizado exitosamente',
      data: actualizado,
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        mensaje: 'Ya existe un producto con ese SKU / código.',
      });
    }
    next(error);
  }
}

export async function actualizarStock(req, res, next) {
  try {
    const id = String(req.params.id || '').trim();
    const { showroom } = req.body;

    const actualizado = await actualizarStockBD(id, { showroom });
    if (!actualizado) {
      return res.status(404).json({
        success: false,
        mensaje: 'Producto no encontrado',
      });
    }

    return res.json({
      success: true,
      mensaje: 'Inventario de producto actualizado',
      data: actualizado,
    });
  } catch (error) {
    next(error);
  }
}

export async function eliminarProducto(req, res, next) {
  try {
    const id = String(req.params.id || '').trim();
    const eliminado = await eliminarProductoBD(id);
    if (!eliminado) {
      return res.status(404).json({
        success: false,
        mensaje: 'Producto no encontrado',
      });
    }

    return res.json({
      success: true,
      mensaje: 'Producto eliminado exitosamente',
      data: eliminado,
    });
  } catch (error) {
    next(error);
  }
}
