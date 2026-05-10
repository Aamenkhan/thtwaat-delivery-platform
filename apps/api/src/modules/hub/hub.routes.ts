import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import {
  createHubBody,
  zoneBody,
  nearestBody,
  assignRouteBody,
} from './hub.schema.js'
import * as ctrl from './hub.controller.js'
import { Role } from '@prisma/client'

const r = Router()

r.post(
  '/',
  requireAuth,
  requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.HUB, Role.HUB_MANAGER),
  validateBody(createHubBody),
  ctrl.create
)

r.get('/', requireAuth, ctrl.list)

r.patch(
  '/:hubId/zones',
  requireAuth,
  requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.HUB, Role.HUB_MANAGER),
  validateBody(zoneBody),
  ctrl.patchZone
)

r.post(
  '/nearest',
  requireAuth,
  validateBody(nearestBody),
  ctrl.nearest
)

r.post(
  '/routes/assign',
  requireAuth,
  requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.HUB, Role.HUB_MANAGER),
  validateBody(assignRouteBody),
  ctrl.assignRoute
)

export const hubRouter = r
