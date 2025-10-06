import { Router, type Request, type Response } from 'express'
import { AuthRequest, requireAuth, requireRole, requireRoles } from '../middleware/auth'
import { getPool } from '../db'

export const campaignsRouter = Router()

// Helpers
async function fetchCampaignWithStats(campaignId: number) {
  const pool = await getPool()
  const [[campaign]]: any = await pool.query(
    'SELECT id, titulo, descripcion, votos_por_votante, habilitada, inicia_en, termina_en FROM campaigns WHERE id=? LIMIT 1',
    [campaignId]
  )
  if (!campaign) return null
  let cands: any[] = []
  try {
    const [rows]: any = await pool.query(
      'SELECT c.id, c.nombre, c.bio AS cand_bio, c.foto_url, c.engineer_id, cc.bio AS cc_bio FROM candidates c INNER JOIN campaign_candidates cc ON cc.candidate_id=c.id WHERE cc.campaign_id=? ORDER BY c.id',
      [campaignId]
    )
    cands = rows
  } catch (err: any) {
    // Fallback if cc.bio column does not yet exist (migration race) -> ignore per-campaign bio
    if (err && (err.code === 'ER_BAD_FIELD_ERROR' || /Unknown column 'cc\.bio'/i.test(String(err.message)))) {
      try {
        const [rows2]: any = await pool.query(
          'SELECT c.id, c.nombre, c.bio AS cand_bio, c.foto_url, c.engineer_id, NULL AS cc_bio FROM candidates c INNER JOIN campaign_candidates cc ON cc.candidate_id=c.id WHERE cc.campaign_id=? ORDER BY c.id',
          [campaignId]
        )
        cands = rows2
      } catch (inner) {
        console.error('fetchCampaignWithStats fallback failed', inner)
        cands = []
      }
    } else {
      console.error('fetchCampaignWithStats candidates query failed', err)
      cands = []
    }
  }
  let voteRows: any[] = []
  try {
    const [vr]: any = await pool.query(
      'SELECT candidate_id, COUNT(*) AS cnt FROM votes WHERE campaign_id=? GROUP BY candidate_id',
      [campaignId]
    )
    voteRows = vr
  } catch (e) {
    console.error('fetchCampaignWithStats votes query failed', e)
  }
  const votos: Record<string, number> = {}
  for (const r of voteRows) votos[String(r.candidate_id)] = Number(r.cnt)
  return {
    id: campaign.id,
    titulo: campaign.titulo,
    descripcion: campaign.descripcion,
    habilitada: !!campaign.habilitada,
    iniciaEn: new Date(campaign.inicia_en).toISOString(),
    terminaEn: new Date(campaign.termina_en).toISOString(),
    candidatos: cands.map((c: any) => ({ id: String(c.id), nombre: c.nombre, bio: (c.cc_bio ?? c.cand_bio) || null, fotoUrl: c.foto_url, engineerId: c.engineer_id ? String(c.engineer_id) : undefined })),
    votos,
    votosPorVotante: Number(campaign.votos_por_votante),
  }
}

