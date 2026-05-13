import type { RequestHandler } from 'express'
import { verifyWorkerJwt } from '../../lib/worker-jwt.js'
import { HttpError } from '../../lib/http-error.js'

export const requireWorkerJwt: RequestHandler = (req, _res, next) => {
  const h = req.headers.authorization
  const t = h?.startsWith('Bearer ') ? h.slice(7).trim() : undefined
  if (!t) {
    next(new HttpError(401, 'Missing bearer token'))
    return
  }
  try {
    const p = verifyWorkerJwt(t)
    req.workerAuth = {
      workerId: p.sub,
      hubId: p.hubId,
      workerRole: p.workerRole,
      role: p.role,
    }
    next()
  } catch {
    next(new HttpError(401, 'Invalid or expired worker token'))
  }
}

export function requireSelfWorkerId(param = 'id'): RequestHandler {
  return (req, _res, next) => {
    const id = req.params[param]
    if (!req.workerAuth) {
      next(new HttpError(401, 'Unauthorized'))
      return
    }
    if (!id || id !== req.workerAuth.workerId) {
      next(new HttpError(403, 'Forbidden'))
      return
    }
    next()
  }
}
