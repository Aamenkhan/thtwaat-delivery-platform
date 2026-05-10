import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePlatformAdmin } from '../../middleware/platform-admin.js'
import { validateBody } from '../../middleware/validate.js'
import {
  createWorkerBody,
  earningBody,
  workerGpsPingBody,
} from './worker.schema.js'
import * as ctrl from './worker.controller.js'
import { Role } from '@prisma/client'

const r = Router()

r.get(
  '/me/routes',
  requireAuth,
  requireRole(Role.WORKER, Role.DELIVERY_WORKER),
  ctrl.myRoutes
)

r.get(
  '/me',
  requireAuth,
  requireRole(Role.WORKER, Role.DELIVERY_WORKER),
  ctrl.myProfile
)

r.post(
  '/me/ping',
  requireAuth,
  requireRole(Role.WORKER, Role.DELIVERY_WORKER),
  validateBody(workerGpsPingBody),
  ctrl.pingLocation
)

r.get('/', requireAuth, requirePlatformAdmin, ctrl.list)

r.post(
  '/',
  requireAuth,
  requirePlatformAdmin,
  validateBody(createWorkerBody),
  ctrl.create
)

r.get(
  '/:workerId/earnings',
  requireAuth,
  requirePlatformAdmin,
  ctrl.earnings
)

r.post(
  '/:workerId/earnings',
  requireAuth,
  requirePlatformAdmin,
  validateBody(earningBody),
  ctrl.postEarning
)

export const workerRouter = r
