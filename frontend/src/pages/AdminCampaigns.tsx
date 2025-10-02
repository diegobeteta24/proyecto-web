import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Col, Container, Form, Modal, Row, Spinner } from 'react-bootstrap'

const API = '/api'

// Stable, top-level typeahead to avoid remounting on each parent re-render
function EngineerTypeahead({ value, onChange, initialLabel, headers }: { value: string, onChange: (v: string) => void, initialLabel?: string, headers: HeadersInit }) {
  const [text, setText] = useState<string>(initialLabel || '')
  const [suggestions, setSuggestions] = useState<Array<{ id: string, nombre: string, colegiado: string }>>([])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // Debounced search
  useEffect(() => {
    const q = text.trim()
    // If looks like a selected label (contains '(#'), don't search
    if (!q || q.length < 2 || q.includes('(#')) { setSuggestions([]); setOpen(false); return }
    const t = setTimeout(async () => {
      try {
        setBusy(true)
        console.log('[Typeahead] fetching', { q })
        const url = `${API}/campaigns/options/engineers/search?q=${encodeURIComponent(q.slice(0,100))}`
        const res = await fetch(url, { headers })
        if (!res.ok) { console.warn('[Typeahead] search failed', res.status); setSuggestions([]); return }
        let data: any = []
        try { data = await res.json() } catch { data = [] }
        console.log('[Typeahead] results', { count: data?.length, sample: data?.[0] })
        setSuggestions(Array.isArray(data) ? data : [])
        setOpen(true)
      } finally {
        setBusy(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [text, headers])

  // Keep input label in sync if parent clears value
  useEffect(() => {
    if (!value) setText('')
  }, [value])

  // If initialLabel changes (edit -> open), sync once when there is no value
  useEffect(() => {
    if (!value && initialLabel) setText(initialLabel)
  }, [initialLabel, value])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div className="d-flex gap-2 align-items-center">
        <Form.Control
          value={text}
          placeholder="Buscar ingeniero por nombre o colegiado…"
          onFocus={() => { if (suggestions.length) { setOpen(true); console.log('[Typeahead] input focus -> open dropdown') } }}
          onChange={e => { setText(e.target.value); console.log('[Typeahead] input change', e.target.value) }}
          className={value ? 'is-valid' : ''}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false) }
            if (e.key === 'Enter') { e.preventDefault(); if (suggestions[0]) { const s = suggestions[0]; onChange(s.id); setText(`${s.nombre} (#${s.colegiado})`); setOpen(false) } }
          }}
        />
        {busy && <Spinner animation="border" size="sm" />}
        <Button size="sm" variant="outline-secondary" onClick={() => { setText(''); onChange(''); setSuggestions([]); setOpen(false); }}>Limpiar</Button>
      </div>
      {value && (
        <div className="text-success" style={{ fontSize: 12 }}>
          Ingeniero seleccionado
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div role="listbox" style={{ position: 'absolute', zIndex: 1050, background: 'white', border: '1px solid #ddd', borderRadius: 4, width: '100%', maxHeight: 220, overflowY: 'auto', boxShadow: '0 6px 12px rgba(0,0,0,.15)' }}>
          {suggestions.map(s => (
            <button
              key={s.id}
              type="button"
              role="option"
              onPointerDown={(e) => { e.preventDefault(); console.log('[Typeahead] onPointerDown select', s); onChange(s.id); setText(`${s.nombre} (#${s.colegiado})`); setOpen(false) }}
              onMouseDown={(e) => { e.preventDefault(); console.log('[Typeahead] onMouseDown select', s); onChange(s.id); setText(`${s.nombre} (#${s.colegiado})`); setOpen(false) }}
              onTouchStart={() => { console.log('[Typeahead] onTouchStart select', s); onChange(s.id); setText(`${s.nombre} (#${s.colegiado})`); setOpen(false) }}
              onClick={(e) => { e.preventDefault(); console.log('[Typeahead] onClick select', s); onChange(s.id); setText(`${s.nombre} (#${s.colegiado})`); setOpen(false) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', cursor: 'pointer', background: 'white', border: 'none' }}
            >
              {s.nombre} <small className="text-muted">#{s.colegiado}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type Campaign = {
  id: string
  titulo: string
  descripcion?: string
  votosPorVotante: number
  habilitada: boolean
  iniciaEn: string
  terminaEn: string
  candidatos: { id: string, nombre: string, engineerId?: string }[]
}

export default function AdminCampaigns() {
  const [token] = useState<string | null>(() => localStorage.getItem('token'))
  const [items, setItems] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)
  const [form, setForm] = useState<any>({ titulo: '', descripcion: '', votosPorVotante: 1, habilitada: false, iniciaEn: '', terminaEn: '', candidatos: [''] })
  const [editCandLabels, setEditCandLabels] = useState<string[]>([''])
  const [editing, setEditing] = useState<Campaign | null>(null)

  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  async function load() {
    setLoading(true)
  const res = await fetch(`${API}/campaigns`, { headers: authHeader as HeadersInit })
    const data = await res.json()
    setItems(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm({ titulo: '', descripcion: '', votosPorVotante: 1, habilitada: false, iniciaEn: '', terminaEn: '', candidatos: [''] })
    setEditCandLabels([''])
    setShow(true)
  }
  function openEdit(c: Campaign) {
    setEditing(c)
    setForm({ titulo: c.titulo, descripcion: c.descripcion ?? '', votosPorVotante: c.votosPorVotante, habilitada: c.habilitada, iniciaEn: c.iniciaEn.slice(0,16), terminaEn: c.terminaEn.slice(0,16), candidatos: c.candidatos.map(x => x.engineerId || '') })
    setEditCandLabels(c.candidatos.map(x => x.nombre))
    setShow(true)
  }

  function updateCand(i: number, v: string) {
    console.log('[AdminCampaigns] updateCand', { index: i, value: v })
    const arr = [...form.candidatos]
    arr[i] = v
    setForm({ ...form, candidatos: arr })
  }
  function addCand() { setForm({ ...form, candidatos: [...form.candidatos, ''] }) }
  function rmCand(i: number) { setForm({ ...form, candidatos: form.candidatos.filter((_: any, idx: number) => idx !== i) }) }

  async function save() {
    const selected = form.candidatos.filter((x: string) => x && x.trim())
    if (selected.length === 0) {
      alert('Debe seleccionar al menos un candidato (ingeniero)')
      return
    }
    // Prevent duplicates
    const uniq = Array.from(new Set(selected))
    if (uniq.length !== selected.length) {
      alert('Hay candidatos repetidos. Por favor, elimine duplicados.')
      return
    }
    console.log('[AdminCampaigns] save candidates', selected)
    const body = {
      titulo: form.titulo,
      descripcion: form.descripcion,
      votosPorVotante: Number(form.votosPorVotante),
      habilitada: !!form.habilitada,
      iniciaEn: new Date(form.iniciaEn).toISOString(),
      terminaEn: new Date(form.terminaEn).toISOString(),
      candidatos: selected.map((id: string) => ({ engineerId: id }))
    }
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...authHeader }
    let res: Response
    if (editing) {
      res = await fetch(`${API}/campaigns/${editing.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
    } else {
      res = await fetch(`${API}/campaigns`, { method: 'POST', headers, body: JSON.stringify(body) })
    }
    const data = await res.json()
    if (!res.ok) return alert(data.error || 'Error')
    setShow(false)
    await load()
  }

  async function toggle(c: Campaign) {
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...authHeader }
    const res = await fetch(`${API}/campaigns/${c.id}`, { method: 'PATCH', headers, body: JSON.stringify({ habilitada: !c.habilitada }) })
    const data = await res.json()
    if (!res.ok) return alert(data.error || 'Error')
    await load()
  }

  async function removeCampaign(c: Campaign) {
    if (!confirm(`¿Eliminar la campaña "${c.titulo}"? Esta acción no se puede deshacer.`)) return
    const res = await fetch(`${API}/campaigns/${c.id}`, { method: 'DELETE', headers: authHeader as HeadersInit })
    if (!res.ok && res.status !== 204) {
      try { const d = await res.json(); alert(d.error || 'No se pudo eliminar') } catch { alert('No se pudo eliminar') }
      return
    }
    await load()
  }

  function exportCSV(c: Campaign) {
    // Build CSV: candidate, votes
    const votos = (c as any).votos as Record<string, number>
    const lines = [['Candidato', 'Votos']]
    for (const cand of c.candidatos) {
      lines.push([cand.nombre, String(votos?.[cand.id] ?? 0)])
    }
    const csv = lines.map(r => r.map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-campania-${c.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // (moved EngineerTypeahead to top-level)

  return (
    <Container>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2>Administración de campañas</h2>
        <Button size="sm" onClick={openCreate}>Nueva campaña</Button>
      </div>
      <Row>
        {items.map(c => (
          <Col md={6} key={c.id} className="mb-3">
            <Card>
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <Card.Title>{c.titulo}</Card.Title>
                    <Card.Text>{c.descripcion}</Card.Text>
                    <small className="text-muted d-block mb-2">{c.habilitada ? 'Habilitada' : 'Deshabilitada'} • {new Date(c.iniciaEn).toLocaleString()} → {new Date(c.terminaEn).toLocaleString()} • {c.votosPorVotante} voto(s) por votante</small>
                  </div>
                  <div className="d-flex flex-column gap-2">
                    <Button variant={c.habilitada ? 'warning' : 'success'} size="sm" onClick={() => toggle(c)}>
                      {c.habilitada ? 'Deshabilitar' : 'Habilitar'}
                    </Button>
                    <Button variant="outline-primary" size="sm" onClick={() => openEdit(c)}>Editar</Button>
                    <Button variant="outline-danger" size="sm" onClick={() => removeCampaign(c)}>Eliminar</Button>
                  </div>
                </div>
                <div className="mt-2">
                  <strong>Candidatos</strong>
                  <ul className="mb-0">
                    {c.candidatos.map(x => (<li key={x.id}>{x.nombre}</li>))}
                  </ul>
                  <div className="mt-2 d-flex gap-2">
                    <Button size="sm" variant="outline-success" onClick={() => exportCSV(c)}>Exportar CSV</Button>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal show={show} onHide={() => setShow(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editing ? 'Editar campaña' : 'Nueva campaña'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="d-grid gap-3">
            <Form.Group>
              <Form.Label>Título</Form.Label>
              <Form.Control value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Descripción</Form.Label>
              <Form.Control as="textarea" rows={3} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
            </Form.Group>
            <Row>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Votos por votante</Form.Label>
                  <Form.Control type="number" min={1} value={form.votosPorVotante} onChange={e => setForm({ ...form, votosPorVotante: e.target.value })} />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Inicio</Form.Label>
                  <Form.Control type="datetime-local" value={form.iniciaEn} onChange={e => setForm({ ...form, iniciaEn: e.target.value })} />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Fin</Form.Label>
                  <Form.Control type="datetime-local" value={form.terminaEn} onChange={e => setForm({ ...form, terminaEn: e.target.value })} />
                </Form.Group>
              </Col>
            </Row>
            <Form.Check type="switch" label="Habilitada" checked={!!form.habilitada} onChange={e => setForm({ ...form, habilitada: e.target.checked })} />
            <div>
              <Form.Label className="mb-2">Candidatos</Form.Label>
              {form.candidatos.map((c: string, i: number) => (
                <div key={i} className="d-flex align-items-start gap-2 mb-2 w-100">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <EngineerTypeahead value={c} onChange={v => updateCand(i, v)} initialLabel={editCandLabels[i]} headers={authHeader as HeadersInit} />
                  </div>
                  <Button size="sm" variant="outline-danger" onClick={() => rmCand(i)}>Quitar</Button>
                </div>
              ))}
              <div className="d-flex justify-content-end">
                <Button size="sm" variant="outline-secondary" onClick={addCand}>Agregar candidato</Button>
              </div>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShow(false)}>Cancelar</Button>
          <Button onClick={save}>{editing ? 'Guardar' : 'Crear'}</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  )
}
