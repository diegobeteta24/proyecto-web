export type Role = 'admin' | 'voter'

export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}

export interface Voter extends BaseEntity {
  colegiado: string
  nombre: string
  email: string
  dpi: string
  fechaNacimiento: string // ISO date
  passwordHash: string
  role: 'voter'
}

export interface Admin extends BaseEntity {
  email: string
  passwordHash: string
  role: 'admin'
}

export interface Candidate extends BaseEntity {
  nombre: string
  bio?: string
  fotoUrl?: string
}

export interface Campaign extends BaseEntity {
  titulo: string
  descripcion?: string
  votosPorVotante: number
  habilitada: boolean
  iniciaEn: string // ISO datetime
  terminaEn: string // ISO datetime
  candidatos: Candidate[]
  // votos por candidato
  votos: Record<string, number>
  // registro de votos por votante
  votosPorVotanteRegistro: Record<string, string[]> // voterId -> candidateIds
}

export interface JwtUser {
  id: string
  role: Role
  colegiado?: string
  email?: string
  nombre?: string
}