// List campaigns (requires auth)
campaignsRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const pool = await getPool()
    const [rows]: any = await pool.query('SELECT id FROM campaigns ORDER BY inicia_en DESC')
    // Map of used votes per campaign for this voter
    const usedMap: Record<string, number> = {}
    if (req.user?.id) {
      const voterId = Number(req.user.id)
      const [usedRows]: any = await pool.query('SELECT campaign_id, COUNT(*) AS used FROM votes WHERE voter_id=? GROUP BY campaign_id', [voterId])
      for (const r of usedRows) usedMap[String(r.campaign_id)] = Number(r.used)
    }
    const result: any[] = []
    const now = Date.now()
    for (const r of rows) {
      try {
        const data = await fetchCampaignWithStats(Number(r.id))
        if (!data) continue
        // Auto-deshabilitar si terminó
        try {
          const end = new Date((data as any).terminaEn).getTime()
          if ((data as any).habilitada && now > end) {
            await pool.query('UPDATE campaigns SET habilitada=0 WHERE id=?', [(data as any).id])
            ;(data as any).habilitada = false
          }
        } catch (innerEnd) {
          console.error('Error auto-deshabilitando campaña', { id: r.id, err: (innerEnd as any)?.message })
        }
        const used = usedMap[String((data as any).id)] ?? 0
        ;(data as any).votosDisponibles = Math.max(0, Number((data as any).votosPorVotante ?? 0) - used)
        result.push(data)
      } catch (eachErr) {
        console.error('Error procesando campaña en listado', { id: r.id, err: (eachErr as any)?.message })
        continue
      }
    }
    return res.json(result)
  } catch (err: any) {
    console.error('GET /api/campaigns failed', err?.message, err)
    return res.status(500).json({ error: 'Error al listar campañas' })
  }
})

// Admin: list selectable candidates from active engineers
campaignsRouter.get('/options/engineers', requireAuth, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const pool = await getPool()
  const [rows]: any = await pool.query('SELECT id, colegiado, nombre FROM engineers WHERE activo=1 ORDER BY nombre')
  return res.json(rows.map((r: any) => ({ id: String(r.id), colegiado: r.colegiado, nombre: r.nombre })))
})

// Admin: search engineers (active) by name or colegiado
campaignsRouter.get('/options/engineers/search', requireAuth, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  let q = String((req.query.q ?? '').toString()).trim()
  if (q.length > 100) q = q.slice(0, 100)
  if (!q) return res.json([])
  const like = `%${q}%`
  const pool = await getPool()
  const [rows]: any = await pool.query(
    'SELECT id, colegiado, nombre FROM engineers WHERE activo=1 AND (nombre LIKE ? OR CAST(colegiado AS CHAR) LIKE ?) ORDER BY nombre LIMIT 20',
    [like, like]
  )
  return res.json(rows.map((r: any) => ({ id: String(r.id), colegiado: r.colegiado, nombre: r.nombre })))
})

// Admin: delete a campaign and its relations
campaignsRouter.delete('/:id', requireAuth, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const id = req.params.id
  const pool: any = await getPool()
  const useConn = !!pool.getConnection
  let conn: any = null
  try {
    if (useConn) {
      conn = await pool.getConnection()
      await conn.beginTransaction()
      await conn.query('DELETE FROM votes WHERE campaign_id=?', [id])
      await conn.query('DELETE FROM campaign_candidates WHERE campaign_id=?', [id])
      const [result]: any = await conn.query('DELETE FROM campaigns WHERE id=?', [id])
      await conn.commit()
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Campaña no encontrada' })
      return res.status(204).end()
    } else {
      // Postgres simple sequence (FK cascades no están definidas, hacemos manual)
      await pool.query('DELETE FROM votes WHERE campaign_id=?', [id])
      await pool.query('DELETE FROM campaign_candidates WHERE campaign_id=?', [id])
      const [result]: any = await pool.query('DELETE FROM campaigns WHERE id=?', [id])
      // In pg result.rowCount disponible; imitamos affectedRows
      const affected = result?.affectedRows ?? result?.rowCount ?? 0
      if (affected === 0) return res.status(404).json({ error: 'Campaña no encontrada' })
      return res.status(204).end()
    }
  } catch (err) {
    if (useConn && conn) { try { await conn.rollback() } catch {} }
    console.error('DELETE /campaigns/:id failed', err)
    return res.status(500).json({ error: 'Error eliminando la campaña' })
  } finally {
    if (useConn && conn) conn.release()
  }
})

