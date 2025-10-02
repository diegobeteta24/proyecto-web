import bcrypt from 'bcryptjs'
import { Admin, Campaign, Candidate, Voter } from './types'

const nowIso = () => new Date().toISOString()

export const db = {
  voters: new Map<string, Voter>(),
  admins: new Map<string, Admin>(),
  campaigns: new Map<string, Campaign>(),
}

const id = () => Math.random().toString(36).slice(2, 10)

export async function seedAdminIfNeeded(): Promise<void> {
  if (process.env.SEED_ADMIN === 'true') {
    const email = 'admin@colegio.gt'
    const exists = [...db.admins.values()].some(a => a.email === email)
    if (!exists) {
      const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!'
      const passwordHash = await bcrypt.hash(password, 10)
      const admin: Admin = {
        id: id(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        email,
        passwordHash,
        role: 'admin',
      }
      db.admins.set(admin.id, admin)
      // eslint-disable-next-line no-console
      console.log(`Seeded admin ${email} / ${password}`)
    }
  }
}

export function createCampaign(partial: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'votos' | 'votosPorVotanteRegistro'>): Campaign {
  const c: Campaign = {
    ...partial,
    id: id(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    votos: {},
    votosPorVotanteRegistro: {},
  }
  // init votes for candidates
  for (const cand of c.candidatos) {
    c.votos[cand.id] = 0
  }
  db.campaigns.set(c.id, c)
  return c
}

export function createCandidate(nombre: string, bio?: string, fotoUrl?: string): Candidate {
  return { id: id(), createdAt: nowIso(), updatedAt: nowIso(), nombre, bio, fotoUrl }
}

export async function createVoter(data: { colegiado: string, nombre: string, email: string, dpi: string, fechaNacimiento: string, password: string }): Promise<Voter> {
  const passwordHash = await bcrypt.hash(data.password, 10)
  const voter: Voter = {
    id: id(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    colegiado: data.colegiado,
    nombre: data.nombre,
    email: data.email,
    dpi: data.dpi,
    fechaNacimiento: data.fechaNacimiento,
    passwordHash,
    role: 'voter',
  }
  db.voters.set(voter.id, voter)
  return voter
}

export function findVoterByCredentials(colegiado: string, dpi: string, fechaNacimiento: string): Voter | undefined {
  return [...db.voters.values()].find(v => v.colegiado === colegiado && v.dpi === dpi && v.fechaNacimiento === fechaNacimiento)
}

export function findVoterByColegiadoOrEmailOrDpi(val: string): Voter | undefined {
  return [...db.voters.values()].find(v => v.colegiado === val || v.email === val || v.dpi === val)
}

export function findAdminByEmail(email: string): Admin | undefined {
  return [...db.admins.values()].find(a => a.email === email)
}
