import { pool } from './database.js';

// Migraciones idempotentes de columnas. Se ejecutan UNA sola vez al iniciar el
// servidor, nunca en el path de un request: el pooler de Supabase puede asignar
// conexiones de solo lectura y un ALTER TABLE ahi falla con
// "cannot execute ALTER TABLE in a read-only transaction".
const migraciones = [
  ['products.video_url', 'ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT'],
  ['products.colors', 'ALTER TABLE products ADD COLUMN IF NOT EXISTS colors TEXT[]'],
  ['products.image_urls', 'ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls TEXT[]'],
  ['customers.nit', 'ALTER TABLE customers ADD COLUMN IF NOT EXISTS nit TEXT'],
  ['customers.nit_type', 'ALTER TABLE customers ALTER COLUMN nit TYPE TEXT'],
  ['categories.updated_at', 'ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()'],
  ['orders.payment_receipt_url', 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT'],
  ['orders.payment_method', 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT'],
];

export async function migrarColumnas() {
  const resultados = [];
  for (const [nombre, sql] of migraciones) {
    try {
      await pool.query(sql);
      resultados.push(`${nombre}: ok`);
    } catch (error) {
      console.warn(`[migracion] ${nombre} omitida: ${error.message}`);
      resultados.push(`${nombre}: omitida`);
    }
  }
  return resultados;
}
