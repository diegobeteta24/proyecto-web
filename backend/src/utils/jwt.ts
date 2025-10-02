import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { JwtUser } from '../types'

const secret: Secret = process.env.JWT_SECRET ?? 'dev-secret'
const expiresIn: SignOptions['expiresIn'] = (process.env.JWT_EXPIRES ?? '1h') as SignOptions['expiresIn']

export function signToken(payload: JwtUser): string {
  const options: SignOptions = { expiresIn }
  return jwt.sign({ ...payload }, secret, options)
}

export function verifyToken(token: string): JwtUser {
  return jwt.verify(token, secret) as JwtUser
}
