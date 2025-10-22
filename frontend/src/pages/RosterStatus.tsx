import { useState } from 'react'
import { Container, Card, Form, Button, Alert, Table, Badge } from 'react-bootstrap'

interface Resumen {
  total: number
  con_cuenta: number
  sin_cuenta: number
  activos: number
  inactivos: number
}

interface Ingeniero {
  colegiado: string
  nombre: string
  email: string | null
  tiene_cuenta: boolean
  activo: boolean
  is_admin: boolean
}

interface RosterData {
  ok: boolean
  resumen: Resumen
  ingenieros: Ingeniero[]
}

export default function RosterStatus() {
  const [secretToken, setSecretToken] = useState('')
  const [data, setData] = useState<RosterData | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setData(null)

    setLoading(true)
    try {
      const response = await fetch('/api/auth/roster-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretToken })
      })

      const result = await response.json()

      if (response.ok) {
        setData(result)
        setMessage({ type: 'success', text: 'Datos cargados exitosamente' })
      } else {
        setMessage({ type: 'danger', text: result.error || 'Error al consultar padrón' })
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
        <div className="col-12 col-lg-10">
          <Card>
            <Card.Body>
              <h3 className="text-center mb-4">📋 Estado del Padrón de Ingenieros</h3>
              <p className="text-muted text-center small mb-4">
                Consulta qué ingenieros del padrón ya tienen cuenta creada
              </p>

              {message && (
                <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
                  {message.text}
                </Alert>
              )}

              <Form onSubmit={handleSubmit} className="mb-4">
                <div className="row justify-content-center">
                  <div className="col-md-6">
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
                    <Button
                      variant="primary"
                      type="submit"
                      className="w-100"
                      disabled={loading}
                    >
                      {loading ? 'Consultando...' : 'Consultar Padrón'}
                    </Button>
                  </div>
                </div>
              </Form>

              {data && (
                <>
                  {/* Resumen */}
                  <Card className="mb-4 bg-light">
                    <Card.Body>
                      <h5 className="mb-3">📊 Resumen</h5>
                      <div className="row text-center">
                        <div className="col-6 col-md-3 mb-3">
                          <div className="fs-2 fw-bold text-primary">{data.resumen.total}</div>
                          <div className="text-muted small">Total en Padrón</div>
                        </div>
                        <div className="col-6 col-md-3 mb-3">
                          <div className="fs-2 fw-bold text-success">{data.resumen.con_cuenta}</div>
                          <div className="text-muted small">Con Cuenta</div>
                        </div>
                        <div className="col-6 col-md-3 mb-3">
                          <div className="fs-2 fw-bold text-warning">{data.resumen.sin_cuenta}</div>
                          <div className="text-muted small">Sin Cuenta</div>
                        </div>
                        <div className="col-6 col-md-3 mb-3">
                          <div className="fs-2 fw-bold text-info">{data.resumen.activos}</div>
                          <div className="text-muted small">Activos</div>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>

                  {/* Tabla de Ingenieros */}
                  <div className="table-responsive">
                    <Table striped bordered hover>
                      <thead className="table-dark">
                        <tr>
                          <th>Colegiado</th>
                          <th>Nombre</th>
                          <th>Email</th>
                          <th className="text-center">Estado</th>
                          <th className="text-center">Cuenta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ingenieros.map((ing) => (
                          <tr key={ing.colegiado}>
                            <td className="fw-bold">{ing.colegiado}</td>
                            <td>
                              {ing.nombre}
                              {ing.is_admin && (
                                <Badge bg="danger" className="ms-2">Admin</Badge>
                              )}
                            </td>
                            <td>
                              {ing.email || (
                                <span className="text-muted fst-italic">Sin email</span>
                              )}
                            </td>
                            <td className="text-center">
                              {ing.activo ? (
                                <Badge bg="success">Activo</Badge>
                              ) : (
                                <Badge bg="secondary">Inactivo</Badge>
                              )}
                            </td>
                            <td className="text-center">
                              {ing.tiene_cuenta ? (
                                <Badge bg="success">✓ Sí</Badge>
                              ) : (
                                <Badge bg="warning" text="dark">✗ No</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>

                  <div className="text-center mt-3">
                    <small className="text-muted">
                      Total de registros: {data.ingenieros.length}
                    </small>
                  </div>
                </>
              )}

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
