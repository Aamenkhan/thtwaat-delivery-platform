import type { Redis } from 'ioredis'
import { getRedis } from '../../lib/redis.js'

const QUEUE_KEY = 'worker:jobs'

export type WorkerJob = {
  type: 'deliver_photo_reminder' | 'reconcile_assignment'
  payload: Record<string, unknown>
}

export async function enqueueWorkerJob(job: WorkerJob): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  await redis.lpush(QUEUE_KEY, JSON.stringify(job))
}

/**
 * Blocking consumer stub for production workers (BullMQ / separate process).
 */
export async function drainOneJob(
  redis: Redis,
  timeoutSec = 5
): Promise<WorkerJob | null> {
  const res = await redis.brpop(QUEUE_KEY, timeoutSec)
  if (!res) return null
  const [, raw] = res
  return JSON.parse(raw) as WorkerJob
}
