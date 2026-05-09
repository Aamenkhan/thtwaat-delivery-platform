import { Redis } from 'ioredis'

let client: Redis | null = null

export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url) {
    return null
  }
  if (!client) {
    client = new Redis(url, { maxRetriesPerRequest: null })
  }
  return client
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit()
    client = null
  }
}
