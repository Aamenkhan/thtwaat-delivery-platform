import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { domainEvents } from './events.js'
import { verifyAccessToken } from './jwt.js'
import { verifyWorkerJwt } from './worker-jwt.js'
import { resolveCorsOrigin } from './cors-origins.js'

let io: Server | null = null

export function getIo(): Server | null {
  return io
}

function resolveSocketOrigins(): string[] | boolean {
  const extra = [
    process.env.WORKER_WEB_URL,
    process.env.ADMIN_WEB_URL,
    process.env.SELLER_WEB_URL,
    'https://worker-web.vercel.app',
    'https://admin-web.vercel.app',
    'https://seller-web.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
  ]
    .map((s) => s?.trim())
    .filter(Boolean) as string[]
  const base = resolveCorsOrigin()
  if (base === true) return true
  if (Array.isArray(base)) return [...new Set([...base, ...extra])]
  return extra
}

function extractBearerToken(socket: {
  handshake: {
    auth: unknown
    headers: { authorization?: string }
  }
}): string | undefined {
  const auth = socket.handshake.auth as { token?: string } | undefined
  if (typeof auth?.token === 'string' && auth.token.length > 0) {
    return auth.token
  }
  const h = socket.handshake.headers.authorization
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7).trim()
  return undefined
}

export function initRealtimeServer(httpServer: HttpServer) {
  if (io) return
  const requireSocketAuth = process.env.SOCKET_REQUIRE_AUTH === '1'

  io = new Server(httpServer, {
    cors: {
      origin: resolveSocketOrigins(),
      methods: ['GET', 'POST'],
    },
  })

  io.use((socket, next) => {
    const token = extractBearerToken(socket)
    if (!token) {
      if (requireSocketAuth) {
        next(new Error('Unauthorized'))
        return
      }
      next()
      return
    }
    try {
      const payload = verifyAccessToken(token)
      socket.data.userId = payload.sub
      socket.data.role = payload.role
      void socket.join(`user:${payload.sub}`)
      next()
    } catch {
      try {
        const w = verifyWorkerJwt(token)
        socket.data.workerId = w.sub
        socket.data.role = w.role
        if (w.hubId) void socket.join(`hub:${w.hubId}`)
        next()
      } catch {
        next(new Error('Unauthorized'))
      }
    }
  })

  io.on('connection', (socket) => {
    socket.on('subscribe:order', (publicId: unknown) => {
      if (typeof publicId === 'string' && publicId.length > 0) {
        void socket.join(`order:${publicId}`)
      }
    })
    socket.on('subscribe:hub', (hubId: unknown) => {
      if (typeof hubId === 'string' && hubId.length > 0) {
        void socket.join(`hub:${hubId}`)
      }
    })
    socket.on('subscribe:seller', (sellerId: unknown) => {
      if (typeof sellerId === 'string' && sellerId.length > 0) {
        void socket.join(`seller:${sellerId}`)
      }
    })
    socket.on('subscribe:customer', (customerId: unknown) => {
      if (typeof customerId === 'string' && customerId.length > 0) {
        void socket.join(`customer:${customerId}`)
      }
    })
  })

  domainEvents.on('order:status:changed', (p) => {
    io?.to(`order:${p.publicId}`).emit('order:status', p)
  })

  domainEvents.on('order:tracking:updated', (p) => {
    io?.to(`order:${p.publicId}`).emit('order:tracking', p)
  })
}
