import { Router } from 'express'
import { requireApiKey } from '../middleware/api-key.js'
import { apiKeyRateLimiter } from '../middleware/api-key-rate-limit.js'
import { validateBody } from '../middleware/validate.js'
import { apiOrdersRouter } from '../modules/api-orders/api-orders.routes.js'
import { commercialPartnerRouter } from '../modules/commercial/commercial.routes.js'
import * as orderService from '../modules/order/order.service.js'
import { HttpError } from '../lib/http-error.js'
import { prisma } from '../lib/prisma.js'
import { z } from 'zod'

const returnBody = z.object({
  publicId: z.string().min(1),
  reason: z.string().optional(),
})

const truckBookBody = z.object({
  truckType: z.string().optional(),
  sourceLat: z.number(),
  sourceLng: z.number(),
  destLat: z.number(),
  destLng: z.number(),
  notes: z.string().optional(),
})

const webhookRegisterBody = z.object({
  url: z.string().url(),
  secret: z.string().min(8),
  events: z.array(z.string()).min(1),
})

/**
 * Public partner surface: `/api/v1/*` (same handlers as `/v1/public` where applicable).
 */
const r = Router()

r.use(commercialPartnerRouter)
r.use(apiOrdersRouter)

r.post(
  '/returns',
  requireApiKey('orders:write'),
  apiKeyRateLimiter(),
  validateBody(returnBody),
  async (req, res, next) => {
    try {
      if (!req.apiKeyAuth) throw new HttpError(401, 'Unauthorized')
      const order = await prisma.order.findFirst({
        where: { publicId: req.body.publicId, sellerId: req.apiKeyAuth.sellerId },
      })
      if (!order) throw new HttpError(404, 'Order not found')
      const updated = await orderService.requestReturn(req.body.publicId, {
        reason: req.body.reason,
      })
      res.json({ ok: true, data: { order: updated } })
    } catch (e) {
      next(e)
    }
  }
)

r.post(
  '/webhooks',
  requireApiKey('webhooks:write'),
  apiKeyRateLimiter(),
  validateBody(webhookRegisterBody),
  async (req, res, next) => {
    try {
      if (!req.apiKeyAuth) throw new HttpError(401, 'Unauthorized')
      const sub = await prisma.sellerWebhookSubscription.create({
        data: {
          sellerId: req.apiKeyAuth.sellerId,
          url: req.body.url,
          secret: req.body.secret,
          events: req.body.events,
        },
      })
      res.status(201).json({ ok: true, data: { subscription: { id: sub.id, url: sub.url, events: sub.events } } })
    } catch (e) {
      next(e)
    }
  }
)

r.post(
  '/transport/book',
  requireApiKey('transport:write'),
  apiKeyRateLimiter(),
  validateBody(truckBookBody),
  async (req, res, next) => {
    try {
      if (!req.apiKeyAuth) throw new HttpError(401, 'Unauthorized')
      const booking = await prisma.truckBooking.create({
        data: {
          sellerId: req.apiKeyAuth.sellerId,
          truckType: req.body.truckType,
          sourceLat: req.body.sourceLat,
          sourceLng: req.body.sourceLng,
          destLat: req.body.destLat,
          destLng: req.body.destLng,
          notes: req.body.notes,
        },
      })
      res.status(201).json({ ok: true, data: { booking } })
    } catch (e) {
      next(e)
    }
  }
)

export const apiV1Router = r
