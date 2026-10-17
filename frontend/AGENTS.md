# AGENTS.md

## Project
TERRA Autoservicio: React 19 + Vite frontend (self-service kiosk) and Express 5 + PostgreSQL backend. Personal data stays in React state only (shared tablet).

## Commands
Frontend (repo root):
- `npm install`
- `npm run dev` -> Vite dev server on `http://localhost:5173`
- `npm run build` -> production bundle
- `npm run lint` -> `oxlint` (React hooks + Oxc rules)
- `npm run preview` -> preview production build

Backend:
- `cd backend && npm install`
- `npm start` (or `npm run dev` with `--watch`) -> `http://localhost:3001`
- Backend exits on startup if Postgres is unavailable; requires `backend/.env` with `DATABASE_URL`, `PORT`, `FRONTEND_URL`, admin env vars

Database:
- Create DB `terra_autoservicio`, then `psql -U postgres -d terra_autoservicio -f database/schema.sql` (run from repo root)
- Reset/seed catalog: `cd backend && node src/config/migrate_seed.js`
- Health check: `GET http://localhost:3001/api/health`

## Architecture
- Frontend env: root `.env` (copy from `.env.example`): `VITE_API_URL`, `VITE_MODO_DEMO`. `VITE_MODO_DEMO` must equal exactly `"true"` to enable demo mode.
- Frontend API base comes from `src/services/api.js` (`VITE_API_URL`, default `http://localhost:3001/api`; trailing slash stripped). Backend mounts `/api/{productos,pedidos,clientes,admin,asistente,auth}`.
- CORS uses `FRONTEND_URL` (default `http://localhost:5173`).
- Admin token lives in `sessionStorage` under `terra_admin_token` (not `localStorage`), expires in 8h; `apiRequest` does not attach it.
- Web/kiosk session (`src/services/sesionService.js`, `src/context/SesionContext.jsx`) lives in `sessionStorage` under `terra_web_token` / `terra_web_usuario`. `apiRequest` attaches it automatically as `Authorization: Bearer`. Endpoints: `POST /api/auth/login`, `GET /api/auth/me`.
- `authWebOpcional` (mounted on `/api`) sets `req.webUser` when the token is valid, without blocking guests.
- Login flow: password is verified by **Supabase Auth** (`backend/src/services/supabaseAuth.js`, `POST /auth/v1/token?grant_type=password` with `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`); the role/state comes from the `public.users` table (`users.auth_user_id` → `auth.users.id`). The backend then issues its own HMAC token (`authWeb.js`, secret `WEB_TOKEN_SECRET`/`ADMIN_TOKEN_SECRET`).
- Wholesale prices: role `mayorista` sees `products.precio_mayorista` (TEXT, parsed by `backend/src/utils/precios.js`); products without it fall back to `public_price`. Orders recompute at wholesale price for this role (`pedidoModel.js`).
- `backend/src/config/migrarUsuariosWeb.js` (idempotent, non-destructive, runs at startup) ensures `users.role` CHECK allows `'mayorista'`, that the Supabase Auth user exists with a confirmed email, and that the matching `public.users` row exists. Seed account `mayorista@gmail.com` / `123456` (override with `MAYORISTA_EMAIL` / `MAYORISTA_PASSWORD`).
- Create/update kiosk users from the console: `npm run usuario -- --email=<correo> --password=<clave> --rol=<rol> --nombre="Nombre"` (`backend/src/config/crearUsuario.js`; roles `admin|seller|warehouse|support|mayorista`; flags `--inactivo`, `--cambiar-password`; `--ayuda` for help). Run the startup migration alone with `npm run usuarios:migrar`.
- With `SUPABASE_SERVICE_ROLE_KEY` set, user creation uses the Supabase Admin API (no confirmation emails, no email rate limit, can also set passwords). Without it, it falls back to the public `signup` endpoint (sends an email; subject to Supabase's email rate limit) and confirms the email via a controlled DB update.
- Orders recompute price/stock from the DB inside a transaction with `SELECT ... FOR SHARE`. Cart is memory-only and backend does not decrement stock on order creation.
- No test scripts exist (`npm test` in backend intentionally fails). Verification is `npm run lint`, `npm run build`, backend startup, and health check.

## Gotchas
- Codebase is ESM (`"type": "module"`); run backend commands from `backend/` so `backend/.env` resolves.
- Tailwind v4 is configured only through `@tailwindcss/vite` in `vite.config.js`; there is no separate Tailwind config.
- `migrate_seed.js` truncates `pedido_detalles`, `pedidos`, `productos` (resetting IDs) and alters the `productos` table; treat it as a destructive dev/reset step, not a safe migration.
- `dist/` and `node_modules/` are ignored build/dependency artifacts.