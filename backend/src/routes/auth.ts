import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../store.js'
import { signToken } from '../utils/jwt.js'
import { getPool } from '../db.js'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'

export const authRouter = Router()

// No longer seed admin in-memory; admins come from engineers with is_admin=1

// Hook para confirmar colegiado activo en padrón (tabla engineers por ahora)
async function isColegiadoActivo(colegiado: string): Promise<boolean> {
  try {
    const pool = await getPool()
    const [[row]]: any = await pool.query('SELECT activo FROM engineers WHERE colegiado=? LIMIT 1', [colegiado])
    return !!(row && row.activo)
  } catch {
    return false
  }
}

function normalizeDateToISO(dateStr: string): string | null {
  if (!dateStr) return null
  // Accept YYYY-MM-DD or DD/MM/YYYY
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/
  const latam4 = /^(\d{2})[\/](\d{2})[\/](\d{4})$/
  const latam2 = /^(\d{2})[\/](\d{2})[\/](\d{2})$/
  if (isoMatch.test(dateStr)) return dateStr
  let m = dateStr.match(latam4)
  if (m) {
    const [ , dd, mm, yyyy ] = m
    return `${yyyy}-${mm}-${dd}`
  }
  m = dateStr.match(latam2)
  if (m) {
    const [ , dd, mm, yy ] = m
    const now = new Date()
    const currentYY = now.getFullYear() % 100
    const yyNum = Number(yy)
    const century = yyNum <= currentYY ? 2000 : 1900
    const yyyy = century + yyNum
    return `${yyyy}-${mm}-${dd}`
  }
  // Fallback: try Date parse
  const d = new Date(dateStr)
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  return null
}

function normalizeNameForCompare(s: string): string {
  if (!s) return ''
  // Remove extra spaces, trim
  let out = s.replace(/\s+/g, ' ').trim()
  // Normalize accents (diacritics) so 'GARCIA' == 'GARCÍA'
  try {
    out = out.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  } catch {}
  return out.toLocaleUpperCase('es-ES')
}

