import { createHmac, timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../lib/db.js'
import { jsonError, jsonOk } from '../../lib/http.js'
import { publicApiKeyMiddleware } from '../../middleware/public-api-key.js'

const webhookBody = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
})

export const notifyRoutes = new Hono()

notifyRoutes.use('/*', publicApiKeyMiddleware)

notifyRoutes.post('/webhooks', async (c) => {
  const parsed = webhookBody.safeParse(await c.req.json())
  if (!parsed.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, parsed.error)
  }

  const secret =
    process.env.WEBHOOK_SIGNING_SECRET ?? 'whsec_dev_change_in_production'
  const row = await prisma.webhookSubscription.create({
    data: {
      url: parsed.data.url,
      secret,
      events: parsed.data.events,
    },
  })

  return jsonOk(c, { subscription: { id: row.id, url: row.url, events: row.events } })
})

notifyRoutes.get('/webhooks', async (c) => {
  const rows = await prisma.webhookSubscription.findMany({
    where: { active: true },
    select: { id: true, url: true, events: true, createdAt: true },
  })
  return jsonOk(c, { webhooks: rows })
})

/**
 * Internal: verify Hono webhook delivery signatures (stub for worker).
 */
export function verifyWebhookSignature(args: {
  secret: string
  body: string
  signature: string
}): boolean {
  const expected = createHmac('sha256', args.secret)
    .update(args.body)
    .digest('hex')
  const sig = args.signature.replace(/^sha256=/, '')
  try {
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(sig, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
