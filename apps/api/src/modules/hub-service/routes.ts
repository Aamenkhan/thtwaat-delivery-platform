import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../lib/db.js'
import { jsonError, jsonOk } from '../../lib/http.js'
import { publicApiKeyMiddleware } from '../../middleware/public-api-key.js'
import { recordOutboxAndEmit } from '../notify-service/outbox.js'

const hubBody = z.object({
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().optional(),
})

export const hubRoutes = new Hono()

hubRoutes.use('/*', publicApiKeyMiddleware)

hubRoutes.post('/', async (c) => {
  const parsed = hubBody.safeParse(await c.req.json())
  if (!parsed.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, parsed.error)
  }

  const hub = await prisma.hub.create({ data: parsed.data })
  return jsonOk(c, { hub })
})

hubRoutes.get('/', async (c) => {
  const hubs = await prisma.hub.findMany({ orderBy: { name: 'asc' } })
  return jsonOk(c, { hubs })
})

const assignBody = z.object({
  orderPublicId: z.string().min(1),
  hubId: z.string().min(1),
})

hubRoutes.post('/assign', async (c) => {
  const parsed = assignBody.safeParse(await c.req.json())
  if (!parsed.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, parsed.error)
  }

  const hub = await prisma.hub.findUnique({
    where: { id: parsed.data.hubId },
  })
  if (!hub) {
    return jsonError(c, 'not_found', 'Hub not found', 404)
  }

  const order = await prisma.order.update({
    where: { publicId: parsed.data.orderPublicId },
    data: {
      hubId: hub.id,
      status: 'AT_HUB',
    },
  })

  await recordOutboxAndEmit({
    type: 'hub.assigned',
    payload: {
      orderId: order.id,
      publicId: order.publicId,
      hubId: hub.id,
      hubName: hub.name,
    },
  })

  return jsonOk(c, { order })
})

hubRoutes.get('/dashboard/summary', async (c) => {
  const hubId = c.get('apiKey').hubId
  if (!hubId) {
    return jsonError(
      c,
      'forbidden',
      'Hub-scoped API key required',
      403
    )
  }

  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const inboundToday = await prisma.parcelScan.count({
    where: {
      hubId,
      scanType: 'hub_inbound',
      createdAt: { gte: start },
    },
  })

  const outboundToday = await prisma.parcelScan.count({
    where: {
      hubId,
      scanType: 'hub_outbound',
      createdAt: { gte: start },
    },
  })

  return jsonOk(c, {
    summary: {
      hubId,
      inboundToday,
      outboundToday,
      exceptions: 0,
    },
  })
})
