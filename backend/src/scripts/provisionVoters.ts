import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { migrate, getPool } from '../db'

function normalize(dateStr: string) {
  const m = dateStr.match(/^\d{4}-\d{2}-\d{2}$/)
  if (m) return dateStr
  throw new Error('fechaNacimiento debe ser YYYY-MM-DD')
}

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Uso: tsx src/scripts/provisionVoters.ts <ruta-json>')
    process.exit(1)
  }
  const data = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'))
  if (!Array.isArray(data)) throw new Error('El archivo debe ser un arreglo JSON')
  await migrate()
  const pool = await getPool()
  const results: any[] = []
  function genPwd() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%^&*()'
    let out = ''
    for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
    return out
  }
  for (const it of data) {
    const colegiado = String(it.colegiado ?? '').trim()
    const email = String(it.email ?? '').trim()
    const dpi = String(it.dpi ?? '').trim()
    const fechaISO = normalize(String(it.fechaNacimiento ?? ''))
    if (!colegiado || !dpi || !fechaISO) { results.push({ colegiado, status: 'skipped', reason: 'datos incompletos' }); continue }
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
          [it.nombre ?? eng.nombre, email || null, dpi, fechaISO, hash, colegiado]
        )
      } else {
        await pool.query(
          'UPDATE engineers SET nombre=?, email=?, dpi=?, fecha_nacimiento=?, password_hash=?, activo=1 WHERE colegiado=?',
          [it.nombre ?? eng.nombre, email || null, dpi, fechaISO, hash, colegiado]
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
  console.table(results)
}

main().catch(err => { console.error(err); process.exit(1) })
