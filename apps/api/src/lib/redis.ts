import { Redis } from 'ioredis'

let client: Redis | null = null

export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL?.trim()
  if (!url) return null
  if (/^(disabled|off|none|skip|no)$/i.test(url)) return null
  if (!client) {
    client = new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: true })
  }
  return client
}

export async function pingRedis(): Promise<boolean> {
  try {
    const r = getRedis()
    if (!r) return false
    const p = await r.ping()
    return p === 'PONG'
  } catch {
    return false
  }
}
