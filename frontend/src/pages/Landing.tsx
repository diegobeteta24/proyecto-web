import { Container, Row, Col, Card, Button } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import './Landing.css'

export default function Landing() {
  return (
    <div className="landing-wrapper">
      <section className="hero py-5">
        <Container>
          <Row className="align-items-center gy-4">
            <Col md={6}>
              <h1 className="display-6 fw-semibold mb-3 text-gradient">Colegio de Ingenieros de Guatemala</h1>
              <p className="lead mb-4">
                Plataforma oficial de votaciones electrónicas para ingenieros colegiados. Transparente, segura y en tiempo real.
              </p>
              <div className="d-flex flex-column flex-sm-row gap-3 cta-buttons">
                <Link to="/register" className="flex-fill flex-sm-grow-0 text-decoration-none">
                  <Button variant="primary" size="lg" className="shadow-sm w-100">Registrarse</Button>
                </Link>
                <Link to="/login" className="flex-fill flex-sm-grow-0 text-decoration-none">
                  <Button variant="outline-secondary" size="lg" className="shadow-sm w-100">Iniciar sesión</Button>
                </Link>
                <Link to="/admin/login" className="flex-fill flex-sm-grow-0 text-decoration-none">
                  <Button variant="outline-dark" size="lg" className="shadow-sm w-100">Admin</Button>
                </Link>
              </div>
              <small className="text-muted d-block mt-3">Crea tu cuenta o inicia sesión para participar en las próximas elecciones.</small>
            </Col>
            <Col md={6} className="d-flex">
              <Card className="ms-md-auto shadow-sm border-0 feature-card">
                <Card.Body>
                  <h2 className="h5 mb-3">¿Qué puedes hacer aquí?</h2>
                  <ul className="mb-0 ps-3 small feature-list">
                    <li><strong>Registrar</strong> tu cuenta como votante colegiado</li>
                    <li><strong>Acceder</strong> de forma segura con token JWT</li>
                    <li><strong>Votar</strong> en campañas activas con control de tiempo</li>
                    <li><strong>Visualizar</strong> resultados parciales en tiempo real</li>
                    <li><strong>Administrar</strong> campañas (solo administradores autorizados)</li>
                  </ul>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="py-5 bg-light">
        <Container>
          <Row className="g-4">
            <Col sm={6} lg={3}>
              <StatCard title="Transparencia" text="Resultados visibles al instante durante la ventana de votación." icon="bi-eye" />
            </Col>
            <Col sm={6} lg={3}>
              <StatCard title="Seguridad" text="Tokens firmados y control de duplicidad de votos." icon="bi-shield-lock" />
            </Col>
            <Col sm={6} lg={3}>
              <StatCard title="Eficiencia" text="Conteo automático y validaciones integradas." icon="bi-speedometer2" />
            </Col>
            <Col sm={6} lg={3}>
              <StatCard title="Confianza" text="Acceso restringido a ingenieros colegiados activos." icon="bi-people" />
            </Col>
          </Row>
        </Container>
      </section>

      <section className="py-5">
        <Container>
          <Row className="justify-content-center">
            <Col md={8} lg={6}>
              <Card className="border-0 shadow-sm text-center">
                <Card.Body>
                  <h3 className="h5 mb-3">Próximas votaciones</h3>
                  <p className="mb-3 text-muted small">Inicia sesión para ver campañas activas, horarios y candidatos disponibles.</p>
                  <Link to="/login" className="text-decoration-none">
                    <Button variant="primary" size="sm">Ver campañas</Button>
                  </Link>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>
    </div>
  )
}

function StatCard({ title, text, icon }: { title: string, text: string, icon: string }) {
  return (
    <Card className="h-100 shadow-sm border-0 stat-card">
      <Card.Body>
        <div className="d-flex align-items-start gap-3">
          <div className="icon-circle flex-shrink-0">
            <i className={`bi ${icon}`}></i>
          </div>
          <div>
            <h3 className="h6 mb-1 fw-semibold">{title}</h3>
            <p className="small mb-0 text-muted">{text}</p>
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}
