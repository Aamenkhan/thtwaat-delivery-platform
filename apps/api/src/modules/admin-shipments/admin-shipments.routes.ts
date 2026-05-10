import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requirePlatformAdmin } from '../../middleware/platform-admin.js'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import {
  adminAssignShipmentBody,
  adminListShipmentsQuery,
} from '../shipment/shipment.schema.js'
import * as ctrl from './admin-shipments.controller.js'

const r = Router()

r.use(requireAuth, requirePlatformAdmin)

r.get('/', validateQuery(adminListShipmentsQuery), ctrl.list)
r.get('/detail/:ref', ctrl.getOne)
r.get('/timeline/:publicId', ctrl.timeline)
r.patch(
  '/assign/:publicId',
  validateBody(adminAssignShipmentBody),
  ctrl.assign
)

export const adminShipmentsRouter = r
