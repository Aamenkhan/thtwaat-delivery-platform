import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requirePlatformAdmin } from '../../middleware/platform-admin.js'
import * as ctrl from './admin-logistics.controller.js'

const r = Router()

r.use(requireAuth, requirePlatformAdmin)

r.get('/summary', ctrl.summary)

export const adminLogisticsRouter = r
