import type { Prisma } from '@prisma/client'
import type { WebhookEventType } from '@repo/types'
import { prisma } from '../../lib/db.js'
import { getSocketServer } from '../../lib/socket-registry.js'

export async function recordOutboxAndEmit(event: {
  type: WebhookEventType
  payload: Record<string, unknown>
}) {
  const row = await prisma.outboxEvent.create({
    data: {
      type: event.type,
      payload: event.payload as Prisma.InputJsonValue,
    },
  })

  const io = getSocketServer()
  io?.emit('platform:event', { id: row.id, ...event })

  const redisUrl = process.env.REDIS_URL
  if (redisUrl) {
    const { getRedis } = await import('../../lib/redis.js')
    const r = getRedis()
    await r?.lpush(
      'notify:webhooks',
      JSON.stringify({ id: row.id, type: event.type, payload: event.payload })
    )
  }

  return row
}
