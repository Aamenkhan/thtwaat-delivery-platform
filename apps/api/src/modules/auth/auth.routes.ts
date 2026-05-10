import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { validateBody } from '../../middleware/validate.js'
import { requireAuth } from '../../middleware/auth.js'
import {
  registerBody,
  loginBody,
  refreshBody,
  logoutBody,
  switchOrgBody,
} from './auth.schema.js'
import * as ctrl from './auth.controller.js'

const r = Router()

const authWindowMs = 15 * 60 * 1000

const strictAuthLimiter = rateLimit({
  windowMs: authWindowMs,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many auth attempts, try again later' },
})

const loginLimiter = rateLimit({
  windowMs: authWindowMs,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many login attempts, try again later' },
})

r.use(strictAuthLimiter)

r.post('/register', validateBody(registerBody), ctrl.register)
r.post('/login', loginLimiter, validateBody(loginBody), ctrl.login)
r.post('/refresh', loginLimiter, validateBody(refreshBody), ctrl.refresh)
r.post('/logout', validateBody(logoutBody), ctrl.logout)
r.post(
  '/switch-org',
  requireAuth,
  validateBody(switchOrgBody),
  ctrl.switchOrg
)

export const authRouter = r