// Admin create campaign
campaignsRouter.post('/', requireAuth, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { titulo, descripcion, votosPorVotante, habilitada, iniciaEn, terminaEn, candidatos } = req.body ?? {}
  if (!titulo || !votosPorVotante || !iniciaEn || !terminaEn) return res.status(400).json({ error: 'Campos requeridos faltantes' })
  const start = new Date(iniciaEn)
  const end = new Date(terminaEn)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) return res.status(400).json({ error: 'Rango de fechas inválido' })
  const pool: any = await getPool()
  const useConn = !!pool.getConnection
  let conn: any = null
  try {
    if (useConn) {
      conn = await pool.getConnection()
      await conn.beginTransaction()
    }
    const exec = async (sql: string, params?: any[]) => useConn ? conn.query(sql, params) : pool.query(sql, params)
    const [ins]: any = await exec(
      'INSERT INTO campaigns (titulo, descripcion, votos_por_votante, habilitada, inicia_en, termina_en) VALUES (?, ?, ?, ?, ?, ?)',
      [titulo, descripcion ?? null, Number(votosPorVotante), habilitada ? 1 : 0, start, end]
    )
    const campaignId = ins.insertId ?? ins[0]?.id ?? ins?.rows?.[0]?.id
    const candArr: any[] = Array.isArray(candidatos) ? candidatos : []
    for (const c of candArr) {
      let candidateId: number | null = null
      if (c && typeof c === 'object' && c.id) {
        candidateId = Number(c.id)
      } else if (c && typeof c === 'object' && c.engineerId) {
        // Create or reuse candidate bound to engineer
        const engId = Number(c.engineerId)
        const [[existing]]: any = await exec('SELECT id FROM candidates WHERE engineer_id=? LIMIT 1', [engId])
        if (existing) {
          candidateId = Number(existing.id)
        } else {
          const [[eng]]: any = await exec('SELECT nombre FROM engineers WHERE id=? AND activo=1 LIMIT 1', [engId])
          if (!eng) throw new Error('Engineer not found or inactive')
          const [insC]: any = await exec('INSERT INTO candidates (nombre, engineer_id) VALUES (?, ?)', [eng.nombre, engId])
          candidateId = insC.insertId
        }
      } else if (typeof c === 'string') {
        const nombre = c
        const [insC]: any = await exec('INSERT INTO candidates (nombre) VALUES (?)', [nombre])
        candidateId = insC.insertId
      } else {
        const nombre = c?.nombre ?? 'Candidato'
        const [insC]: any = await exec('INSERT INTO candidates (nombre, foto_url) VALUES (?, ?)', [nombre, c?.fotoUrl ?? null])
        candidateId = insC.insertId
      }
      // Insert link with optional per-campaign bio
      if (useConn) {
        await conn.query('INSERT INTO campaign_candidates (campaign_id, candidate_id, bio) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE bio=VALUES(bio)', [campaignId, candidateId, (c && typeof c === 'object' && c.bio) ? String(c.bio).trim() || null : null])
      } else {
        // Pg: upsert manual (no ON DUPLICATE KEY). Intentar insert y si viola PK, actualizar
        try {
          await pool.query('INSERT INTO campaign_candidates (campaign_id, candidate_id, bio) VALUES (?, ?, ?)', [campaignId, candidateId, (c && typeof c === 'object' && c.bio) ? String(c.bio).trim() || null : null])
        } catch (e: any) {
          if (e?.code === '23505') {
            await pool.query('UPDATE campaign_candidates SET bio=? WHERE campaign_id=? AND candidate_id=?', [(c && typeof c === 'object' && c.bio) ? String(c.bio).trim() || null : null, campaignId, candidateId])
          } else throw e
        }
      }
    }
    if (useConn) await conn.commit()
    const data = await fetchCampaignWithStats(campaignId)
    return res.json(data)
  } catch (err: any) {
    if (useConn && conn) { try { await conn.rollback() } catch {} }
    return res.status(500).json({ error: 'No se pudo crear la campaña' })
  } finally {
    if (useConn && conn) conn.release()
  }
})

