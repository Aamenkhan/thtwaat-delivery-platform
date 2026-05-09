import type { Prisma } from '@prisma/client'
import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../lib/db.js'
import { jsonError, jsonOk } from '../../lib/http.js'
import { publicApiKeyMiddleware } from '../../middleware/public-api-key.js'
import { recordOutboxAndEmit } from '../notify-service/outbox.js'

const scanBody = z.object({
  qrPayload: z.string().min(1),
  scanType: z.enum([
    'hub_inbound',
    'hub_outbound',
    'pickup',
    'delivery_attempt',
  ]),
  hubId: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
})

export const scanRoutes = new Hono()

scanRoutes.use('/*', publicApiKeyMiddleware)

scanRoutes.post('/', async (c) => {
  const parsed = scanBody.safeParse(await c.req.json())
  if (!parsed.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, parsed.error)
  }

  const order = await prisma.order.findUnique({
    where: { qrPayload: parsed.data.qrPayload },
  })
  if (!order) {
    return jsonError(c, 'not_found', 'Unknown QR / order', 404)
  }

  const scan = await prisma.parcelScan.create({
    data: {
      orderId: order.id,
      hubId: parsed.data.hubId,
      scanType: parsed.data.scanType,
      meta: (parsed.data.meta ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
    },
  })

  await recordOutboxAndEmit({
    type: 'scan.recorded',
    payload: {
      scanId: scan.id,
      orderId: order.id,
      publicId: order.publicId,
      scanType: scan.scanType,
    },
  })

  return jsonOk(c, { scan, orderPublicId: order.publicId })
})
