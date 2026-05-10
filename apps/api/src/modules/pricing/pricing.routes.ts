import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import { quoteBody } from './pricing.schema.js'
import * as ctrl from './pricing.controller.js'

const r = Router()

r.post('/quote', requireAuth, validateBody(quoteBody), ctrl.quote)

export const pricingRouter = r
