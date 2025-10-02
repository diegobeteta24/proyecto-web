import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Container, Card, ListGroup, Badge, Button } from 'react-bootstrap'
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

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
    return item.candidatos.map((c: any) => ({ name: c.nombre, value: item.votos?.[c.id] ?? 0 }))
  }, [item])
  const colors = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc948']

  if (loading) return <Container><p>Cargando…</p></Container>
  if (error) return <Container><p className="text-danger">{error}</p></Container>
  if (!item) return <Container><p>No encontrada</p></Container>

  const startMs = new Date(item.iniciaEn).getTime()
  const endMs = new Date(item.terminaEn).getTime()
  const inWindow = now >= startMs && now <= endMs
  const finished = now > endMs
  const timeLeftMs = Math.max(0, endMs - now)
  const hh = String(Math.floor(timeLeftMs / 3600000)).padStart(2, '0')
  const mm = String(Math.floor((timeLeftMs % 3600000) / 60000)).padStart(2, '0')
  const ss = String(Math.floor((timeLeftMs % 60000) / 1000)).padStart(2, '0')
  const canVote = item.habilitada && inWindow && (item.votosDisponibles ?? item.votosPorVotante) > 0

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
            <div>
              <PieChart width={320} height={240}>
                <Pie dataKey="value" data={chartData} cx={140} cy={110} outerRadius={80}>
                  {chartData.map((entry: any, idx: number) => <Cell key={idx} fill={colors[idx % colors.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </div>
            <div className="flex-grow-1">
              <h5>Candidatos</h5>
              <ListGroup>
                {item.candidatos.map((c: any) => (
                  <ListGroup.Item key={c.id} className="d-flex justify-content-between align-items-center gap-3">
                    <span>{c.nombre}</span>
                    <div className="d-flex align-items-center gap-2">
                      <Badge bg="light" text="dark">{item.votos?.[c.id] ?? 0} voto(s)</Badge>
                      <Button size="sm" disabled={!canVote || voting} onClick={() => vote(c.id)}>Votar</Button>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
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
