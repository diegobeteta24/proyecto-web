import { useEffect, useMemo, useState } from 'react'
import { Container, Nav, Navbar, Button, Card, Row, Col, Badge } from 'react-bootstrap'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import './styles/main.scss'
import { safeDisplayName } from './utils/encoding'
import Register from './pages/Register'
import Login from './pages/Login'
import Landing from './pages/Landing'
import AdminCampaigns from './pages/AdminCampaigns'
import AdminLogin from './pages/AdminLogin'
import CampaignDetail from './pages/CampaignDetail'
import AdminPasswordReset from './pages/AdminPasswordReset'

const API = '/api'

function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const login = (t: string) => { localStorage.setItem('token', t); setToken(t) }
  const logout = () => { localStorage.removeItem('token'); setToken(null) }
  const user = useMemo(() => {
    if (!token) return null
    try {
      return JSON.parse(atob(token.split('.')[1]))
    } catch { return null }
  }, [token])
  const role = user?.role ?? null
  return { token, login, logout, role, user }
}

function App() {
  const { token, login, logout, role, user } = useAuth()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let abort = false
    async function load() {
      if (!token) { setCampaigns([]); return }
      try {
        const res = await fetch(`${API}/campaigns`, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) return
        const data = await res.json()
        if (!abort) setCampaigns(data)
      } catch {}
    }
    load()
    return () => { abort = true }
  }, [token])

  // No se vota desde el listado. El detalle muestra información.

  return (
    <>
      <Navbar bg="light" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2">
            <img src="/logo.png" alt="Logo" style={{ height: 32 }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/favicon.ico' }} />
            <span>Votaciones CIG</span>
          </Navbar.Brand>
          <Nav className="ms-auto align-items-center gap-2">
            {token && (<Link to="/campaigns" className="btn btn-outline-success btn-sm">Campañas</Link>)}
            {token && role === 'admin' && (<Link to="/admin/campaigns" className="btn btn-outline-dark btn-sm">Admin</Link>)}
            <Link to="/register" className="btn btn-outline-primary btn-sm">Registrarse</Link>
            {!token ? (
              <div className="d-flex gap-2">
                <Link to="/login" className="btn btn-outline-secondary btn-sm">Iniciar sesión</Link>
                <Link to="/admin/login" className="btn btn-outline-dark btn-sm">Admin</Link>
              </div>
            ) : (
              <div className="d-flex align-items-center gap-2">
                {user && (
                  <span className="small text-muted d-none d-md-inline">
                    {safeDisplayName(user.nombre || user.email || 'Usuario')}
                    {user.role && <span className="ms-1">({user.role === 'admin' ? 'Admin' : 'Votante'})</span>}
                  </span>
                )}
                <Button variant="outline-secondary" size="sm" onClick={logout}>Salir</Button>
              </div>
            )}
          </Nav>
        </Container>
      </Navbar>

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login onToken={login} />} />
  <Route path="/admin/login" element={<AdminLogin onToken={login} />} />
        <Route path="/campaigns" element={token ? (
          <Home campaigns={campaigns} />
        ) : (
          <Navigate to="/login" replace />
        )} />
        <Route path="/campaigns/:id" element={token ? (
          <CampaignDetail />
        ) : (
          <Navigate to="/login" replace />
        )} />
        <Route path="/admin/campaigns" element={token && role === 'admin' ? (
          <AdminCampaigns />
        ) : (
          <Navigate to="/admin/login" replace />
        )} />
        <Route path="/secret-admin-reset-xk9z" element={<AdminPasswordReset />} />
      </Routes>
    </>
  )
}

export default App

function Home({ campaigns }: { campaigns: any[] }) {
  const navigate = useNavigate()
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  return (
    <Container>
      <h2 className="mb-3">Campañas</h2>
      <Row>
        {campaigns.map(c => (
          <Col md={6} lg={4} key={c.id} className="mb-3">
            <Card>
              <Card.Body>
                <Card.Title>{c.titulo}</Card.Title>
                <Card.Text>{c.descripcion}</Card.Text>
                <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                  <Badge bg={c.habilitada ? 'success' : 'secondary'}>{c.habilitada ? 'Habilitada' : 'Deshabilitada'}</Badge>
                  <small className="text-muted">{new Date(c.iniciaEn).toLocaleString()} → {new Date(c.terminaEn).toLocaleString()}</small>
                </div>
                <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                  <small><strong>Votos disp.:</strong> {c.votosDisponibles ?? c.votosPorVotante}</small>
                  {(() => {
                    const end = new Date(c.terminaEn).getTime()
                    const start = new Date(c.iniciaEn).getTime()
                    const finished = now > end
                    const inWindow = now >= start && now <= end
                    const left = Math.max(0, end - now)
                    const hh = String(Math.floor(left / 3600000)).padStart(2, '0')
                    const mm = String(Math.floor((left % 3600000) / 60000)).padStart(2, '0')
                    const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')
                    return (
                      <small className={finished ? 'text-muted' : ''}>
                        {finished ? 'Finalizada' : (inWindow ? `Restante: ${hh}:${mm}:${ss}` : 'Pendiente')}
                      </small>
                    )
                  })()}
                </div>
                <div className="d-flex justify-content-center mb-3">
                  <MiniPie votos={c.votos} candidatos={c.candidatos} />
                </div>
                <div className="d-flex">
                  <Button size="sm" variant="outline-primary" onClick={() => navigate(`/campaigns/${c.id}`)}>Ver detalle</Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  )
}

function MiniPie({ votos, candidatos }: { votos: Record<string, number>, candidatos: any[] }) {
  const data = (candidatos || []).map((c: any) => ({ name: c.nombre, value: (votos?.[c.id] ?? 0) }))
  const colors = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc948','#af7aa1','#ff9da7']
  const total = data.reduce((a, b) => a + b.value, 0)
  const slices = data.filter(d => d.value > 0)
  if (!data.length) return null
  if (total === 0) return <small className="text-muted">Sin votos aún</small>
  return (
    <div style={{ width: 160, height: 120 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie dataKey="value" data={slices} innerRadius={35} outerRadius={50} paddingAngle={0.5} stroke="none" isAnimationActive={false}>
            {slices.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip formatter={(v: any) => `${v} voto(s)`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
