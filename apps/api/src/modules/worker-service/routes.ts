import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../lib/db.js'
import { getRedis } from '../../lib/redis.js'
import { jsonError, jsonOk } from '../../lib/http.js'
import { publicApiKeyMiddleware } from '../../middleware/public-api-key.js'
import { recordOutboxAndEmit } from '../notify-service/outbox.js'

const assignBody = z.object({
  orderPublicId: z.string().min(1),
  workerId: z.string().min(1),
})

export const workerRoutes = new Hono()

workerRoutes.use('/*', publicApiKeyMiddleware)

workerRoutes.post('/assign', async (c) => {
  const parsed = assignBody.safeParse(await c.req.json())
  if (!parsed.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, parsed.error)
  }

  const order = await prisma.order.findUnique({
    where: { publicId: parsed.data.orderPublicId },
  })
  if (!order) {
    return jsonError(c, 'not_found', 'Order not found', 404)
  }

  const assignment = await prisma.workerAssignment.create({
    data: {
      orderId: order.id,
      workerId: parsed.data.workerId,
      status: 'assigned',
    },
  })

  const redis = getRedis()
  await redis?.hset(`worker:assignment:${assignment.id}`, {
    orderId: order.id,
    workerId: parsed.data.workerId,
  })

  await recordOutboxAndEmit({
    type: 'worker.assigned',
    payload: {
      assignmentId: assignment.id,
      orderId: order.id,
      publicId: order.publicId,
      workerId: parsed.data.workerId,
    },
  })

  return jsonOk(c, { assignment })
})
