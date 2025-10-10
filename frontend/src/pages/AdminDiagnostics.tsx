import { useEffect, useState } from 'react'
import { Container, Card, Table, Alert, Spinner, Button } from 'react-bootstrap'

export default function AdminDiagnostics() {
  const [token] = useState<string | null>(() => localStorage.getItem('token'))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!token) {
      setError('No hay token de autenticación')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/admin/engineers/diagnostics', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Error desconocido' }))
        setError(errData.error || `Error ${res.status}`)
        return
      }

      const result = await res.json()
      setData(result)
    } catch (err: any) {
      setError(err.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p className="mt-3">Cargando diagnósticos...</p>
      </Container>
    )
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
          <Button variant="outline-danger" onClick={load}>Reintentar</Button>
        </Alert>
      </Container>
    )
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Diagnóstico del Sistema</h2>
        <Button variant="outline-primary" size="sm" onClick={load}>
          Actualizar
        </Button>
      </div>

      <Card className="mb-4">
        <Card.Header>
          <strong>Estadísticas de Ingenieros</strong>
        </Card.Header>
        <Card.Body>
          <div className="row text-center">
            <div className="col-md-4">
              <h3 className="text-primary">{data?.total || 0}</h3>
              <p className="text-muted">Total</p>
            </div>
            <div className="col-md-4">
              <h3 className="text-success">{data?.activos || 0}</h3>
              <p className="text-muted">Activos</p>
            </div>
            <div className="col-md-4">
              <h3 className="text-warning">{data?.admins || 0}</h3>
              <p className="text-muted">Administradores</p>
            </div>
          </div>
        </Card.Body>
      </Card>

      {data?.sample && data.sample.length > 0 && (
        <Card>
          <Card.Header>
            <strong>Muestra de Ingenieros (primeros 5)</strong>
          </Card.Header>
          <Card.Body>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Colegiado</th>
                  <th>Nombre</th>
                  <th>Activo</th>
                  <th>Admin</th>
                </tr>
              </thead>
              <tbody>
                {data.sample.map((eng: any, idx: number) => (
                  <tr key={idx}>
                    <td>{eng.colegiado}</td>
                    <td>{eng.nombre}</td>
                    <td>
                      {eng.activo ? (
                        <span className="badge bg-success">Sí</span>
                      ) : (
                        <span className="badge bg-secondary">No</span>
                      )}
                    </td>
                    <td>
                      {eng.is_admin ? (
                        <span className="badge bg-warning">Admin</span>
                      ) : (
                        <span className="badge bg-light text-dark">Usuario</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {data?.total === 0 && (
        <Alert variant="warning">
          <Alert.Heading>⚠️ No hay ingenieros en la base de datos</Alert.Heading>
          <p>
            El roster de ingenieros está vacío. Esto puede deberse a:
          </p>
          <ul>
            <li>El archivo <code>seeds/engineers.import.json</code> no se copió al build</li>
            <li>El archivo está vacío o tiene un formato incorrecto</li>
            <li>Hubo un error al cargar el roster durante el arranque</li>
          </ul>
          <hr />
          <p className="mb-0">
            Revisa los logs de Heroku para ver si hay mensajes como:<br />
            <code>[SEED] Merge roster completado (X/Y)</code>
          </p>
        </Alert>
      )}
    </Container>
  )
}
