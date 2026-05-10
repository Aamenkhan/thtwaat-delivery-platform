import { Router } from 'express'
import { requireApiKey } from '../../middleware/api-key.js'
import { apiKeyRateLimiter } from '../../middleware/api-key-rate-limit.js'
import { validateBody } from '../../middleware/validate.js'
import { publicCreateOrderBody } from './public.schema.js'
import * as ctrl from './public.controller.js'

const r = Router()

r.get(
  '/orders/:publicId',
  requireApiKey('orders:read'),
  apiKeyRateLimiter(),
  ctrl.getOrder
)
r.post(
  '/orders',
  requireApiKey('orders:write'),
  apiKeyRateLimiter(),
  validateBody(publicCreateOrderBody),
  ctrl.createOrder
)

export const publicApiRouter = r
