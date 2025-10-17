# 🗳️ Plataforma de Votaciones CIG

Sistema de votaciones electrónicas para el Colegio de Ingenieros de Guatemala. Permite gestionar campañas electorales, emitir votos de forma segura y visualizar resultados en tiempo real.

---

## 🌐 Sitio en Producción

**URL:** [https://colegio-ingenieros-dw-909704573ad3.herokuapp.com/](https://colegio-ingenieros-dw-909704573ad3.herokuapp.com/)

### 🔑 Credenciales de Prueba

**Administrador:**
- Colegiado: `19999`
- Contraseña: `Admin123!`

**Votante Demo:**
- Colegiado: `12345`
- DPI: `1234567890123`
- Fecha de Nacimiento: `1990-01-01`
- Contraseña: `Voter123!`

---

## 📋 Características

### Para Votantes
- ✅ Registro con validación contra padrón oficial de colegiados
- ✅ Autenticación segura con JWT (colegiado + DPI + fecha de nacimiento + contraseña)
- ✅ Visualización de campañas activas con countdown en tiempo real
- ✅ Emisión de votos con validación de restricciones
- ✅ Resultados en tiempo real con gráficos interactivos
- ✅ Prevención de votos duplicados con constraints de base de datos

### Para Administradores
- ✅ Panel de gestión de campañas (crear, editar, eliminar)
- ✅ Asignación dinámica de candidatos desde el padrón
- ✅ Control de fechas de inicio y fin de votación
- ✅ Habilitación/deshabilitación manual de campañas
- ✅ Exportación de resultados a CSV
- ✅ Cierre automático de campañas al vencer el plazo

---

## 🛠️ Tecnologías

### Backend
- **Node.js** 18+ con **Express** 4.19
- **TypeScript** 5.6 en modo estricto
- **JWT** (jsonwebtoken 9.0) para autenticación
- **bcryptjs** 2.4 para hash de contraseñas
- **MySQL2** 3.15 / **PostgreSQL** (pg 8.16) con soporte dual
- **Zod** para validación de schemas

### Frontend
- **React** 18.3 con **TypeScript** 5.6
- **Vite** 5.4 como bundler (HMR)
- **SASS/SCSS** 1.79 con variables, mixins y anidamiento
- **React Router** 6.30 para navegación SPA
- **Recharts** 2.12 para gráficos de resultados
- **Bootstrap** 5.3 + React-Bootstrap para UI

### Infraestructura
- **Heroku** (despliegue en producción)
- **PostgreSQL** (addon de Heroku)
- **Git/GitHub** para control de versiones

---

## 🚀 Instalación y Desarrollo Local

### Requisitos Previos
- Node.js 18+ y npm
- MySQL 8+ o PostgreSQL 12+ (opcional para desarrollo local)

### 1. Clonar el Repositorio
```bash
git clone https://github.com/diegobeteta24/proyecto-web.git
cd proyecto-web
```

### 2. Configurar Backend

```bash
cd backend
npm install
```

Crea un archivo `.env` con las siguientes variables:

```bash
# Servidor
PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=super-secreto-cambia-esto
JWT_EXPIRES=1h

# Base de datos MySQL (desarrollo local)
DB_CLIENT=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=votaciones

# O PostgreSQL (comentar las líneas MySQL)
# DATABASE_URL=postgres://user:pass@localhost:5432/votaciones

# Admin reset (para emergencias)
ADMIN_RESET_SECRET=TuTokenSuperSecreto123!
```

Inicia el backend:
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3001`

### 3. Configurar Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

**Nota:** Vite usa un proxy para redirigir `/api` al backend en puerto 3001 (configurado en `vite.config.ts`).

---

## 📦 Estructura del Proyecto

```
proyecto-web/
├── backend/                    # API Node.js + Express + TypeScript
│   ├── src/
│   │   ├── index.ts           # Punto de entrada, configuración Express
│   │   ├── db.ts              # Conexión y migraciones de BD
│   │   ├── store.ts           # Capa de abstracción de datos
│   │   ├── types.ts           # Definiciones de tipos TypeScript
│   │   ├── routes/
│   │   │   ├── auth.ts        # Registro, login (voter/admin)
│   │   │   ├── campaigns.ts   # CRUD campañas y votación
│   │   │   └── adminEngineers.ts # Gestión del padrón
│   │   ├── middleware/
│   │   │   └── auth.ts        # Verificación JWT y roles
│   │   └── utils/
│   │       └── jwt.ts         # Generación y validación de tokens
│   ├── seeds/
│   │   └── engineers.import.json # Padrón de ingenieros autorizados
│   ├── public/                # Assets estáticos (favicon, logos)
│   ├── uploads/               # Fotos de candidatos
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
├── frontend/                   # Aplicación React + TypeScript + Vite
│   ├── src/
│   │   ├── main.tsx           # Punto de entrada React
│   │   ├── App.tsx            # Componente raíz con rutas
│   │   ├── pages/
│   │   │   ├── Landing.tsx    # Página de inicio
│   │   │   ├── Login.tsx      # Login de votantes
│   │   │   ├── Register.tsx   # Registro de nuevos votantes
│   │   │   ├── AdminLogin.tsx # Login de administradores
│   │   │   ├── AdminCampaigns.tsx # Panel CRUD de campañas
│   │   │   ├── CampaignDetail.tsx # Detalle y votación
│   │   │   └── AdminDiagnostics.tsx # Diagnósticos del sistema
│   │   ├── styles/
│   │   │   └── main.scss      # Estilos globales SASS
│   │   └── utils/
│   │       ├── apiClient.ts   # Cliente HTTP con interceptor JWT
│   │       └── encoding.ts    # Utilidades de codificación
│   ├── public/                # Assets públicos
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── README.md
│
├── Procfile                    # Configuración Heroku
├── package.json                # Scripts de despliegue
└── README.md                   # Este archivo
```

---

## 🔐 Seguridad

### Implementaciones de Seguridad
- ✅ **Contraseñas hasheadas** con bcrypt (salt rounds = 10)
- ✅ **JWT firmado** con secret configurable (HS256)
- ✅ **Expiración de tokens** configurable por variable de entorno
- ✅ **Interceptor automático** de tokens expirados (logout + redirección)
- ✅ **Validación de entrada** con Zod en backend y regex en frontend
- ✅ **Constraints UNIQUE** en base de datos para evitar votos duplicados
- ✅ **Middleware de autorización** por rol (admin/voter)
- ✅ **Auditoría completa** de votos con timestamp
- ✅ **HTTPS forzado** en producción (Heroku)

### Variables de Entorno Críticas
- `JWT_SECRET`: Clave secreta para firmar tokens (cambiar en producción)
- `JWT_EXPIRES`: Duración de tokens (ej: `1h`, `24h`, `7d`)
- `ADMIN_RESET_SECRET`: Token para resetear contraseñas de admin en emergencias

---

## 🗄️ Base de Datos

### Tablas Principales

**engineers** - Padrón de ingenieros autorizados
- Campos: colegiado (UNIQUE), nombre, email, dpi, password_hash, activo, is_admin

**campaigns** - Campañas electorales
- Campos: titulo, descripcion, votos_por_votante, habilitada, inicia_en, termina_en

**candidates** - Candidatos disponibles
- Campos: nombre, bio, foto_url, engineer_id (FK opcional)

**campaign_candidates** - Relación N:M campañas-candidatos
- Campos: campaign_id, candidate_id, bio (override)

**votes** - Registro de votos emitidos
- Campos: campaign_id, candidate_id, voter_id, created_at
- Constraint: UNIQUE(campaign_id, voter_id, candidate_id)

### Migraciones Automáticas
El backend ejecuta migraciones automáticamente al iniciar:
- Crea tablas si no existen
- Importa padrón desde `seeds/engineers.import.json`
- Crea usuario demo y admin predeterminado
- Siembra campaña de ejemplo si la BD está vacía

---

## 🚢 Despliegue en Heroku

### Comandos Automáticos
El despliegue en Heroku se maneja con los siguientes scripts (configurados en `package.json`):

```json
{
  "heroku-prebuild": "npm ci --prefix backend && npm ci --prefix frontend",
  "heroku-postbuild": "npm run build --prefix frontend && npm run build --prefix backend"
}
```

### Variables de Entorno Requeridas
Configurar en Heroku Config Vars:
```bash
heroku config:set JWT_SECRET="tu-clave-super-secreta" --app tu-app
heroku config:set JWT_EXPIRES="1h" --app tu-app
heroku config:set ADMIN_RESET_SECRET="token-secreto" --app tu-app
heroku config:set NODE_ENV="production" --app tu-app
```

`DATABASE_URL` se configura automáticamente al agregar el addon de PostgreSQL.

### Procfile
```
web: node backend/dist/index.js
```

### Despliegue Manual
```bash
git push heroku main
```

---

## 📖 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro de nuevo votante
- `POST /api/auth/login` - Login de votante
- `POST /api/auth/admin/login` - Login de administrador
- `GET /api/auth/me` - Información del usuario actual
- `POST /api/auth/admin/reset-secret` - Reset de contraseña de emergencia

### Campañas
- `GET /api/campaigns` - Listar todas las campañas
- `GET /api/campaigns/:id` - Detalle de una campaña
- `POST /api/campaigns` - Crear campaña (admin)
- `PATCH /api/campaigns/:id` - Actualizar campaña (admin)
- `DELETE /api/campaigns/:id` - Eliminar campaña (admin)
- `POST /api/campaigns/:id/vote` - Emitir voto

### Administración
- `POST /api/admin/engineers/sync` - Sincronizar padrón (admin)
- `POST /api/admin/engineers/provision` - Provisionar usuarios (admin)
- `GET /api/admin/engineers/diagnostics` - Diagnósticos del sistema (admin)

Todos los endpoints (excepto login/registro) requieren header `Authorization: Bearer <token>`.

---

## 🧪 Testing

### Probar Localmente
1. Registra un nuevo votante (usa colegiado del padrón: 10001-10013 o 19999)
2. Inicia sesión y visualiza campañas
3. Vota en una campaña activa
4. Verifica actualización en tiempo real del gráfico
5. Como admin, crea una nueva campaña y asigna candidatos

### Verificar en Producción
Visita: [https://colegio-ingenieros-dw-909704573ad3.herokuapp.com/](https://colegio-ingenieros-dw-909704573ad3.herokuapp.com/)

---

## 🤝 Contribución

Este es un proyecto académico. Para contribuir:
1. Fork el repositorio
2. Crea una rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'feat: Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📝 Licencia

MIT License - Ver archivo LICENSE para más detalles.

---

## 👥 Autores

**Desarrollo:**
- Diego Beteta - [GitHub](https://github.com/diegobeteta24)

**Proyecto Académico:**
- Universidad Mariano Gálvez de Guatemala
- Curso: Desarrollo Web
- Fecha: Octubre 2025

---

## 📞 Soporte

Para reportar problemas o solicitar nuevas funcionalidades, abre un [Issue en GitHub](https://github.com/diegobeteta24/proyecto-web/issues).

---

**⚠️ Nota:** Este sistema está diseñado para fines educativos. Para uso en elecciones oficiales, se recomienda realizar auditoría de seguridad completa y pruebas de penetración.
