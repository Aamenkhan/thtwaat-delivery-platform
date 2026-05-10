import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requirePlatformAdmin } from '../../middleware/platform-admin.js'
import { validateQuery } from '../../middleware/validate.js'
import { listWindowQuery } from './admin-logistics.schema.js'
import * as ctrl from './admin-logistics.controller.js'

const r = Router()

r.use(requireAuth, requirePlatformAdmin)

r.get('/summary', ctrl.summary)
r.get('/sellers', validateQuery(listWindowQuery), ctrl.sellers)
r.get('/pricing-slabs', ctrl.pricingSlabs)
r.get('/hub-zones', ctrl.hubZones)
r.get('/cod-orders', validateQuery(listWindowQuery), ctrl.codOrders)
r.get('/analytics', ctrl.analytics)

export const adminLogisticsRouter = r
