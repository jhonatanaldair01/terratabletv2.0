
import {
  crearPedidoBD,
  registrarPagoPedidoBD,
  obtenerPedidoBD,
  listarPedidosBD,
  actualizarEstadoPedidoBD,
} from '../models/pedidoModel.js';

export async function registrarPagoPedido(req, res, next) {
  try {
    const id = String(req.params.id || '').trim();
    const metodoPago = String(req.body?.metodoPago || '').trim();
    const comprobanteUrl = String(req.body?.comprobanteUrl || '').trim() || null;
    if (!id || !['qr', 'efectivo', 'tarjeta'].includes(metodoPago)) {
      return res.status(400).json({ success: false, mensaje: 'Datos de pago inválidos.' });
    }
    if (comprobanteUrl && (comprobanteUrl.length > 2000 || !/^https:\/\//i.test(comprobanteUrl))) {
      return res.status(400).json({ success: false, mensaje: 'La URL del comprobante no es válida.' });
    }
    const pedido = await registrarPagoPedidoBD(id, { metodoPago, comprobanteUrl });
    if (!pedido) return res.status(404).json({ success: false, mensaje: 'Pedido no encontrado.' });
    return res.json({ success: true, data: pedido });
  } catch (error) { next(error); }
}

export async function actualizarEstadoPedido(req, res, next) {
  try {
    const id = String(req.params.id || '').trim(); const estado = String(req.body?.estado || '').trim();
    const permitidos = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'];
    if (!id || !permitidos.includes(estado)) return res.status(400).json({ success: false, mensaje: 'Estado inválido' });
    const pedido = await actualizarEstadoPedidoBD(id, estado);
    if (!pedido) return res.status(404).json({ success: false, mensaje: 'Pedido no encontrado' });
    return res.json({ success: true, data: pedido });
  } catch (error) { next(error); }
}

export async function listarPedidos(req, res, next) {
  try {
    const limite = Number(req.query.limite ?? 100);
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 200) return res.status(400).json({ success: false, mensaje: 'Límite inválido' });
    const estado = String(req.query.estado ?? '').trim();
    const permitidos = ['', 'pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'];
    if (!permitidos.includes(estado)) return res.status(400).json({ success: false, mensaje: 'Estado inválido' });
    const pedidos = await listarPedidosBD({ buscar: String(req.query.buscar ?? '').trim(), estado, limite });
    return res.json({ success: true, data: pedidos });
  } catch (error) { next(error); }
}

export async function crearPedido(req, res, next) {
  try {
    const clienteId = req.body?.clienteId == null ? null : String(req.body.clienteId).trim();

    const items = req.body?.items;

    if (
      clienteId !== null &&
      !clienteId
    ) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID de cliente inválido',
      });
    }

    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 50
    ) {
      return res.status(400).json({
        success: false,
        mensaje: 'Debes enviar entre 1 y 50 productos',
      });
    }

    const productos = new Map();

    for (const item of items) {
      const productoId = String(item?.productoId || '').trim();
      const cantidad = Number(item?.cantidad);

      if (
        !productoId ||
        !Number.isSafeInteger(cantidad) ||
        cantidad < 1 ||
        cantidad > 100
      ) {
        return res.status(400).json({
          success: false,
          mensaje: 'Producto o cantidad inválida',
        });
      }

      const cantidadTotal =
        (productos.get(productoId) || 0) + cantidad;

      if (cantidadTotal > 100) {
        return res.status(400).json({
          success: false,
          mensaje: 'Máximo 100 unidades por producto',
        });
      }

      productos.set(productoId, cantidadTotal);
    }

    const itemsNormalizados = Array.from(
      productos,
      ([productoId, cantidad]) => ({
        productoId,
        cantidad,
      })
    );

    const pedido = await crearPedidoBD(
      clienteId,
      itemsNormalizados,
      { esMayorista: req.webUser?.rol === 'mayorista' }
    );

    return res.status(201).json({
      success: true,
      mensaje: 'Pedido generado correctamente',
      data: pedido,
    });
  } catch (error) {
    next(error);
  }
}

export async function obtenerPedido(req, res, next) {
  try {
    const id = String(req.params.id || '').trim();

    if (!id) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID de pedido inválido',
      });
    }

    const pedido = await obtenerPedidoBD(id);

    if (!pedido) {
      return res.status(404).json({
        success: false,
        mensaje: 'Pedido no encontrado',
      });
    }

    return res.json({
      success: true,
      data: pedido,
    });
  } catch (error) {
    next(error);
  }
}
