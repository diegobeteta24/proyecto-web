import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Form, Button, Card } from 'react-bootstrap'
import { apiPost } from '../utils/apiClient'

export default function AdminLogin({ onToken }: { onToken?: (t: string) => void }) {
  const [colegiado, setColegiado] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const body: any = { password }
      if (colegiado.trim()) body.colegiado = colegiado.trim()
      else body.email = email.trim()
      
      const data = await apiPost('/auth/admin/login', body)
      
      // Persist token y actualizar estado global si nos pasaron onToken
      try { localStorage.setItem('token', data.token) } catch {}
      if (onToken) onToken(data.token)
      navigate('/admin/campaigns', { replace: true })
    } catch (err: any) {
      alert(err?.message || 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container style={{ maxWidth: 420 }}>
      <Card>
        <Card.Body>
          <Card.Title>Ingreso Administrador</Card.Title>
          <Form onSubmit={onSubmit} className="d-grid gap-3">
            <Form.Text>Ingresa colegiado o email, y contraseña</Form.Text>
            <Form.Group>
              <Form.Label>Colegiado</Form.Label>
              <Form.Control value={colegiado} onChange={e => setColegiado(e.target.value)} placeholder="Opcional si usas email" />
            </Form.Group>
            <Form.Group>
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Opcional si usas colegiado" />
            </Form.Group>
            <Form.Group>
              <Form.Label>Contraseña</Form.Label>
              <Form.Control type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </Form.Group>
            <Button type="submit" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}</Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  )
}
