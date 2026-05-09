import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../lib/db.js'
import { jsonError, jsonOk } from '../../lib/http.js'
import { publicApiKeyMiddleware } from '../../middleware/public-api-key.js'
import { recordOutboxAndEmit } from '../notify-service/outbox.js'

const createBody = z.object({
  sellerId: z.string().min(1),
  destination: z.object({ lat: z.number(), lng: z.number() }),
})

export const orderRoutes = new Hono()

orderRoutes.use('/*', publicApiKeyMiddleware)

orderRoutes.get('/dashboard/summary', async (c) => {
  const sellerId = c.get('apiKey').sellerId
  if (!sellerId) {
    return jsonError(
      c,
      'forbidden',
      'Seller-scoped API key required',
      403
    )
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [openOrders, deliveredThisWeek, returnsPending] = await Promise.all([
    prisma.order.count({
      where: {
        sellerId,
        status: {
          notIn: ['DELIVERED', 'RETURNED', 'CANCELLED'],
        },
      },
    }),
    prisma.order.count({
      where: {
        sellerId,
        status: 'DELIVERED',
        updatedAt: { gte: weekAgo },
      },
    }),
    prisma.order.count({
      where: { sellerId, returnInitiated: true, status: { not: 'RETURNED' } },
    }),
  ])

  return jsonOk(c, {
    summary: { sellerId, openOrders, deliveredThisWeek, returnsPending },
  })
})

orderRoutes.post('/', async (c) => {
  const body = createBody.safeParse(await c.req.json())
  if (!body.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, body.error)
  }

  const sellerId = c.get('apiKey').sellerId ?? body.data.sellerId
  const qrPayload = `ord_${randomUUID().replace(/-/g, '')}`

  const order = await prisma.order.create({
    data: {
      sellerId,
      destinationLat: body.data.destination.lat,
      destinationLng: body.data.destination.lng,
      qrPayload,
    },
  })

  await recordOutboxAndEmit({
    type: 'order.created',
    payload: { orderId: order.id, publicId: order.publicId, status: order.status },
  })

  return jsonOk(c, { order })
})

orderRoutes.get('/:publicId', async (c) => {
  const publicId = c.req.param('publicId')
  const order = await prisma.order.findUnique({ where: { publicId } })
  if (!order) {
    return jsonError(c, 'not_found', 'Order not found', 404)
  }
  return jsonOk(c, { order })
})

const statusBody = z.object({
  status: z.enum([
    'CREATED',
    'PICKED_UP',
    'IN_TRANSIT',
    'AT_HUB',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'RETURN_REQUESTED',
    'RETURNED',
    'CANCELLED',
  ]),
})

orderRoutes.patch('/:publicId/status', async (c) => {
  const publicId = c.req.param('publicId')
  const parsed = statusBody.safeParse(await c.req.json())
  if (!parsed.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, parsed.error)
  }

  const existing = await prisma.order.findUnique({ where: { publicId } })
  if (!existing) {
    return jsonError(c, 'not_found', 'Order not found', 404)
  }

  const order = await prisma.order.update({
    where: { publicId },
    data: { status: parsed.data.status },
  })

  await recordOutboxAndEmit({
    type: 'order.status_changed',
    payload: {
      orderId: order.id,
      publicId: order.publicId,
      from: existing.status,
      to: order.status,
    },
  })

  return jsonOk(c, { order })
})

const returnBody = z.object({
  reason: z.string().optional(),
})

orderRoutes.post('/:publicId/return', async (c) => {
  const publicId = c.req.param('publicId')
  const parsed = returnBody.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, parsed.error)
  }

  const existing = await prisma.order.findUnique({ where: { publicId } })
  if (!existing) {
    return jsonError(c, 'not_found', 'Order not found', 404)
  }

  const order = await prisma.order.update({
    where: { publicId },
    data: { returnInitiated: true, status: 'RETURN_REQUESTED' },
  })

  await recordOutboxAndEmit({
    type: 'order.return_initiated',
    payload: {
      orderId: order.id,
      publicId: order.publicId,
      reason: parsed.data.reason ?? null,
    },
  })

  return jsonOk(c, { order })
})

const proofBody = z.object({
  urls: z.array(z.string().url()).min(1),
})

orderRoutes.post('/:publicId/photo-proof', async (c) => {
  const publicId = c.req.param('publicId')
  const parsed = proofBody.safeParse(await c.req.json())
  if (!parsed.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, parsed.error)
  }

  const existing = await prisma.order.findUnique({ where: { publicId } })
  if (!existing) {
    return jsonError(c, 'not_found', 'Order not found', 404)
  }

  const order = await prisma.order.update({
    where: { publicId },
    data: {
      photoProofUrls: [...existing.photoProofUrls, ...parsed.data.urls],
    },
  })

  return jsonOk(c, { order })
})
