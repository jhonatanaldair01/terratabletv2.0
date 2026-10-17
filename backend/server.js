
import app from './src/app.js';
import { pool } from './src/config/database.js';
import { migrarColumnas } from './src/config/migrarColumnas.js';

const PORT = Number(process.env.PORT) || 3001;

try {
  await pool.query('SELECT 1');
  await migrarColumnas();

  app.listen(PORT, '0.0.0.0', () => {
    console.log('-----------------------------------');
    console.log('TERRA AUTOSERVICIO - BACKEND');
    console.log(`Servidor: http://localhost:${PORT}`);
    console.log('PostgreSQL: Conectado');
    console.log('-----------------------------------');
  });
} catch (error) {
  console.error('No se pudo iniciar el servidor:', error.message);
  await pool.end();
  process.exit(1);
}
