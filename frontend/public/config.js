// =====================================================================
//  CONFIGURACIÓN DE CONEXIONES - TERRA Autoservicio
//  Este archivo se carga en tiempo de ejecución (NO se compila).
//  Al desplegar, edita SOLO este archivo (queda en dist/config.js)
//  y recarga la página. No hace falta volver a ejecutar npm run build.
// =====================================================================
const EN_LOCAL = typeof location !== 'undefined'
  && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

window.TERRA_CONFIG = {
  // URL pública del backend (API). La usan la app Y la ficha QR (detalle-qr.html).
  // Ejemplo: "https://tu-backend.onrender.com/api"
  // - Debe terminar en /api
  // - En tu PC (localhost) se deja vacía a propósito: así se usa VITE_API_URL
  //   (http://localhost:3001/api) y la tienda local pega contra el backend local,
  //   en vez del backend desplegado (que puede estar en otra versión).
  API_URL: EN_LOCAL ? "" : "https://terra-nuevo.vercel.app/api",
  // Webhook del nodo "When chat message received" de n8n (workflow publicado/activo).
  // Ejemplo producción: "https://n8n.midominio.com/webhook/xxxx-xxxx/chat"
  N8N_CHAT_URL: "https://ranked-oxide-seller-stood.trycloudflare.com/webhook/cf2f2ecb-49f1-4287-9704-7f2214849274/chat",
};