function formatDateYMD(val: any): string | null {
  if (!val) return null
  // If it's already a Date
  if (val instanceof Date) {
    const yyyy = val.getFullYear()
    const mm = String(val.getMonth() + 1).padStart(2, '0')
    const dd = String(val.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  // If it's a string, try to normalize
  if (typeof val === 'string') {
    // Common cases: 'YYYY-MM-DD', full ISO, or with time
    const isoLike = val.match(/^\d{4}-\d{2}-\d{2}/)
    if (isoLike) return val.slice(0, 10)
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
    return null
  }
  return null
}

const registerSchema = z.object({
  colegiado: z.string().trim().regex(/^\d+$/, 'Colegiado debe contener sólo dígitos').min(3, 'Colegiado demasiado corto'),
  nombre: z.string().trim().min(3, 'Nombre demasiado corto'),
  email: z.string().trim().email('Correo inválido'),
  dpi: z.string().trim().regex(/^\d{13}$/, 'DPI debe tener 13 dígitos'),
  fechaNacimiento: z.string(),
  password: z.string().min(8, 'Contraseña muy corta').refine(v => /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && /[^\w\s]/.test(v), 'La contraseña debe incluir mayúscula, minúscula, número y símbolo')
})

authRouter.post('/register', async (req, res) => {
  const started = Date.now()
  try {
    const parsed = registerSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
    }
    const { colegiado, nombre, email, dpi, fechaNacimiento, password } = parsed.data
    const fechaISO = normalizeDateToISO(String(fechaNacimiento))
    if (!fechaISO) return res.status(400).json({ error: 'Fecha de nacimiento inválida' })
    const pool = await getPool()
  const [[eng]]: any = await pool.query("SELECT id, activo, nombre, email as e_email, dpi as e_dpi, fecha_nacimiento as e_fn, password_hash FROM engineers WHERE colegiado=? LIMIT 1", [colegiado])
    if (!eng) return res.status(403).json({ error: 'Colegiado no autorizado para registrarse' })
    if (!eng.activo) return res.status(403).json({ error: 'Colegiado inactivo. Contacta al administrador.' })
    if (normalizeNameForCompare(String(eng.nombre)) !== normalizeNameForCompare(String(nombre))) {
      return res.status(400).json({ error: 'El nombre no coincide con el padrón' })
    }
    if (eng.password_hash) return res.status(409).json({ error: 'El colegiado ya tiene una cuenta' })
  const engFn = formatDateYMD(eng.e_fn)
  if (!eng.e_dpi || !engFn) return res.status(400).json({ error: 'Datos del padrón incompletos (DPI o fecha de nacimiento faltan). Contacta al administrador.' })
  if (String(eng.e_dpi) !== String(dpi)) return res.status(400).json({ error: 'DPI no coincide con el padrón' })
  if (String(engFn) !== String(fechaISO)) return res.status(400).json({ error: 'Fecha de nacimiento no coincide con el padrón' })
    const [[dupEmail]]: any = await pool.query('SELECT id FROM engineers WHERE email=? AND colegiado<>? LIMIT 1', [email, colegiado])
    if (dupEmail) return res.status(409).json({ error: 'El correo ya está registrado' })
    const [[dupDpi]]: any = await pool.query('SELECT id FROM engineers WHERE dpi=? AND colegiado<>? LIMIT 1', [dpi, colegiado])
    if (dupDpi) return res.status(409).json({ error: 'El DPI ya está registrado' })
    const passwordHash = await bcrypt.hash(password, 10)
    try {
      const isPg = (process.env.DB_CLIENT || '').trim().toLowerCase() === 'pg' || (
        process.env.DATABASE_URL && /^(postgres|postgresql):\/\//i.test(String(process.env.DATABASE_URL))
      )
      if (isPg) {
        await pool.query(
          'UPDATE engineers SET nombre=?, email=?, dpi=?, fecha_nacimiento=?, password_hash=?, activo=true WHERE colegiado=?',
          [nombre ?? eng.nombre, email, dpi, fechaISO, passwordHash, colegiado]
        )
      } else {
        await pool.query(
          'UPDATE engineers SET nombre=?, email=?, dpi=?, fecha_nacimiento=?, password_hash=?, activo=1 WHERE colegiado=?',
          [nombre ?? eng.nombre, email, dpi, fechaISO, passwordHash, colegiado]
        )
      }
      console.info('Registro exitoso', { colegiado, engineerId: eng.id, ms: Date.now() - started })
      return res.json({ ok: true })
    } catch (err: any) {
      if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
        const msg = String(err.sqlMessage || '')
        if (msg.includes('email')) return res.status(409).json({ error: 'El correo ya está registrado' })
        if (msg.includes('dpi')) return res.status(409).json({ error: 'El DPI ya está registrado' })
        return res.status(409).json({ error: 'Registro duplicado' })
      }
      console.error('Fallo al actualizar engineer para registro', { colegiado, message: err?.message, code: err?.code })
      return res.status(500).json({ error: 'No se pudo registrar' })
    }
  } catch (outer: any) {
    console.error('Error inesperado en /auth/register', { body: req.body, message: outer?.message, stack: outer?.stack })
    return res.status(500).json({ error: 'Error interno' })
  }
})

