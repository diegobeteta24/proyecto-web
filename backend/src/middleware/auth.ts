import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt.js'
import { JwtUser } from '../types.js'

export interface AuthRequest extends Request {
  user?: JwtUser
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }
  const token = auth.slice(7)
  try {
    const user = verifyToken(token)
    req.user = user
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireRole(role: 'admin' | 'voter') {
  return function (req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' })
    next()
  }
}

export function requireRoles(roles: Array<'admin' | 'voter'>) {
  return function (req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
    if (!roles.includes(req.user.role as any)) return res.status(403).json({ error: 'Forbidden' })
    next()
  }
}
