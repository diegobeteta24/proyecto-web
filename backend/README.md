# Backend — API Express TS

## Scripts
- npm run dev — desarrollo con tsx watch
- npm run build — compila a dist
- npm start — ejecuta dist

## Endpoints principales
- GET /api/health
- POST /api/auth/register (votante)
- POST /api/auth/login (votante)
- POST /api/auth/admin/login (admin)
- GET /api/campaigns
- POST /api/campaigns (admin, Bearer token)
- POST /api/campaigns/:id/vote (voter, Bearer token)
