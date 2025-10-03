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

## Base de Datos: Cambiar entre PostgreSQL y MySQL

El código soporta ambos motores. La autodetección ocurre así:
1. Si `DB_CLIENT=pg` → fuerza PostgreSQL.
2. Si no se define `DB_CLIENT` pero la variable `DATABASE_URL` empieza con `postgres://` o `postgresql://` → usa PostgreSQL.
3. Caso contrario → MySQL.

### Variables de entorno (MySQL)
```
DB_CLIENT=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=votaciones
```
Puedes omitir `DB_CLIENT` (por defecto es mysql) siempre que NO exista un `DATABASE_URL` de Postgres definido.

### Variables de entorno (PostgreSQL con cadena completa)
```
DB_CLIENT=pg        # recomendado para dejarlo explícito
DATABASE_URL=postgres://usuario:password@host:5432/dbname
# Si tu proveedor requiere SSL sin verificación:
DB_SSL=1            # (por defecto ya activa ssl con rejectUnauthorized=false)
```
Si no deseas usar `DATABASE_URL`, puedes definir manualmente:
```
DB_CLIENT=pg
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_password
DB_NAME=votaciones
```

### Migraciones
Las migraciones se ejecutan automáticamente al arrancar (`migrate()` en `index.ts`). No necesitas comandos extra.

### Seeds de datos
- Usuario demo (colegiado 12345) y campaña demo: se crean automáticamente si la tabla está vacía.
- Admin (nombre exacto `JOSE MIGUEL VILLATORO HIDALGO`) se promueve automáticamente en el arranque.

### Seed del padrón (engineers)
Archivo de importación ejemplo: `./seeds/engineers.import.json`.

Ejecutar (desde `backend/`):
```
npx tsx src/scripts/seedEngineers.ts ./seeds/engineers.import.json
```
El script detecta el motor y utiliza:
- MySQL: `ON DUPLICATE KEY UPDATE`
- PostgreSQL: `ON CONFLICT (colegiado) DO UPDATE`

### Provisionar (asignar credenciales a colegiados existentes)
Puedes usar el endpoint admin `/api/auth/admin/engineers/provision` o el script:
```
npx tsx src/scripts/provisionVoters.ts ./seeds/provision.sample.json
```
(El JSON debe ser un arreglo de objetos con colegiado, email, dpi, fechaNacimiento y opcional password.)

### Diferencias importantes entre motores
- Booleans: MySQL usa TINYINT(1); PostgreSQL usa BOOLEAN. El código ajusta dinámicamente (ej. `activo=1` vs `activo=true`).
- Placeholders: MySQL usa `?`; PostgreSQL internamente los traduce a `$1, $2...` (se hace automáticamente en `db.ts`).
- Upserts: MySQL `ON DUPLICATE KEY UPDATE`; PostgreSQL `ON CONFLICT (...) DO UPDATE`.
- Fechas: Se evita `DATE_FORMAT` y se formatea en JavaScript para compatibilidad.

### Cambiar de un motor a otro en dos máquinas
1. Crea/copias un `.env` distinto por máquina, por ejemplo:
	- `.env.mysql` (desarrollo local).
	- `.env.pg` (deploy / otra laptop con Postgres).
2. Duplica el archivo a `.env` según la máquina:
	- En Windows (PowerShell): `Copy-Item .env.mysql .env`.
3. Instala dependencias una sola vez (ya incluye `mysql2` y `pg`).
4. Arranca: `npm run dev`.
5. Ejecuta el seed del padrón si la tabla `engineers` está vacía.

### Verificación rápida
```
curl http://localhost:3001/api/health
curl http://localhost:3001/api/auth/engineers/12345/status
```
Si `existsInRoster` es true para 12345, la semilla básica está OK.

### Problemas comunes
- Error `column "activo" is of type boolean but expression is of type integer`: Falta cambiar a Postgres (asegúrate `DB_CLIENT=pg`) o estás usando un UPDATE con `activo=1` viejo (ya corregido en main).
- Registro dice “Colegiado no autorizado”: No insertaste el padrón (`seedEngineers.ts`) o usas base equivocada (verifica `DATABASE_URL`).
- Diferencia de nombres con tildes: Se normalizan quitando diacríticos; asegúrate de que el JSON tenga el nombre completo sin errores de ortografía.

## Notas de Seguridad
- No subas `.env` reales al repo.
- Cambia contraseñas demo (Admin123!, Voter123!) en entornos productivos.
- Considera forzar HTTPS detrás de un proxy / plataforma de hosting.

## Futuras Mejoras Sugeridas
- Tests automatizados para migraciones multi-motor.
- Endpoint para importar padrón sin CLI.
- Auditoría de votos (logs firmados).

