import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Card, Form, Button, Alert, Row, Col } from 'react-bootstrap'

const API = '/api'

export default function Login({ onToken }: { onToken: (t: string) => void }) {
  const [colegiado, setColegiado] = useState('')
  const [dpi, setDpi] = useState('')
  const [dob, setDob] = useState('')
  const [pwd, setPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const cleanColegiado = colegiado.replace(/\D+/g, '').trim()
  const cleanDpi = dpi.replace(/\D+/g, '').trim()
  const canSubmit = cleanColegiado && /^\d+$/.test(cleanColegiado) && /^\d{13}$/.test(cleanDpi) && !!dob && pwd.length >= 6

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!canSubmit) { setError('Revisa los campos'); return }
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colegiado: cleanColegiado, dpi: cleanDpi, fechaNacimiento: dob, password: pwd })
      })
      let data: any = null
      try { data = await res.json() } catch { data = null }
      if (!res.ok) { setError(data?.error || 'Credenciales inválidas'); return }
      onToken(data.token)
      navigate('/campaigns', { replace: true })
    } catch (err: any) {
      setError(err?.message || 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container className="mb-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card>
            <Card.Body>
              <Card.Title>Iniciar sesión (Votantes)</Card.Title>
              {error && <Alert variant="danger">{error}</Alert>}
              <Form onSubmit={submit} noValidate>
                <Form.Group className="mb-3">
                  <Form.Label>Número de colegiado</Form.Label>
                  <Form.Control value={colegiado} onChange={e => setColegiado(e.target.value)} placeholder="Solo dígitos" />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>DPI</Form.Label>
                  <Form.Control value={dpi} onChange={e => setDpi(e.target.value)} placeholder="13 dígitos (ignora espacios y guiones)" />
                </Form.Group>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Fecha de nacimiento</Form.Label>
                      <Form.Control type="date" value={dob} onChange={e => setDob(e.target.value)} />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Contraseña</Form.Label>
                      <Form.Control type="password" value={pwd} onChange={e => setPwd(e.target.value)} />
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-flex gap-2">
                  <Button type="submit" disabled={!canSubmit || loading}>{loading ? 'Ingresando…' : 'Ingresar'}</Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  )
}