// Voter login
authRouter.post('/login', async (req, res) => {
  try {
    const { colegiado, dpi, fechaNacimiento, password } = req.body ?? {}
    if (!colegiado || !dpi || !fechaNacimiento || !password) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' })
    }
    const fechaISO = normalizeDateToISO(String(fechaNacimiento))
    if (!fechaISO) return res.status(400).json({ error: 'Fecha de nacimiento inválida' })
    const pool = await getPool()
    // Must be in engineers roster and active
  const [[eng]]: any = await pool.query("SELECT id, colegiado, nombre, password_hash, fecha_nacimiento AS fn, dpi, activo FROM engineers WHERE colegiado=? LIMIT 1", [colegiado])
    if (!eng) return res.status(401).json({ error: 'Credenciales inválidas' })
    if (!eng.activo) return res.status(403).json({ error: 'Usuario inactivo' })
    if (!(await isColegiadoActivo(String(eng.colegiado)))) return res.status(403).json({ error: 'Colegiado no elegible' })
    const cleanDBDpi = String(eng.dpi ?? '').replace(/\D+/g, '')
    const cleanReqDpi = String(dpi ?? '').replace(/\D+/g, '')
    if (cleanDBDpi !== cleanReqDpi) return res.status(401).json({ error: 'Credenciales inválidas' })
  const engFn = formatDateYMD(eng.fn)
  if (String(engFn ?? '') !== String(fechaISO)) return res.status(401).json({ error: 'Credenciales inválidas' })
    if (!eng.password_hash) return res.status(401).json({ error: 'Credenciales inválidas' })
    const ok = await bcrypt.compare(password, String(eng.password_hash))
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' })
    const token = signToken({ id: String(eng.id), role: 'voter', colegiado: eng.colegiado, nombre: eng.nombre })
    return res.json({ token })
  } catch (e) {
    return res.status(500).json({ error: 'Error al iniciar sesión' })
  }
})

// Admin login (use engineers table)
authRouter.post('/admin/login', async (req, res) => {
  const { colegiado, email, password } = req.body ?? {}
  if ((!colegiado && !email) || !password) return res.status(400).json({ error: 'Campos requeridos faltantes' })
  const pool = await getPool()
  let row: any = null
  if (colegiado) {
    const [[r]]: any = await pool.query('SELECT id, colegiado, nombre, email, password_hash, is_admin, activo FROM engineers WHERE colegiado=? LIMIT 1', [String(colegiado)])
    row = r
  } else if (email) {
    const [[r]]: any = await pool.query('SELECT id, colegiado, nombre, email, password_hash, is_admin, activo FROM engineers WHERE email=? LIMIT 1', [String(email)])
    row = r
  }
  if (!row || !row.is_admin || !row.password_hash) return res.status(401).json({ error: 'Credenciales inválidas' })
  if (!row.activo) return res.status(403).json({ error: 'Usuario inactivo' })
  const ok = await bcrypt.compare(password, row.password_hash ?? '')
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' })
  const token = signToken({ id: String(row.id), role: 'admin', email: row.email, colegiado: row.colegiado, nombre: row.nombre })
  return res.json({ token })
})

// Whoami
authRouter.get('/me', (req, res) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  const token = auth.slice(7)
  try {
    // decode but don't validate claims beyond signature/exp
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'))
    return res.json({ user: payload })
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
})

// Public: check colegiado status for registration UX
authRouter.get('/engineers/:colegiado/status', async (req, res) => {
  const colegiado = String(req.params.colegiado || '').trim()
  if (!/^\d+$/.test(colegiado)) return res.status(400).json({ error: 'Colegiado inválido' })
  const pool = await getPool()
  const [[row]]: any = await pool.query('SELECT id, activo, password_hash FROM engineers WHERE colegiado=? LIMIT 1', [colegiado])
  if (!row) return res.json({ existsInRoster: false, active: false, hasAccount: false })
  return res.json({ existsInRoster: true, active: !!row.activo, hasAccount: !!row.password_hash })
})

