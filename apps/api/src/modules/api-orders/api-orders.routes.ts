import { Router } from 'express'
import { requireApiKey } from '../../middleware/api-key.js'
import { apiKeyRateLimiter } from '../../middleware/api-key-rate-limit.js'
import * as ctrl from './api-orders.controller.js'
import * as dual from './api-orders-dual.controller.js'
import * as publicTrack from './api-orders-public-track.controller.js'

const r = Router()

r.get('/orders/qr/:orderNumber', publicTrack.getPublicOrderAggregate)
r.get('/orders/:orderNumber/track', publicTrack.getPublicOrderAggregate)

r.post('/orders', dual.postApiV1Orders)

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
