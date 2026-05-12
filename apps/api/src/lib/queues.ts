import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

let connection: Redis | null = null

function getBullConnection(): Redis | null {
  const url = process.env.REDIS_URL?.trim()
  if (!url) return null
  if (/^(disabled|off|none|skip|no)$/i.test(url)) return null
  if (/^\/\/(disabled|off|none|skip|no)(:|$)/i.test(url.replace(/^redis:/, ''))) return null
  if (!connection) {
    connection = new Redis(url, { maxRetriesPerRequest: null })
  }
  return connection
}

/** Logistics jobs (labels, webhooks, heavy pricing). Lazy — no-op if Redis missing. */
export function getLogisticsQueue(): Queue | null {
  const conn = getBullConnection()
  if (!conn) return null
  return new Queue('logistics', { connection: conn })
}