// Admin: sync engineers roster (authorized colegiados)
authRouter.post('/admin/engineers/sync', requireAuth, requireRole('admin'), async (req, res) => {
  // Expect body: { items: [{ colegiado, nombre, activo, dpi?, fechaNacimiento? }, ...] }
  const { items } = req.body ?? {}
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Formato inválido' })
  const pool: any = await getPool()
  const isPg = (process.env.DB_CLIENT || '').trim().toLowerCase() === 'pg' || (
    process.env.DATABASE_URL && /^(postgres|postgresql):\/\//i.test(String(process.env.DATABASE_URL))
  )
  let conn: any = null
  try {
    if (!isPg) {
      conn = await pool.getConnection()
      await conn.beginTransaction()
    }
    for (const it of items) {
      const colegiado = String(it.colegiado ?? '').trim()
      const nombre = String(it.nombre ?? '').trim()
      const activo = it.activo ? 1 : 0
      const dpi = it.dpi ? String(it.dpi).trim() : null
      const fecha = it.fechaNacimiento ? String(it.fechaNacimiento).trim() : null
      if (!colegiado || !nombre) continue
      if (isPg) {
        await pool.query(
          `INSERT INTO engineers (colegiado, nombre, activo, dpi, fecha_nacimiento)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (colegiado) DO UPDATE SET
             nombre = EXCLUDED.nombre,
             activo = EXCLUDED.activo,
             dpi = COALESCE(EXCLUDED.dpi, engineers.dpi),
             fecha_nacimiento = COALESCE(EXCLUDED.fecha_nacimiento, engineers.fecha_nacimiento)`,
          [colegiado, nombre, !!activo, dpi, fecha]
        )
      } else {
        await conn.query(
          `INSERT INTO engineers (colegiado, nombre, activo, dpi, fecha_nacimiento) VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), activo=VALUES(activo), dpi=IFNULL(VALUES(dpi), dpi), fecha_nacimiento=IFNULL(VALUES(fecha_nacimiento), fecha_nacimiento)`,
          [colegiado, nombre, activo, dpi, fecha]
        )
      }
    }
    if (!isPg) await conn.commit()
    return res.json({ ok: true, count: items.length })
  } catch (e) {
    if (!isPg && conn) { try { await conn.rollback() } catch {} }
    return res.status(500).json({ error: 'No se pudo sincronizar el padrón' })
  } finally {
    if (!isPg && conn) conn.release()
  }
})

// Admin: provisionar usuarios para colegiados autorizados (crea si falta, avisa si existe)
authRouter.post('/admin/engineers/provision', requireAuth, requireRole('admin'), async (req, res) => {
  // Expect body: { items: [{ colegiado, nombre?, email, dpi, fechaNacimiento, password? }, ...] }
  const { items } = req.body ?? {}
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Sin elementos' })
  const pool = await getPool()
  const results: any[] = []
  function genPwd() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%^&*()'
    let out = ''
    for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
    return out
  }
  for (const it of items) {
    const colegiado = String(it.colegiado ?? '').trim()
    const email = String(it.email ?? '').trim()
    const dpi = String(it.dpi ?? '').trim()
    const fechaISO = (() => {
      const s = String(it.fechaNacimiento ?? '')
      const iso = s.match(/^\d{4}-\d{2}-\d{2}$/) ? s : null
      return iso ?? null
    })()
    if (!colegiado || !email || !dpi || !fechaISO) { results.push({ colegiado, status: 'skipped', reason: 'datos incompletos' }); continue }
    const [[eng]]: any = await pool.query('SELECT id, activo, nombre, password_hash FROM engineers WHERE colegiado=? LIMIT 1', [colegiado])
    if (!eng) { results.push({ colegiado, status: 'error', reason: 'no autorizado' }); continue }
    if (!eng.activo) { results.push({ colegiado, status: 'error', reason: 'inactivo' }); continue }
    if (eng.password_hash) { results.push({ colegiado, status: 'exists' }); continue }
    const pwd = it.password && String(it.password).length >= 8 ? String(it.password) : genPwd()
    const hash = await bcrypt.hash(pwd, 10)
    try {
      const isPg = (process.env.DB_CLIENT || '').trim().toLowerCase() === 'pg' || (
        process.env.DATABASE_URL && /^(postgres|postgresql):\/\//i.test(String(process.env.DATABASE_URL))
      )
      if (isPg) {
        await pool.query(
          'UPDATE engineers SET nombre=?, email=?, dpi=?, fecha_nacimiento=?, password_hash=?, activo=true WHERE colegiado=?',
          [it.nombre ?? eng.nombre, email, dpi, fechaISO, hash, colegiado]
        )
      } else {
        await pool.query(
          'UPDATE engineers SET nombre=?, email=?, dpi=?, fecha_nacimiento=?, password_hash=?, activo=1 WHERE colegiado=?',
          [it.nombre ?? eng.nombre, email, dpi, fechaISO, hash, colegiado]
        )
      }
      results.push({ colegiado, status: 'created', password: pwd })
    } catch (err: any) {
      if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
        results.push({ colegiado, status: 'exists' })
      } else {
        results.push({ colegiado, status: 'error', reason: 'db' })
      }
    }
  }
  return res.json({ ok: true, results })
})