// Update campaign (toggle, edit fields, replace candidates)
campaignsRouter.patch('/:id', requireAuth, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  const { titulo, descripcion, votosPorVotante, habilitada, iniciaEn, terminaEn, candidatos } = req.body ?? {}
  const pool: any = await getPool()
  const useConn = !!pool.getConnection
  let conn: any = null
  try {
    if (useConn) { conn = await pool.getConnection(); await conn.beginTransaction() }
    const exec = async (sql: string, params?: any[]) => useConn ? conn.query(sql, params) : pool.query(sql, params)
    // Update core campaign fields if provided
    const fields: string[] = []
    const values: any[] = []
    if (typeof titulo === 'string') { fields.push('titulo=?'); values.push(titulo) }
    if (typeof descripcion !== 'undefined') { fields.push('descripcion=?'); values.push(descripcion ?? null) }
    if (typeof votosPorVotante !== 'undefined') { fields.push('votos_por_votante=?'); values.push(Number(votosPorVotante)) }
    if (typeof habilitada !== 'undefined') { fields.push('habilitada=?'); values.push(habilitada ? 1 : 0) }
    if (typeof iniciaEn !== 'undefined') { fields.push('inicia_en=?'); values.push(new Date(iniciaEn)) }
    if (typeof terminaEn !== 'undefined') { fields.push('termina_en=?'); values.push(new Date(terminaEn)) }
    if (fields.length > 0) {
      await exec(`UPDATE campaigns SET ${fields.join(', ')} WHERE id=?`, [...values, id])
    }
    // Replace candidates if provided
    if (Array.isArray(candidatos)) {
      // Remove existing links
      await exec('DELETE FROM campaign_candidates WHERE campaign_id=?', [id])
      for (const c of candidatos) {
        let candidateId: number | null = null
        if (c && typeof c === 'object' && c.id) {
          candidateId = Number(c.id)
        } else if (c && typeof c === 'object' && c.engineerId) {
          const engId = Number(c.engineerId)
          const [[existing]]: any = await exec('SELECT id FROM candidates WHERE engineer_id=? LIMIT 1', [engId])
          if (existing) {
            candidateId = Number(existing.id)
          } else {
            const [[eng]]: any = await exec('SELECT nombre FROM engineers WHERE id=? AND activo=1 LIMIT 1', [engId])
            if (!eng) throw new Error('Engineer not found or inactive')
            const [insC]: any = await exec('INSERT INTO candidates (nombre, engineer_id) VALUES (?, ?)', [eng.nombre, engId])
            candidateId = insC.insertId
          }
        } else {
          const nombre = typeof c === 'string' ? c : c?.nombre ?? 'Candidato'
          const [insC]: any = await exec('INSERT INTO candidates (nombre, foto_url) VALUES (?, ?)', [nombre, c?.fotoUrl ?? null])
          candidateId = insC.insertId
        }
        if (useConn) {
          await conn.query('INSERT INTO campaign_candidates (campaign_id, candidate_id, bio) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE bio=VALUES(bio)', [id, candidateId, (c && typeof c === 'object' && c.bio) ? String(c.bio).trim() || null : null])
        } else {
          try {
            await pool.query('INSERT INTO campaign_candidates (campaign_id, candidate_id, bio) VALUES (?, ?, ?)', [id, candidateId, (c && typeof c === 'object' && c.bio) ? String(c.bio).trim() || null : null])
          } catch (e: any) {
            if (e?.code === '23505') {
              await pool.query('UPDATE campaign_candidates SET bio=? WHERE campaign_id=? AND candidate_id=?', [(c && typeof c === 'object' && c.bio) ? String(c.bio).trim() || null : null, id, candidateId])
            } else throw e
          }
        }
      }
    }
    if (useConn) await conn.commit()
    const data = await fetchCampaignWithStats(id)
    if (!data) return res.status(404).json({ error: 'Campaña no encontrada' })
    return res.json(data)
  } catch (err) {
    if (useConn && conn) { try { await conn.rollback() } catch {} }
    return res.status(500).json({ error: 'No se pudo actualizar la campaña' })
  } finally {
    if (useConn && conn) conn.release()
  }
})

