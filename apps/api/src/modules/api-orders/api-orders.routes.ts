import { Router } from 'express'
import { requireApiKey } from '../../middleware/api-key.js'
import { apiKeyRateLimiter } from '../../middleware/api-key-rate-limit.js'
import { validateBody } from '../../middleware/validate.js'
import { createPartnerOrderBody } from './api-orders.schema.js'
import * as ctrl from './api-orders.controller.js'

const r = Router()

r.post(
  '/orders',
  requireApiKey('orders:write'),
  apiKeyRateLimiter(),
  validateBody(createPartnerOrderBody),
  ctrl.createOrder
)

r.get(
  '/orders/:id',
  requireApiKey('orders:read'),
  apiKeyRateLimiter(),
  ctrl.getOrder
)

r.get(
  '/tracking/:trackingId',
  requireApiKey('orders:read'),
  apiKeyRateLimiter(),
  ctrl.trackingByTrackingId
)

export const apiOrdersRouter = r
