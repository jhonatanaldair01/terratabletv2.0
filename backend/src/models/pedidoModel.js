import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';

const aMonto = (minor) => Number(minor || 0) / 100;

export async function crearPedidoBD(clienteId, items) {
  const conexion = await pool.connect();
  try {
    await conexion.query('BEGIN');
    if (clienteId) {
      const cliente = await conexion.query('SELECT id FROM customers WHERE id=$1', [clienteId]);
      if (!cliente.rowCount) throw new Error('El cliente no existe en Supabase');
    }
    const detalles = []; let totalMinor = 0;
    for (const item of items) {
      const producto = await conexion.query(
        `SELECT p.id AS product_id, p.name, p.stock_quantity, v.id AS variant_id, v.sku,
                COALESCE(v.price_publico, ROUND(COALESCE(p.public_price,0)*100)::bigint) AS price_minor
         FROM products p LEFT JOIN product_variants v ON v.product_id=p.id AND v.is_active=TRUE
         WHERE p.id=$1 AND COALESCE(p.activo,p.is_active,TRUE)=TRUE LIMIT 1`, [item.productoId]);
      if (!producto.rowCount) throw new Error('Producto no encontrado o inactivo en Supabase');
      const p = producto.rows[0];
      if (Number(p.stock_quantity || 0) < item.cantidad) throw new Error(`Stock insuficiente para ${p.name}`);
      const subtotalMinor = Number(p.price_minor) * item.cantidad;
      totalMinor += subtotalMinor;
      detalles.push({ variantId: p.variant_id, nombre: p.name, sku: p.sku, cantidad: item.cantidad, precioUnitario: aMonto(p.price_minor), subtotal: aMonto(subtotalMinor) });
    }
    const ticket = `TER-${randomUUID().slice(0, 8).toUpperCase()}`;
    const nuevo = await conexion.query(
      `INSERT INTO orders (customer_id,status,fulfillment_type,subtotal_minor,discount_minor,delivery_fee_minor,total_minor,currency,ticket_number)
       VALUES ($1,'pending','store_pickup',$2,0,0,$2,'BOB',$3)
       RETURNING id, ticket_number AS codigo, customer_id AS cliente_id, total_minor, status AS estado, created_at AS fecha`, [clienteId, totalMinor, ticket]);
    for (const d of detalles) {
      await conexion.query(`INSERT INTO order_items (order_id,product_variant_id,product_name,sku,quantity,unit_price_minor,discount_minor,total_minor,currency) VALUES ($1,$2,$3,$4,$5,$6,0,$7,'BOB')`, [nuevo.rows[0].id, d.variantId, d.nombre, d.sku, d.cantidad, Math.round(d.precioUnitario*100), Math.round(d.subtotal*100)]);
    }
    await conexion.query('COMMIT');
    return { ...nuevo.rows[0], total: aMonto(nuevo.rows[0].total_minor), items: detalles };
  } catch (error) { await conexion.query('ROLLBACK'); throw error; } finally { conexion.release(); }
}

export async function obtenerPedidoBD(id) {
  const { rows } = await pool.query(
    `SELECT o.id,o.ticket_number AS codigo,o.customer_id AS cliente_id,o.total_minor,o.status AS estado,o.created_at AS fecha,
            o.payment_receipt_url AS comprobante_url,o.payment_method AS metodo_pago,
            c.name AS cliente_nombre,c.phone AS cliente_telefono,c.nit AS cliente_nit
     FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.id=$1`,
    [id]
  );
  if (!rows[0]) return null;
  const detalles = await pool.query(`SELECT product_variant_id AS "productoId",product_name AS nombre,quantity AS cantidad,unit_price_minor/100.0 AS "precioUnitario",total_minor/100.0 AS subtotal FROM order_items WHERE order_id=$1 ORDER BY created_at`, [id]);
  const pedido = rows[0];
  return {
    ...pedido,
    total: aMonto(pedido.total_minor),
    cliente: pedido.cliente_nombre ? { nombre: pedido.cliente_nombre, telefono: pedido.cliente_telefono, nit: pedido.cliente_nit } : null,
    items: detalles.rows,
  };
}

export async function listarPedidosBD({ buscar = '', estado = '', limite = 100 } = {}) {
  const valores=[]; const condiciones=[];
  if(buscar){valores.push(`%${buscar}%`);condiciones.push(`(o.ticket_number ILIKE $${valores.length} OR COALESCE(c.name,'') ILIKE $${valores.length})`);}
  if(estado){valores.push(estado);condiciones.push(`o.status=$${valores.length}`);}
  valores.push(limite); const where=condiciones.length?`WHERE ${condiciones.join(' AND ')}`:'';
  const { rows } = await pool.query(`SELECT o.id,o.ticket_number AS codigo,o.customer_id AS cliente_id,o.total_minor/100.0 AS total,o.status AS estado,o.created_at AS fecha,o.payment_receipt_url AS comprobante_url,o.payment_method AS metodo_pago,COALESCE(c.name,'Compra como invitado') AS cliente,COALESCE(string_agg(i.quantity::text || 'x ' || i.product_name, ', '),'') AS items FROM orders o LEFT JOIN customers c ON c.id=o.customer_id LEFT JOIN order_items i ON i.order_id=o.id ${where} GROUP BY o.id,c.name ORDER BY o.created_at DESC LIMIT $${valores.length}`, valores);
  return rows;
}

export async function registrarPagoPedidoBD(id, { metodoPago, comprobanteUrl }) {
  const { rows } = await pool.query(
    `UPDATE orders
     SET status='completed', payment_method=$1, payment_receipt_url=COALESCE($2, payment_receipt_url), updated_at=NOW()
     WHERE id=$3
     RETURNING id`,
    [metodoPago, comprobanteUrl || null, id]
  );
  return rows[0] ? obtenerPedidoBD(id) : null;
}

export async function actualizarEstadoPedidoBD(id, estado) {
  const { rows } = await pool.query(`UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id`, [estado, id]);
  return rows[0] ? obtenerPedidoBD(id) : null;
}
