import { Container, Row, Col, Card } from 'react-bootstrap'

export default function Landing() {
  return (
    <Container>
      <Row className="justify-content-center">
        <Col md={10} lg={8}>
          <Card className="mb-3">
            <Card.Body>
              <h1 className="h3 mb-3">Colegio de Ingenieros de Guatemala</h1>
              <p>
                Bienvenido a la plataforma de votaciones oficiales. Aquí podrás registrarte como votante,
                iniciar sesión y participar en los procesos electorales vigentes.
              </p>
              <ul>
                <li>Registro de votantes para ingenieros colegiados</li>
                <li>Acceso seguro mediante credenciales y token</li>
                <li>Resultados en tiempo real durante las jornadas de votación</li>
              </ul>
              <p className="text-muted mb-0">Para participar, primero debes registrarte y luego iniciar sesión.</p>
            </Card.Body>
          </Card>
          <Card>
            <Card.Body>
              <h2 className="h5">Próximas votaciones</h2>
              <p className="mb-0">Inicia sesión para ver y participar en las campañas disponibles.</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  )
}