// Diagnostic endpoint to check engineer count
authRouter.get('/admin/engineers/diagnostics', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const pool = await getPool()
    const [[{ total }]]: any = await pool.query('SELECT COUNT(*) AS total FROM engineers')
    const [[{ activos }]]: any = await pool.query('SELECT COUNT(*) AS activos FROM engineers WHERE activo=true OR activo=1')
    const [[{ admins }]]: any = await pool.query('SELECT COUNT(*) AS admins FROM engineers WHERE is_admin=true OR is_admin=1')
    const [sample]: any = await pool.query('SELECT colegiado, nombre, activo, is_admin FROM engineers LIMIT 5')
    
    return res.json({
      ok: true,
      total: Number(total),
      activos: Number(activos),
      admins: Number(admins),
      sample: sample || []
    })
  } catch (err) {
    console.error('Diagnostics error:', err)
    return res.status(500).json({ error: 'Error obteniendo diagnósticos' })
  }
})

// Secret admin password reset (for emergency recovery)
authRouter.post('/admin/reset-secret', async (req, res) => {
  const { secretToken, colegiado, newPassword } = req.body ?? {}
  const expectedToken = process.env.ADMIN_RESET_SECRET || 'cambiar-esto-urgente'
  
  if (!secretToken || secretToken !== expectedToken) {
    return res.status(403).json({ error: 'Token secreto inválido' })
  }
  
  if (!colegiado || !newPassword) {
    return res.status(400).json({ error: 'Colegiado y nueva contraseña requeridos' })
  }
  
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'Contraseña muy corta (mínimo 8 caracteres)' })
  }
  
  try {
    const pool = await getPool()
    const [[admin]]: any = await pool.query(
      'SELECT id, is_admin FROM engineers WHERE colegiado=? LIMIT 1',
      [String(colegiado)]
    )
    
    if (!admin || !admin.is_admin) {
      return res.status(404).json({ error: 'Admin no encontrado' })
    }
    
    const hash = await bcrypt.hash(String(newPassword), 10)
    const isPg = (process.env.DB_CLIENT || '').trim().toLowerCase() === 'pg' || (
      process.env.DATABASE_URL && /^(postgres|postgresql):\/\//i.test(String(process.env.DATABASE_URL))
    )
    
    if (isPg) {
      await pool.query(
        'UPDATE engineers SET password_hash=?, activo=true WHERE colegiado=?',
        [hash, String(colegiado)]
      )
    } else {
      await pool.query(
        'UPDATE engineers SET password_hash=?, activo=1 WHERE colegiado=?',
        [hash, String(colegiado)]
      )
    }
    
    return res.json({ ok: true, message: 'Contraseña actualizada exitosamente' })
  } catch (err) {
    console.error('Error en reset secreto de admin:', err)
    return res.status(500).json({ error: 'Error interno' })
  }
})

