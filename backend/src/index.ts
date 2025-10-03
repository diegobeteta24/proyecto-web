import 'dotenv/config'
import express, { Request, Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import { authRouter } from './routes/auth'
import { campaignsRouter } from './routes/campaigns'
import { adminEngineersRouter } from './routes/adminEngineers'
import { db } from './store'
import { migrate, getPool } from './db'
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
app.listen(PORT, () => {
  // ensure DB is ready
  migrate().then(async () => {
    const pool = await getPool()
    // Upsert demo voter into engineers to ensure known credentials exist
    const hash = await bcrypt.hash('Voter123!', 10)
    console.log('Ensuring demo voter in engineers…')
    await pool.query(
      'INSERT INTO engineers (colegiado, nombre, email, dpi, fecha_nacimiento, password_hash, activo) VALUES (?, ?, ?, ?, ?, ?, 1)\n'
      + 'ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), email=VALUES(email), password_hash=VALUES(password_hash), fecha_nacimiento=VALUES(fecha_nacimiento), activo=1',
      ['12345', 'Votante Demo', 'votante@example.com', '1234567890123', '1990-01-01', hash]
    )
    // Promote requested admin (dev convenience) and ensure password if missing
    try {
      const adminName = 'JOSE MIGUEL VILLATORO HIDALGO'
      const defaultPwd = 'Admin123!'
      const hash = await bcrypt.hash(defaultPwd, 10)
      await pool.query('UPDATE engineers SET is_admin=1, activo=1 WHERE nombre=?', [adminName])
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
      const [ins]: any = await pool.query(
        'INSERT INTO campaigns (titulo, descripcion, votos_por_votante, habilitada, inicia_en, termina_en) VALUES (?, ?, ?, ?, ?, ?)',
        ['Elección Junta Directiva 2025', 'Vota por tu planilla favorita', 1, 1, start, end]
      )
      const campaignId = ins.insertId
      const candNames = ['Lista A', 'Lista B', 'Lista C']
      for (const name of candNames) {
        const [insC]: any = await pool.query('INSERT INTO candidates (nombre) VALUES (?)', [name])
        await pool.query('INSERT INTO campaign_candidates (campaign_id, candidate_id) VALUES (?, ?)', [campaignId, insC.insertId])
      }
      console.log('Seeded demo campaign in MySQL')
    }
  }).catch(err => console.error('DB migrate error', err))
  console.log(`API listening on http://localhost:${PORT}`)
})
