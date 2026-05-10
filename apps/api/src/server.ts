import './load-env.js'
import http from 'node:http'
import { createApp } from './app.js'
import { initRealtimeServer } from './lib/realtime.js'
import { prisma } from './lib/prisma.js'

const port = Number(process.env.PORT) || 4000
const app = createApp()
const server = http.createServer(app)

initRealtimeServer(server)

function requireEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) {
    console.error(`[startup] FATAL: ${name} is required`)
    process.exit(1)
  }
  return v
}

async function start() {
  requireEnv('DATABASE_URL')
  requireEnv('JWT_SECRET')

  try {
    await prisma.$connect()
    console.log('[startup] Prisma database connection OK')
  } catch (e) {
    console.error('[startup] Prisma $connect failed — fix DATABASE_URL / network / SSL:', e)
    process.exit(1)
  }

  server.listen(port, () => {
    const publicUrl = process.env.RENDER_EXTERNAL_URL?.trim()
    console.log(
      `[startup] API + Socket.IO listening on port ${port}` +
        (publicUrl ? ` (public URL ${publicUrl})` : '')
    )
  })
}

void start()
