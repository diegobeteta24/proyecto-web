import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Container, Card, ListGroup, Badge, Button, Row, Col } from 'react-bootstrap'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const API = '/api'

export default function CampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [token] = useState<string | null>(() => localStorage.getItem('token'))
  const [item, setItem] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const pollRef = useRef<number | null>(null)
  const [voting, setVoting] = useState(false)

  useEffect(() => {
    if (!id) return
    (async () => {
      try {
        setLoading(true)
        const res = await fetch(`${API}/campaigns/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        if (!res.ok) {
          setError('No se pudo cargar la campaña'); setLoading(false); return
        }
        const data = await res.json()
        setItem(data)
      } catch (e: any) {
        setError(e?.message || 'Error de red')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, token])

  // Clock tick (for countdown)
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  // Poll for live results every 7s while campaign active
  useEffect(() => {
    if (!item) return
    const start = new Date(item.iniciaEn).getTime()
    const end = new Date(item.terminaEn).getTime()
    const activeWindow = item.habilitada && now >= start && now <= end
    if (activeWindow && pollRef.current == null) {
      const h = window.setInterval(async () => {
        try {
          const res = await fetch(`${API}/campaigns/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
          if (res.ok) {
            const data = await res.json()
            setItem(data)
          }
        } catch {}
      }, 7000)
      pollRef.current = h as unknown as number
    }
    if (!activeWindow && pollRef.current != null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current != null) { window.clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [item, id, token, now])

  const chartData = useMemo(() => {
    if (!item) return []
    return item.candidatos.map((c: any) => ({ id: c.id, name: c.nombre, value: item.votos?.[c.id] ?? 0 }))
  }, [item])
  const totalVotes = useMemo(() => chartData.reduce((acc: number, d: any) => acc + (d.value || 0), 0), [chartData])
  // Only draw slices with > 0 votes to avoid degenerate wedges that distort the donut
  const chartSlices = useMemo(() => chartData.filter((d: any) => (d.value || 0) > 0), [chartData])
  const colors = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc948','#af7aa1','#ff9da7']
  // We'll compute finished earlier so podium can reference it
  const startMs = item ? new Date(item.iniciaEn).getTime() : 0
  const endMs = item ? new Date(item.terminaEn).getTime() : 0
  const inWindow = item ? (now >= startMs && now <= endMs) : false
  const finished = item ? now > endMs : false
  const timeLeftMs = item ? Math.max(0, endMs - now) : 0
  const hh = String(Math.floor(timeLeftMs / 3600000)).padStart(2, '0')
  const mm = String(Math.floor((timeLeftMs % 3600000) / 60000)).padStart(2, '0')
  const ss = String(Math.floor((timeLeftMs % 60000) / 1000)).padStart(2, '0')
  const canVote = item && item.habilitada && inWindow && ((item.votosDisponibles ?? item.votosPorVotante) > 0)

  const podium = useMemo(() => {
    if (!item || !finished) return null
    type PodEntry = { id: string, nombre: string, votos: number }
    const list: PodEntry[] = item.candidatos.map((c: any) => ({ id: String(c.id), nombre: c.nombre, votos: item.votos?.[c.id] ?? 0 }))
    const total = list.reduce((a, b) => a + b.votos, 0)
    if (total === 0) return { total: 0, entries: [] as any[], winnerTie: false }
    list.sort((a, b) => b.votos - a.votos)
    const entries: Array<{ position: number, votos: number, candidates: PodEntry[] }> = []
    let currentPos = 1
    let idx = 0
    while (idx < list.length && entries.length < 3) {
      const votosRef = list[idx].votos
      const group = list.filter((x) => x.votos === votosRef)
      entries.push({ position: currentPos, votos: votosRef, candidates: group })
      idx += group.length
      currentPos += group.length
    }
    const winnerTie = entries.length > 0 && entries[0].candidates.length > 1
    return { total, entries, winnerTie }
  }, [item, finished])

  if (loading) return <Container><p>Cargando…</p></Container>
  if (error) return <Container><p className="text-danger">{error}</p></Container>
  if (!item) return <Container><p>No encontrada</p></Container>

  // (moved calculations above for ordering)

  async function vote(candidateId: string) {
    if (!token) return alert('Inicia sesión para votar')
    if (!canVote) return
    try {
      setVoting(true)
      const res = await fetch(`${API}/campaigns/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ candidateId })
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'No se pudo registrar el voto'); return }
      setItem((prev: any) => ({ ...prev, votos: data.votos, votosDisponibles: data.disponibles }))
    } catch {
      alert('No se pudo registrar el voto')
    } finally {
      setVoting(false)
    }
  }

  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">{item.titulo}</h2>
        <div className="d-flex gap-2">
          <Link className="btn btn-outline-secondary btn-sm" to="/campaigns">Volver</Link>
        </div>
      </div>
      <Card>
        <Card.Body>
          <Card.Text>{item.descripcion}</Card.Text>
          <div className="mb-2">
            <Badge bg={item.habilitada ? 'success' : 'secondary'} className="me-2">{item.habilitada ? 'Habilitada' : 'Deshabilitada'}</Badge>
            <small className="text-muted">{new Date(item.iniciaEn).toLocaleString()} → {new Date(item.terminaEn).toLocaleString()}</small>
          </div>
          <div className="mb-1"><strong>Votos disponibles:</strong> {item.votosDisponibles ?? item.votosPorVotante}</div>
          <div className="mb-3">
            {finished ? (
              <span className="text-muted">Votación finalizada</span>
            ) : (
              <span>Tiempo restante: <strong>{hh}:{mm}:{ss}</strong></span>
            )}
          </div>
          <div className="d-flex flex-column flex-lg-row gap-4">
            <div style={{ minWidth: 280, width: '100%', maxWidth: 420, marginBottom: '1.25rem', marginTop: '1.75rem' }}>
              {totalVotes === 0 ? (
                <div className="d-flex align-items-center justify-content-center" style={{height: 240}}>
                  <small className="text-muted">Aún no hay votos</small>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      dataKey="value"
                      data={chartSlices}
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={0.5}
                      stroke="none"
                      isAnimationActive={false}
                      labelLine={false}
                      label={(p: any) => {
                        const pct = totalVotes > 0 ? Math.round((p.value / totalVotes) * 100) : 0
                        return p.value > 0 && pct >= 8 ? `${pct}%` : ''
                      }}
                    >
                      {chartSlices.map((_: any, idx: number) => <Cell key={idx} fill={colors[idx % colors.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${v} voto(s)`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {podium && podium.total > 0 && (
                <div className="mt-3" style={{fontSize:14}}>
                  <strong>Resultados finales:</strong><br />
                  {podium.winnerTie ? (
                    <div className="text-warning mb-1">Empate en primer lugar ({podium.entries[0].candidates[0].votos} voto(s))</div>
                  ) : (
                    <div className="text-success mb-1">Ganador: {podium.entries[0].candidates[0].nombre} ({podium.entries[0].candidates[0].votos} voto(s))</div>
                  )}
                  <ol className="mb-0" style={{paddingLeft:'1.2rem'}}>
                    {podium.entries.map((e: any) => (
                      <li key={e.position} style={{marginBottom:4}}>
                        <span style={{fontWeight:600}}>
                          {e.position === 1 && '🥇 '}
                          {e.position === 2 && '🥈 '}
                          {e.position === 3 && '🥉 '}
                          {e.candidates.length > 1 ? `Empate (${e.candidates.length})` : ''}
                        </span>
                        {e.candidates.map((c: any, i: number)=> (
                          <span key={c.id}>
                            {i>0 && ', '}
                            {c.nombre} <span className="text-muted">[{c.votos}]</span>
                          </span>
                        ))}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            <div className="flex-grow-1">
              <h5>Candidatos</h5>
              <Row className="g-3">
                {item.candidatos.map((c: any, i: number) => {
                  const src = c.fotoUrl || `https://picsum.photos/seed/cand-${c.id || i}/480/300`
                  const votos = item.votos?.[c.id] ?? 0
                  const isWinner = finished && podium && podium.entries.length>0 && podium.entries[0].candidates.some((w:any)=> w.id === c.id)
                  const winnerTie = podium?.winnerTie
                  return (
                    <Col md={6} lg={4} key={c.id}>
                      <Card className="h-100">
                        <Card.Img variant="top" src={src} alt={c.nombre} style={{ height: 160, objectFit: 'cover' }} />
                        <Card.Body className="d-flex flex-column">
                          <Card.Title className="fs-6 mb-1">{c.nombre}</Card.Title>
                          {c.bio ? <Card.Text className="text-muted small flex-grow-1">{c.bio}</Card.Text> : <div className="flex-grow-1" />}
                          <div className="d-flex justify-content-between align-items-center mt-2">
                            <Badge bg={isWinner ? (winnerTie ? 'warning' : 'success') : 'light'} text={isWinner ? 'light' : 'dark'}>
                              {votos} voto(s){isWinner && !winnerTie && ' • Ganador'}{isWinner && winnerTie && ' • Empate 1°'}
                            </Badge>
                            <Button size="sm" disabled={!canVote || voting} onClick={() => vote(c.id)}>Votar</Button>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  )
                })}
              </Row>
            </div>
          </div>
          <div className="mt-3">
            <small className="text-muted">La votación está disponible únicamente durante el periodo establecido.</small>
          </div>
        </Card.Body>
      </Card>
    </Container>
  )
}