// Vote in a campaign
campaignsRouter.post('/:id/vote', requireAuth, requireRoles(['voter','admin']), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  const { candidateId } = req.body ?? {}
  if (!candidateId) return res.status(400).json({ error: 'Candidato requerido' })
  const pool = await getPool()
  // Get campaign and rules
  const [[campaign]]: any = await pool.query('SELECT id, habilitada, inicia_en, termina_en, votos_por_votante FROM campaigns WHERE id=? LIMIT 1', [id])
  if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })
  const now = new Date()
  if (!campaign.habilitada || now < new Date(campaign.inicia_en) || now > new Date(campaign.termina_en)) {
    return res.status(400).json({ error: 'Campaña no habilitada o fuera de tiempo' })
  }
  // Validate candidate belongs to campaign
  const [[candOk]]: any = await pool.query('SELECT 1 AS ok FROM campaign_candidates WHERE campaign_id=? AND candidate_id=? LIMIT 1', [id, Number(candidateId)])
  if (!candOk) return res.status(400).json({ error: 'Candidato inválido' })
  const voterId = Number(req.user!.id) // now refers to engineers.id
  const [[{ used }]]: any = await pool.query('SELECT COUNT(*) AS used FROM votes WHERE campaign_id=? AND voter_id=?', [id, voterId])
  if (Number(used) >= Number(campaign.votos_por_votante)) {
    return res.status(400).json({ error: 'No tienes votos disponibles' })
  }
  try {
    await pool.query('INSERT INTO votes (campaign_id, candidate_id, voter_id) VALUES (?, ?, ?)', [id, Number(candidateId), voterId])
  } catch (err: any) {
    if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
      return res.status(409).json({ error: 'Ya registraste un voto para este candidato en esta campaña' })
    }
    return res.status(500).json({ error: 'No se pudo registrar el voto' })
  }
  // Return updated counts and remaining
  const [voteRows]: any = await pool.query('SELECT candidate_id, COUNT(*) AS cnt FROM votes WHERE campaign_id=? GROUP BY candidate_id', [id])
  const votos: Record<string, number> = {}
  for (const r of voteRows) votos[String(r.candidate_id)] = Number(r.cnt)
  const remaining = Number(campaign.votos_por_votante) - (Number(used) + 1)
  return res.json({ ok: true, votos, usados: Number(used) + 1, disponibles: remaining })
})

// Get a campaign detail
campaignsRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  try {
    const data = await fetchCampaignWithStats(id)
    if (!data) return res.status(404).json({ error: 'No encontrada' })
    try {
      const pool = await getPool()
      // Auto-deshabilitar si terminó
      try {
        const end = new Date((data as any).terminaEn).getTime()
        if ((data as any).habilitada && Date.now() > end) {
          await pool.query('UPDATE campaigns SET habilitada=0 WHERE id=?', [id])
          ;(data as any).habilitada = false
        }
      } catch {}
      const voterId = req.user?.id ? Number(req.user.id) : null
      if (voterId) {
        const [[row]]: any = await pool.query('SELECT COUNT(*) AS used FROM votes WHERE campaign_id=? AND voter_id=?', [id, voterId])
        const used = Number(row?.used ?? 0)
        ;(data as any).votosDisponibles = Math.max(0, Number((data as any).votosPorVotante ?? 0) - used)
      } else {
        ;(data as any).votosDisponibles = Number((data as any).votosPorVotante ?? 0)
      }
    } catch (inner) {
      console.error('Error computing votosDisponibles', inner)
    }
    return res.json(data)
  } catch (err) {
    console.error('GET /api/campaigns/:id failed', err)
    return res.status(500).json({ error: 'Error interno obteniendo campaña' })
  }
})
