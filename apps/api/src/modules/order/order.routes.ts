import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePlatformAdmin } from '../../middleware/platform-admin.js'
import { validateBody } from '../../middleware/validate.js'
import {
  createOrderBody,
  assignSourceHubBody,
  returnOrderBody,
  patchStatusBody,
} from './order.schema.js'
import * as ctrl from './order.controller.js'
import { Role } from '@prisma/client'
import { z } from 'zod'

const photoBody = z.object({
  urls: z.array(z.string().url()).min(1),
})

const r = Router()

r.post(
  '/',
  requireAuth,
  requireRole(
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.SELLER,
    Role.HUB_MANAGER
  ),
  validateBody(createOrderBody),
  ctrl.create
)

r.get('/:publicId', requireAuth, ctrl.getOne)

r.post(
  '/:publicId/source-hub',
  requireAuth,
  requireRole(
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.HUB,
    Role.HUB_MANAGER,
    Role.SELLER
  ),
  validateBody(assignSourceHubBody),
  ctrl.assignSourceHub
)

r.post(
  '/:publicId/return',
  requireAuth,
  validateBody(returnOrderBody),
  ctrl.returnFlow
)

r.patch(
  '/:publicId/status',
  requireAuth,
  requirePlatformAdmin,
  validateBody(patchStatusBody),
  ctrl.patchStatus
)

r.post(
  '/:publicId/photos',
  requireAuth,
  requireRole(
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.SELLER,
    Role.HUB_MANAGER,
    Role.WORKER,
    Role.DELIVERY_WORKER
  ),
  validateBody(photoBody),
  ctrl.addPhotos
)

export const orderRouter = r
