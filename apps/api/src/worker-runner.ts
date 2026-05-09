import type { Redis } from 'ioredis'
import { getRedis } from './lib/redis.js'
import { drainOneJob } from './modules/worker-service/queue.js'

function requireRedis(): Redis {
  const r = getRedis()
  if (!r) {
    console.error('REDIS_URL is not set; worker idle.')
    throw new Error('REDIS_URL is required for worker-runner')
  }
  return r
}

const redis = requireRedis()

console.log('worker-service consumer started')

async function loop() {
  for (;;) {
    const job = await drainOneJob(redis, 10)
    if (job) {
      console.log('[worker] job', job)
    }
  }
}

loop().catch((err) => {
  console.error(err)
  process.exit(1)
})
