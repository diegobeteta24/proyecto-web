import { useState } from 'react'
import { Container, Card, Form, Button, Alert } from 'react-bootstrap'

export default function AdminPasswordReset() {
  const [secretToken, setSecretToken] = useState('')
  const [colegiado, setColegiado] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'danger', text: 'Las contraseñas no coinciden' })
      return
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'danger', text: 'La contraseña debe tener al menos 8 caracteres' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/admin/reset-secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretToken, colegiado, newPassword })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Contraseña actualizada exitosamente. Ahora puedes iniciar sesión.' })
        setSecretToken('')
        setColegiado('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setMessage({ type: 'danger', text: data.error || 'Error al actualizar contraseña' })
      }
    } catch (err) {
      setMessage({ type: 'danger', text: 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container className="py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <Card>
            <Card.Body>
              <h3 className="text-center mb-4">🔐 Recuperación de Acceso Admin</h3>
              <p className="text-muted text-center small mb-4">
                Usa el token secreto para restablecer la contraseña del administrador
              </p>

              {message && (
                <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
                  {message.text}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Token Secreto</Form.Label>
                  <Form.Control
                    type="password"
                    value={secretToken}
                    onChange={(e) => setSecretToken(e.target.value)}
                    placeholder="Token configurado en servidor"
                    required
                    autoComplete="off"
                  />
                  <Form.Text className="text-muted">
                    Definido en ADMIN_RESET_SECRET del servidor
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Colegiado Admin</Form.Label>
                  <Form.Control
                    type="text"
                    value={colegiado}
                    onChange={(e) => setColegiado(e.target.value)}
                    placeholder="Ej: 19999"
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Nueva Contraseña</Form.Label>
                  <Form.Control
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    minLength={8}
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>Confirmar Contraseña</Form.Label>
                  <Form.Control
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    required
                    minLength={8}
                  />
                </Form.Group>

                <Button
                  variant="primary"
                  type="submit"
                  className="w-100"
                  disabled={loading}
                >
                  {loading ? 'Procesando...' : 'Restablecer Contraseña'}
                </Button>
              </Form>

              <div className="text-center mt-4">
                <small className="text-muted">
                  ⚠️ Esta página es solo para uso administrativo autorizado
                </small>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </Container>
  )
}
