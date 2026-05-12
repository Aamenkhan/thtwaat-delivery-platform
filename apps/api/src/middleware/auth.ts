import type { RequestHandler } from 'express'
import type { Role } from '@prisma/client'
import { verifyAccessToken } from '../lib/jwt.js'
import { HttpError } from '../lib/http-error.js'

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization
  const headerToken = header?.startsWith('Bearer ') ? header.slice(7) : null
  const token = req.cookies?.thtwaat_access_token || headerToken
  
  if (!token) {
    next(new HttpError(401, 'Missing bearer token or cookie'))
    return
  }
  try {
    const { sub, role, orgId, membershipRole } = verifyAccessToken(token)
    req.auth = { userId: sub, role, orgId, membershipRole }
    next()
  } catch {
    next(new HttpError(401, 'Invalid or expired token'))
  }
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new HttpError(401, 'Unauthorized'))
      return
    }
    if (!roles.includes(req.auth.role)) {
      next(new HttpError(403, 'Insufficient role'))
      return
    }
    next()
  }
}
