import { useState } from 'react'
import { Container, Card, Form, Button, Alert, Row, Col } from 'react-bootstrap'

const API = '/api'

function isValidEmail(email: string) {
  return /[^@ \t\r\n]+@[^@ \t\r\n]+\.[^@ \t\r\n]+/.test(email)
}

function isValidDPI(dpi: string) {
  // DPI Guatemala: 13 dígitos
  return /^\d{13}$/.test(dpi)
}

function isValidDate(dateStr: string) {
  const d = new Date(dateStr)
  return !Number.isNaN(d.getTime())
}

function isStrongPassword(pwd: string) {
  // Min 8, mayús, minúsc, número, símbolo
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(pwd)
}

export default function Register() {
  const [form, setForm] = useState({
    colegiado: '',
    nombre: '',
    email: '',
    dpi: '',
    fechaNacimiento: '',
    password: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const setField = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const validations = {
    colegiado: form.colegiado.trim().length >= 3 && /^\d+$/.test(form.colegiado),
    nombre: form.nombre.trim().length >= 3,
    email: isValidEmail(form.email),
    dpi: isValidDPI(form.dpi),
    fechaNacimiento: isValidDate(form.fechaNacimiento),
    password: isStrongPassword(form.password),
  }

  const allValid = Object.values(validations).every(Boolean)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setOk(false)
    if (!allValid) {
      setError('Por favor corrige los campos marcados antes de continuar.')
      return
    }
    try {
      setSubmitting(true)
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al registrar')
        return
      }
      setOk(true)
    } catch (err: any) {
      setError(err?.message || 'Error de red')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container className="mb-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card>
            <Card.Body>
              <Card.Title>Registro de Votantes</Card.Title>
              <Card.Text>Completa tus datos para crear tu cuenta.</Card.Text>
              {error && <Alert variant="danger">{error}</Alert>}
              {ok && <Alert variant="success">Registro exitoso. Ahora puedes iniciar sesión.</Alert>}
              <Form onSubmit={onSubmit} noValidate>
                <Form.Group className="mb-3">
                  <Form.Label>Número de colegiado</Form.Label>
                  <Form.Control value={form.colegiado} onChange={e => setField('colegiado', e.target.value)} isInvalid={form.colegiado !== '' && !validations.colegiado} placeholder="Solo dígitos" />
                  <Form.Control.Feedback type="invalid">Debe contener solo dígitos y al menos 3 caracteres.</Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Nombre completo</Form.Label>
                  <Form.Control value={form.nombre} onChange={e => setField('nombre', e.target.value)} isInvalid={form.nombre !== '' && !validations.nombre} />
                  <Form.Control.Feedback type="invalid">Ingresa tu nombre completo.</Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Correo electrónico</Form.Label>
                  <Form.Control type="email" value={form.email} onChange={e => setField('email', e.target.value)} isInvalid={form.email !== '' && !validations.email} />
                  <Form.Control.Feedback type="invalid">Correo no válido.</Form.Control.Feedback>
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>DPI</Form.Label>
                      <Form.Control value={form.dpi} onChange={e => setField('dpi', e.target.value)} isInvalid={form.dpi !== '' && !validations.dpi} placeholder="13 dígitos" />
                      <Form.Control.Feedback type="invalid">Debe tener 13 dígitos.</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Fecha de nacimiento</Form.Label>
                      <Form.Control type="date" value={form.fechaNacimiento} onChange={e => setField('fechaNacimiento', e.target.value)} isInvalid={form.fechaNacimiento !== '' && !validations.fechaNacimiento} />
                      <Form.Control.Feedback type="invalid">Fecha inválida.</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-4">
                  <Form.Label>Contraseña</Form.Label>
                  <Form.Control type="password" value={form.password} onChange={e => setField('password', e.target.value)} isInvalid={form.password !== '' && !validations.password} placeholder="Mín 8, mayús, minúsc, número y símbolo" />
                  <Form.Control.Feedback type="invalid">Debe tener mínimo 8 caracteres e incluir mayúscula, minúscula, número y símbolo.</Form.Control.Feedback>
                </Form.Group>

                <div className="d-flex gap-2">
                  <Button type="submit" disabled={submitting || !allValid}>
                    {submitting ? 'Enviando…' : 'Registrarme'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  )
}
