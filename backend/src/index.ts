import 'dotenv/config'
// Boot diagnostics (antes de cualquier otra cosa)
console.log('[BOOT] starting backend', {
  node: process.version,
  pid: process.pid,
  dbClientEnv: process.env.DB_CLIENT,
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  cwd: process.cwd(),
  portEnv: process.env.PORT
})
process.on('unhandledRejection', (reason: any) => {
  console.error('[FATAL] Unhandled Rejection', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception', err)
})
import express, { Request, Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { campaignsRouter } from './routes/campaigns.js'
import { adminEngineersRouter } from './routes/adminEngineers.js'
import { db } from './store.js'
import { migrate, getPool } from './db.js'
import bcrypt from 'bcryptjs'

// Emular __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json())

// Static assets: favicon and candidate images
const publicDir = path.join(__dirname, '..', 'public')
const uploadsDir = path.join(__dirname, '..', 'uploads')
app.use('/static', express.static(publicDir, { maxAge: '1d', extensions: ['png','jpg','jpeg','svg','ico','webp'] }))
app.use('/uploads', express.static(uploadsDir, { maxAge: '5m' }))

// Simple endpoint to confirm uploads path (debug)
app.get('/api/uploads/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

app.use('/api/auth', authRouter)
app.use('/api/campaigns', campaignsRouter)
app.use('/api/admin/engineers', adminEngineersRouter)

// Serve favicon at root path too
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(publicDir, 'favicon.ico'), (err) => {
    if (err) return res.status(404).end()
  })
})

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001
console.log('[BOOT] configured PORT', PORT)
app.listen(PORT, '0.0.0.0', () => {
  // ensure DB is ready
  migrate().then(async () => {
    const pool = await getPool()
    const isPg = (process.env.DB_CLIENT || '').trim().toLowerCase() === 'pg' || (
      process.env.DATABASE_URL && /^(postgres|postgresql):\/\//i.test(String(process.env.DATABASE_URL))
    )
    // Seed initial engineers roster from bundled JSON if table is empty
    try {
      const [[{ c: engCount }]]: any = await pool.query('SELECT COUNT(*) AS c FROM engineers')
      if (Number(engCount) === 0) {
        console.log('[SEED] engineers vacío, intentando cargar seeds/engineers.import.json')
        const fs = await import('node:fs/promises')
        const rosterPath = path.join(__dirname, '..', 'seeds', 'engineers.import.json')
        let raw: any = null
        try {
          raw = JSON.parse(await fs.readFile(rosterPath, 'utf8'))
        } catch (e) {
          console.warn('[SEED] No se pudo leer archivo de roster', (e as any)?.message)
        }
        if (Array.isArray(raw) && raw.length) {
          let inserted = 0
          if (isPg) { await pool.query('BEGIN') }
          try {
            for (const it of raw) {
              const colegiado = String(it.colegiado || '').trim()
              const nombre = String(it.nombre || '').trim()
              if (!colegiado || !nombre) continue
              const dpi = it.dpi ? String(it.dpi).trim() : null
              const fecha = it.fechaNacimiento ? String(it.fechaNacimiento).trim() : null
              if (isPg) {
                await pool.query(
                  `INSERT INTO engineers (colegiado, nombre, activo, dpi, fecha_nacimiento, is_admin)
                   VALUES (?, ?, true, ?, ?, ?)
                   ON CONFLICT (colegiado) DO UPDATE SET nombre=EXCLUDED.nombre, activo=EXCLUDED.activo, dpi=COALESCE(EXCLUDED.dpi, engineers.dpi), fecha_nacimiento=COALESCE(EXCLUDED.fecha_nacimiento, engineers.fecha_nacimiento);`,
                  [colegiado, nombre, dpi, fecha, colegiado === '19999']
                )
              } else {
                await pool.query(
                  `INSERT INTO engineers (colegiado, nombre, activo, dpi, fecha_nacimiento, is_admin)
                   VALUES (?, ?, 1, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), activo=VALUES(activo), dpi=IFNULL(VALUES(dpi), dpi), fecha_nacimiento=IFNULL(VALUES(fecha_nacimiento), fecha_nacimiento)`,
                  [colegiado, nombre, dpi, fecha, colegiado === '19999' ? 1 : 0]
                )
              }
              inserted++
            }
            if (isPg) { await pool.query('COMMIT') }
            console.log(`[SEED] Roster inicial cargado (${inserted} registros)`)          
          } catch (e) {
            if (isPg) { try { await pool.query('ROLLBACK') } catch {} }
            console.error('[SEED] Error sembrando roster inicial', (e as any)?.message)
          }
        } else {
          console.warn('[SEED] Archivo roster vacío o inválido')
        }
      } else {
        console.log('[SEED] engineers ya contiene registros, se omite seed inicial')
      }
    } catch (e) {
      console.warn('[SEED] Falló verificación/seed inicial', (e as any)?.message)
    }
    // Enforce all engineers active + ensure admin colegiado 19999 (idempotent) 
    try {
      if (isPg) {
        await pool.query('UPDATE engineers SET activo=true')
      } else {
        await pool.query('UPDATE engineers SET activo=1')
      }
      const [[adminRow]]: any = await pool.query('SELECT id, is_admin FROM engineers WHERE colegiado=? LIMIT 1', ['19999'])
      if (adminRow && !adminRow.is_admin) {
        if (isPg) {
          await pool.query('UPDATE engineers SET is_admin=true WHERE colegiado=?', ['19999'])
        } else {
          await pool.query('UPDATE engineers SET is_admin=1 WHERE colegiado=?', ['19999'])
        }
        console.log('[SEED] Promovido colegiado 19999 a admin')
      }
    } catch (e) {
      console.warn('[SEED] No se pudo forzar activos/admin', (e as any)?.message)
    }
    // Upsert demo voter into engineers to ensure known credentials exist
    const hash = await bcrypt.hash('Voter123!', 10)
    console.log('Ensuring demo voter in engineers…')
    // isPg already computed above
    if (isPg) {
      // PostgreSQL upsert using ON CONFLICT
      await pool.query(
        `INSERT INTO engineers (colegiado, nombre, email, dpi, fecha_nacimiento, password_hash, activo, is_admin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (colegiado) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           fecha_nacimiento = EXCLUDED.fecha_nacimiento,
           activo = true;`,
        ['12345', 'Votante Demo', 'votante@example.com', '1234567890123', '1990-01-01', hash, true, false]
      )
    } else {
      // MySQL upsert style
      await pool.query(
        'INSERT INTO engineers (colegiado, nombre, email, dpi, fecha_nacimiento, password_hash, activo) VALUES (?, ?, ?, ?, ?, ?, 1)\n'
        + 'ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), email=VALUES(email), password_hash=VALUES(password_hash), fecha_nacimiento=VALUES(fecha_nacimiento), activo=1',
        ['12345', 'Votante Demo', 'votante@example.com', '1234567890123', '1990-01-01', hash]
      )
    }
    // Promote requested admin (dev convenience) and ensure password if missing
    try {
      const adminName = 'JOSE MIGUEL VILLATORO HIDALGO'
      const defaultPwd = 'Admin123!'
      const hash = await bcrypt.hash(defaultPwd, 10)
      if (isPg) {
        await pool.query('UPDATE engineers SET is_admin=true, activo=true WHERE nombre=?', [adminName])
      } else {
        await pool.query('UPDATE engineers SET is_admin=1, activo=1 WHERE nombre=?', [adminName])
      }
      await pool.query(
        'UPDATE engineers SET password_hash = COALESCE(password_hash, ?), email = COALESCE(email, ?) WHERE nombre=?',
        [hash, 'admin@example.com', adminName]
      )
    } catch {}
    // Seed demo campaign if none
    const [[{ c: campaignsCount }]]: any = await pool.query('SELECT COUNT(*) AS c FROM campaigns')
    if (Number(campaignsCount) === 0) {
      const now = new Date()
      const start = new Date(now.getTime() - 5 * 60 * 1000)
      const end = new Date(now.getTime() + 60 * 60 * 1000)
      let campaignId: number
      if (isPg) {
        const [rows]: any = await pool.query(
          'INSERT INTO campaigns (titulo, descripcion, votos_por_votante, habilitada, inicia_en, termina_en) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
          ['Elección Junta Directiva 2025', 'Vota por tu planilla favorita', 1, true, start, end]
        )
        campaignId = rows[0].id
      } else {
        const [ins]: any = await pool.query(
          'INSERT INTO campaigns (titulo, descripcion, votos_por_votante, habilitada, inicia_en, termina_en) VALUES (?, ?, ?, ?, ?, ?)',
          ['Elección Junta Directiva 2025', 'Vota por tu planilla favorita', 1, 1, start, end]
        )
        campaignId = ins.insertId
      }
      const candNames = ['Lista A', 'Lista B', 'Lista C']
      for (const name of candNames) {
        if (isPg) {
          const [rowsC]: any = await pool.query('INSERT INTO candidates (nombre) VALUES (?) RETURNING id', [name])
            await pool.query('INSERT INTO campaign_candidates (campaign_id, candidate_id) VALUES (?, ?)', [campaignId, rowsC[0].id])
        } else {
          const [insC]: any = await pool.query('INSERT INTO candidates (nombre) VALUES (?)', [name])
          await pool.query('INSERT INTO campaign_candidates (campaign_id, candidate_id) VALUES (?, ?)', [campaignId, insC.insertId])
        }
      }
      console.log(`Seeded demo campaign in ${isPg ? 'PostgreSQL' : 'MySQL'}`)
    }
    // --- Servir frontend build (SPA) en producción ---
    try {
      const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist')
      app.use(express.static(frontendDist))
      // Fallback SPA (después de rutas /api )
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' })
        res.sendFile(path.join(frontendDist, 'index.html'))
      })
      console.log('[HTTP] Frontend build habilitado')
    } catch (e) {
      console.warn('[HTTP] No se pudo habilitar frontend build', (e as any)?.message)
    }
  }).catch(err => {
    console.error('DB migrate error (continuing, server still up)', err)
  })
  console.log(`API listening on 0.0.0.0:${PORT}`)
})
