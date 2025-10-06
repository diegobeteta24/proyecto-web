import { Router, Request, Response } from 'express'
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js'
import { getPool } from '../db.js'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export const adminEngineersRouter = Router()

adminEngineersRouter.use(requireAuth, requireRole('admin'))

// List engineers (basic search & active filter)
adminEngineersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const q = String(req.query.q || '').trim()
  const activeParam = req.query.activo
  const where: string[] = []
  const params: any[] = []
  if (q) {
    where.push('(nombre LIKE ? OR colegiado LIKE ? OR email LIKE ?)')
    const like = `%${q}%`
    params.push(like, like, like)
  }
  if (typeof activeParam !== 'undefined') {
    const val = String(activeParam) === '1' ? 1 : 0
    where.push('activo=?')
    params.push(val)
  }
  const sql = `SELECT id, colegiado, nombre, email, activo, is_admin FROM engineers ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY nombre LIMIT 200`
  const pool = await getPool()
  const [rows]: any = await pool.query(sql, params)
  return res.json(rows.map((r: any) => ({ id: String(r.id), colegiado: String(r.colegiado), nombre: r.nombre, email: r.email, activo: !!r.activo, isAdmin: !!r.is_admin })))
})

// Patch engineer fields (activo, nombre, email, password)
const patchSchema = z.object({
  nombre: z.string().trim().min(3).optional(),
  email: z.string().trim().email().optional(),
  activo: z.boolean().optional(),
  password: z.string().min(8).refine(v => /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && /[^\w\s]/.test(v), 'Password débil').optional()
})

adminEngineersRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'ID inválido' })
  const parsed = patchSchema.safeParse(req.body || {})
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' })
  const { nombre, email, activo, password } = parsed.data
  const pool = await getPool()
  const fields: string[] = []
  const values: any[] = []
  if (typeof nombre !== 'undefined') { fields.push('nombre=?'); values.push(nombre) }
  if (typeof email !== 'undefined') { fields.push('email=?'); values.push(email) }
  if (typeof activo !== 'undefined') { fields.push('activo=?'); values.push(activo ? 1 : 0) }
  if (typeof password !== 'undefined') { const hash = await bcrypt.hash(password, 10); fields.push('password_hash=?'); values.push(hash) }
  if (!fields.length) return res.json({ ok: true, noop: true })
  try {
    await pool.query(`UPDATE engineers SET ${fields.join(', ')} WHERE id=?`, [...values, id])
  } catch (err: any) {
    if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
      return res.status(409).json({ error: 'Email duplicado' })
    }
    return res.status(500).json({ error: 'No se pudo actualizar' })
  }
  const [[row]]: any = await pool.query('SELECT id, colegiado, nombre, email, activo, is_admin FROM engineers WHERE id=? LIMIT 1', [id])
  if (!row) return res.status(404).json({ error: 'No encontrado' })
  return res.json({ id: String(row.id), colegiado: String(row.colegiado), nombre: row.nombre, email: row.email, activo: !!row.activo, isAdmin: !!row.is_admin })
})

// Reset password with generated strong one
adminEngineersRouter.post('/:id/reset-password', async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'ID inválido' })
  function genPwd() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%^&*()'
    let out = ''
    for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
    return out
  }
  const password = genPwd()
  const hash = await bcrypt.hash(password, 10)
  const pool = await getPool()
  await pool.query('UPDATE engineers SET password_hash=? WHERE id=?', [hash, id])
  return res.json({ ok: true, password })
})
