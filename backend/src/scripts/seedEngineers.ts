import 'dotenv/config'
import { migrate, getPool } from '../db.js'

async function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
  if (args.length === 0) {
    console.error('Uso: tsx src/scripts/seedEngineers.ts <ruta-json> [ruta-json-2 ...]')
    process.exit(1)
  }
  const fs = await import('node:fs/promises')
  const merged: any[] = []
  for (const file of args) {
    const json = JSON.parse(await fs.readFile(file, 'utf8'))
    if (Array.isArray(json)) merged.push(...json)
    else if (Array.isArray(json?.items)) merged.push(...json.items)
    else throw new Error(`El archivo ${file} debe ser un arreglo JSON o { items: [] }`)
  }
  await migrate()
  const pool: any = await getPool()
  const isPg = (process.env.DB_CLIENT || '').trim().toLowerCase() === 'pg' || (
    process.env.DATABASE_URL && /^(postgres|postgresql):\/\//i.test(String(process.env.DATABASE_URL))
  )
  let count = 0
  if (isPg) {
    try {
      await pool.query('BEGIN')
      for (const it of merged) {
        const colegiado = String(it.colegiado ?? '').trim()
        const nombre = String(it.nombre ?? '').trim()
        // Forzar todos activos independientemente del JSON
        const activo = true
        const dpi = it.dpi ? String(it.dpi).trim() : null
        const fecha = it.fechaNacimiento ? String(it.fechaNacimiento).trim() : null
        if (!colegiado || !nombre) continue
        await pool.query(
          `INSERT INTO engineers (colegiado, nombre, activo, dpi, fecha_nacimiento)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (colegiado) DO UPDATE SET
             nombre = EXCLUDED.nombre,
             activo = EXCLUDED.activo,
             dpi = COALESCE(EXCLUDED.dpi, engineers.dpi),
             fecha_nacimiento = COALESCE(EXCLUDED.fecha_nacimiento, engineers.fecha_nacimiento)`,
          [colegiado, nombre, activo, dpi, fecha]
        )
        count++
      }
  // Asegurar admin para colegiado 19999
  await pool.query('UPDATE engineers SET is_admin=true, activo=true WHERE colegiado=?', ['19999'])
  await pool.query('COMMIT')
  console.log(`Seeded/updated ${count} engineers (PostgreSQL) from ${args.length} file(s) (19999 => admin)`) 
    } catch (e) {
      try { await pool.query('ROLLBACK') } catch {}
      console.error('Seed error (pg)', e)
      process.exit(1)
    }
  } else {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      for (const it of merged) {
        const colegiado = String(it.colegiado ?? '').trim()
        const nombre = String(it.nombre ?? '').trim()
        // Forzar activos
        const activo = 1
        const dpi = it.dpi ? String(it.dpi).trim() : null
        const fecha = it.fechaNacimiento ? String(it.fechaNacimiento).trim() : null
        if (!colegiado || !nombre) continue
        await conn.query(
          `INSERT INTO engineers (colegiado, nombre, activo, dpi, fecha_nacimiento) VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), activo=VALUES(activo), dpi=IFNULL(VALUES(dpi), dpi), fecha_nacimiento=IFNULL(VALUES(fecha_nacimiento), fecha_nacimiento)`,
          [colegiado, nombre, activo, dpi, fecha]
        )
        count++
      }
  await conn.query('UPDATE engineers SET is_admin=1, activo=1 WHERE colegiado=?', ['19999'])
  await conn.commit()
  console.log(`Seeded/updated ${count} engineers (MySQL) from ${args.length} file(s) (19999 => admin)`) 
    } catch (e) {
      try { await conn.rollback() } catch {}
      console.error('Seed error (mysql)', e)
      process.exit(1)
    } finally {
      conn.release()
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
