# Plataforma de Votaciones

Monorepo con backend (Express + MySQL) y frontend (React + Vite).

## Requisitos
- Node.js 18+
- MySQL 8+

## Backend
- Ubicación: `backend/`
- Configura variables de entorno en `backend/.env` (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, etc.).
- Scripts:
  - `npm run dev` – desarrollo con recarga
  - `npm run build` – compila TypeScript
  - `npm start` – ejecuta `dist/`

## Frontend
- Ubicación: `frontend/`
- Scripts:
  - `npm run dev` – servidor de desarrollo
  - `npm run build` – build de producción a `dist/`

## Desarrollo local (rápido)
1. `cd backend` y `npm i`; crea `backend/.env`.
2. `npm run dev` para levantar el API.
3. En otra terminal: `cd frontend` y `npm i`.
4. `npm run dev` para iniciar la UI.

## Producción
- Backend: `npm run build` y `npm start` en un servidor con Node y acceso a MySQL.
- Frontend: `npm run build` y sirve `frontend/dist` con tu servidor web (Nginx/Apache/Static host).

## Licencia
MIT# Plataforma de Votaciones — Desarrollo local

Este repo contiene dos aplicaciones:
- backend: API en Node/Express con TypeScript y JWT (almacenamiento en memoria para desarrollo local)
- frontend: React + TypeScript + Vite + SASS/SCSS + React‑Bootstrap

## Requisitos
- Node.js 18+ y npm

## Variables de entorno (backend)
Crea un archivo `.env` dentro de `backend/` basado en `.env.example`:

```
PORT=3001
JWT_SECRET=super-secreto-cambia-esto
JWT_EXPIRES=1h
SEED_ADMIN=true
SEED_ADMIN_PASSWORD=Admin123!
```

## Instalación

1) Backend
- Instalar dependencias
- Levantar en modo desarrollo

2) Frontend
- Instalar dependencias
- Iniciar Vite (abre http://localhost:5173)

## Comandos

Backend:
- `npm install` desde `backend/`
- `npm run dev`

Frontend:
- `npm install` desde `frontend/`
- `npm run dev`

La app frontend usa un proxy de Vite hacia `http://localhost:3001` para el path `/api`.

## Notas
- El backend usa almacenamiento en memoria para empezar rápido. Para producción, cambia a una base de datos real (p. ej. Prisma + PostgreSQL) y persiste los datos.
- El usuario admin se siembra automáticamente si `SEED_ADMIN=true`.
