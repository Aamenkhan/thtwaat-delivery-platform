import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../lib/db.js'
import { jsonError, jsonOk } from '../../lib/http.js'
import { publicApiKeyMiddleware } from '../../middleware/public-api-key.js'
import { recordOutboxAndEmit } from '../notify-service/outbox.js'

const payoutBody = z.object({
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).default('USD'),
  reference: z.string().optional(),
})

export const payoutRoutes = new Hono()

payoutRoutes.use('/*', publicApiKeyMiddleware)

payoutRoutes.post('/', async (c) => {
  const parsed = payoutBody.safeParse(await c.req.json())
  if (!parsed.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, parsed.error)
  }

  const sellerId = c.get('apiKey').sellerId
  if (!sellerId) {
    return jsonError(
      c,
      'forbidden',
      'Seller-scoped API key required',
      403
    )
  }

  const payout = await prisma.payout.create({
    data: {
      sellerId,
      amountCents: parsed.data.amountCents,
      currency: parsed.data.currency,
      status: 'completed',
      reference: parsed.data.reference,
    },
  })

  await recordOutboxAndEmit({
    type: 'payout.completed',
    payload: {
      payoutId: payout.id,
      sellerId: payout.sellerId,
      amountCents: payout.amountCents,
      currency: payout.currency,
    },
  })

  return jsonOk(c, { payout })
})

payoutRoutes.get('/', async (c) => {
  const sellerId = c.get('apiKey').sellerId
  if (!sellerId) {
    return jsonError(
      c,
      'forbidden',
      'Seller-scoped API key required',
      403
    )
  }

  const payouts = await prisma.payout.findMany({
    where: { sellerId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return jsonOk(c, { payouts })
})
