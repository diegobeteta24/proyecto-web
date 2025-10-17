// API Client with JWT interceptor for automatic logout on 401
const API_BASE = '/api'

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers })

  // Interceptor: Si 401, limpiar sesión y redirigir
  if (response.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Sesión expirada. Redirigiendo al login...')
  }

  return response
}

// Helper para GET con JSON response
export async function apiGet<T = any>(endpoint: string): Promise<T> {
  const res = await apiFetch(endpoint)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `Error ${res.status}` }))
    throw new Error(error.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// Helper para POST con JSON body y response
export async function apiPost<T = any>(endpoint: string, body: any): Promise<T> {
  const res = await apiFetch(endpoint, { 
    method: 'POST', 
    body: JSON.stringify(body) 
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `Error ${res.status}` }))
    throw new Error(error.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// Helper para PATCH con JSON body y response
export async function apiPatch<T = any>(endpoint: string, body: any): Promise<T> {
  const res = await apiFetch(endpoint, { 
    method: 'PATCH', 
    body: JSON.stringify(body) 
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `Error ${res.status}` }))
    throw new Error(error.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// Helper para DELETE
export async function apiDelete(endpoint: string): Promise<void> {
  const res = await apiFetch(endpoint, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    const error = await res.json().catch(() => ({ error: `Error ${res.status}` }))
    throw new Error(error.error || `HTTP ${res.status}`)
  }
}
