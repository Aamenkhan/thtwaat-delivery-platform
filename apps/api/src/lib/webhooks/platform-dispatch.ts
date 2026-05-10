import { createHmac } from 'node:crypto'
import { prisma } from '../prisma.js'
import { withRetry } from '../retry.js'
import type { PlatformWebhookEvent } from './platform-events.js'

function sign(secret: string, body: string) {
  return createHmac('sha256', secret).update(body).digest('hex')
}

export async function dispatchPlatformWebhook(args: {
  event: PlatformWebhookEvent
  orderId: string
  publicId: string
  sellerId: string
  status: string
  payload?: Record<string, unknown>
}) {
  const subs = await prisma.sellerWebhookSubscription.findMany({
    where: {
      sellerId: args.sellerId,
      active: true,
      events: { has: args.event },
    },
  })

  const body = JSON.stringify({
    event: args.event,
    orderId: args.orderId,
    publicId: args.publicId,
    status: args.status,
    timestamp: new Date().toISOString(),
    ...(args.payload ?? {}),
  })

  for (const s of subs) {
    const sig = sign(s.secret, body)
    try {
      const statusCode = await withRetry(
        async () => {
          const res = await fetch(s.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Logistics-Signature': `sha256=${sig}`,
              'X-Logistics-Event': args.event,
            },
            body,
          })
          if (!res.ok) {
            throw new Error(`Webhook HTTP ${res.status}`)
          }
          return res.status
        },
        { maxAttempts: 4, baseDelayMs: 500 }
      )
      await prisma.webhookDeliveryLog.create({
        data: {
          subscriptionId: s.id,
          event: args.event,
          url: s.url,
          statusCode,
          attempt: 1,
        },
      })
    } catch (e) {
      await prisma.webhookDeliveryLog.create({
        data: {
          subscriptionId: s.id,
          event: args.event,
          url: s.url,
          attempt: 4,
          error: e instanceof Error ? e.message : 'unknown',
        },
      })
    }
  }
}
