import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import { createScanBody } from './scan.schema.js'
import * as ctrl from './scan.controller.js'

const r = Router()

r.post('/', requireAuth, validateBody(createScanBody), ctrl.createScan)

export const scanRouter = r
